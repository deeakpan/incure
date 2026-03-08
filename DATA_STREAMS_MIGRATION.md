# Data Streams Migration Guide

This document explains the migration from Supabase to Somnia Data Streams for storing game state.

## Overview

All game state is now stored **on-chain** using Somnia Data Streams. The backend is now minimal and only handles:
- Triggering spread every 5 minutes
- Rotating formula seed every 24 hours

The frontend reads game state directly from Data Streams, eliminating the need for a database sync layer.

## Architecture Changes

### Before (Supabase-based)
```
Contract → Events → Backend Listener → Supabase → Backend API → Frontend
```

### After (Data Streams-based)
```
Contract → Data Streams → Frontend (direct read)
Backend → Cron Jobs → Contract (triggerSpread, rotateFormula)
```

## Contract Changes

### InCureGame.sol

The contract now:
1. Accepts Data Streams contract address and schema IDs in constructor
2. Publishes to Data Streams when:
   - `deployAntidote()` is called → publishes antidote deployment + region update
   - `triggerSpread()` is called → publishes all updated regions
   - `triggerMutation()` is called → publishes mutation event
   - `resetSeason()` is called → publishes full game state

### Schema Definitions

Four schemas are used:

1. **Region Infection** (`regionInfectionSchemaId`)
   - Schema: `uint64 timestamp, uint8 regionId, uint8 infectionPct`
   - Published when: region infection changes

2. **Antidote Deployment** (`antidoteDeploymentSchemaId`)
   - Schema: `uint64 timestamp, address player, uint8 regionId, uint8 cureEffect, bool success`
   - Published when: player deploys an antidote

3. **Mutation** (`mutationSchemaId`)
   - Schema: `uint64 timestamp, uint8 newStrain`
   - Published when: pathogen mutates

4. **Game State** (`gameStateSchemaId`)
   - Schema: `uint64 timestamp, uint8 season, uint8[20] regionInfections`
   - Published when: season resets or contract initializes

## Deployment Steps

### 1. Compute Schema IDs

Before deploying, compute the schema IDs:

```bash
cd contracts
node scripts/compute-schemas.js
```

This will output the schema IDs. Copy them to `contracts/scripts/deploy.js`.

### 2. Update Deploy Script

Edit `contracts/scripts/deploy.js` and update the schema ID constants:

```javascript
const REGION_INFECTION_SCHEMA_ID = "0x..."; // From compute-schemas.js
const ANTIDOTE_DEPLOYMENT_SCHEMA_ID = "0x...";
const MUTATION_SCHEMA_ID = "0x...";
const GAME_STATE_SCHEMA_ID = "0x...";
```

### 3. Register Schemas (Optional)

Schemas are automatically registered when first data is published, but you can pre-register them using the SDK:

```typescript
import { SDK } from '@somnia-chain/streams';
import { zeroBytes32 } from '@somnia-chain/streams';

await sdk.streams.registerDataSchemas([
  {
    schemaName: 'region_infection',
    schema: 'uint64 timestamp, uint8 regionId, uint8 infectionPct',
    parentSchemaId: zeroBytes32
  },
  // ... other schemas
], true); // ignoreAlreadyRegistered = true
```

### 4. Deploy Contract

Deploy with the new constructor parameters:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network somnia-testnet
```

### 5. Update Frontend Schema IDs

After deployment, update `app/lib/schemas.ts` with the computed schema IDs:

```typescript
export const SCHEMA_IDS = {
  regionInfection: '0x...' as `0x${string}`,
  antidoteDeployment: '0x...' as `0x${string}`,
  mutation: '0x...' as `0x${string}`,
  gameState: '0x...' as `0x${string}`,
};
```

## Backend Changes

### Removed
- ✅ Supabase database connection
- ✅ Event listener (no longer needed - data published directly)
- ✅ WebSocket server (frontend reads directly from streams)
- ✅ API endpoints for game state/leaderboard

### Kept
- ✅ Cron jobs for `triggerSpread()` (every 5 minutes)
- ✅ Cron jobs for `rotateFormula()` (every 24 hours)
- ✅ Health endpoint
- ✅ Contract state endpoint (optional)

### Environment Variables

Backend now only needs:

```env
INCURE_GAME_ADDRESS=0x...
SOMNIA_TESTNET_RPC_URL=https://dream-rpc.somnia.network
DEPLOYER_PRIVATE_KEY=0x...
PORT=3001
```

**No longer needed:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## Frontend Changes

### Reading from Data Streams

Use the utilities in `app/lib/dataStreams.ts`:

```typescript
import { getAllRegionInfections } from '@/lib/dataStreams';

// Get all region infections
const infections = await getAllRegionInfections(gameContractAddress);
// Returns: { 0: 45, 1: 32, ... } (regionId -> infectionPct)
```

### Real-time Updates

Subscribe to Data Streams for real-time updates:

```typescript
import { subscribeToRegionInfections } from '@/lib/dataStreams';

subscribeToRegionInfections(gameContractAddress, (regionId, infectionPct) => {
  // Update UI
  updateInfection(regionId, infectionPct);
});
```

## Benefits

1. **No Database Sync** - Data is stored on-chain, no backend sync needed
2. **Verifiable** - All game state is on-chain and verifiable
3. **Simpler Backend** - Only cron jobs, no database or event listeners
4. **Direct Access** - Frontend reads directly from chain
5. **Schema Updates** - Can update schemas in one transaction

## Data Streams Contract

- **Address**: `0xB1Ae08D3d1542eF9971A63Aede2dB8d0239c78d4`
- **Network**: Somnia Testnet (same address for mainnet)
- **Documentation**: https://docs.somnia.network/developer/data-streams

## Troubleshooting

### Schema Not Registered

If you get "Schema not registered" errors:
1. Check that schema IDs match between contract and frontend
2. Pre-register schemas using the SDK (see step 3 above)
3. Ensure Data Streams contract address is correct

### Data Not Appearing

1. Verify contract is publishing (check transaction logs)
2. Check schema IDs match
3. Ensure you're reading from the correct publisher address (game contract)
4. Use `getAllPublisherDataForSchema()` to see all published data

### Frontend Can't Read

1. Ensure `@somnia-chain/streams` is installed
2. Check RPC URL is correct
3. Verify schema IDs in `app/lib/schemas.ts` match computed values
4. Check browser console for errors

## Next Steps

1. ✅ Contract publishes to Data Streams
2. ✅ Backend simplified to cron jobs only
3. ⏳ Frontend reads from Data Streams (in progress)
4. ⏳ Remove Supabase dependencies from package.json
5. ⏳ Update documentation
