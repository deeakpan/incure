/**
 * Publish Initial Game State to Data Streams
 * 
 * Run this AFTER registering schemas to publish the initial 15 regions.
 * 
 * Usage: node scripts/publish-initial-state.js
 */

require('dotenv').config();

const { SDK } = require('@somnia-chain/streams');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { defineChain } = require('viem');

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
  const rpcUrl = process.env.SOMNIA_TESTNET_RPC_URL || 'https://dream-rpc.somnia.network';
  const gameAddress = process.env.INCURE_GAME_ADDRESS;
  let privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ Error: PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  if (!gameAddress) {
    console.error('❌ Error: INCURE_GAME_ADDRESS not found in .env');
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

  const sdk = new SDK({ 
    public: publicClient,
    wallet: walletClient
  });

  // Schema IDs (must match deploy script)
  const REGION_INFECTION_SCHEMA_ID = "0x137abdabe8e064b2a1799b9d20b9ed6b6eab1da3cd73698ad887945baebbc0b4";
  const GAME_STATE_SCHEMA_ID = "0x6c1cd97255efd890b742ac83af75d41895553e1216d1f18d17fcdfcd1e50f527";

  // Read current state from contract
  const GAME_ABI = [
    {
      type: 'function',
      name: 'regionInfection',
      inputs: [{ name: 'regionId', type: 'uint8' }],
      outputs: [{ name: '', type: 'uint8' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'currentSeason',
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }],
      stateMutability: 'view',
    },
  ];

  console.log('\n📊 Reading current game state from contract...\n');

  // Read all 20 regions
  const regionInfections = [];
  for (let i = 0; i < 20; i++) {
    const infection = await publicClient.readContract({
      address: gameAddress,
      abi: GAME_ABI,
      functionName: 'regionInfection',
      args: [i],
    });
    regionInfections.push(Number(infection));
  }

  const season = await publicClient.readContract({
    address: gameAddress,
    abi: GAME_ABI,
    functionName: 'currentSeason',
  });

  console.log('Current season:', Number(season));
  console.log('Region infections:', regionInfections);

  // Publish each region infection
  console.log('\n📤 Publishing region infections to Data Streams...\n');
  
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const streams = [];

  for (let regionId = 0; regionId < 20; regionId++) {
    if (regionInfections[regionId] > 0) {
      // Encode: uint64 timestamp, uint8 regionId, uint8 infectionPct
      const data = Buffer.concat([
        Buffer.from(timestamp.toString(16).padStart(16, '0'), 'hex').reverse(), // uint64 (8 bytes, little-endian)
        Buffer.alloc(24), // padding
        Buffer.from([regionId]), // uint8
        Buffer.alloc(31), // padding
        Buffer.from([regionInfections[regionId]]), // uint8
        Buffer.alloc(31), // padding
      ]);

      const dataId = require('viem').keccak256(
        require('viem').toHex(
          Buffer.concat([
            Buffer.from(gameAddress.slice(2), 'hex'),
            Buffer.from('region'),
            Buffer.from([regionId]),
            Buffer.from(timestamp.toString(16).padStart(16, '0'), 'hex'),
          ])
        )
      );

      streams.push({
        id: dataId,
        schemaId: REGION_INFECTION_SCHEMA_ID,
        data: '0x' + data.toString('hex'),
      });
    }
  }

  // Publish game state snapshot
  console.log('📤 Publishing game state snapshot...\n');
  
  const gameStateData = Buffer.concat([
    Buffer.from(timestamp.toString(16).padStart(16, '0'), 'hex').reverse(), // uint64
    Buffer.alloc(24), // padding
    Buffer.from([Number(season)]), // uint8 season
    Buffer.alloc(31), // padding
    ...regionInfections.map(pct => Buffer.concat([Buffer.from([pct]), Buffer.alloc(31)])), // uint8[20]
  ]);

  const gameStateId = require('viem').keccak256(
    require('viem').toHex(
      Buffer.concat([
        Buffer.from(gameAddress.slice(2), 'hex'),
        Buffer.from('gamestate'),
        Buffer.from([Number(season)]),
        Buffer.from(timestamp.toString(16).padStart(16, '0'), 'hex'),
      ])
    )
  );

  streams.push({
    id: gameStateId,
    schemaId: GAME_STATE_SCHEMA_ID,
    data: '0x' + gameStateData.toString('hex'),
  });

  try {
    const txHash = await sdk.streams.set(streams);
    console.log('✅ Published initial state. Transaction:', txHash);
    console.log(`   Published ${streams.length} data entries\n`);
  } catch (error) {
    console.error('❌ Error publishing:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
