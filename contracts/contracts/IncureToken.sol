// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IncureToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant INITIAL_EMISSION_RATE = 100e18;
    uint256 public constant HALVING_INTERVAL = 7 days;
    uint256 public constant MAX_SUPPLY = 270_000_000e18; // 270 million tokens

    uint256 public deploymentTime;
    address public gameContract;

    constructor(address deployer) ERC20("InCure Token", "INCURE") Ownable(msg.sender) {
        require(deployer != address(0), "Invalid deployer address");
        deploymentTime = block.timestamp;

        // 270,000,000 x 20% = 54,000,000 $INCURE to deployer for liquidity
        _mint(deployer, MAX_SUPPLY * 20 / 100);
    }

    function setGameContract(address _gameContract) external onlyOwner {
        require(_gameContract != address(0), "Invalid address");
        gameContract = _gameContract;
    }

    function currentEmissionRate() public view returns (uint256) {
        uint256 elapsed = block.timestamp - deploymentTime;
        uint256 halvingCount = elapsed / HALVING_INTERVAL;
        if (halvingCount >= 20) return 0;
        return INITIAL_EMISSION_RATE >> halvingCount;
    }

    function mint(address to, uint8 cureEffect) external {
        require(msg.sender == gameContract, "Only game contract");
        require(cureEffect > 0 && cureEffect <= 100, "Invalid cure effect");

        uint256 reward = (currentEmissionRate() * cureEffect) / 100;

        // Remaining 216m available for gameplay emission
        uint256 currentSupply = totalSupply();
        if (currentSupply + reward > MAX_SUPPLY) {
            reward = MAX_SUPPLY - currentSupply;
        }

        if (reward > 0) {
            _mint(to, reward);
        }
    }
}
