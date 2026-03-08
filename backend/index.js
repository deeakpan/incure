// Load .env file FIRST before any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from backend directory
const result = dotenv.config({ path: join(__dirname, '.env') });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('.env file loaded successfully');
}

// Minimal backend - only handles cron jobs for triggering spread and rotating formula
// All game state is now stored in Somnia Data Streams and read directly by the frontend
import express from 'express';
import { startCronJobs } from './cron.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Get live contract state (strain, spread countdown)
app.get('/api/contract-state', async (req, res) => {
  try {
    if (!process.env.INCURE_GAME_ADDRESS || !process.env.SOMNIA_TESTNET_RPC_URL) {
      return res.status(503).json({ error: 'Contract address not configured' });
    }

    const { ethers } = await import('ethers');
    // ethers v6: JsonRpcProvider(url, network?, options?)
    // Let it auto-detect network from RPC
    const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_TESTNET_RPC_URL);
    
    const GAME_ABI = [
      'function currentStrain() view returns (uint8)',
      'function lastSpreadTime() view returns (uint256)',
      'function SPREAD_INTERVAL() view returns (uint256)',
    ];
    
    const game = new ethers.Contract(process.env.INCURE_GAME_ADDRESS, GAME_ABI, provider);
    
    const [currentStrain, lastSpreadTime, spreadInterval] = await Promise.all([
      game.currentStrain(),
      game.lastSpreadTime(),
      game.SPREAD_INTERVAL(),
    ]);
    
    const now = Math.floor(Date.now() / 1000);
    const lastSpread = Number(lastSpreadTime);
    const interval = Number(spreadInterval);
    const nextSpreadTime = lastSpread + interval;
    const countdown = Math.max(0, nextSpreadTime - now);
    
    res.json({
      currentStrain: Number(currentStrain),
      spreadCountdown: countdown,
      lastSpreadTime: lastSpread,
      spreadInterval: interval,
      tokenAddress: process.env.INCURE_TOKEN_ADDRESS || null,
    });
  } catch (error) {
    // Suppress timeout errors - they're expected if RPC is slow/down
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('timeout') && !errorMsg.includes('TIMEOUT')) {
      console.error('Error getting contract state:', errorMsg);
    }
    res.status(500).json({ error: 'Failed to get contract state' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start cron jobs (triggerSpread every 5 mins, rotateFormula every 24 hours)
if (process.env.INCURE_GAME_ADDRESS && process.env.SOMNIA_TESTNET_RPC_URL && process.env.DEPLOYER_PRIVATE_KEY) {
  console.log('⏰ Starting cron jobs...');
  startCronJobs(
    process.env.INCURE_GAME_ADDRESS,
    process.env.SOMNIA_TESTNET_RPC_URL,
    process.env.DEPLOYER_PRIVATE_KEY
  );
} else {
  console.warn('⚠️  Cron jobs NOT started. Missing:');
  if (!process.env.INCURE_GAME_ADDRESS) console.warn('   - INCURE_GAME_ADDRESS');
  if (!process.env.SOMNIA_TESTNET_RPC_URL) console.warn('   - SOMNIA_TESTNET_RPC_URL');
  if (!process.env.DEPLOYER_PRIVATE_KEY) console.warn('   - DEPLOYER_PRIVATE_KEY');
}

app.listen(PORT, () => {
  console.log(`✅ Minimal backend server running on port ${PORT}`);
  console.log(`📊 All game state is stored in Somnia Data Streams`);
  console.log(`⏰ Cron jobs will trigger spread and rotate formula`);
});
