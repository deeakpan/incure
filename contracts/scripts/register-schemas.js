/**
 * Register Data Streams Schemas
 * 
 * Run this AFTER deploying the contract to register schemas on-chain.
 * 
 * Usage: node scripts/register-schemas.js
 */

require('dotenv').config();

const { SDK, zeroBytes32 } = require('@somnia-chain/streams');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { defineChain } = require('viem');

// Somnia Testnet chain config (must match docs)
const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public: { http: ['https://dream-rpc.somnia.network'] },
  },
});

async function main() {
  const rpcUrl = process.env.SOMNIA_TESTNET_RPC_URL || 'https://dream-rpc.somnia.network';
  let privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ Error: PRIVATE_KEY not found in .env');
    console.log('   Add PRIVATE_KEY=... to contracts/.env');
    process.exit(1);
  }

  // Add 0x prefix if missing
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const account = privateKeyToAccount(privateKey);
  
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  // Initialize SDK exactly as shown in docs
  const sdk = new SDK({
    public: publicClient,
    wallet: walletClient
  });

  // Define schemas (must match contract schemas exactly)
  const schemas = [
    {
      schemaName: 'region_infection',
      schema: 'uint64 timestamp, uint8 regionId, uint8 infectionPct',
      parentSchemaId: zeroBytes32
    },
    {
      schemaName: 'antidote_deployment',
      schema: 'uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success',
      parentSchemaId: zeroBytes32
    },
    {
      schemaName: 'mutation',
      schema: 'uint64 timestamp, uint8 newStrain',
      parentSchemaId: zeroBytes32
    },
    {
      schemaName: 'game_state',
      schema: 'uint64 timestamp, uint8 season, uint8[20] regionInfections',
      parentSchemaId: zeroBytes32
    },
  ];

  console.log('\n📋 Registering Data Streams Schemas...\n');
  console.log(`Publisher: ${account.address}\n`);

  try {
    // Debug: Check what's actually available
    console.log('sdk.streams type:', typeof sdk.streams);
    console.log('sdk.streams methods:', sdk.streams ? Object.getOwnPropertyNames(sdk.streams) : 'null');
    console.log('sdk keys:', Object.keys(sdk));
    
    // Try the method - if it doesn't exist, we'll see what does
    if (!sdk.streams || typeof sdk.streams.registerDataSchemas !== 'function') {
      throw new Error(`registerDataSchemas not found. Available on sdk.streams: ${sdk.streams ? Object.keys(sdk.streams).join(', ') : 'sdk.streams is null'}`);
    }
    
    const txHash = await sdk.streams.registerDataSchemas(schemas, true);
    
    if (txHash) {
      console.log('✅ Schema registration transaction:', txHash);
      console.log('⏳ Waiting for confirmation...');
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('✅ Schemas registered in block:', receipt.blockNumber);
    } else {
      console.log('ℹ️  Schemas already registered (or no action needed)');
    }
    
    console.log('\n✅ All schemas registered successfully!');
    console.log('   The contract can now publish data to Data Streams.\n');
  } catch (error) {
    if (String(error).includes('SchemaAlreadyRegistered')) {
      console.log('✅ Schemas already registered');
    } else {
      console.error('❌ Error registering schemas:', error);
      throw error;
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
