const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "RON");

  // ── TREASURY ADDRESS ──
  // Change this to your actual treasury multisig before mainnet deployment
  // On testnet, deployer address is fine
  const TREASURY_ADDRESS = deployer.address;

  // ── TRUSTED ORACLE ADDRESS ──
  // This is your backend wallet that signs formula evaluation results
  // IMPORTANT: Set this to your backend's wallet address before mainnet
  // On testnet, you can use deployer address, but create a separate wallet for production
  const TRUSTED_ORACLE_ADDRESS = deployer.address; // TODO: Change to backend wallet

  // ── DATA STREAMS ──
  // Somnia Data Streams contract address (same for testnet and mainnet)
  const DATA_STREAMS_ADDRESS = "0xB1Ae08D3d1542eF9971A63Aede2dB8d0239c78d4";
  
  // Schema IDs - Computed using `node scripts/compute-schemas.js`
  const REGION_INFECTION_SCHEMA_ID = "0x137abdabe8e064b2a1799b9d20b9ed6b6eab1da3cd73698ad887945baebbc0b4";
  const ANTIDOTE_DEPLOYMENT_SCHEMA_ID = "0x6384755d2e985e048fde38ae0e02f58047be6458d13ae799e636809f7127eb11";
  const MUTATION_SCHEMA_ID = "0x68fb518b085dc23743b4eb7accc380b15d16be7c9cfc1194739b75406132e97d";
  const GAME_STATE_SCHEMA_ID = "0x6c1cd97255efd890b742ac83af75d41895553e1216d1f18d17fcdfcd1e50f527";

  // 1. Deploy IncureToken
  // Constructor now requires deployer address for initial 20% mint
  console.log("\nDeploying IncureToken...");
  const IncureToken = await ethers.getContractFactory("IncureToken");
  const incureToken = await IncureToken.deploy(deployer.address);
  await incureToken.waitForDeployment();
  const tokenAddress = await incureToken.getAddress();
  console.log("IncureToken deployed to:", tokenAddress);

  // Confirm initial mint landed
  const deployerBalance = await incureToken.balanceOf(deployer.address);
  console.log("Deployer received (liquidity allocation):", ethers.formatEther(deployerBalance), "INCURE");
  console.log("Remaining supply cap for gameplay:", ethers.formatEther(
    await incureToken.MAX_SUPPLY() - deployerBalance
  ), "INCURE");

  // 2. Deploy ChemicalInventory
  // Now requires treasury address in constructor
  console.log("\nDeploying ChemicalInventory...");
  const ChemicalInventory = await ethers.getContractFactory("ChemicalInventory");
  const chemicalInventory = await ChemicalInventory.deploy(TREASURY_ADDRESS);
  await chemicalInventory.waitForDeployment();
  const chemAddress = await chemicalInventory.getAddress();
  console.log("ChemicalInventory deployed to:", chemAddress);

  // 3. Deploy Pharmacy
  // Now requires treasury address as third argument
  console.log("\nDeploying Pharmacy...");
  const Pharmacy = await ethers.getContractFactory("Pharmacy");
  const pharmacy = await Pharmacy.deploy(chemAddress, tokenAddress, TREASURY_ADDRESS);
  await pharmacy.waitForDeployment();
  const pharmacyAddress = await pharmacy.getAddress();
  console.log("Pharmacy deployed to:", pharmacyAddress);

  // 4. Deploy InCureGame
  // Now requires trustedOracle, dataStreams, and schema IDs
  console.log("\nDeploying InCureGame...");
  console.log("⚠️  Make sure you've computed schema IDs first (run: node scripts/compute-schemas.js)");
  const InCureGame = await ethers.getContractFactory("InCureGame");
  const game = await InCureGame.deploy(
    chemAddress,
    tokenAddress,
    TRUSTED_ORACLE_ADDRESS,
    DATA_STREAMS_ADDRESS,
    REGION_INFECTION_SCHEMA_ID,
    ANTIDOTE_DEPLOYMENT_SCHEMA_ID,
    MUTATION_SCHEMA_ID,
    GAME_STATE_SCHEMA_ID
  );
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log("InCureGame deployed to:", gameAddress);
  console.log("Trusted Oracle (backend wallet):", TRUSTED_ORACLE_ADDRESS);
  console.log("Data Streams contract:", DATA_STREAMS_ADDRESS);

  // 5. Wire up contract addresses
  console.log("\nSetting contract permissions...");

  await incureToken.setGameContract(gameAddress);
  console.log("IncureToken: game contract set");

  await chemicalInventory.setGameContract(gameAddress);
  console.log("ChemicalInventory: game contract set");

  await chemicalInventory.setPharmacyContract(pharmacyAddress);
  console.log("ChemicalInventory: pharmacy contract set");

  // 6. Verify emission rate at deployment
  const emissionRate = await incureToken.currentEmissionRate();
  console.log("\nCurrent emission rate:", ethers.formatEther(emissionRate), "INCURE per 1% cured");

  console.log("\n=== Deployment Summary ===");
  console.log("Network:            Ronin Testnet (Saigon)");
  console.log("Deployer:           ", deployer.address);
  console.log("Treasury:           ", TREASURY_ADDRESS);
  console.log("Trusted Oracle:     ", TRUSTED_ORACLE_ADDRESS);
  console.log("IncureToken:        ", tokenAddress);
  console.log("ChemicalInventory:  ", chemAddress);
  console.log("Pharmacy:           ", pharmacyAddress);
  console.log("InCureGame:         ", gameAddress);
  console.log("\n=== Token Allocation ===");
  console.log("Max supply:         270,000,000 INCURE");
  console.log("Deployer (20%):     54,000,000 INCURE  ← use for liquidity pool");
  console.log("Gameplay (80%):     216,000,000 INCURE ← earned through cures");
  console.log("\nSave these addresses in your .env.local file:");
  console.log(`NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_CHEMICAL_CONTRACT_ADDRESS=${chemAddress}`);
  console.log(`NEXT_PUBLIC_PHARMACY_CONTRACT_ADDRESS=${pharmacyAddress}`);
  console.log(`NEXT_PUBLIC_GAME_CONTRACT_ADDRESS=${gameAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });