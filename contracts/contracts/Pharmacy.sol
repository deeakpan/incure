// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ChemicalInventory.sol";
import "./IncureToken.sol";

contract Pharmacy is Ownable, ReentrancyGuard {
    struct Listing {
        address seller;
        uint8   chemId;
        uint256 quantity;
        uint256 pricePerUnit;
        bool    active;
    }

    ChemicalInventory public chemicalInventory;
    IncureToken        public incureToken;
    address            public treasury;

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId;

    uint256 public constant MIN_PRICE          = 1e18;
    uint256 public constant MAX_PRICE          = 1_000_000e18;
    uint256 public constant MAX_LISTING_QTY    = 100;
    uint256 public constant FEE_BPS            = 500; // 5%

    // Direct pharmacy prices by tier
    // Common (1-7):    10 $INCURE
    // Uncommon (8-11): 50 $INCURE
    // Rare (12-15):    200 $INCURE
    uint256 public constant COMMON_PRICE   = 10e18;
    uint256 public constant UNCOMMON_PRICE = 50e18;
    uint256 public constant RARE_PRICE     = 200e18;

    event ListingCreated(uint256 indexed listingId, address indexed seller, uint8 chemId, uint256 quantity, uint256 pricePerUnit);
    event ListingCancelled(uint256 indexed listingId);
    event ListingPurchased(uint256 indexed listingId, address indexed buyer, uint256 quantity);
    event ChemicalPurchased(address indexed buyer, uint8 chemId, uint256 quantity, uint256 totalPrice);

    constructor(
        address _chemicalInventory,
        address _incureToken,
        address _treasury
    ) Ownable(msg.sender) {
        require(
            _chemicalInventory != address(0) &&
            _incureToken != address(0) &&
            _treasury != address(0),
            "Invalid addresses"
        );
        chemicalInventory = ChemicalInventory(payable(_chemicalInventory));
        incureToken = IncureToken(_incureToken);
        treasury    = _treasury;
    }

    function listForSale(
        uint8   chemId,
        uint256 quantity,
        uint256 pricePerUnit
    ) external nonReentrant {
        require(chemId >= 1 && chemId <= 15, "Invalid chemical ID");
        require(quantity > 0 && quantity <= MAX_LISTING_QTY, "Invalid quantity");
        require(pricePerUnit >= MIN_PRICE && pricePerUnit <= MAX_PRICE, "Invalid price");
        require(chemicalInventory.balanceOf(msg.sender, chemId) >= quantity, "Insufficient balance");

        chemicalInventory.safeTransferFrom(msg.sender, address(this), chemId, quantity, "");

        listings[nextListingId] = Listing({
            seller:       msg.sender,
            chemId:       chemId,
            quantity:     quantity,
            pricePerUnit: pricePerUnit,
            active:       true
        });

        emit ListingCreated(nextListingId, msg.sender, chemId, quantity, pricePerUnit);
        nextListingId++;
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not your listing");
        require(listing.active, "Not active");

        listing.active = false;
        chemicalInventory.safeTransferFrom(address(this), msg.sender, listing.chemId, listing.quantity, "");

        emit ListingCancelled(listingId);
    }

    function buyFromListing(uint256 listingId, uint256 quantity) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(quantity > 0 && quantity <= listing.quantity, "Invalid quantity");
        require(listing.seller != msg.sender, "Cannot buy own listing");

        uint256 totalPrice    = listing.pricePerUnit * quantity;
        uint256 fee           = (totalPrice * FEE_BPS) / 10000;
        uint256 sellerReceives = totalPrice - fee;

        require(incureToken.balanceOf(msg.sender) >= totalPrice, "Insufficient $INCURE");

        // Update state before transfers
        listing.quantity -= quantity;
        if (listing.quantity == 0) listing.active = false;

        incureToken.transferFrom(msg.sender, listing.seller, sellerReceives);
        if (fee > 0) incureToken.transferFrom(msg.sender, treasury, fee);
        chemicalInventory.safeTransferFrom(address(this), msg.sender, listing.chemId, quantity, "");

        emit ListingPurchased(listingId, msg.sender, quantity);
    }

    // Paginated listing fetch — avoids unbounded loop gas issues
    function getActiveListings(uint256 offset, uint256 limit)
        external view
        returns (Listing[] memory result, uint256 total)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active) count++;
        }

        if (offset >= count) return (new Listing[](0), count);
        uint256 resultSize = (offset + limit > count) ? count - offset : limit;

        result = new Listing[](resultSize);
        uint256 found = 0;
        uint256 skipped = 0;

        for (uint256 i = 0; i < nextListingId && found < resultSize; i++) {
            if (listings[i].active) {
                if (skipped < offset) { skipped++; }
                else { result[found] = listings[i]; found++; }
            }
        }

        return (result, count);
    }

    function buyFromPharmacy(uint8 chemId, uint256 quantity) external nonReentrant {
        require(chemId >= 1 && chemId <= 15, "Invalid chemical ID");
        require(quantity > 0 && quantity <= MAX_LISTING_QTY, "Invalid quantity");

        uint256 pricePerUnit;
        if (chemId >= 12) {
            pricePerUnit = RARE_PRICE;
        } else if (chemId >= 8) {
            pricePerUnit = UNCOMMON_PRICE;
        } else {
            pricePerUnit = COMMON_PRICE;
        }

        uint256 totalPrice = pricePerUnit * quantity;
        require(incureToken.balanceOf(msg.sender) >= totalPrice, "Insufficient $INCURE");

        // Burn $INCURE — deflationary sink
        incureToken.burnFrom(msg.sender, totalPrice);
        chemicalInventory.mintForPharmacy(msg.sender, chemId, quantity);

        emit ChemicalPurchased(msg.sender, chemId, quantity, totalPrice);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
