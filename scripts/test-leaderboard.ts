/**
 * Test script for leaderboard functionality
 * Run with: npx tsx scripts/test-leaderboard.ts
 */

import { getLeaderboard } from '../app/lib/dataStreams';
import { sdk } from '../app/lib/dataStreams';
import { SCHEMA_IDS } from '../app/lib/schemas';
import type { Hex } from 'viem';

async function main() {
  // Game contract address
  const gameAddress = '0xb91bC6228ae575389f164e4a220b1AfB39C12965' as `0x${string}`;

  console.log('🧪 Testing leaderboard functionality...');
  console.log(`📍 Game Contract Address: ${gameAddress}`);
  console.log(`📋 Schema ID: ${SCHEMA_IDS.antidoteDeployment}`);
  console.log('');

  // Step 1: Test direct SDK call to see what we get
  console.log('🔍 Step 1: Testing direct SDK call...');
  try {
    const rawData = await sdk.streams.getAllPublisherDataForSchema(
      SCHEMA_IDS.antidoteDeployment,
      gameAddress as `0x${string}`
    );
    
    console.log('📦 Raw data type:', typeof rawData);
    console.log('📦 Is array?', Array.isArray(rawData));
    console.log('📦 Is null?', rawData === null);
    
    if (rawData === null) {
      console.log('⚠️  No data found - returning null');
      console.log('This could mean:');
      console.log('  - No data has been published yet');
      console.log('  - Schema ID is incorrect');
      console.log('  - Publisher address is incorrect');
      return;
    }
    
    if (Array.isArray(rawData)) {
      console.log(`📊 Array length: ${rawData.length}`);
      if (rawData.length > 0) {
        console.log('📝 First item type:', typeof rawData[0]);
        console.log('📝 First item is array?', Array.isArray(rawData[0]));
        console.log('📝 First item:', JSON.stringify(rawData[0], null, 2));
        
        // Check if it's Hex[] or SchemaDecodedItem[][]
        if (typeof rawData[0] === 'string' && rawData[0].startsWith('0x')) {
          console.log('✅ Data format: Hex[] (raw hex strings)');
        } else if (Array.isArray(rawData[0])) {
          console.log('✅ Data format: SchemaDecodedItem[][] (decoded arrays)');
          console.log('📝 First decoded item:', JSON.stringify(rawData[0], null, 2));
        } else if (typeof rawData[0] === 'object') {
          console.log('✅ Data format: Object array');
          console.log('📝 Object keys:', Object.keys(rawData[0]));
        }
      }
    } else {
      console.log('⚠️  Unexpected data format:', rawData);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ Error in direct SDK call:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }

  // Step 2: Test the getLeaderboard function
  console.log('🔍 Step 2: Testing getLeaderboard function...');
  try {
    const leaderboard = await getLeaderboard(gameAddress, 10);
    
    console.log('✅ Leaderboard retrieved successfully!');
    console.log(`📈 Found ${leaderboard.length} entries`);
    console.log('');
    
    if (leaderboard.length === 0) {
      console.log('⚠️  Leaderboard is empty - no successful deployments found yet');
    } else {
      console.log('🏆 Leaderboard:');
      leaderboard.forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.address} - Score: ${entry.score} - Deployments: ${entry.deployments}`);
      });
    }
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
