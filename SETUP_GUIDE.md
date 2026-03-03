# InCure Setup Guide

## 1. Download Natural Earth GeoJSON

The map needs country polygon data. I've already downloaded it for you, but if you need to re-download:

**Option 1: Direct Download (Easiest)**
```powershell
# In PowerShell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson" -OutFile "app/data/ne_110m_admin_0_countries.geojson"
```

**Option 2: Manual Download**
1. Go to: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
2. Download "Admin 0 – Countries"
3. Extract ZIP
4. Copy `ne_110m_admin_0_countries.geojson` to `app/data/`

The file should be at: `app/data/ne_110m_admin_0_countries.geojson`

---

## 2. What is PostgreSQL For?

PostgreSQL is a **database** that your backend uses to:

### **Why You Need It:**
1. **Cache On-Chain Data** - Store infection % for all 20 regions
   - Reading 20 values from blockchain = 20 RPC calls = SLOW
   - Reading from database = INSTANT

2. **Leaderboard** - Track top players
   - Aggregates total $INCURE earned per player
   - Updates when players deploy cures

3. **Real-Time Updates** - Backend listens to blockchain events
   - When someone deploys a cure → updates database
   - Broadcasts to all connected frontend clients via WebSocket

### **The Flow:**
```
Player deploys cure → Blockchain updates → Backend listens → Updates PostgreSQL → WebSocket broadcasts → Frontend updates map
```

### **Do You Need PostgreSQL?**

**YES** - For the MVP to work properly:
- Without it: Frontend has to make 20+ blockchain calls every time (slow, expensive)
- With it: Frontend gets instant updates via WebSocket (fast, free)

### **How to Set It Up:**

**Option 1: Local PostgreSQL**
```bash
# Install PostgreSQL (if not installed)
# Windows: Download from postgresql.org
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# Create database
createdb incure

# Update backend/.env
DATABASE_URL=postgresql://username:password@localhost:5432/incure
```

**Option 2: Free Cloud Database (Easier for MVP)**
- **Railway** (free tier): https://railway.app
- **Supabase** (free tier): https://supabase.com
- **Neon** (free tier): https://neon.tech

Just copy the connection string to `backend/.env`

**Option 3: Skip for Now (Mock Data)**
- Backend can run without PostgreSQL
- Just won't have persistent storage
- Good for initial testing

---

## 3. Quick Setup Checklist

- [x] GeoJSON file downloaded
- [ ] PostgreSQL database set up (or use cloud)
- [ ] Backend `.env` file created
- [ ] Contracts deployed to Fuji
- [ ] Frontend `.env` with contract addresses
- [ ] Run `npm install` in all folders
- [ ] Start backend: `cd backend && npm start`
- [ ] Start frontend: `npm run dev`

---

## 4. Environment Variables Needed

### `backend/.env`
```env
DATABASE_URL=postgresql://user:pass@host:5432/incure
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
FUJI_WS_URL=wss://api.avax-test.network/ext/bc/C/ws
INCURE_GAME_ADDRESS=0x... (after deploying contracts)
DEPLOYER_PRIVATE_KEY=your_private_key
PORT=3001
```

### `frontend/.env.local` (or `.env`)
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_GAME_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHEMICAL_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_PHARMACY_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001
```

---

**TL;DR:**
- **GeoJSON**: Already downloaded for you ✅
- **PostgreSQL**: Database for fast reads & leaderboard (use free cloud option for MVP)
