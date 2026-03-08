/**
 * Data Streams Schema Definitions for InCure
 * 
 * These schemas match the ones defined in the InCureGame contract.
 * Use these to decode data from Data Streams.
 */

export const SCHEMAS = {
  // Schema: "uint64 timestamp, uint8 regionId, uint8 infectionPct"
  regionInfection: 'uint64 timestamp, uint8 regionId, uint8 infectionPct',
  
  // Schema: "uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success"
  antidoteDeployment: 'uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success',
  
  // Schema: "uint64 timestamp, uint8 newStrain"
  mutation: 'uint64 timestamp, uint8 newStrain',
  
  // Schema: "uint64 timestamp, uint8 season, uint8[20] regionInfections"
  gameState: 'uint64 timestamp, uint8 season, uint8[20] regionInfections',
} as const;

// Data Streams contract address (same for testnet and mainnet)
export const DATA_STREAMS_ADDRESS = '0xB1Ae08D3d1542eF9971A63Aede2dB8d0239c78d4' as const;

// Schema IDs - Computed using `node scripts/compute-schemas.js`
export const SCHEMA_IDS = {
  regionInfection: '0x137abdabe8e064b2a1799b9d20b9ed6b6eab1da3cd73698ad887945baebbc0b4' as `0x${string}`,
  antidoteDeployment: '0x6384755d2e985e048fde38ae0e02f58047be6458d13ae799e636809f7127eb11' as `0x${string}`,
  mutation: '0x68fb518b085dc23743b4eb7accc380b15d16be7c9cfc1194739b75406132e97d' as `0x${string}`,
  gameState: '0x6c1cd97255efd890b742ac83af75d41895553e1216d1f18d17fcdfcd1e50f527' as `0x${string}`,
};
