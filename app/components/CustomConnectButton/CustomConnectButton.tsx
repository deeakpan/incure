'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState } from 'react';
import Image from 'next/image';

export default function CustomConnectButton() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  // When not connected, show RainbowKit's ConnectButton
  if (!isConnected) {
    return <ConnectButton showBalance={{ smallScreen: false, largeScreen: false }} />;
  }

  // When connected, show custom button with Morty
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 bg-[#00aa55] hover:bg-[#008844] transition-all duration-200 px-3 py-1.5 rounded-lg border-2 border-[#00aa55] hover:border-[#008844] shadow-lg hover:shadow-[#00aa55]/30 font-bold text-sm text-black h-9"
        style={{ color: '#000000' }}
      >
        {/* Morty avatar */}
        <div className="w-6 h-6 rounded-full overflow-hidden bg-[#0d1a14] border border-[#00aa55] flex items-center justify-center flex-shrink-0">
          <Image
            src="/scientist.png"
            alt="Morty"
            width={24}
            height={24}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
        
        {/* Username */}
        <span className="font-bold text-sm leading-none">Morty</span>
        
        {/* Dropdown arrow */}
        <svg 
          width="10" 
          height="10" 
          viewBox="0 0 12 12" 
          fill="none" 
          className={`transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full right-0 mt-1.5 z-50 bg-[#0d1a14] border border-[#1a3a22] rounded-lg shadow-xl w-[180px] overflow-hidden">
            {/* Account info */}
            <div className="px-3 py-2 border-b border-[#1a3a22]">
              <div className="text-[10px] text-[#6a8f72] mb-0.5">Connected</div>
              <div className="text-xs text-white font-mono truncate">{address}</div>
            </div>
            
            {/* Disconnect button */}
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-xs text-white hover:bg-[#1a3a22] transition-colors"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
