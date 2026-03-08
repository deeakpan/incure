require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
          evmVersion: "cancun",
        },
      },
    ],
  },
  networks: {
    // Somnia Testnet
    somniaTestnet: {
      url: process.env.SOMNIA_TESTNET_RPC_URL || "https://api.infra.testnet.somnia.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 50312,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "../test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
