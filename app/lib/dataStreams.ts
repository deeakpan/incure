/**
 * Data Streams utilities for reading game state from Somnia Data Streams
 */

import { SDK } from '@somnia-chain/streams';
import { createPublicClient, http, defineChain, type Hex } from 'viem';
import { SCHEMA_IDS, DATA_STREAMS_ADDRESS } from './schemas';

// Somnia Testnet chain config (duplicated from wagmi.ts to avoid circular dependency)
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

// Initialize SDK for reading from Data Streams
const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

export const sdk = new SDK({ public: publicClient });

/**
 * Get the latest region infection data for all regions
 * Reads from the most recent game state snapshot
 */
export async function getLatestGameState(gameContractAddress: `0x${string}`) {
  try {
    const gameState = await sdk.streams.getLastPublishedDataForSchema(
      SCHEMA_IDS.gameState,
      gameContractAddress as `0x${string}`
    );
    
    if (!gameState) {
      return null;
    }
    
    // Handle different return formats: Hex[] or SchemaDecodedItem[][]
    let data: Hex | null = null;
    if (Array.isArray(gameState) && gameState.length > 0) {
      // If it's Hex[], take the first item
      if (typeof gameState[0] === 'string' && gameState[0].startsWith('0x')) {
        data = gameState[0] as Hex;
      } else if (Array.isArray(gameState[0]) && gameState[0].length > 0) {
        // If it's SchemaDecodedItem[][], extract hex from first item
        const firstItem = gameState[0][0];
        if (typeof firstItem === 'object' && firstItem !== null && 'data' in firstItem) {
          data = firstItem.data as Hex;
        }
      }
    }
    
    if (!data) {
      return null;
    }
    
    // Decode: uint64 timestamp, uint8 season, uint8[20] regionInfections
    // Data is packed: 8 bytes timestamp + 32 bytes season + 20 * 32 bytes infections
    // Parse the data (this is a simplified version - you may need to adjust based on actual encoding)
    // For now, we'll read from individual region infection streams
    return null;
  } catch (error) {
    console.error('Error getting latest game state:', error);
    return null;
  }
}

/**
 * Get the latest infection percentage for a specific region
 */
export async function getLatestRegionInfection(
  gameContractAddress: `0x${string}`,
  regionId: number
): Promise<number | null> {
  try {
    // Get all region infection data for this publisher
    const allData = await sdk.streams.getAllPublisherDataForSchema(
      SCHEMA_IDS.regionInfection,
      gameContractAddress as `0x${string}`
    );
    
    if (!allData || !Array.isArray(allData)) {
      return null;
    }
    
    // Handle different return formats: Hex[] or SchemaDecodedItem[][]
    const dataArray: Hex[] = [];
    for (const item of allData) {
      if (typeof item === 'string' && item.startsWith('0x')) {
        dataArray.push(item as Hex);
      } else if (Array.isArray(item) && item.length > 0) {
        const firstItem = item[0];
        if (typeof firstItem === 'object' && firstItem !== null && 'data' in firstItem) {
          dataArray.push(firstItem.data as Hex);
        }
      }
    }
    
    // Filter for this region and get the latest
    const regionData = dataArray
      .map((hexData) => {
        try {
          return decodeRegionInfection(hexData);
        } catch {
          return null;
        }
      })
      .filter((decoded): decoded is { timestamp: bigint; regionId: number; infectionPct: number } => 
        decoded !== null && decoded.regionId === regionId
      )
      .sort((a, b) => {
        // Sort by timestamp (most recent first)
        return Number(b.timestamp - a.timestamp);
      });
    
    if (regionData.length === 0) {
      return null;
    }
    
    return regionData[0].infectionPct;
  } catch (error) {
    console.error(`Error getting region ${regionId} infection:`, error);
    return null;
  }
}

/**
 * Get all region infections (latest for each region)
 */
export async function getAllRegionInfections(
  gameContractAddress: `0x${string}`
): Promise<Record<number, number>> {
  const infections: Record<number, number> = {};
  
  // Get all region infection data
  try {
    const allData = await sdk.streams.getAllPublisherDataForSchema(
      SCHEMA_IDS.regionInfection,
      gameContractAddress as `0x${string}`
    );
    
    if (!allData || !Array.isArray(allData)) {
      return infections;
    }
    
    // Handle different return formats: Hex[] or SchemaDecodedItem[][]
    const dataArray: Hex[] = [];
    for (const item of allData) {
      if (typeof item === 'string' && item.startsWith('0x')) {
        dataArray.push(item as Hex);
      } else if (Array.isArray(item) && item.length > 0) {
        const firstItem = item[0];
        if (typeof firstItem === 'object' && firstItem !== null && 'data' in firstItem) {
          dataArray.push(firstItem.data as Hex);
        }
      }
    }
    
    // Group by regionId and keep only the latest for each
    const regionMap = new Map<number, { timestamp: bigint; infectionPct: number }>();
    
    for (const hexData of dataArray) {
      try {
        const decoded = decodeRegionInfection(hexData);
        const existing = regionMap.get(decoded.regionId);
        
        if (!existing || decoded.timestamp > existing.timestamp) {
          regionMap.set(decoded.regionId, {
            timestamp: decoded.timestamp,
            infectionPct: decoded.infectionPct,
          });
        }
      } catch (error) {
        console.error('Error decoding region infection data:', error);
      }
    }
    
    // Convert to record
    for (const [regionId, data] of regionMap.entries()) {
      infections[regionId] = data.infectionPct;
    }
  } catch (error) {
    console.error('Error getting all region infections:', error);
  }
  
  return infections;
}

