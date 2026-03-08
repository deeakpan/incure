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
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');
}

// Now import other modules that may use environment variables
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initDB, getGameState, getLeaderboard, getChemicals } from './db.js';
import { initWebSocket } from './ws.js';
import { startListener } from './listener.js';
import { startCronJobs } from './cron.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// CORS configuration - allow all origins in development
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));
app.use(express.json());

// Initialize WebSocket
initWebSocket(server);

// Initialize database
await initDB();

// REST API endpoints
app.get('/api/gamestate', async (req, res) => {
  try {
    const regions = await getGameState();
    const gameState = {};
    regions.forEach((r) => {
      gameState[r.iso_code] = r.infection_pct;
    });
    res.json(gameState);
  } catch (error) {
    const errorMsg = error?.message || String(error);
    // Suppress timeout errors - they're expected if Supabase is slow/down
    if (!errorMsg.includes('timeout') && !errorMsg.includes('TIMEOUT') && !errorMsg.includes('ConnectTimeout')) {
      console.error('Error getting game state:', errorMsg);
    }
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard(10);
    res.json(leaderboard.map((r) => ({
      address: r.address,
      score: parseFloat(r.total_incure),
    })));
  } catch (error) {
    const errorMsg = error?.message || String(error);
    // Suppress timeout errors - they're expected if Supabase is slow/down
    if (!errorMsg.includes('timeout') && !errorMsg.includes('TIMEOUT') && !errorMsg.includes('ConnectTimeout')) {
      console.error('Error getting leaderboard:', errorMsg);
    }
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

app.get('/api/chemicals', async (req, res) => {
  try {
    const chemicals = await getChemicals();
    res.json(chemicals);
  } catch (error) {
    console.error('Error getting chemicals:', error);
    res.status(500).json({ error: 'Failed to get chemicals' });
  }
});

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

// Start event listener (Somnia Reactivity)
if (process.env.INCURE_GAME_ADDRESS && process.env.SOMNIA_TESTNET_RPC_URL) {
  console.log('🔮 Starting Somnia Reactivity listener...');
  startListener(process.env.INCURE_GAME_ADDRESS);
} else {
  console.warn('⚠️  Reactivity listener NOT started. Missing:');
  if (!process.env.INCURE_GAME_ADDRESS) console.warn('   - INCURE_GAME_ADDRESS');
  if (!process.env.SOMNIA_TESTNET_RPC_URL) console.warn('   - SOMNIA_TESTNET_RPC_URL');
}

// Start cron jobs
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

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});
