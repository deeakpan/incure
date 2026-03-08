import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Somnia Testnet
export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia Test Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL || 'https://api.infra.testnet.somnia.network',
      ],
      webSocket: [
        process.env.NEXT_PUBLIC_SOMNIA_TESTNET_WS_URL || 'wss://api.infra.testnet.somnia.network/ws',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://explorer.testnet.somnia.network' },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'InCure',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [somniaTestnet],
  ssr: false,
});
