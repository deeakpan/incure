'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';

const GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;

const GAME_ABI = [
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'lastDeployTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DEPLOY_COOLDOWN',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export default function DeployCooldown() {
  const { address, isConnected } = useAccount();
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Read last deploy time and cooldown from contract
  const { data: lastDeployTime } = useReadContract({
    address: GAME_CONTRACT_ADDRESS,
    abi: GAME_ABI,
    functionName: 'lastDeployTime',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && !!GAME_CONTRACT_ADDRESS,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  const { data: deployCooldown } = useReadContract({
    address: GAME_CONTRACT_ADDRESS,
    abi: GAME_ABI,
    functionName: 'DEPLOY_COOLDOWN',
    query: {
      enabled: !!GAME_CONTRACT_ADDRESS,
    },
  });

  // Calculate remaining cooldown time
  useEffect(() => {
    if (!isConnected || !address || !lastDeployTime || !deployCooldown) {
      setRemainingSeconds(0);
      return;
    }

    const updateCooldown = () => {
      const lastDeploy = Number(lastDeployTime);
      const cooldown = Number(deployCooldown);
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - lastDeploy;
      const remaining = Math.max(0, cooldown - elapsed);
      setRemainingSeconds(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [isConnected, address, lastDeployTime, deployCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Always show, even when not connected (will show 00:00)
  return (
    <div className="fixed bottom-16 left-4 z-50 font-stopwatch tabular-nums text-xs cursor-pointer transition-all duration-300 hover:scale-110 hover:brightness-125" style={{ color: '#00ff88' }}>
      COOL DOWN: {formatTime(remainingSeconds)}
    </div>
  );
}
