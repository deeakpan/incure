# InCure MVP - Global Antidote Experiment

Real-time, on-chain pandemic strategy game on Avalanche Fuji testnet.

## 🚀 Quick Start

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
# Set up .env file (see backend/.env.example)
npm start
```

### Contracts
```bash
cd contracts
npm install
# Set up .env with PRIVATE_KEY and FUJI_RPC_URL
npx hardhat compile
npx hardhat run scripts/deploy.js --network fuji
```

## 📁 Project Structure

```
incure/
├── app/                    # Next.js frontend
│   ├── components/         # React components
│   ├── store/              # Zustand state
│   ├── utils/              # Utilities
│   └── hooks/              # Custom hooks
├── contracts/              # Solidity smart contracts
├── backend/                # Node.js backend
└── test/                   # Tests
```

## 🎮 Features

- **20 Countries** on-chain infection tracking
- **Full Pharmacy** for P2P chemical trading
- **Field Lab Kit** staking (0.1 AVAX) for daily harvests
- **Real-time updates** via WebSocket
- **deck.gl map** with infection visualization

## 📝 Environment Variables

See `backend/.env.example` and `contracts/.env.example` for required variables.

## 🛠️ Tech Stack

- **Frontend**: Next.js, React, deck.gl, MapLibre, TailwindCSS, RainbowKit
- **Backend**: Node.js, Express, PostgreSQL, WebSocket, node-cron
- **Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin
- **Chain**: Avalanche Fuji Testnet
