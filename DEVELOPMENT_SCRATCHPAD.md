# InCure MVP Development Scratchpad
## 20 Countries | Full Pharmacy | Node-Cron | Starting with UI

---

## 🎯 MVP Scope Confirmed
- ✅ **20 countries** on-chain (not 195)
- ✅ **Full Pharmacy** included (P2P chemical trading)
- ✅ **Node-cron** for spread/mutation (not Chainlink)
- ✅ **10 chemicals** (subset of 50)
- ✅ **Field Lab Kit** included (stake 0.1 AVAX, harvest daily)
- ✅ **Starter pack**: 3 of each of 3 common chemicals = 9 total

---

## 📋 Development Order

### PHASE 1: UI FOUNDATION (Start Here)
- [ ] **1.1** Project setup
  - [ ] Initialize Vite + React project
  - [ ] Install core dependencies
  - [ ] Set up TailwindCSS config
  - [ ] Create folder structure

- [ ] **1.2** WorldMap Component (deck.gl + MapLibre)
  - [ ] Install deck.gl, MapLibre GL JS, react-map-gl
  - [ ] Download Natural Earth GeoJSON (195 countries)
  - [ ] Create `WorldMap.jsx` with base map
  - [ ] Add GeoJsonLayer with static colors
  - [ ] Implement infection color mapping (0% = green, 100% = red)
  - [ ] Add click handler for region selection
  - [ ] Add hover tooltip showing infection %
  - [ ] Add smooth color transitions (800ms)
  - [ ] Add pulsing animation for 80%+ infection

- [ ] **1.3** HUD Component (Top Bar)
  - [ ] Create `HUD.jsx` with fixed top position
  - [ ] Add InCure logo (Playfair Display, italic, gradient)
  - [ ] Add Global Infection % display (mock data)
  - [ ] Add Spread Countdown timer (MM:SS, mock)
  - [ ] Add Pathogen Strain display (mock)
  - [ ] Add $INCURE Balance display (mock)
  - [ ] Add Connect Wallet button (RainbowKit)
  - [ ] Style with backdrop blur, dark theme

- [ ] **1.4** ChemLab Component (Slide-up Panel)
  - [ ] Create `ChemLab.jsx` with bottom slide-up animation
  - [ ] Add region selection display ("Deploying to: China — 64%")
  - [ ] Add infection progress bar for selected region
  - [ ] Create 3 chemical selection slots
  - [ ] Add chemical inventory grid (10 chemicals, mock data)
  - [ ] Add ratio sliders (one per selected chemical)
  - [ ] Add ratio sum validation (must = 100%)
  - [ ] Add Deploy button (disabled/enabled states)
  - [ ] Add loading state for transaction
  - [ ] Style with dark green-black theme

- [ ] **1.5** Sidebar Component (Right Panel)
  - [ ] Create `Sidebar.jsx` with fixed right position (280px)
  - [ ] **Leaderboard section**: Top 10 curers (mock data)
  - [ ] **Inventory section**: Grid of 10 chemicals with quantities
  - [ ] **Region Info section**: Selected region details
  - [ ] Add "Claim Starter Kit" button
  - [ ] Make scrollable sections

- [ ] **1.6** Pharmacy Component
  - [ ] Create `Pharmacy.jsx` component
  - [ ] Add buy/sell tabs
  - [ ] Add chemical selection dropdown
  - [ ] Add quantity input
  - [ ] Add price display ($INCURE or AVAX)
  - [ ] Add order book or simple market view
  - [ ] Add "List for Sale" functionality
  - [ ] Style to match game theme

- [ ] **1.7** Toast Notification System
  - [ ] Create `Toast.jsx` component
  - [ ] Add fade-in animation from bottom
  - [ ] Add auto-dismiss after 3 seconds
  - [ ] Support success (green) and error (red) variants
  - [ ] Add to global app state

- [ ] **1.8** Zustand Store Setup
  - [ ] Create `store/gameStore.js`
  - [ ] Add state: `infectionData`, `selectedRegion`, `inventory`, `balance`, `strain`, `leaderboard`
  - [ ] Add actions: `updateInfection`, `selectRegion`, `updateInventory`, etc.

- [ ] **1.9** UI Polish & Animations
  - [ ] Add Framer Motion animations
  - [ ] Add cure ripple effect on successful deploy
  - [ ] Add red pulse on spread events
  - [ ] Add green glow on cured regions (fade after 60s)
  - [ ] Verify all color schemes match spec
  - [ ] Test responsive layout

