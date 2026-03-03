import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Avalanche Fuji Testnet
const avalancheFuji = defineChain({
  id: 43113,
  name: 'Avalanche Fuji',
  nativeCurrency: {
    decimals: 18,
    name: 'AVAX',
    symbol: 'AVAX',
  },
  rpcUrls: {
    default: {
      http: [
        'https://avax-fuji.g.alchemy.com/v2/AHvxVXQVrlt9ju46izVeM',
        'https://api.avax-test.network/ext/bc/C/rpc',
        'https://avalanche-fuji-c-chain-rpc.publicnode.com',
        'https://fuji.drpc.org',
      ],
      webSocket: ['wss://api.avax-test.network/ext/bc/C/ws'],
    },
  },
  blockExplorers: {
    default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io' },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'InCure',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [avalancheFuji],
  ssr: false,
});
