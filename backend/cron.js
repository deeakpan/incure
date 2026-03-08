import cron from 'node-cron';
import { ethers } from 'ethers';
import { decodeEventLog } from 'viem';
import { batchUpdateInfection } from './db.js';
import { broadcast } from './ws.js';

const SPREAD_ABI = [
  'function triggerSpread() external',
  'function lastSpreadTime() view returns (uint256)',
  'function SPREAD_INTERVAL() view returns (uint256)',
];
const MUTATION_ABI = ['function triggerMutation() external'];
const FORMULA_ABI = [
  'function rotateFormula() external',
  'function lastFormulaRotation() view returns (uint256)',
  'function FORMULA_ROTATION() view returns (uint256)',
];
const STATE_ABI = ['function lastMutationTime() view returns (uint256)'];

// Event ABI for decoding InfectionSpread events
const INFECTION_SPREAD_EVENT_ABI = {
  type: 'event',
  name: 'InfectionSpread',
  inputs: [
    { name: 'regionIds', type: 'uint8[]', indexed: false },
    { name: 'newPcts', type: 'uint8[]', indexed: false },
  ],
};

// Helper function to check and rotate formula seed
async function checkAndRotateFormula(game) {
  try {
    const lastRotation = await game.lastFormulaRotation();
    const rotationInterval = await game.FORMULA_ROTATION();
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastRotation = now - Number(lastRotation);
    const requiredInterval = Number(rotationInterval);
    
    if (timeSinceLastRotation >= requiredInterval) {
      console.log('Rotating formula seed...');
      
      // Estimate gas first to catch revert reasons
      try {
        await game.rotateFormula.estimateGas();
      } catch (estimateError) {
        if (estimateError.reason === 'Too soon' || estimateError.message?.includes('Too soon')) {
          console.log('Formula rotation cooldown active (from estimate), skipping...');
          return;
        }
        console.error('Gas estimate failed:', estimateError.reason || estimateError.message);
        return;
      }
      
      const tx = await game.rotateFormula();
      const receipt = await tx.wait();
      
      if (receipt.status === 0) {
        console.error('Formula rotation transaction reverted. Receipt:', receipt);
        return;
      }
      
      console.log('Formula seed rotated:', tx.hash);
    } else {
      const remaining = requiredInterval - timeSinceLastRotation;
      const hoursRemaining = Math.floor(remaining / 3600);
      const minutesRemaining = Math.floor((remaining % 3600) / 60);
      console.log(`Formula rotation cooldown active. Time remaining: ${hoursRemaining}h ${minutesRemaining}m`);
    }
  } catch (error) {
    if (error.reason === 'Too soon' || error.message?.includes('Too soon')) {
      console.log('Formula rotation cooldown active, skipping...');
    } else {
      console.error('Error checking formula rotation:', error.reason || error.message || error);
    }
  }
}

export function startCronJobs(gameAddress, rpcUrl, deployerKey) {
  // ethers v6: JsonRpcProvider(url, network?, options?)
  // network can be undefined (auto-detect) or a Networkish object
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(deployerKey, provider);
  const game = new ethers.Contract(gameAddress, [...SPREAD_ABI, ...MUTATION_ABI, ...FORMULA_ABI, ...STATE_ABI], wallet);

  // Trigger spread every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('Triggering spread...');
      
      // Check if enough time has passed before attempting
      try {
        const lastSpreadTime = await game.lastSpreadTime();
        const spreadInterval = await game.SPREAD_INTERVAL();
        const now = Math.floor(Date.now() / 1000);
        const timeSinceLastSpread = now - Number(lastSpreadTime);
        const requiredInterval = Number(spreadInterval);
        
        if (timeSinceLastSpread < requiredInterval) {
          console.log(`Spread cooldown active. Time remaining: ${requiredInterval - timeSinceLastSpread}s`);
          return;
        }
      } catch (checkError) {
        console.log('Could not check spread cooldown, attempting anyway...');
      }
      
      // Estimate gas first to catch revert reasons
      try {
        await game.triggerSpread.estimateGas();
      } catch (estimateError) {
        if (estimateError.reason === 'Too soon' || estimateError.message?.includes('Too soon')) {
          console.log('Spread cooldown active (from estimate), skipping...');
          return;
        }
        console.error('Gas estimate failed:', estimateError.reason || estimateError.message);
        return;
      }
      
      const tx = await game.triggerSpread();
      const receipt = await tx.wait();
      
      if (receipt.status === 0) {
        console.error('Spread transaction reverted. Receipt:', receipt);
        return;
      }
      
      console.log('Spread triggered:', tx.hash);
      
      // Read InfectionSpread event from receipt and update Supabase directly
      try {
        // Find the InfectionSpread event in the logs
        const eventTopic = ethers.id('InfectionSpread(uint8[],uint8[])');
        const spreadLog = receipt.logs.find(log => 
          log.topics && log.topics[0] === eventTopic
        );
        
        if (spreadLog) {
          // Decode the event using viem
          const decoded = decodeEventLog({
            abi: [INFECTION_SPREAD_EVENT_ABI],
            topics: spreadLog.topics,
            data: spreadLog.data,
          });
          
          const { regionIds, newPcts } = decoded.args;
          console.log('📨 InfectionSpread event decoded from receipt:', {
            regionIds: regionIds.map(Number),
            newPcts: newPcts.map(Number),
          });
          
          // Update Supabase directly
          const updates = regionIds.map((id, i) => ({
            regionId: Number(id),
            pct: Number(newPcts[i]),
          }));
          
          console.log(`   Updating ${updates.length} regions in Supabase...`);
          await batchUpdateInfection(updates);
          console.log('✅ Supabase updated directly from cron job');
          
          // Broadcast to WebSocket clients
          broadcast({
            type: 'spread',
            updates,
          });
          console.log('✅ Broadcasted to WebSocket clients');
        } else {
          console.warn('⚠️ InfectionSpread event not found in receipt logs');
        }
      } catch (error) {
        console.error('❌ Error processing spread event from receipt:', error);
        // Don't throw - the spread was successful, just failed to update DB
        // The subscription handler will catch it as a fallback
      }
    } catch (error) {
      // "Too soon" is expected if cooldown hasn't passed - just log and continue
      if (error.reason === 'Too soon' || error.message?.includes('Too soon')) {
        console.log('Spread cooldown active, skipping...');
      } else if (error.receipt?.status === 0) {
        console.error('Spread transaction reverted. Hash:', error.receipt?.hash);
        // Try to get revert reason if available
        if (error.data) {
          console.error('Revert data:', error.data);
        }
      } else {
        console.error('Error triggering spread:', error.reason || error.message || error);
      }
    }
  });

  // Trigger mutation every 7 days (check every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      const lastMutation = await game.lastMutationTime();
      const now = Math.floor(Date.now() / 1000);
      const sevenDays = 7 * 24 * 60 * 60;
      
      if (now - Number(lastMutation) >= sevenDays) {
        console.log('Triggering mutation...');
        const tx = await game.triggerMutation();
        await tx.wait();
        console.log('Mutation triggered:', tx.hash);
      }
    } catch (error) {
      console.error('Error checking mutation:', error);
    }
  });

  // Check formula rotation immediately on start
  console.log('Checking formula rotation on startup...');
  checkAndRotateFormula(game);

  // Rotate formula seed every 24 hours (check every hour)
  cron.schedule('0 * * * *', async () => {
    await checkAndRotateFormula(game);
  });

  console.log('Cron jobs started');
}
