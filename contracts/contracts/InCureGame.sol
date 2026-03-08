// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./ChemicalInventory.sol";
import "./IncureToken.sol";

/// @title IDataStreams - Interface for Somnia Data Streams contract
interface IDataStreams {
    struct DataStream {
        bytes32 id;
        bytes32 schemaId;
        bytes data;
    }

    /// @notice Publish data to streams (esstores function)
    /// @param streams Array of data streams to publish
    function esstores(DataStream[] calldata streams) external;
}

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
    
    // ── DATA STREAMS ───────────────────────────────────────────────────────────
    // Somnia Data Streams contract address: 0xB1Ae08D3d1542eF9971A63Aede2dB8d0239c78d4
    IDataStreams public immutable dataStreams;
    
    // Schema IDs (computed from schema strings, set in constructor)
    // Schema: "uint64 timestamp, uint8 regionId, uint8 infectionPct"
    bytes32 public immutable regionInfectionSchemaId;
    
    // Schema: "uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success"
    bytes32 public immutable antidoteDeploymentSchemaId;
    
    // Schema: "uint64 timestamp, uint8 newStrain"
    bytes32 public immutable mutationSchemaId;
    
    // Schema: "uint64 timestamp, uint8 season, uint8[20] regionInfections"
    bytes32 public immutable gameStateSchemaId;
    
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
        address _trustedOracle,
        address _dataStreams,
        bytes32 _regionInfectionSchemaId,
        bytes32 _antidoteDeploymentSchemaId,
        bytes32 _mutationSchemaId,
        bytes32 _gameStateSchemaId
    ) Ownable(msg.sender) {
        require(
            _chemicalInventory != address(0) && 
            _incureToken != address(0) && 
            _trustedOracle != address(0) &&
            _dataStreams != address(0),
            "Invalid addresses"
        );
        chemicalInventory = ChemicalInventory(payable(_chemicalInventory));
        incureToken = IncureToken(_incureToken);
        trustedOracle = _trustedOracle;
        dataStreams = IDataStreams(_dataStreams);
        
        // Set schema IDs (computed off-chain using SDK)
        regionInfectionSchemaId = _regionInfectionSchemaId;
        antidoteDeploymentSchemaId = _antidoteDeploymentSchemaId;
        mutationSchemaId = _mutationSchemaId;
        gameStateSchemaId = _gameStateSchemaId;
        
        currentStrain = 1;
        currentSeason = 1;
        lastMutationTime = block.timestamp;
        lastSpreadTime   = block.timestamp;
        lastFormulaRotation = block.timestamp;
        
        // Initialize formula seed with deployment randomness
        formulaSeed = keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender));

        _initializeRegions();
        
        // Publish initial game state to Data Streams
        _publishGameState();
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
        
        // Publish to Data Streams
        _publishAntidoteDeployment(msg.sender, regionId, cureEffect, success);
        
        // Publish updated region infection
        _publishRegionInfection(regionId, regionInfection[regionId]);
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
        
        // Publish all updated regions to Data Streams
        for (uint256 i = 0; i < affectedRegions.length; i++) {
            if (affectedRegions[i] > 0 || newPcts[i] > 0) {
                _publishRegionInfection(affectedRegions[i], newPcts[i]);
            }
        }
    }
    
    function triggerMutation() external {
        require(block.timestamp >= lastMutationTime + MUTATION_INTERVAL, "Too soon");
        currentStrain++;
        lastMutationTime = block.timestamp;
        
        // Formula derivation now happens off-chain from formulaSeed
        // No need to store formulas on-chain
        emit PathogenMutated(currentStrain);
        
        // Publish to Data Streams
        _publishMutation(currentStrain);
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
        
        // Publish new game state after season reset
        _publishGameState();
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
    
    // ── DATA STREAMS HELPERS ────────────────────────────────────────────────────
    
    /// @notice Encode region infection data according to schema
    /// Schema: "uint64 timestamp, uint8 regionId, uint8 infectionPct"
    function _encodeRegionInfection(uint8 regionId, uint8 infectionPct) internal view returns (bytes memory) {
        return abi.encodePacked(
            uint64(block.timestamp),  // uint64 (8 bytes)
            uint256(regionId),         // uint8 padded to uint256 (32 bytes)
            uint256(infectionPct)      // uint8 padded to uint256 (32 bytes)
        );
    }
    
    /// @notice Encode antidote deployment data according to schema
    /// Schema: "uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success"
    function _encodeAntidoteDeployment(
        address player,
        uint8 regionId,
        uint8 cureEffect,
        bool success
    ) internal view returns (bytes memory) {
        return abi.encodePacked(
            uint64(block.timestamp),           // uint64 (8 bytes)
            uint256(uint160(player)),          // address (20 bytes, padded to 32)
            uint256(regionId),                 // uint8 padded to uint256 (32 bytes)
            uint256(cureEffect),               // uint8 padded to uint256 (32 bytes)
            success ? uint256(1) : uint256(0)  // bool padded to uint256 (32 bytes)
        );
    }
    
    /// @notice Encode mutation data according to schema
    /// Schema: "uint64 timestamp, uint8 newStrain"
    function _encodeMutation(uint8 newStrain) internal view returns (bytes memory) {
        return abi.encodePacked(
            uint64(block.timestamp),  // uint64 (8 bytes)
            uint256(newStrain)         // uint8 padded to uint256 (32 bytes)
        );
    }
    
    /// @notice Encode full game state according to schema
    /// Schema: "uint64 timestamp, uint8 season, uint8[20] regionInfections"
    function _encodeGameState() internal view returns (bytes memory) {
        bytes memory data = abi.encodePacked(
            uint64(block.timestamp),  // uint64 (8 bytes)
            uint256(currentSeason)    // uint8 padded to uint256 (32 bytes)
        );
        
        // Append all 20 region infections (each padded to uint256)
        for (uint8 i = 0; i < 20; i++) {
            data = abi.encodePacked(data, uint256(regionInfection[i]));
        }
        
        return data;
    }
    
    /// @notice Generate deterministic data ID for region infection
    function _generateRegionInfectionId(uint8 regionId) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), "region", regionId, block.timestamp));
    }
    
    /// @notice Generate deterministic data ID for antidote deployment
    function _generateAntidoteDeploymentId(address player, uint8 regionId) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), "antidote", player, regionId, block.timestamp));
    }
    
    /// @notice Generate deterministic data ID for mutation
    function _generateMutationId() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), "mutation", currentStrain, block.timestamp));
    }
    
    /// @notice Generate deterministic data ID for game state
    function _generateGameStateId() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), "gamestate", currentSeason, block.timestamp));
    }
    
    /// @notice Publish region infection update to Data Streams
    function _publishRegionInfection(uint8 regionId, uint8 infectionPct) internal {
        bytes memory data = _encodeRegionInfection(regionId, infectionPct);
        bytes32 dataId = _generateRegionInfectionId(regionId);
        
        IDataStreams.DataStream[] memory streams = new IDataStreams.DataStream[](1);
        streams[0] = IDataStreams.DataStream({
            id: dataId,
            schemaId: regionInfectionSchemaId,
            data: data
        });
        
        // Don't revert on failure - publishing is non-critical
        try dataStreams.esstores(streams) {
            // Success
        } catch {
            // Silently fail - publishing is non-critical
        }
    }
    
    /// @notice Publish antidote deployment to Data Streams
    function _publishAntidoteDeployment(
        address player,
        uint8 regionId,
        uint8 cureEffect,
        bool success
    ) internal {
        bytes memory data = _encodeAntidoteDeployment(player, regionId, cureEffect, success);
        bytes32 dataId = _generateAntidoteDeploymentId(player, regionId);
        
        IDataStreams.DataStream[] memory streams = new IDataStreams.DataStream[](1);
        streams[0] = IDataStreams.DataStream({
            id: dataId,
            schemaId: antidoteDeploymentSchemaId,
            data: data
        });
        
        // Don't revert on failure - publishing is non-critical
        try dataStreams.esstores(streams) {
            // Success
        } catch {
            // Silently fail - publishing is non-critical
        }
    }
    
    /// @notice Publish mutation to Data Streams
    function _publishMutation(uint8 newStrain) internal {
        bytes memory data = _encodeMutation(newStrain);
        bytes32 dataId = _generateMutationId();
        
        IDataStreams.DataStream[] memory streams = new IDataStreams.DataStream[](1);
        streams[0] = IDataStreams.DataStream({
            id: dataId,
            schemaId: mutationSchemaId,
            data: data
        });
        
        // Don't revert on failure - publishing is non-critical
        try dataStreams.esstores(streams) {
            // Success
        } catch {
            // Silently fail - publishing is non-critical
        }
    }
    
    /// @notice Publish full game state to Data Streams
    function _publishGameState() internal {
        bytes memory data = _encodeGameState();
        bytes32 dataId = _generateGameStateId();
        
        IDataStreams.DataStream[] memory streams = new IDataStreams.DataStream[](1);
        streams[0] = IDataStreams.DataStream({
            id: dataId,
            schemaId: gameStateSchemaId,
            data: data
        });
        
        // Don't revert on failure - publishing is non-critical
        try dataStreams.esstores(streams) {
            // Success
        } catch {
            // Silently fail - publishing is non-critical
        }
    }
}
