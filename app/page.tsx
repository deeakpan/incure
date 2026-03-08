'use client';

import dynamic from 'next/dynamic';

const WorldMap = dynamic(() => import('./components/WorldMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center w-full h-full bg-black text-[#00e676]">Loading map...</div>,
});
import HUD from './components/HUD';
import Sidebar from './components/Sidebar';
import ChemLab from './components/ChemLab';
import Pharmacy from './components/Pharmacy';
import DeployCooldown from './components/DeployCooldown/DeployCooldown';
import { ToastContainer } from './components/Toast/Toast';
import { useGameStore } from './store/gameStore';
import { useEffect, useState } from 'react';
import { REGION_ISOS } from './utils/regionData';
import { Toast } from './components/Toast/Toast';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { useReactivitySubscription } from './hooks/useReactivitySubscription';
import { REGIONS } from './utils/regionData';

// Backend removed - all data now read from contract/Data Streams

// ERC20 balanceOf ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export default function Home() {
  const { updateInfection, setSpreadCountdown, selectRegion, setLeaderboard, setStrain, setBalance } = useGameStore();
  const { address, isConnected } = useAccount();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | undefined>(
    (process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}` | undefined)
  );

  // Set up Somnia Reactivity subscription for real-time event updates
  useReactivitySubscription();

  // Fetch token balance when wallet is connected
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && !!tokenAddress,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Update store when balance changes
  useEffect(() => {
    if (balanceData !== undefined) {
      const balanceStr = formatEther(balanceData as bigint);
      setBalance(balanceStr);
      console.log('✅ Updated INCURE balance:', balanceStr);
    } else if (!isConnected) {
      setBalance('0');
    }
  }, [balanceData, isConnected, setBalance]);

  // Refetch balance when token address is set
  useEffect(() => {
    if (tokenAddress && isConnected && address) {
      refetchBalance();
    }
  }, [tokenAddress, isConnected, address, refetchBalance]);

  const publicClient = usePublicClient();

  // Fetch real data from contract on mount (Reactivity handles updates)
  useEffect(() => {
    // Read all region infections directly from contract
    const fetchGameStateFromContract = async () => {
      const gameAddress = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
      if (!gameAddress || !publicClient) {
        console.warn('⚠️ Cannot fetch from contract: missing address or client');
        return;
      }

      try {
        console.log('📖 Reading all region infections from contract...');
        const GAME_ABI = [
          {
            type: 'function',
            name: 'regionInfection',
            inputs: [{ name: 'regionId', type: 'uint8' }],
            outputs: [{ name: '', type: 'uint8' }],
            stateMutability: 'view',
          },
        ] as const;

        // Read all 20 regions in parallel
        const regionPromises = Object.entries(REGIONS).map(async ([regionIdStr, region]) => {
          const regionId = Number(regionIdStr);
          try {
            const infection = await publicClient.readContract({
              address: gameAddress,
              abi: GAME_ABI,
              functionName: 'regionInfection',
              args: [regionId],
            });
            return { iso: region.iso, pct: Number(infection) };
          } catch (error) {
            console.error(`Error reading region ${regionId}:`, error);
            return null;
          }
        });

        const results = await Promise.all(regionPromises);
        const validResults = results.filter((r): r is { iso: string; pct: number } => r !== null);
        
        console.log(`✅ Read ${validResults.length} regions from contract:`, validResults);
        validResults.forEach(({ iso, pct }) => {
          updateInfection(iso, pct);
        });
      } catch (error) {
        console.error('Error fetching game state from contract:', error);
      }
    };

    // Fetch leaderboard from Data Streams
    const fetchLeaderboard = async () => {
      const gameAddress = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
      if (!gameAddress) {
        console.warn('⚠️ Game contract address not set, skipping leaderboard fetch');
        return;
      }

      try {
        console.log('📊 Fetching leaderboard from Data Streams...');
        const { getLeaderboard } = await import('./lib/dataStreams');
        const leaderboard = await getLeaderboard(gameAddress, 10);
        console.log('✅ Fetched leaderboard from Data Streams:', leaderboard);
        if (leaderboard.length === 0) {
          console.warn('⚠️ Leaderboard is empty - no successful deployments found yet');
        }
        setLeaderboard(leaderboard);
      } catch (error) {
        console.error('❌ Error fetching leaderboard:', error);
        setLeaderboard([]);
      }
    };

    // Fetch live contract state directly from contract
    const fetchContractState = async () => {
      const gameAddress = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
      if (!gameAddress || !publicClient) {
        return;
      }

      try {
        const GAME_STATE_ABI = [
          {
            type: 'function',
            name: 'currentStrain',
            inputs: [],
            outputs: [{ name: '', type: 'uint8' }],
            stateMutability: 'view',
          },
          {
            type: 'function',
            name: 'lastSpreadTime',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
          {
            type: 'function',
            name: 'SPREAD_INTERVAL',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ] as const;

        const [currentStrain, lastSpreadTime, spreadInterval] = await Promise.all([
          publicClient.readContract({
            address: gameAddress,
            abi: GAME_STATE_ABI,
            functionName: 'currentStrain',
          }),
          publicClient.readContract({
            address: gameAddress,
            abi: GAME_STATE_ABI,
            functionName: 'lastSpreadTime',
          }),
          publicClient.readContract({
            address: gameAddress,
            abi: GAME_STATE_ABI,
            functionName: 'SPREAD_INTERVAL',
          }),
        ]);

        const now = Math.floor(Date.now() / 1000);
        const lastSpread = Number(lastSpreadTime);
        const interval = Number(spreadInterval);
        const nextSpreadTime = lastSpread + interval;
        const countdown = Math.max(0, nextSpreadTime - now);

        setStrain(Number(currentStrain));
        setSpreadCountdown(countdown);
        console.log('✅ Fetched contract state from chain:', { currentStrain: Number(currentStrain), countdown });
      } catch (error) {
        console.error('Error fetching contract state:', error);
      }
    };

    // Fetch all data in parallel, but don't block map rendering if backend is down
    Promise.all([fetchGameStateFromContract(), fetchLeaderboard(), fetchContractState()])
      .then(() => {
        setMapReady(true);
      })
      .catch((error) => {
        console.error('Error initializing data:', error);
        // Still show map even if backend is unavailable
        setMapReady(true);
      });

    // Update spread countdown every second (decrement from contract value)
    const interval = setInterval(() => {
      setSpreadCountdown((prev) => {
        if (prev <= 0) {
          // Refresh from contract when countdown hits 0
          fetchContractState();
          return 300; // Fallback value
        }
        return prev - 1;
      });
    }, 1000);

    // Poll for updates every 30 seconds (reduced frequency since Reactivity handles real-time events)
    // Reactivity will update infections/strain instantly, but we still poll for leaderboard and countdown
    const pollInterval = setInterval(() => {
      fetchLeaderboard(); // Leaderboard still needs polling
      fetchContractState(); // Refresh contract state (countdown)
      // Note: fetchGameState() removed - Reactivity handles infection updates in real-time
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [updateInfection, setSpreadCountdown, setLeaderboard, setStrain, tokenAddress, publicClient]);

  const handleRegionClick = (iso: string) => {
    selectRegion(iso);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black fixed inset-0" style={{ backgroundColor: '#000000' }}>
      {/* World Map - Full screen, behind everything */}
      {mapReady && (
        <div className="absolute inset-0 z-0">
          <WorldMap onRegionClick={handleRegionClick} />
        </div>
      )}

      {/* HUD Bar - Fixed at top, above map */}
      <div className="relative z-50">
        <HUD />
      </div>
      
      {/* Sidebar - Slides in from right when arrow clicked */}
      <Sidebar />

      {/* ChemLab - Left sidebar */}
      <div className="relative z-40">
        <ChemLab />
      </div>

      {/* Pharmacy Button & Modal, above map */}
      <div className="relative z-40">
        <Pharmacy onPurchaseSuccess={(message) => showToast(message, 'success')} />
      </div>

      {/* Deploy Cooldown - Bottom Left */}
      <div className="relative z-50">
        <DeployCooldown />
      </div>

      {/* Toast Notifications, above everything */}
      <div className="relative z-50">
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
        </div>
    </div>
  );
}
