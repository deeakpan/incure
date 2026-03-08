/**
 * Compute Schema IDs for InCure Data Streams
 * 
 * Run this script to get the schema IDs that need to be passed to the contract constructor.
 * 
 * Usage: node scripts/compute-schemas.js
 */

const { SDK } = require('@somnia-chain/streams');
const { createPublicClient, http, defineChain } = require('viem');

// Somnia Testnet chain config
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
  const rpcUrl = process.env.RPC_URL || 'https://dream-rpc.somnia.network';
  const dataStreamsAddress = '0xB1Ae08D3d1542eF9971A63Aede2dB8d0239c78d4';
  
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  const sdk = new SDK({ 
    public: publicClient,
    dataStreamsAddress: dataStreamsAddress
  });

  // Define schemas
  const schemas = {
    regionInfection: 'uint64 timestamp, uint8 regionId, uint8 infectionPct',
    antidoteDeployment: 'uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success',
    mutation: 'uint64 timestamp, uint8 newStrain',
    gameState: 'uint64 timestamp, uint8 season, uint8[20] regionInfections',
  };

  console.log('\n📋 Computing Schema IDs for InCure Data Streams...\n');
  console.log(`Data Streams Contract: ${dataStreamsAddress}\n`);

  const schemaIds = {};
  
  for (const [name, schema] of Object.entries(schemas)) {
    try {
      const schemaId = await sdk.streams.computeSchemaId(schema);
      schemaIds[name] = schemaId;
      console.log(`${name}:`);
      console.log(`  Schema: ${schema}`);
      console.log(`  Schema ID: ${schemaId}\n`);
    } catch (error) {
      console.error(`Error computing schema for ${name}:`, error.message);
      // Fallback: compute locally using keccak256
      const { keccak256, toHex, stringToHex } = require('viem');
      const schemaHex = stringToHex(schema);
      const computedId = keccak256(schemaHex);
      schemaIds[name] = computedId;
      console.log(`${name} (computed locally):`);
      console.log(`  Schema: ${schema}`);
      console.log(`  Schema ID: ${computedId}\n`);
    }
  }

  console.log('\n✅ Copy these schema IDs to your deployment script:\n');
  console.log(JSON.stringify(schemaIds, null, 2));
  console.log('\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
