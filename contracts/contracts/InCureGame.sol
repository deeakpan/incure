// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./ChemicalInventory.sol";
import "./IncureToken.sol";

contract InCureGame is Ownable, ReentrancyGuard {

    // ── REGION STATE ────────────────────────────────────────────────────────
    // 20 regions mapped to ISO codes on the frontend:
    // 0=US 1=CA 2=BR 3=AR 4=GB 5=FR 6=DE 7=RU 8=CN 9=IN
    // 10=AU 11=JP 12=NG 13=ZA 14=EG 15=SA 16=PK 17=ID 18=TR 19=MX
    // ───────────────────────────────────────────────────────────────────────
    mapping(uint8 => uint8) public regionInfection;
    
    uint8 public currentStrain;
    uint8 public currentSeason;
    uint256 public lastMutationTime;
    uint256 public lastSpreadTime;
    
    uint256 public constant SPREAD_INTERVAL  = 5 minutes;
    uint256 public constant MUTATION_INTERVAL = 7 days;
    uint256 public constant MAX_CURE_PER_DEPLOY = 50;
    uint256 public constant DEPLOY_COOLDOWN  = 30 seconds;
    uint256 public constant FORMULA_ROTATION = 24 hours;

    // Formula seed rotates every 24 hours - backend derives formulas from this
    bytes32 public formulaSeed;
    uint256 public lastFormulaRotation;

    // Trusted oracle address (backend wallet) for signature verification
    address public trustedOracle;

    mapping(address => uint256) public lastDeployTime;
    mapping(address => bool)    public hasStarterKit;

    // Credibility: increases on success, decreases on fail, min 0
    mapping(address => uint256) public credibility;

    // Nonce per player to prevent signature replay attacks
    mapping(address => uint256) public nonces;
    
    ChemicalInventory public chemicalInventory;
    IncureToken        public incureToken;
    
    event AntidoteDeployed(address indexed player, uint8 regionId, uint8 cureEffect, bool success);
    event InfectionSpread(uint8[] regionIds, uint8[] newPcts);
    event PathogenMutated(uint8 newStrain);
    event StarterKitClaimed(address indexed player);
    event FieldLabUpgraded(address indexed player, uint8 newSlotCount, uint256 cost);
    event SeasonReset(uint8 newSeason);
    event FormulaRotated(bytes32 newSeed);
    
    constructor(
        address _chemicalInventory,
        address _incureToken,
        address _trustedOracle
    ) Ownable(msg.sender) {
        require(
            _chemicalInventory != address(0) && 
            _incureToken != address(0) && 
            _trustedOracle != address(0),
            "Invalid addresses"
        );
        chemicalInventory = ChemicalInventory(payable(_chemicalInventory));
        incureToken = IncureToken(_incureToken);
        trustedOracle = _trustedOracle;
        
        currentStrain = 1;
        currentSeason = 1;
        lastMutationTime = block.timestamp;
        lastSpreadTime   = block.timestamp;
        lastFormulaRotation = block.timestamp;
        
        // Initialize formula seed with deployment randomness
        formulaSeed = keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender));

        _initializeRegions();
    }
    
    function _initializeRegions() internal {
        uint8[15] memory infected = [0,1,2,4,5,6,7,8,9,10,12,13,16,17,19];
        uint8[15] memory values   = [45,32,78,56,67,43,89,64,52,28,71,59,82,46,41];
        for (uint256 i = 0; i < 15; i++) {
            regionInfection[infected[i]] = values[i];
        }
        // Regions 3,11,14,15,18 start at 0
    }
    
    function claimStarterKit() external {
        require(!hasStarterKit[msg.sender], "Already claimed");
        hasStarterKit[msg.sender] = true;
        chemicalInventory.mintStarter(msg.sender);
        emit StarterKitClaimed(msg.sender);
    }
    
    function deployAntidote(
        uint8 regionId,
        uint8[3] calldata chemIds,
        uint8[3] calldata ratios,
        uint8 cureEffect,
        bool success,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        require(regionId < 20, "Invalid region");
        require(ratios[0] + ratios[1] + ratios[2] == 100, "Ratios must sum to 100");
        require(regionInfection[regionId] > 0, "Region already cured");
        require(block.timestamp >= lastDeployTime[msg.sender] + DEPLOY_COOLDOWN, "Cooldown active");
        require(cureEffect <= 100, "Invalid cure effect");
        require(nonce == nonces[msg.sender], "Invalid nonce");

        for (uint256 i = 0; i < 3; i++) {
            require(chemIds[i] >= 1 && chemIds[i] <= 15, "Invalid chemical ID");
        }
        require(
            chemIds[0] != chemIds[1] && chemIds[1] != chemIds[2] && chemIds[0] != chemIds[2],
            "Duplicate chemicals"
        );

        // Verify signature from backend oracle
        // Message includes player, regionId, cureEffect, success, and nonce
        bytes32 message = keccak256(abi.encodePacked(msg.sender, regionId, cureEffect, success, nonce));
        bytes32 ethSignedMessage = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(ethSignedMessage, signature);
        require(signer == trustedOracle, "Invalid signature");

        // Increment nonce to prevent replay attacks
        nonces[msg.sender]++;

        lastDeployTime[msg.sender] = block.timestamp;

        // Burn chemicals immediately
        uint256[] memory ids     = new uint256[](3);
        uint256[] memory amounts = new uint256[](3);
        ids[0] = chemIds[0]; ids[1] = chemIds[1]; ids[2] = chemIds[2];
        amounts[0] = 1; amounts[1] = 1; amounts[2] = 1;

        chemicalInventory.burnBatch(msg.sender, ids, amounts);
        
        // Apply result immediately
        if (success) {
            uint8 reduction = cureEffect > uint8(MAX_CURE_PER_DEPLOY)
                ? uint8(MAX_CURE_PER_DEPLOY)
                : cureEffect;
            
            if (regionInfection[regionId] > reduction) {
                regionInfection[regionId] -= reduction;
            } else {
                regionInfection[regionId] = 0;
            }
            
            incureToken.mint(msg.sender, cureEffect);

            // Credibility up on success
            credibility[msg.sender] += 10;

        } else {
            // Failed deploy increases infection by 5-15%
            uint8 increase = uint8(
                uint256(keccak256(abi.encodePacked(block.prevrandao, msg.sender, block.timestamp))) % 11
            ) + 5;

            if (uint16(regionInfection[regionId]) + uint16(increase) > 100) {
                regionInfection[regionId] = 100;
            } else {
                regionInfection[regionId] += increase;
            }

            // Credibility down on fail, floor at 0
            if (credibility[msg.sender] >= 5) {
                credibility[msg.sender] -= 5;
            } else {
                credibility[msg.sender] = 0;
            }
        }
        
        emit AntidoteDeployed(msg.sender, regionId, cureEffect, success);
    }
    
    // Rotate formula seed every 24 hours - anyone can call, backend cron does it
    function rotateFormula() external {
        require(block.timestamp >= lastFormulaRotation + FORMULA_ROTATION, "Too soon");
        lastFormulaRotation = block.timestamp;
                    
        // New seed from previous seed + timestamp + randomness - unpredictable until block is mined
        formulaSeed = keccak256(abi.encodePacked(formulaSeed, block.timestamp, block.prevrandao));
        
        emit FormulaRotated(formulaSeed);
    }
    
    function triggerSpread() external {
        require(block.timestamp >= lastSpreadTime + SPREAD_INTERVAL, "Too soon");
        lastSpreadTime = block.timestamp;
        
        uint8[]   memory affectedRegions = new uint8[](5);
        uint8[]   memory newPcts         = new uint8[](5);
        uint256 seed = uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp)));
        
        for (uint256 i = 0; i < 5; i++) {
            uint8 regionId = uint8((seed + i) % 20);
            if (regionInfection[regionId] < 100) {
                affectedRegions[i] = regionId;
                uint8 increase = uint8((seed + i) % 5) + 1;
                if (uint16(regionInfection[regionId]) + uint16(increase) > 100) {
                    newPcts[i] = 100;
                } else {
                    newPcts[i] = regionInfection[regionId] + increase;
                }
                regionInfection[regionId] = newPcts[i];
            }
        }
        
        emit InfectionSpread(affectedRegions, newPcts);
    }
    
    function triggerMutation() external {
        require(block.timestamp >= lastMutationTime + MUTATION_INTERVAL, "Too soon");
        currentStrain++;
        lastMutationTime = block.timestamp;
        
        // Formula derivation now happens off-chain from formulaSeed
        // No need to store formulas on-chain
        emit PathogenMutated(currentStrain);
    }

    // ── SEASON RESET ────────────────────────────────────────────────────────
    // Called by owner when global infection hits 0% (players win)
    // or when pathogen becomes unbeatable (players lose).
    // Chemical balances and $INCURE balances carry over.
    // Credibility resets to 0 for all players (fresh season).
    // ───────────────────────────────────────────────────────────────────────
    function resetSeason() external onlyOwner {
        currentSeason++;
        currentStrain = 1;
        lastMutationTime = block.timestamp;
        lastSpreadTime   = block.timestamp;

        // Reset formula seed for new season
        formulaSeed = keccak256(abi.encodePacked(block.prevrandao, block.timestamp, currentSeason));
        lastFormulaRotation = block.timestamp;

        // Reinitialize infection values
        _initializeRegions();

        emit SeasonReset(currentSeason);
    }

    function setTrustedOracle(address _trustedOracle) external onlyOwner {
        require(_trustedOracle != address(0), "Invalid address");
        trustedOracle = _trustedOracle;
    }

    function upgradeFieldLabSlots(uint8 additionalSlots) external nonReentrant {
        require(additionalSlots > 0, "Must upgrade at least 1 slot");
        
        (uint8 currentSlots, , ) = chemicalInventory.fieldLabs(msg.sender);
        require(currentSlots > 0, "No field lab");
        require(currentSlots + additionalSlots <= 10, "Max 10 slots");
        
        uint256 totalCost = 0;
        for (uint8 i = 0; i < additionalSlots; i++) {
            uint8 slotNumber = currentSlots + i + 1;
            uint256 slotCost = uint256(slotNumber - 3) * 50e18;
            totalCost += slotCost;
        }
        
        require(incureToken.balanceOf(msg.sender) >= totalCost, "Insufficient $INCURE");
        incureToken.burnFrom(msg.sender, totalCost);
        chemicalInventory.upgradeSlots(msg.sender, additionalSlots);
        
        emit FieldLabUpgraded(msg.sender, currentSlots + additionalSlots, totalCost);
    }
}
