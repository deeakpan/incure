# InCure Backend Setup

## Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor in your Supabase dashboard
3. Copy and paste the contents of `supabase-migration.sql` and run it
4. This will create all necessary tables and seed initial data

## Environment Variables

Create a `.env` file in the `backend/` directory with:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Or use anon key for read-only operations:
# SUPABASE_ANON_KEY=your-anon-key

# Contract Addresses (from deployment)
INCURE_GAME_ADDRESS=0x...
INCURE_TOKEN_ADDRESS=0x...
CHEMICAL_INVENTORY_ADDRESS=0x...
PHARMACY_ADDRESS=0x...

# Network
RONIN_RPC_URL=https://saigon-testnet.roninchain.com/rpc

# Backend Wallet (for signing formula evaluations)
TRUSTED_ORACLE_PRIVATE_KEY=your-private-key-here

# Deployer (for cron jobs)
DEPLOYER_PRIVATE_KEY=your-deployer-private-key

# Server
PORT=3001
```

## Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Click on "Settings" → "API"
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (for backend writes)
   - **anon key** → `SUPABASE_ANON_KEY` (for public reads, optional)

## Installing Dependencies

```bash
cd backend
npm install
```

## Running the Backend

```bash
npm start
# or for development with auto-reload:
npm run dev
```

## API Endpoints

- `GET /api/gamestate` - Get all regions with infection percentages
- `GET /api/leaderboard` - Get top players by $INCURE earnings
- `GET /api/chemicals` - Get all 15 chemical compounds
- `GET /health` - Health check

## Icon Assets

Chemical icons should be placed in `public/icons/` directory:
- `artemis.svg`
- `quinine.svg`
- `berberine.svg`
- `allicin.svg`
- `curcumin.svg`
- `thymol.svg`
- `resveratrol.svg`
- `lactoferrin.svg`
- `cryptolepine.svg`
- `andrographine.svg`
- `piperin.svg`
- `defensin.svg`
- `cathelicidin.svg`
- `squalamine.svg`
- `retrocyclin.svg`

Download icons from freepik.com and place them in the public/icons directory.
