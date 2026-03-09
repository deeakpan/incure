# InCure MVP - Global Antidote Experiment

Real-time, on-chain pandemic strategy game on Somnia Testnet.

## Overview

InCure is a real-time strategy game where players deploy antidotes to cure infected regions around the world. The game uses **Somnia Reactivity** for real-time event subscriptions and **Somnia Data Streams** for persistent leaderboard data.

---

## Somnia Reactivity Usage

### Architecture

Reactivity is implemented in two places:

1. **Backend** (`backend/listener.js`) - Subscribes to game contract events and broadcasts to WebSocket clients
2. **Frontend** (`app/hooks/useReactivitySubscription.ts`) - React hook that subscribes to events and updates the UI state in real-time

Both subscribe to the same game contract events, ensuring all players see updates simultaneously.

### Subscribed Events

**AntidoteDeployed** - When players deploy antidotes:
- Backend: Receives event via Reactivity subscription, reads updated infection percentage from contract via `readContract()`, broadcasts to WebSocket clients
- Frontend: Receives event via Reactivity subscription, reads updated infection percentage from contract via `readContract()`, updates Zustand store with the new value, map re-renders with updated infection level

**InfectionSpread** - When the pathogen spreads (triggered by cron job):
- Backend: Receives event via Reactivity subscription, broadcasts spread updates to all WebSocket clients (fallback/redundancy - primary handling is via cron job)
- Frontend: Receives event via Reactivity subscription, uses `newPcts` array directly from the event data (no contract read needed), updates all affected regions in Zustand store, map shows new infection levels instantly

**PathogenMutated** - When the pathogen mutates to a new strain:
- Backend: Receives event via Reactivity subscription, broadcasts mutation event to all clients
- Frontend: Receives event via Reactivity subscription, uses `newStrain` value directly from event data, updates current strain in Zustand store, header shows new strain number

### Event Handling Pattern

Both implementations follow the same pattern:
1. Extract `topics` and `data` from the event payload
2. Decode using `decodeEventLog` with the contract ABI
3. Match event by topic hash
4. Process event arguments and update state accordingly

The backend uses a switch statement, while the frontend uses if/else chains. Both handle the same three event types with automatic reconnection on WebSocket failures.

---

## Somnia Data Streams Usage

### Purpose

Data Streams are used to store and retrieve persistent leaderboard data. Unlike Reactivity events which are transient, Data Streams provide on-chain storage for historical game data.

### Implementation

**Location**: `app/lib/dataStreams.ts`

**Schema Used**: `antidoteDeployment`
- Stores: `timestamp`, `player`, `regionId`, `cureEffect`, `success`
- Schema ID: `0x6384755d2e985e048fde38ae0e02f58047be6458d13ae799e636809f7127eb11`

### Leaderboard Function

The `getLeaderboard()` function:
1. Retrieves all antidote deployment data for the game contract using `getAllPublisherDataForSchema()`
2. Handles raw hex format (`Hex[]`) returned by the SDK
3. Decodes each deployment record manually (since schema isn't registered on-chain)
4. Filters for successful deployments only
5. Aggregates by player address, summing `cureEffect` as score and counting deployments
6. Returns sorted leaderboard with `address`, `score`, and `deployments` count

### Data Format

The SDK returns data as raw hex strings (`Hex[]`) rather than decoded objects. The implementation manually decodes the packed data:
- `uint64 timestamp` (8 bytes)
- `uint256 player address` (32 bytes, last 20 bytes are the address)
- `uint256 regionId` (32 bytes)
- `uint256 cureEffect` (32 bytes)
- `uint256 success` (32 bytes)

### Usage

The leaderboard is fetched periodically in `app/page.tsx` and displayed in the sidebar. The frontend also uses the deployment count to show total deployments in the user's profile stats.
