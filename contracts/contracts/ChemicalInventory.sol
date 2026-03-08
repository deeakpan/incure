// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ChemicalInventory is ERC1155, Ownable, ReentrancyGuard {

    // ── CHEMICAL TIERS (15 IDs total) ──────────────────────────────────────
    // IDs 1–7:   Common      No supply cap, harvestable daily
    // IDs 8–11:  Uncommon    5,000,000 cap per ID  (20,000,000 total)
    // IDs 12–15: Rare        1,000,000 cap per ID  (4,000,000 total)
    //
    // Common chemicals:
    //   1 = Willow Bark   2 = Quinine       3 = Iodine
    //   4 = Honey         5 = Garlic        6 = Cinnamon
    //   7 = Pine Resin
    //
    // Uncommon chemicals:
    //   8 = Silver Nitrate   9 = Fermented Malt
    //   10 = Licorice Root   11 = Charcoal
    //
    // Rare chemicals:
    //   12 = Colloidal Gold  13 = Dragon's Blood
    //   14 = Elderberry      15 = Black Lotus
    // ───────────────────────────────────────────────────────────────────────
    
    address public gameContract;
    address public pharmacyContract;
    address public treasury;
    
    struct FieldLab {
        uint8 slots;
        uint256 lastHarvest;
        uint256 stakedAt;
    }
    
    mapping(address => FieldLab) public fieldLabs;
    uint256 public constant FIELD_LAB_STAKE = 0.05 ether;
    uint256 public constant HARVEST_COOLDOWN = 24 hours;
    
    // Supply caps and tracking
    mapping(uint256 => uint256) public maxSupply;
    mapping(uint256 => uint256) public totalMinted;

    event FieldLabPurchased(address indexed player);
    event ChemicalsHarvested(address indexed player, uint256[] ids, uint256[] amounts);

    constructor(address _treasury) ERC1155("") Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;

        // Uncommon caps — 5 million per ID
        maxSupply[8]  = 5_000_000;
        maxSupply[9]  = 5_000_000;
        maxSupply[10] = 5_000_000;
        maxSupply[11] = 5_000_000;

        // Rare caps — 1 million per ID
        maxSupply[12] = 1_000_000;
        maxSupply[13] = 1_000_000;
        maxSupply[14] = 1_000_000;
        maxSupply[15] = 1_000_000;
    }

    modifier onlyGame() {
        require(msg.sender == gameContract, "Only game contract");
        _;
    }

    modifier onlyPharmacy() {
        require(msg.sender == pharmacyContract, "Only pharmacy contract");
        _;
    }

    function setGameContract(address _gameContract) external onlyOwner {
        require(_gameContract != address(0), "Invalid address");
        gameContract = _gameContract;
    }

    function setPharmacyContract(address _pharmacyContract) external onlyOwner {
        require(_pharmacyContract != address(0), "Invalid address");
        pharmacyContract = _pharmacyContract;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    // Owner can raise supply caps, never lower them
    function updateSupplyCap(uint256 chemId, uint256 newCap) external onlyOwner {
        require(chemId >= 8 && chemId <= 15, "Only capped chemicals");
        require(newCap > maxSupply[chemId], "Can only increase cap");
        maxSupply[chemId] = newCap;
    }

    // Starter pack: 3 of each common chemical (IDs 1, 2, 3)
    function mintStarter(address to) external onlyGame {
        uint256[] memory ids = new uint256[](3);
        uint256[] memory amounts = new uint256[](3);
        ids[0] = 1; ids[1] = 2; ids[2] = 3;
        amounts[0] = 3; amounts[1] = 3; amounts[2] = 3;
        _mintBatch(to, ids, amounts, "");
    }

    function burnBatch(
        address from,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external onlyGame {
        _burnBatch(from, ids, amounts);
    }

    function buyFieldLab() external payable nonReentrant {
        require(msg.value == FIELD_LAB_STAKE, "Must pay exactly 0.05 STT");
        require(fieldLabs[msg.sender].slots == 0, "Already has field lab");
        
        // Write state before external call
        fieldLabs[msg.sender] = FieldLab({
            slots: 3,
            lastHarvest: 0,
            stakedAt: block.timestamp
        });

        (bool success, ) = payable(treasury).call{value: FIELD_LAB_STAKE}("");
        require(success, "Failed to send STT to treasury");

        emit FieldLabPurchased(msg.sender);
    }

    function harvest() external nonReentrant {
        FieldLab storage lab = fieldLabs[msg.sender];
        require(lab.slots > 0, "No field lab");
        require(block.timestamp >= lab.lastHarvest + HARVEST_COOLDOWN, "Cooldown active");
        
        lab.lastHarvest = block.timestamp;
        
        uint256[] memory ids = new uint256[](lab.slots);
        uint256[] memory amounts = new uint256[](lab.slots);
        
        uint256 seed = uint256(
            keccak256(abi.encodePacked(block.timestamp, msg.sender, lab.lastHarvest, block.prevrandao))
        );

        // Common IDs 1-7
        uint8[7] memory common = [1, 2, 3, 4, 5, 6, 7];
        // Uncommon IDs 8-11
        uint8[4] memory uncommon = [8, 9, 10, 11];
        // Rare IDs 12-15
        uint8[4] memory rare = [12, 13, 14, 15];
        
        for (uint256 i = 0; i < lab.slots; i++) {
            uint256 roll = uint256(keccak256(abi.encodePacked(seed, i))) % 100;
            uint256 selectedId;
            
            if (roll < 2) {
                // 2% chance rare
                selectedId = rare[(seed + i) % 4];
            } else if (roll < 15) {
                // 13% chance uncommon
                selectedId = uncommon[(seed + i) % 4];
            } else {
                // 85% chance common
                selectedId = common[(seed + i) % 7];
            }
            
            // Check supply cap - if capped and at limit, fall back to common
            if (maxSupply[selectedId] > 0) {
                if (totalMinted[selectedId] >= maxSupply[selectedId]) {
                    // Supply cap reached, use common instead
                    selectedId = common[(seed + i + 1000) % 7];
            } else {
                    // Update totalMinted for capped chemicals
                    totalMinted[selectedId]++;
                }
            }
            
            ids[i] = selectedId;
            amounts[i] = 1;
        }
        
        _mintBatch(msg.sender, ids, amounts, "");
        emit ChemicalsHarvested(msg.sender, ids, amounts);
    }

    function upgradeSlots(address player, uint8 additionalSlots) external onlyGame {
        FieldLab storage lab = fieldLabs[player];
        require(lab.slots > 0, "No field lab");
        require(lab.slots + additionalSlots <= 10, "Max 10 slots");
        lab.slots += additionalSlots;
    }

    function mintForPharmacy(address to, uint8 chemId, uint256 amount) external onlyPharmacy {
        require(chemId >= 1 && chemId <= 15, "Invalid chemical ID");

        // Enforce supply cap for uncommon and rare
        if (maxSupply[chemId] > 0) {
            require(totalMinted[chemId] + amount <= maxSupply[chemId], "Max supply reached");
            totalMinted[chemId] += amount;
        }

        _mint(to, chemId, amount, "");
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