/**
 * Decode region infection data
 * Schema: "uint64 timestamp, uint8 regionId, uint8 infectionPct"
 * Encoding: abi.encodePacked(uint64 timestamp, uint256 regionId, uint256 infectionPct)
 */
function decodeRegionInfection(data: Hex): {
  timestamp: bigint;
  regionId: number;
  infectionPct: number;
} {
  // Remove 0x prefix
  const hex = data.slice(2);
  
  // uint64 timestamp (8 bytes = 16 hex chars)
  const timestampHex = hex.slice(0, 16);
  const timestamp = BigInt('0x' + timestampHex);
  
  // uint256 regionId (32 bytes = 64 hex chars)
  const regionIdHex = hex.slice(16, 80);
  const regionId = Number(BigInt('0x' + regionIdHex));
  
  // uint256 infectionPct (32 bytes = 64 hex chars)
  const infectionPctHex = hex.slice(80, 144);
  const infectionPct = Number(BigInt('0x' + infectionPctHex));
  
  return { timestamp, regionId, infectionPct };
}

/**
 * Decode antidote deployment data
 * Schema: "uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success"
 * Encoding: abi.encodePacked(uint64 timestamp, uint256 player, uint256 regionId, uint256 cureEffect, uint256 success)
 */
function decodeAntidoteDeployment(data: Hex): {
  timestamp: bigint;
  player: string;
  regionId: number;
  cureEffect: number;
  success: boolean;
} {
  // Remove 0x prefix
  const hex = data.slice(2);
  
  // uint64 timestamp (8 bytes = 16 hex chars)
  const timestampHex = hex.slice(0, 16);
  const timestamp = BigInt('0x' + timestampHex);
  
  // uint256 player address (32 bytes = 64 hex chars)
  const playerHex = hex.slice(16, 80);
  const player = '0x' + playerHex.slice(24); // Address is last 20 bytes (40 hex chars)
  
  // uint256 regionId (32 bytes = 64 hex chars)
  const regionIdHex = hex.slice(80, 144);
  const regionId = Number(BigInt('0x' + regionIdHex));
  
  // uint256 cureEffect (32 bytes = 64 hex chars)
  const cureEffectHex = hex.slice(144, 208);
  const cureEffect = Number(BigInt('0x' + cureEffectHex));
  
  // uint256 success (32 bytes = 64 hex chars)
  const successHex = hex.slice(208, 272);
  const successValue = BigInt('0x' + successHex);
  const success = successValue.toString() !== '0';
  
  return { timestamp, player, regionId, cureEffect, success };
}

/**
 * Get leaderboard from Data Streams
 * Aggregates all successful antidote deployments by player address
 */
export async function getLeaderboard(
  gameContractAddress: `0x${string}`,
  limit: number = 10
): Promise<Array<{ address: string; score: number; deployments: number }>> {
  try {
    // Get all antidote deployment data
    const allData = await sdk.streams.getAllPublisherDataForSchema(
      SCHEMA_IDS.antidoteDeployment,
      gameContractAddress as `0x${string}`
    );
    
    // Check if allData is valid and iterable
    if (!allData) {
      return [];
    }
    
    // Handle different return formats: Hex[] or SchemaDecodedItem[][]
    let dataArray: any[] = [];
    if (Array.isArray(allData)) {
      dataArray = allData;
    } else if (typeof allData === 'object' && 'data' in allData && Array.isArray(allData.data)) {
      dataArray = allData.data;
    } else {
      return [];
    }
    
    // Aggregate by player address (only successful deployments)
    const playerData = new Map<string, { score: number; deployments: number }>();
    
    for (const item of dataArray) {
      try {
        // Handle both formats: Hex[] (raw hex string) or object with .data property
        let hexData: Hex;
        if (typeof item === 'string' && item.startsWith('0x')) {
          // Item is already a hex string
          hexData = item as Hex;
        } else if (typeof item === 'object' && item !== null && 'data' in item) {
          // Item is an object with a data property
          hexData = item.data as Hex;
        } else {
          continue;
        }
        
        const decoded = decodeAntidoteDeployment(hexData);
        
        // Only count successful deployments
        if (decoded.success) {
          const playerKey = decoded.player.toLowerCase();
          const current = playerData.get(playerKey) || { score: 0, deployments: 0 };
          playerData.set(playerKey, {
            score: current.score + decoded.cureEffect,
            deployments: current.deployments + 1,
          });
        }
      } catch (error) {
        console.error('Error decoding antidote deployment:', error);
      }
    }
    
    // Convert to array and sort by score (descending)
    const leaderboard = Array.from(playerData.entries())
      .map(([address, data]) => ({ address, score: data.score, deployments: data.deployments }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return leaderboard;
  } catch (error) {
    console.error('Error getting leaderboard from Data Streams:', error);
    return [];
  }
}

/**
 * Subscribe to real-time region infection updates
 */
export function subscribeToRegionInfections(
  gameContractAddress: `0x${string}`,
  onUpdate: (regionId: number, infectionPct: number) => void
) {
  // Use WebSocket transport for subscriptions
  const wsClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(), // TODO: Use webSocket() for real-time subscriptions
  });
  
  const wsSdk = new SDK({ public: wsClient });
  
  // Subscribe to region infection updates
  // Note: This is a simplified version - you may need to adjust based on event structure
  wsSdk.streams.subscribe({
    ethCalls: [],
    onData: (data: unknown) => {
      // Handle subscription updates
      console.log('Region infection update:', data);
    },
    onError: (error: unknown) => {
      console.error('Subscription error:', error);
    },
  });
}