---

### PHASE 2: SMART CONTRACTS

- [ ] **2.1** Project Setup
  - [ ] Initialize Hardhat project
  - [ ] Install OpenZeppelin contracts
  - [ ] Set up Hardhat config for Fuji testnet
  - [ ] Create `.env` with private key and RPC URL

- [ ] **2.2** IncureToken.sol
  - [ ] Extend OpenZeppelin ERC20
  - [ ] Add `deploymentTime` and `halvingInterval` (7 days)
  - [ ] Add `currentEmissionRate()` view function
  - [ ] Add `mint()` function (only callable by game contract)
  - [ ] Implement halving logic (bitshift: `INITIAL_RATE >> halvingCount`)
  - [ ] Start at 100 tokens per 1% cured

- [ ] **2.3** ChemicalInventory.sol
  - [ ] Extend OpenZeppelin ERC1155
  - [ ] Define 10 chemicals (IDs 1-10)
  - [ ] Add `mintStarter()` function (gives 3 of each of 3 common: IDs 1,2,3)
  - [ ] Add `burnBatch()` function (only callable by game contract)
  - [ ] Add Field Lab Kit struct and mapping
  - [ ] Add `stakeFieldLab()` function (stake 0.1 AVAX)
  - [ ] Add `harvest()` function (daily chemical yield)
  - [ ] Add `upgradeSlots()` function (burn $INCURE)

- [ ] **2.4** Pharmacy.sol
  - [ ] Create contract for P2P chemical trading
  - [ ] Add listing struct: `{seller, chemId, quantity, price, currency}`
  - [ ] Add `listForSale()` function
  - [ ] Add `buyFromListing()` function
  - [ ] Add `cancelListing()` function
  - [ ] Add marketplace view functions

- [ ] **2.5** InCureGame.sol
  - [ ] Define 20 hardcoded regions (0-19)
  - [ ] Add `mapping(uint8 => uint8) public regionInfection`
  - [ ] Add `currentStrain`, `lastMutationTime`, `lastSpreadTime`
  - [ ] Add `hasStarterKit` mapping
  - [ ] Add `claimStarterKit()` function
  - [ ] Add `deployAntidote()` function
  - [ ] Add `_evaluateFormula()` internal function
  - [ ] Add `triggerSpread()` function (anyone can call, 5-min cooldown)
  - [ ] Add `triggerMutation()` function (anyone can call, 7-day cooldown)
  - [ ] Emit all required events
  - [ ] Initialize 15 regions with random 20-95% infection in constructor

- [ ] **2.6** Contract Testing
  - [ ] Write tests for IncureToken
  - [ ] Write tests for ChemicalInventory
  - [ ] Write tests for Pharmacy
  - [ ] Write tests for InCureGame
  - [ ] Test full flow: claim starter → deploy → earn tokens

- [ ] **2.7** Deploy to Fuji Testnet
  - [ ] Deploy IncureToken
  - [ ] Deploy ChemicalInventory
  - [ ] Deploy Pharmacy
  - [ ] Deploy InCureGame (set addresses of other contracts)
  - [ ] Copy contract addresses to `.env` files

---

### PHASE 3: BACKEND

- [ ] **3.1** Project Setup
  - [ ] Initialize Node.js + Express project
  - [ ] Install: express, ethers, pg, node-cron, ws, cors, dotenv
  - [ ] Set up PostgreSQL database
  - [ ] Create `.env` with DB URL, RPC URL, contract addresses

- [ ] **3.2** Database Schema
  - [ ] Create `regions` table (id, iso_code, infection_pct, updated_at)
  - [ ] Create `leaderboard` table (address, total_incure, week_start)
  - [ ] Seed 20 regions with initial data

- [ ] **3.3** Event Listener
  - [ ] Create `listener.js` with ethers.js WebSocket provider
  - [ ] Subscribe to `AntidoteDeployed` events
  - [ ] Subscribe to `InfectionSpread` events
  - [ ] Subscribe to `PathogenMutated` events
  - [ ] Update PostgreSQL on each event
  - [ ] Broadcast to WebSocket clients

- [ ] **3.4** WebSocket Server
  - [ ] Create `ws.js` WebSocket server
  - [ ] Handle client connections
  - [ ] Broadcast infection updates to all clients
  - [ ] Handle reconnection logic

