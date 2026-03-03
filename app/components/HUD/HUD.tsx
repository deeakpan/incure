'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/app/store/gameStore';
import { REGION_ISOS } from '@/app/utils/regionData';
import CustomConnectButton from '@/app/components/CustomConnectButton/CustomConnectButton';

export default function HUD() {
  const { infectionData, currentStrain, incureBalance, spreadCountdown, sidebarOpen } = useGameStore();

  // Calculate global infection % (average of 20 active regions)
  const globalInfection = useMemo(() => {
    const activeRegions = REGION_ISOS.filter(iso => infectionData[iso] !== undefined);
    if (activeRegions.length === 0) return 0;
    
    const sum = activeRegions.reduce((acc, iso) => acc + (infectionData[iso] || 0), 0);
    return Math.round(sum / activeRegions.length);
  }, [infectionData]);

  // Format countdown timer (MM:SS)
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format balance
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.01) return '<0.01';
    
    // Format large numbers with commas
    if (num >= 1000000) {
      const millions = num / 1000000;
      return `${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
    } else if (num >= 1000) {
      const thousands = num / 1000;
      return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
    }
    
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  return (
    <>
      {/* InCure branding - outside rectangle on the left */}
      <div className="fixed top-4 left-6 z-[60] font-logo text-2xl" data-incure-text style={{ color: '#00aa55', WebkitTextFillColor: '#00aa55' }}>
        InCure
      </div>

      {/* Floating stats rectangle - aligned left a bit */}
      <div className="fixed left-[42%] top-4 transform -translate-x-1/2 z-50 bg-[#0d1a14]/90 backdrop-blur-md border border-[#1a3a22] rounded-lg px-4 py-3 transition-all duration-300 hover:bg-[#0d1a14] hover:border-[#00aa55]/50 hover:shadow-lg hover:shadow-[#00aa55]/20">
        <div className="flex items-center gap-4">
          {/* Global Infection */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#6a8f72] text-sm">Global Infection:</span>
            <span className="font-bold tabular-nums text-base" data-infection-value style={{ color: '#ff4444', WebkitTextFillColor: '#ff4444' }}>
              {globalInfection}%
            </span>
          </div>

          {/* Spread Countdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#6a8f72] text-sm">Next Spread:</span>
            <span className="font-mono tabular-nums text-sm font-bold" data-spread-value style={{ color: '#00aa55', WebkitTextFillColor: '#00aa55' }}>
              {formatCountdown(spreadCountdown)}
            </span>
          </div>

          {/* Pathogen Strain */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#6a8f72] text-sm">Strain:</span>
            <span className="font-bold text-sm" data-strain-value style={{ color: '#00aa55', WebkitTextFillColor: '#00aa55' }}>
              Ω-{currentStrain}
            </span>
          </div>

          {/* $INCURE Balance */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#6a8f72] text-sm">$INCURE:</span>
            <span className="font-bold tabular-nums text-sm" data-balance-value style={{ color: '#00aa55', WebkitTextFillColor: '#00aa55' }}>
              {formatBalance(incureBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Connect Wallet - only show when sidebar is closed */}
      {!sidebarOpen && (
        <div className="fixed top-4 right-6 z-50">
          <CustomConnectButton />
        </div>
      )}
    </>
  );
}
