'use client';

import { useState, useEffect } from 'react';
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingBag, Beaker, Sparkles, X, User, Trophy, Zap, FlaskConical, Clock } from 'lucide-react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { useGameStore } from '@/app/store/gameStore';
import { CHEMICALS, CHEMICAL_IDS } from '@/app/utils/chemicals';
import CustomConnectButton from '@/app/components/CustomConnectButton/CustomConnectButton';

// ── Types ─────────────────────────────────────────────────────────────────
type Tab = 'common' | 'uncommon' | 'rare';
type Chemical = {
  name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  iconPath: string;
  description?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; color: string; glow: string }[] = [
  { id: 'common',   label: 'Common',   color: '#00aa55', glow: 'rgba(0,170,85,0.3)'   },
  { id: 'uncommon', label: 'Uncommon', color: '#00aaff', glow: 'rgba(0,170,255,0.3)'  },
  { id: 'rare',     label: 'Rare',     color: '#ffd700', glow: 'rgba(255,215,0,0.3)'  },
];

const RARITY_STYLES = {
  common:   { border: '#00aa55', bg: 'rgba(0,170,85,0.08)',   text: '#00aa55', badge: 'rgba(0,170,85,0.15)',   glow: 'rgba(0,170,85,0.3)'   },
  uncommon: { border: '#00aaff', bg: 'rgba(0,170,255,0.08)',  text: '#00aaff', badge: 'rgba(0,170,255,0.15)',  glow: 'rgba(0,170,255,0.3)'  },
  rare:     { border: '#ffd700', bg: 'rgba(255,215,0,0.08)',  text: '#ffd700', badge: 'rgba(255,215,0,0.15)',  glow: 'rgba(255,215,0,0.3)'  },
};

const GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
const CHEMICAL_INVENTORY_ADDRESS = process.env.NEXT_PUBLIC_CHEMICAL_CONTRACT_ADDRESS as `0x${string}` | undefined;

