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
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

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

  // Fetch real data from backend on mount
  useEffect(() => {
    // Fetch infection data from backend
    const fetchGameState = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/gamestate`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Fetched REAL data from backend:', data);
          // Update infection data for each region
          Object.entries(data).forEach(([iso, pct]) => {
            updateInfection(iso, pct as number);
          });
        } else {
          console.error('Failed to fetch game state:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching game state:', error);
        // Fallback: if backend is not available, use empty data
        // Map will still render but with no infection data
      }
    };

    // Fetch leaderboard
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Fetched REAL leaderboard from backend:', data);
          setLeaderboard(data);
        } else {
          console.error('Failed to fetch leaderboard');
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    };

    // Fetch live contract state (strain, spread countdown, token address)
    const fetchContractState = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/contract-state`);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Fetched REAL contract state:', data);
          setStrain(data.currentStrain);
          setSpreadCountdown(data.spreadCountdown);
          // Update token address from backend if not set in env
          if (data.tokenAddress && !tokenAddress) {
            setTokenAddress(data.tokenAddress as `0x${string}`);
            console.log('✅ Set token address from backend:', data.tokenAddress);
          }
        } else {
          console.error('Failed to fetch contract state');
        }
      } catch (error) {
        console.error('Error fetching contract state:', error);
      }
    };

    // Fetch all data in parallel, but don't block map rendering if backend is down
    Promise.all([fetchGameState(), fetchLeaderboard(), fetchContractState()])
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

    // Poll for updates every 10 seconds
    const pollInterval = setInterval(() => {
      fetchGameState();
      fetchLeaderboard();
      fetchContractState(); // Refresh contract state (strain, countdown)
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [updateInfection, setSpreadCountdown, setLeaderboard, setStrain, tokenAddress]);

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
