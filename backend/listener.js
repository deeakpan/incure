import { ethers } from 'ethers';
import { updateRegionInfection, batchUpdateInfection, updateLeaderboard } from './db.js';
import { broadcast } from './ws.js';

const GAME_ABI = [
  "event AntidoteDeployed(address indexed player, uint8 regionId, uint8 cureEffect, bool success)",
  "event InfectionSpread(uint8[] regionIds, uint8[] newPcts)",
  "event PathogenMutated(uint8 newStrain)",
  "function regionInfection(uint8) view returns (uint8)",
];

export function startListener(gameAddress, wsUrl) {
  const provider = new ethers.WebSocketProvider(wsUrl);
  const game = new ethers.Contract(gameAddress, GAME_ABI, provider);

  console.log('Starting event listener for:', gameAddress);

  // Listen to AntidoteDeployed events
  game.on('AntidoteDeployed', async (player, regionId, cureEffect, success, event) => {
    console.log('AntidoteDeployed:', { player, regionId, cureEffect, success });
    
    try {
      // Get updated infection from contract
      const newInfection = await game.regionInfection(regionId);
      
      // Update database
      await updateRegionInfection(Number(regionId), Number(newInfection));
      
      // Broadcast to all clients
      broadcast({
        type: 'infection_update',
        regionId: Number(regionId),
        newPct: Number(newInfection),
        player: player,
        cureEffect: Number(cureEffect),
        success: success,
      });

      // Update leaderboard if successful
      if (success) {
        // Calculate reward (simplified - should match contract logic)
        const reward = (cureEffect * 100) / 100; // Adjust based on emission rate
        await updateLeaderboard(player, reward);
      }
    } catch (error) {
      console.error('Error handling AntidoteDeployed:', error);
    }
  });

  // Listen to InfectionSpread events
  game.on('InfectionSpread', async (regionIds, newPcts, event) => {
    console.log('InfectionSpread:', { regionIds, newPcts });
    
    try {
      const updates = regionIds.map((id, i) => ({
        regionId: Number(id),
        pct: Number(newPcts[i]),
      }));
      
      await batchUpdateInfection(updates);
      
      broadcast({
        type: 'spread',
        updates: updates,
      });
    } catch (error) {
      console.error('Error handling InfectionSpread:', error);
    }
  });

  // Listen to PathogenMutated events
  game.on('PathogenMutated', async (newStrain, event) => {
    console.log('PathogenMutated:', { newStrain });
    
    broadcast({
      type: 'mutation',
      newStrain: Number(newStrain),
    });
  });

  // Handle reconnection
  provider.on('error', (error) => {
    console.error('Provider error:', error);
  });

  console.log('Event listener started');
}