// Contract ABIs
const GAME_ABI = [
  {
    inputs: [],
    name: 'claimStarterKit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'hasStarterKit',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const CHEMICAL_INVENTORY_ABI = [
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'fieldLabs',
    outputs: [
      { name: 'slots', type: 'uint8' },
      { name: 'lastHarvest', type: 'uint256' },
      { name: 'stakedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'harvest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'buyFieldLab',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// ── Profile Section ────────────────────────────────────────────────────────
function ProfileSection() {
  const { address, isConnected } = useAccount();
  const { inventory, leaderboard } = useGameStore();

  // Get user rank from leaderboard
  const userRank = address && leaderboard.length > 0
    ? leaderboard.findIndex(entry => entry.address.toLowerCase() === address.toLowerCase()) + 1
    : null;

  // Mock stats (replace with real data later)
  const stats = {
    deploys: 42,
    username: 'Morty',
    totalChemicals: Object.values(inventory).reduce((sum, qty) => sum + (qty || 0), 0),
  };

  if (!isConnected) {
    return (
      <div className="px-5 pt-5 pb-4 space-y-3 shrink-0" style={{ borderBottom: '1px solid rgba(26,58,34,0.6)' }}>
        <CustomConnectButton />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 pt-5 pb-4 space-y-4 shrink-0"
      style={{ borderBottom: '1px solid rgba(26,58,34,0.6)' }}
    >
      {/* Profile Header */}
      <div className="flex items-center gap-3">
        {/* Avatar - Scientist image */}
        <motion.div
          className="w-12 h-12 rounded-xl shrink-0 relative overflow-hidden"
          style={{
            border: '2px solid rgba(0,170,85,0.4)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <img
            src="/scientist.png"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-3.5 h-3.5 text-[#00aa55]" />
            <span className="text-sm font-bold text-[#e8f5e9] truncate">{stats.username}</span>
          </div>
          <div className="text-[10px] text-[#6a8f72] font-mono truncate">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <motion.div
          className="rounded-lg px-3 py-2.5 text-center"
          style={{
            background: 'rgba(0,170,85,0.08)',
            border: '1px solid rgba(0,170,85,0.2)',
          }}
          whileHover={{ scale: 1.05, borderColor: '#00aa55' }}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-[#00aa55]" />
            <span className="text-[10px] text-[#6a8f72] uppercase tracking-wider">Deploys</span>
          </div>
          <div className="text-base font-black text-[#00aa55] tabular-nums">{stats.deploys}</div>
        </motion.div>

        <motion.div
          className="rounded-lg px-3 py-2.5 text-center"
          style={{
            background: 'rgba(255,215,0,0.08)',
            border: '1px solid rgba(255,215,0,0.2)',
          }}
          whileHover={{ scale: 1.05, borderColor: '#ffd700' }}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-[#ffd700]" />
            <span className="text-[10px] text-[#6a8f72] uppercase tracking-wider">Rank</span>
          </div>
          <div className="text-base font-black text-[#ffd700] tabular-nums">
            {userRank ? `#${userRank}` : '—'}
          </div>
        </motion.div>

        <motion.div
          className="rounded-lg px-3 py-2.5 text-center"
          style={{
            background: 'rgba(0,170,255,0.08)',
            border: '1px solid rgba(0,170,255,0.2)',
          }}
          whileHover={{ scale: 1.05, borderColor: '#00aaff' }}
        >
          <div className="text-[10px] text-[#6a8f72] uppercase tracking-wider mb-1">Total</div>
          <div className="text-base font-black text-[#00aaff] tabular-nums">{stats.totalChemicals}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Field Lab Section ──────────────────────────────────────────────────────
function FieldLabSection() {
  const { address, isConnected } = useAccount();
  
  const { data: fieldLabData } = useReadContract({
    address: CHEMICAL_INVENTORY_ADDRESS,
    abi: CHEMICAL_INVENTORY_ABI,
    functionName: 'fieldLabs',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS,
      refetchInterval: 5000,
    },
  });

  const { writeContract: writeHarvest, isPending: isHarvesting, data: harvestHash } = useWriteContract();
  const { writeContract: writeBuyFieldLab, isPending: isBuying } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: harvestHash });

  const slots = fieldLabData?.[0] ?? 0;
  const lastHarvest = fieldLabData?.[1] ?? BigInt(0);
  const hasFieldLab = slots > 0;

  // Calculate time until next harvest (24 hours)
  const now = BigInt(Math.floor(Date.now() / 1000));
  const harvestCooldown = BigInt(86400); // 24 hours
  const nextHarvestTime = lastHarvest + harvestCooldown;
  const canHarvest = now >= nextHarvestTime;

  const handleHarvest = () => {
    if (!CHEMICAL_INVENTORY_ADDRESS) return;
    writeHarvest({
      address: CHEMICAL_INVENTORY_ADDRESS,
      abi: CHEMICAL_INVENTORY_ABI,
      functionName: 'harvest',
    });
  };

  const handleBuyFieldLab = () => {
    if (!CHEMICAL_INVENTORY_ADDRESS) return;
    writeBuyFieldLab({
      address: CHEMICAL_INVENTORY_ADDRESS,
      abi: CHEMICAL_INVENTORY_ABI,
      functionName: 'buyFieldLab',
      value: BigInt('50000000000000000'), // 0.05 STT
    });
  };

  if (!isConnected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 space-y-3"
      style={{
        background: 'rgba(0,170,85,0.08)',
        border: '1.5px solid rgba(0,170,85,0.3)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 text-[#00aa55]" />
        <h3 className="text-sm font-bold text-[#e8f5e9]">Field Lab</h3>
      </div>

      {!hasFieldLab ? (
        <div className="space-y-3">
          <p className="text-xs text-[#6a8f72]">
            Purchase a Field Lab to harvest chemicals daily. Start with 3 slots.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBuyFieldLab}
            disabled={isBuying}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-[#060a0d] transition-all"
            style={{ background: 'linear-gradient(90deg, #00aa55, #00cc66)' }}
          >
            {isBuying ? 'Processing...' : 'Buy Field Lab (0.05 STT)'}
          </motion.button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6a8f72]">Slots</span>
            <span className="text-sm font-bold text-[#00aa55]">{slots}/10</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleHarvest}
            disabled={!canHarvest || isHarvesting || isConfirming}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-[#060a0d] transition-all flex items-center justify-center gap-2"
            style={{ 
              background: canHarvest ? 'linear-gradient(90deg, #00aa55, #00cc66)' : 'rgba(0,170,85,0.2)',
              opacity: canHarvest ? 1 : 0.5,
            }}
          >
            {isHarvesting || isConfirming ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : canHarvest ? (
              <>
                <Sparkles className="w-4 h-4" />
                Harvest Chemicals
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Cooldown Active
              </>
            )}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// ── Chemical Detail Slideout ───────────────────────────────────────────────
function ChemicalSlideout({
  chemId,
  chem,
  qty,
  onClose,
}: {
  chemId: number;
  chem: Chemical;
  qty: number;
  onClose: () => void;
}) {
  const styles = RARITY_STYLES[chem.rarity];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-[380px] top-1/2 -translate-y-1/2 w-[320px] z-[90] rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, #0d1a14 0%, #060a0d 100%)',
          border: `1.5px solid ${styles.border}`,
          boxShadow: `0 0 30px ${styles.glow}, 0 20px 40px rgba(0,0,0,0.5)`,
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors hover:bg-white/5"
        >
          <X className="w-4 h-4 text-[#6a8f72]" />
        </button>

        {/* Icon */}
        <div
          className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-3"
          style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
        >
          <img
            src={chem.iconPath}
            alt={chem.name}
            className="w-10 h-10 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Name + badge */}
        <div className="text-center space-y-2 mb-4">
          <h3 className="text-lg font-bold text-[#e8f5e9]">{chem.name}</h3>
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: styles.badge, color: styles.text }}
          >
            {chem.rarity}
          </span>
        </div>

        {/* Description */}
        {chem.description && (
          <p className="text-xs text-[#6a8f72] text-center leading-relaxed mb-4">{chem.description}</p>
        )}

        {/* Quantity */}
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[10px] text-[#6a8f72] uppercase tracking-wider">Owned</span>
          <span className="text-xl font-bold tabular-nums" style={{ color: styles.text }}>
            {qty}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Supply Cap', value: chem.rarity === 'rare' ? '1M' : chem.rarity === 'uncommon' ? '5M' : '∞' },
            { label: 'Harvest', value: chem.rarity === 'rare' ? '2%' : chem.rarity === 'uncommon' ? '13%' : '85%' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg px-2.5 py-2 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-[9px] text-[#6a8f72] uppercase tracking-wider mb-1">{stat.label}</div>
              <div className="text-xs font-bold text-[#e8f5e9]">{stat.value}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Chemical Card ──────────────────────────────────────────────────────────
function ChemCard({
  chemId,
  chem,
  qty,
  onClick,
}: {
  chemId: number;
  chem: Chemical;
  qty: number;
  onClick: () => void;
}) {
  const styles = RARITY_STYLES[chem.rarity];
  const hasQty = qty > 0;

  return (
    <motion.button
      whileHover={{ scale: hasQty ? 1.04 : 1, y: hasQty ? -2 : 0 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative w-full rounded-xl p-3 text-left transition-all focus:outline-none"
      style={{
        background: hasQty ? styles.bg : 'rgba(255,255,255,0.02)',
        border: `1.5px solid ${hasQty ? styles.border : 'rgba(255,255,255,0.06)'}`,
        boxShadow: hasQty ? `0 0 12px ${styles.glow ?? 'transparent'}` : 'none',
        opacity: hasQty ? 1 : 0.4,
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 mx-auto"
        style={{ background: 'rgba(0,0,0,0.3)' }}
      >
        <img
          src={chem.iconPath}
          alt={chem.name}
          className="w-7 h-7 object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Name */}
      <div className="text-[11px] text-[#a0bfa8] text-center font-medium truncate mb-1.5" title={chem.name}>
        {chem.name}
      </div>

      {/* Qty */}
      <div
        className="text-base font-black text-center tabular-nums"
        style={{ color: hasQty ? styles.text : '#3a5a42' }}
      >
        {qty}
      </div>

      {/* Owned dot */}
      {hasQty && (
        <div
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
          style={{ background: styles.text }}
        />
      )}
    </motion.button>
  );
}

// ── Starter Pack Banner ────────────────────────────────────────────────────
function StarterBanner({ onClaim, isPending }: { onClaim: () => void; isPending: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-5 space-y-4"
      style={{
        background: 'linear-gradient(135deg, rgba(0,170,85,0.12) 0%, rgba(0,100,50,0.06) 100%)',
        border: '1.5px solid rgba(0,170,85,0.35)',
      }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
        style={{ background: 'rgba(0,170,85,0.2)' }}
      />

      <div className="flex items-start gap-3 relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,170,85,0.15)', border: '1px solid rgba(0,170,85,0.3)' }}
        >
          <Beaker className="w-5 h-5 text-[#00aa55]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#e8f5e9] mb-1">Starter Pack Available</h3>
          <p className="text-xs text-[#6a8f72] leading-relaxed">
            Claim 3× of each common compound to begin deploying cures.
          </p>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: isPending ? 1 : 1.02 }}
        whileTap={{ scale: isPending ? 1 : 0.98 }}
        onClick={onClaim}
        disabled={isPending}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-[#060a0d] transition-all relative overflow-hidden"
        style={{ 
          background: isPending ? 'rgba(0,170,85,0.5)' : 'linear-gradient(90deg, #00aa55, #00cc66)',
        }}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isPending ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Claim Free Starter Pack
            </>
          )}
        </span>
      </motion.button>
    </motion.div>
  );
}

// ── Pharmacy Button ────────────────────────────────────────────────────────
function PharmacyButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all"
      style={{
        background: 'rgba(198,40,40,0.08)',
        border: '1.5px solid rgba(198,40,40,0.3)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(198,40,40,0.15)' }}
      >
        <ShoppingBag className="w-4 h-4 text-[#c62828]" />
      </div>
      <div className="text-left">
        <div className="text-sm font-bold text-[#e8f5e9]">Pharmacy</div>
        <div className="text-xs text-[#6a8f72]">Buy & trade compounds</div>
      </div>
      <ChevronRight className="w-4 h-4 text-[#6a8f72] ml-auto" />
    </motion.button>
  );
}

// ── Inventory Fetcher Component ────────────────────────────────────────────
function InventoryFetcher() {
  const { address, isConnected } = useAccount();
  const { updateInventory } = useGameStore();

  // Fetch all 15 chemical balances explicitly
  const b1 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(1)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b2 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(2)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b3 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(3)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b4 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(4)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b5 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(5)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b6 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(6)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b7 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(7)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b8 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(8)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b9 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(9)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b10 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(10)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b11 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(11)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b12 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(12)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b13 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(13)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b14 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(14)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });
  const b15 = useReadContract({ address: CHEMICAL_INVENTORY_ADDRESS, abi: CHEMICAL_INVENTORY_ABI, functionName: 'balanceOf', args: address && CHEMICAL_INVENTORY_ADDRESS ? [address, BigInt(15)] : undefined, query: { enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS, refetchInterval: 5000 } });

  const balances = [b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15];

  // Update store when balances change
  useEffect(() => {
    balances.forEach(({ data }, index) => {
      if (data !== undefined) {
        updateInventory(index + 1, Number(data));
      }
    });
  }, [balances.map(b => b.data?.toString()).join(','), updateInventory]);

  return null;
}

// ── Main Sidebar ───────────────────────────────────────────────────────────
export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, inventory } = useGameStore();
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('common');
  const [selectedChem, setSelectedChem] = useState<number | null>(null);

  // Inventory fetcher component handles fetching

  // Check hasStarterKit from contract
  const { data: hasStarterKitFromContract, refetch: refetchStarterKit } = useReadContract({
    address: GAME_CONTRACT_ADDRESS,
    abi: GAME_ABI,
    functionName: 'hasStarterKit',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && !!GAME_CONTRACT_ADDRESS,
      refetchInterval: 5000,
    },
  });

  const { writeContract: writeClaimStarter, isPending: isClaiming, data: claimHash } = useWriteContract();
  const { isLoading: isConfirmingClaim, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ 
    hash: claimHash 
  });

  // Refetch starter kit status after successful claim (inventory auto-refetches)
  useEffect(() => {
    if (isClaimSuccess) {
      setTimeout(() => {
        refetchStarterKit();
      }, 2000); // Wait 2 seconds for block confirmation
    }
  }, [isClaimSuccess, refetchStarterKit]);

  const hasStarterPack = hasStarterKitFromContract || 
    ((inventory[1] || 0) > 0 || (inventory[2] || 0) > 0 || (inventory[3] || 0) > 0);

  const filteredChems = CHEMICAL_IDS.filter((id) => {
    const chem = CHEMICALS[id as keyof typeof CHEMICALS] as Chemical;
    return chem.rarity === activeTab;
  });

  const totalOwned = Object.values(inventory).reduce((s, q) => s + (q || 0), 0);

  const handleClaimStarter = () => {
    if (!GAME_CONTRACT_ADDRESS || !isConnected) return;
    writeClaimStarter({
      address: GAME_CONTRACT_ADDRESS,
      abi: GAME_ABI,
      functionName: 'claimStarterKit',
    });
  };

  const handleOpenPharmacy = () => {
    // wire to pharmacy modal
    console.log('open pharmacy');
  };

  return (
    <>
      {/* Chemical detail slideout */}
      <AnimatePresence>
        {selectedChem !== null && sidebarOpen && (
          <ChemicalSlideout
            chemId={selectedChem}
            chem={CHEMICALS[selectedChem as keyof typeof CHEMICALS] as Chemical}
            qty={inventory[selectedChem] || 0}
            onClose={() => setSelectedChem(null)}
          />
        )}
      </AnimatePresence>

      {/* Toggle arrow */}
      <motion.button
        animate={{ right: sidebarOpen ? 388 : 16 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-1/2 -translate-y-1/2 z-50 p-2 rounded-lg transition-colors"
        style={{
          background: '#0d1a14',
          border: '1px solid #1a3a22',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {sidebarOpen
          ? <ChevronRight className="w-4 h-4 text-[#00aa55]" />
          : <ChevronLeft  className="w-4 h-4 text-[#00aa55]" />
        }
      </motion.button>

      {/* Inventory Fetcher - runs in background */}
      {isConnected && <InventoryFetcher />}

      {/* Sidebar panel */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-[380px] z-40 flex flex-col"
            style={{
              background: 'linear-gradient(180deg, #0a1510 0%, #060a0d 100%)',
              borderLeft: '1px solid rgba(26,58,34,0.8)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* ── Profile Section ── */}
            <ProfileSection />

            {/* ── Header with tabs ── */}
            <div
              className="px-5 pt-4 pb-4 space-y-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(26,58,34,0.6)' }}
            >
              {/* Total count */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#6a8f72]">
                  Compound Inventory
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,170,85,0.12)', color: '#00aa55' }}
                >
                  {totalOwned} owned
                </span>
              </div>

              {/* Tabs */}
              <div
                className="flex gap-1 p-1 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const tabCount = CHEMICAL_IDS.filter((id) => {
                    const c = CHEMICALS[id as keyof typeof CHEMICALS] as Chemical;
                    return c.rarity === tab.id && (inventory[id] || 0) > 0;
                  }).length;

                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex-1 relative py-2 rounded-lg text-xs font-bold transition-colors focus:outline-none"
                      style={{
                        color: isActive ? tab.color : '#6a8f72',
                        background: isActive ? `${tab.color}18` : 'transparent',
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {tab.label}
                      {tabCount > 0 && (
                        <span
                          className="ml-1 text-[10px] font-black"
                          style={{ color: tab.color, opacity: 0.8 }}
                        >
                          {tabCount}
                        </span>
                      )}
                      {isActive && (
                        <motion.div
                          layoutId="tab-indicator"
                          className="absolute inset-0 rounded-lg"
                          style={{
                            border: `1px solid ${tab.color}`,
                            opacity: 0.4,
                          }}
                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
              {/* Starter pack banner */}
              {!hasStarterPack && (
                <StarterBanner 
                  onClaim={handleClaimStarter} 
                  isPending={isClaiming || isConfirmingClaim}
                />
              )}

              {/* Field Lab Section */}
              {isConnected && <FieldLabSection />}

              {/* Chemical grid */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-3 gap-2.5"
                >
                  {filteredChems.map((chemId, i) => {
                    const chem = CHEMICALS[chemId as keyof typeof CHEMICALS] as Chemical;
                    return (
                      <motion.div
                        key={chemId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <ChemCard
                          chemId={chemId}
                          chem={chem}
                          qty={inventory[chemId] || 0}
                          onClick={() => setSelectedChem(chemId)}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {/* Empty state */}
              {filteredChems.length === 0 && (
                <div className="text-center py-12 space-y-2">
                  <div className="text-3xl opacity-30">⬡</div>
                  <p className="text-xs text-[#3a5a42]">No {activeTab} compounds found</p>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div
              className="px-5 py-4 shrink-0"
              style={{ borderTop: '1px solid rgba(26,58,34,0.6)' }}
            >
              <PharmacyButton onClick={handleOpenPharmacy} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