- [ ] **3.5** REST API
  - [ ] Create `GET /api/gamestate` endpoint (returns all 20 regions)
  - [ ] Create `GET /api/leaderboard` endpoint
  - [ ] Add CORS middleware

- [ ] **3.6** Cron Jobs
  - [ ] Create `cron.js` with node-cron
  - [ ] Schedule `triggerSpread()` every 5 minutes
  - [ ] Schedule `triggerMutation()` every 7 days
  - [ ] Add error handling and logging

- [ ] **3.7** Main Server
  - [ ] Create `index.js` Express server
  - [ ] Integrate event listener
  - [ ] Integrate WebSocket server
  - [ ] Integrate cron jobs
  - [ ] Start server on PORT from env

---

### PHASE 4: FRONTEND-BLOCKCHAIN INTEGRATION

- [ ] **4.1** Wallet Connection
  - [ ] Set up RainbowKit with Avalanche Fuji network
  - [ ] Configure wagmi with Fuji RPC
  - [ ] Test wallet connect/disconnect

- [ ] **4.2** Contract Hooks
  - [ ] Create `useGameState.js` hook (WebSocket + REST fallback)
  - [ ] Create `useDeployAntidote.js` hook (wagmi writeContract)
  - [ ] Create `useInventory.js` hook (ERC-1155 balance reads)
  - [ ] Create `useIncureBalance.js` hook (ERC-20 balance read)
  - [ ] Create `usePharmacy.js` hook (Pharmacy contract interactions)

- [ ] **4.3** Connect UI to Contracts
  - [ ] Wire WorldMap to real infection data from WebSocket
  - [ ] Wire HUD to real balance, strain, timer
  - [ ] Wire ChemLab deploy button to contract transaction
  - [ ] Wire Sidebar inventory to ERC-1155 balances
  - [ ] Wire Pharmacy to contract buy/sell functions
  - [ ] Wire "Claim Starter Kit" button

- [ ] **4.4** Real-time Updates
  - [ ] Connect WebSocket to backend
  - [ ] Update Zustand store on WebSocket messages
  - [ ] Trigger map re-renders on state changes
  - [ ] Show toast notifications on deploy success/fail

---

### PHASE 5: TESTING & POLISH

- [ ] **5.1** End-to-End Testing
  - [ ] Test: Connect wallet → Claim starter → Select region → Mix → Deploy
  - [ ] Test: Verify map updates after deploy
  - [ ] Test: Verify balance updates
  - [ ] Test: Verify inventory decreases after deploy
  - [ ] Test: Pharmacy buy/sell flow
  - [ ] Test: Field Lab staking and harvest

- [ ] **5.2** Performance Optimization
  - [ ] Optimize map rendering (check FPS)
  - [ ] Optimize WebSocket message handling
  - [ ] Add loading states everywhere
  - [ ] Test with multiple regions updating simultaneously

- [ ] **5.3** Bug Fixes
  - [ ] Fix any UI glitches
  - [ ] Fix contract edge cases
  - [ ] Fix backend event handling
  - [ ] Test error scenarios

- [ ] **5.4** Deployment
  - [ ] Deploy frontend to Vercel
  - [ ] Deploy backend to Railway
  - [ ] Update environment variables
  - [ ] Test live deployment

---

## 🎨 UI Design Reference

### Color Palette
- Background: `#060a0d`
- Panels: `#0d1a14`
- Border: `#1a3a22`
- Primary: `#00e676` (green)
- Danger: `#c62828` (red)
- Warning: `#ff6f00` (orange)
- Text primary: `#e8f5e9`
- Text muted: `#6a8f72`

### Typography
- Logo/Titles: "Playfair Display", italic, bold
- UI Text: "Space Grotesk"
- Numbers: `font-variant-numeric: tabular-nums`

### 20 Hardcoded Countries
```
0=US, 1=CA, 2=BR, 3=AR, 4=GB, 5=FR, 6=DE, 7=RU, 8=CN, 9=IN,
10=AU, 11=JP, 12=NG, 13=ZA, 14=EG, 15=SA, 16=PK, 17=ID, 18=TR, 19=MX
```

---

## 📝 Notes Section

### Current Focus: UI Foundation
Starting with WorldMap component...

### Blockers/Issues:
- None yet

### Decisions Made:
- Using node-cron instead of Chainlink for MVP
- 20 countries instead of 195
- Full Pharmacy included
- Starter pack: 9 chemicals (3×3)

---

*Last Updated: [Date]*
