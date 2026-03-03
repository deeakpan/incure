'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useGameStore } from '@/app/store/gameStore';
import { CHEMICALS, CHEMICAL_IDS, COMMON_CHEMICALS, UNCOMMON_CHEMICALS, RARE_CHEMICALS } from '@/app/utils/chemicals';
import { X, ShoppingBag, Store, Loader2, Search } from 'lucide-react';
import Image from 'next/image';

const PHARMACY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PHARMACY_CONTRACT_ADDRESS as `0x${string}` | undefined;
const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}` | undefined;

// Fixed prices from contract
const PRICES = {
  common: 10,   // 10 $INCURE
  uncommon: 50, // 50 $INCURE
  rare: 200,     // 200 $INCURE
} as const;

// ERC20 ABI for allowance and approve
const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Pharmacy contract ABI
const PHARMACY_ABI = [
  {
    inputs: [
      { name: 'chemId', type: 'uint8' },
      { name: 'quantity', type: 'uint256' },
    ],
    name: 'buyFromPharmacy',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    name: 'getActiveListings',
    outputs: [
      {
        components: [
          { name: 'seller', type: 'address' },
          { name: 'chemId', type: 'uint8' },
          { name: 'quantity', type: 'uint256' },
          { name: 'pricePerUnit', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
        name: 'result',
        type: 'tuple[]',
      },
      { name: 'total', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
    ],
    name: 'buyFromListing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'chemId', type: 'uint8' },
      { name: 'quantity', type: 'uint256' },
      { name: 'pricePerUnit', type: 'uint256' },
    ],
    name: 'listForSale',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'cancelListing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextListingId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'listings',
    outputs: [
      { name: 'seller', type: 'address' },
      { name: 'chemId', type: 'uint8' },
      { name: 'quantity', type: 'uint256' },
      { name: 'pricePerUnit', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type Listing = {
  listingId: number;
  seller: `0x${string}`;
  chemId: number;
  quantity: bigint;
  pricePerUnit: bigint;
  active: boolean;
};

interface PharmacyProps {
  onPurchaseSuccess?: (message: string) => void;
}

export default function Pharmacy({ onPurchaseSuccess }: PharmacyProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'direct' | 'marketplace'>('direct');
  const [marketplaceMode, setMarketplaceMode] = useState<'buy' | 'sell'>('buy');
  const [rarityFilter, setRarityFilter] = useState<'all' | 'common' | 'uncommon' | 'rare'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChem, setSelectedChem] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [listPrice, setListPrice] = useState('');
  const [buyQuantity, setBuyQuantity] = useState<{ [key: number]: number }>({});
  const { inventory } = useGameStore();
  const { address, isConnected } = useAccount();
  const purchaseSuccessShown = useRef<string | null>(null);

  // Contract hooks
  const { writeContract: writePurchase, isPending: isPurchasing, data: purchaseHash } = useWriteContract();
  const { writeContract: writeApprove, isPending: isApproving, data: approveHash } = useWriteContract();
  const { writeContract: writeBuyListing, isPending: isBuyingListing, data: buyListingHash } = useWriteContract();
  const { writeContract: writeListForSale, isPending: isListing, data: listHash } = useWriteContract();
  const { writeContract: writeCancelListing, isPending: isCancelling, data: cancelHash } = useWriteContract();
  
  const { isLoading: isConfirmingApprove } = useWaitForTransactionReceipt({ hash: approveHash });
  
  const { isLoading: isConfirming, isSuccess: isPurchaseSuccess } = useWaitForTransactionReceipt({ hash: purchaseHash });
  const { isLoading: isConfirmingBuy } = useWaitForTransactionReceipt({ hash: buyListingHash });
  const { isLoading: isConfirmingList } = useWaitForTransactionReceipt({ hash: listHash });
  const { isLoading: isConfirmingCancel } = useWaitForTransactionReceipt({ hash: cancelHash });

  // Fetch nextListingId to know the range of listing IDs
  const { data: nextListingId } = useReadContract({
    address: PHARMACY_CONTRACT_ADDRESS,
    abi: PHARMACY_ABI,
    functionName: 'nextListingId',
    query: {
      enabled: activeTab === 'marketplace' && !!PHARMACY_CONTRACT_ADDRESS,
      refetchInterval: 10000,
    },
  });

  // Fetch active listings
  const { data: listingsData, refetch: refetchListings } = useReadContract({
    address: PHARMACY_CONTRACT_ADDRESS,
    abi: PHARMACY_ABI,
    functionName: 'getActiveListings',
    args: [BigInt(0), BigInt(100)], // offset 0, limit 100
    query: {
      enabled: activeTab === 'marketplace' && !!PHARMACY_CONTRACT_ADDRESS,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  // Map listings to their actual IDs
  // Note: getActiveListings doesn't return IDs, so we need to match them
  // For MVP, we'll iterate through possible IDs and match by properties
  // In production, consider tracking listing IDs from events or modifying contract
  const listings: Listing[] = (() => {
    const rawListings = (listingsData?.[0] as Omit<Listing, 'listingId'>[]) || [];
    if (!nextListingId || rawListings.length === 0) return [];
    
    // For now, use index as listingId (limitation: assumes order matches)
    // TODO: Implement proper ID matching via events or contract modification
    return rawListings.map((listing, index) => ({
      listingId: index, // Temporary - needs proper ID tracking
      ...listing,
    }));
  })();

  // Helper function to get price by rarity
  const getPrice = (chemId: number): number => {
    const chem = CHEMICALS[chemId as keyof typeof CHEMICALS];
    if (chem.rarity === 'common') return PRICES.common;
    if (chem.rarity === 'uncommon') return PRICES.uncommon;
    return PRICES.rare;
  };

  // Calculate required amount for purchase
  const getRequiredAmount = (): bigint => {
    if (!selectedChem || !quantity || quantity === '') return BigInt(0);
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return BigInt(0);
    const price = getPrice(selectedChem);
    return parseEther((qty * price).toString());
  };

  // Check allowance
  const requiredAmount = getRequiredAmount();
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && PHARMACY_CONTRACT_ADDRESS ? [address, PHARMACY_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: isConnected && !!address && !!TOKEN_CONTRACT_ADDRESS && !!PHARMACY_CONTRACT_ADDRESS && selectedChem !== null && quantity !== '',
      refetchInterval: 5000,
    },
  });

  const hasEnoughAllowance = allowance && requiredAmount > 0 ? allowance >= requiredAmount : false;

  const handleApprove = () => {
    if (!TOKEN_CONTRACT_ADDRESS || !PHARMACY_CONTRACT_ADDRESS || !requiredAmount) return;
    
    // Approve a large amount to avoid repeated approvals
    const approveAmount = parseEther('1000000'); // 1M $INCURE
    
    writeApprove({
      address: TOKEN_CONTRACT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PHARMACY_CONTRACT_ADDRESS, approveAmount],
    });
  };

  const handlePurchase = () => {
    if (!selectedChem || !PHARMACY_CONTRACT_ADDRESS || !quantity || quantity === '') return;
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return;
    
    writePurchase({
      address: PHARMACY_CONTRACT_ADDRESS,
      abi: PHARMACY_ABI,
      functionName: 'buyFromPharmacy',
      args: [selectedChem as number, BigInt(qty)],
    });
  };

  // Marketplace handlers
  const handleBuyFromListing = (listingId: number, qty: number) => {
    if (!PHARMACY_CONTRACT_ADDRESS) return;
    writeBuyListing({
      address: PHARMACY_CONTRACT_ADDRESS,
      abi: PHARMACY_ABI,
      functionName: 'buyFromListing',
      args: [BigInt(listingId), BigInt(qty)],
    });
  };

  const handleListForSale = () => {
    if (!selectedChem || !listPrice || !PHARMACY_CONTRACT_ADDRESS || !quantity || quantity === '') return;
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return;
    const priceInWei = parseEther(listPrice);
    writeListForSale({
      address: PHARMACY_CONTRACT_ADDRESS,
      abi: PHARMACY_ABI,
      functionName: 'listForSale',
      args: [selectedChem as number, BigInt(qty), priceInWei],
    });
  };

  const handleCancelListing = (listingId: number) => {
    if (!PHARMACY_CONTRACT_ADDRESS) return;
    writeCancelListing({
      address: PHARMACY_CONTRACT_ADDRESS,
      abi: PHARMACY_ABI,
      functionName: 'cancelListing',
      args: [BigInt(listingId)],
    });
  };

  // Reset form on successful transactions
  useEffect(() => {
    if (purchaseHash && isPurchaseSuccess && purchaseSuccessShown.current !== purchaseHash) {
      const chemName = selectedChem ? CHEMICALS[selectedChem as keyof typeof CHEMICALS].name : 'chemicals';
      const qty = quantity || '1';
      purchaseSuccessShown.current = purchaseHash;
      onPurchaseSuccess?.(`Successfully purchased ${qty}x ${chemName}!`);
      setSelectedChem(null);
      setQuantity('1');
    }
    // Reset the ref when purchaseHash changes (new transaction)
    if (!purchaseHash) {
      purchaseSuccessShown.current = null;
    }
    if (approveHash && !isConfirmingApprove) {
      refetchAllowance();
    }
    if (listHash && !isConfirmingList) {
      setSelectedChem(null);
      setQuantity('1');
      setListPrice('');
      refetchListings();
    }
    if (buyListingHash && !isConfirmingBuy) {
      refetchListings();
    }
    if (cancelHash && !isConfirmingCancel) {
      refetchListings();
    }
  }, [purchaseHash, isPurchaseSuccess, approveHash, isConfirmingApprove, listHash, isConfirmingList, buyListingHash, isConfirmingBuy, cancelHash, isConfirmingCancel, refetchListings, refetchAllowance, selectedChem, quantity]);

  return (
    <>
      {/* Pharmacy Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-3 px-6 py-3 bg-[#00aa55] text-[#060a0d] font-bold rounded-lg hover:shadow-[0_0_20px_rgba(0,170,85,0.3)] transition-all"
      >
        <span>Pharmacy</span>
        
        {/* Image inside button - round at top */}
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#060a0d] flex-shrink-0">
          <Image
            src="/OIP.webp"
            alt=""
            width={32}
            height={32}
            className="w-full h-full object-cover object-top"
            style={{ objectPosition: 'top' }}
            unoptimized
          />
        </div>
      </button>

      {/* Pharmacy Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-[calc(50%-200px)] top-1/2 -translate-y-1/2 z-50"
          >
            <div
              className="bg-[#0d1a14] border border-[#1a3a22] rounded-lg w-[400px] max-h-[75vh] overflow-y-auto shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-[#e8f5e9]">Pharmacy</h2>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setSelectedChem(null);
                      setRarityFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-[#6a8f72] hover:text-[#e8f5e9]"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Selected Chemical Display */}
                {selectedChem && activeTab === 'direct' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 p-3 bg-[#1a3a22] rounded-lg border border-[#00aa55]/30"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                        <img
                          src={CHEMICALS[selectedChem as keyof typeof CHEMICALS].iconPath}
                          alt={CHEMICALS[selectedChem as keyof typeof CHEMICALS].name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-[#e8f5e9]">
                            {CHEMICALS[selectedChem as keyof typeof CHEMICALS].name}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            CHEMICALS[selectedChem as keyof typeof CHEMICALS].rarity === 'common' ? 'bg-[#00aa55]/20 text-[#00aa55]' :
                            CHEMICALS[selectedChem as keyof typeof CHEMICALS].rarity === 'uncommon' ? 'bg-[#00aaff]/20 text-[#00aaff]' :
                            'bg-[#ffd700]/20 text-[#ffd700]'
                          }`}>
                            {CHEMICALS[selectedChem as keyof typeof CHEMICALS].rarity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-[#6a8f72] leading-relaxed">
                          {CHEMICALS[selectedChem as keyof typeof CHEMICALS].description}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedChem(null)}
                        className="text-[#6a8f72] hover:text-[#e8f5e9] flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Tabs */}
                <div className="flex gap-1.5 mb-3">
                  <button
                    onClick={() => {
                      setActiveTab('direct');
                      setSelectedChem(null);
                      setSearchQuery('');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      activeTab === 'direct'
                        ? 'bg-[#00aa55] text-[#060a0d] shadow-[0_0_8px_rgba(0,170,85,0.3)]'
                        : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                    }`}
                  >
                    <Store size={14} />
                    Direct
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('marketplace');
                      setSelectedChem(null);
                      setSearchQuery('');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      activeTab === 'marketplace'
                        ? 'bg-[#00aa55] text-[#060a0d] shadow-[0_0_8px_rgba(0,170,85,0.3)]'
                        : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                    }`}
                  >
                    <ShoppingBag size={14} />
                    Marketplace
                  </button>
                </div>

                {/* Direct Purchase Tab */}
                {activeTab === 'direct' && (
                  <div>
                    {!isConnected ? (
                      <div className="text-center py-8">
                        <p className="text-[#6a8f72]">Connect your wallet to purchase chemicals</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Rarity Filter Tabs */}
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => setRarityFilter('all')}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                              rarityFilter === 'all'
                                ? 'bg-[#00aa55] text-[#060a0d]'
                                : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                            }`}
                          >
                            All
                          </button>
                          <button
                            onClick={() => setRarityFilter('common')}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                              rarityFilter === 'common'
                                ? 'bg-[#00aa55] text-[#060a0d]'
                                : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                            }`}
                          >
                            Common ({PRICES.common})
                          </button>
                          <button
                            onClick={() => setRarityFilter('uncommon')}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                              rarityFilter === 'uncommon'
                                ? 'bg-[#00aaff] text-[#060a0d]'
                                : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                            }`}
                          >
                            Uncommon ({PRICES.uncommon})
                          </button>
                          <button
                            onClick={() => setRarityFilter('rare')}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                              rarityFilter === 'rare'
                                ? 'bg-[#ffd700] text-[#060a0d]'
                                : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                            }`}
                          >
                            Rare ({PRICES.rare})
                          </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a8f72]" />
                          <input
                            type="text"
                            placeholder="Search chemicals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-[#0d1a14] border border-[#1a3a22] rounded text-[#e8f5e9] text-xs focus:border-[#00aa55] focus:outline-none"
                          />
                        </div>

                        {/* Chemical Grid */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {(rarityFilter === 'all' ? CHEMICAL_IDS :
                            rarityFilter === 'common' ? COMMON_CHEMICALS :
                            rarityFilter === 'uncommon' ? UNCOMMON_CHEMICALS :
                            RARE_CHEMICALS)
                            .filter((chemId) => {
                              const chem = CHEMICALS[chemId as keyof typeof CHEMICALS];
                              if (!searchQuery) return true;
                              return chem.name.toLowerCase().includes(searchQuery.toLowerCase());
                            })
                            .map((chemId) => {
                            const chem = CHEMICALS[chemId as keyof typeof CHEMICALS];
                            const isSelected = selectedChem === chemId;
                            const price = getPrice(chemId);
                            const color = chem.rarity === 'common' ? '#00aa55' : chem.rarity === 'uncommon' ? '#00aaff' : '#ffd700';
                            
                            return (
                              <motion.button
                                key={chemId}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => setSelectedChem(chemId)}
                                className={`p-2 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? 'bg-[#1a3a22]'
                                    : 'border-[#1a3a22] bg-[#0d1a14] hover:border-[#00aa55]/50'
                                }`}
                                style={isSelected ? {
                                  borderColor: color,
                                  boxShadow: `0 0 10px ${color}40`,
                                } : {}}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-10 h-10 flex items-center justify-center">
                                    <img
                                      src={chem.iconPath}
                                      alt={chem.name}
                                      className="w-full h-full object-contain"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  </div>
                                  <div className="text-xs font-bold text-[#e8f5e9] truncate w-full text-center">
                                    {chem.name}
                                  </div>
                                  <div className={`text-xs font-bold`} style={{ color }}>
                                    {price}
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Purchase Controls */}
                        {selectedChem && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 p-3 bg-[#1a3a22] rounded-lg border border-[#00aa55]/30"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '0') {
                                    setQuantity('');
                                  } else {
                                    const num = parseInt(val);
                                    if (!isNaN(num) && num > 0) {
                                      setQuantity(Math.min(100, num).toString());
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  if (quantity === '' || parseInt(quantity) <= 0) {
                                    setQuantity('1');
                                  }
                                }}
                                className="w-16 p-1.5 bg-[#0d1a14] border border-[#1a3a22] rounded text-[#e8f5e9] text-xs focus:border-[#00aa55] focus:outline-none"
                              />
                              <div className="flex-1">
                                <div className="text-xs text-[#6a8f72]">Total:</div>
                                <div className="text-base font-bold text-[#00aa55]">
                                  {selectedChem && quantity && quantity !== '' ? (parseInt(quantity) || 0) * getPrice(selectedChem) : 0} $INCURE
                                </div>
                              </div>
                              {!hasEnoughAllowance && requiredAmount > 0 ? (
                                <button
                                  onClick={handleApprove}
                                  disabled={isApproving || isConfirmingApprove || !TOKEN_CONTRACT_ADDRESS}
                                  className="px-3 py-1.5 bg-[#00aaff] text-white font-bold rounded hover:bg-[#0088cc] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
                                >
                                  {isApproving || isConfirmingApprove ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Approving...
                                    </>
                                  ) : (
                                    'Approve'
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={handlePurchase}
                                  disabled={isPurchasing || isConfirming || !PHARMACY_CONTRACT_ADDRESS || !quantity || quantity === '' || parseInt(quantity) <= 0}
                                  className="px-3 py-1.5 bg-[#00aa55] text-[#060a0d] font-bold rounded hover:bg-[#008844] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
                                >
                                  {isPurchasing || isConfirming ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      {isPurchasing ? 'Confirming...' : 'Processing...'}
                                    </>
                                  ) : (
                                    'Purchase'
                                  )}
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Marketplace Tab */}
                {activeTab === 'marketplace' && (
                  <div>
                    <p className="text-[#6a8f72] mb-6">Buy and sell chemicals with other players</p>
                    
                    {!isConnected ? (
                      <div className="text-center py-12">
                        <p className="text-[#6a8f72]">Connect your wallet to use the marketplace</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Buy/Sell Mode Toggle */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMarketplaceMode('buy')}
                            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all ${
                              marketplaceMode === 'buy'
                                ? 'bg-[#00aa55] text-[#060a0d] shadow-[0_0_15px_rgba(0,170,85,0.4)]'
                                : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                            }`}
                          >
                            Buy from Players
                          </button>
                          <button
                            onClick={() => setMarketplaceMode('sell')}
                            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all ${
                              marketplaceMode === 'sell'
                                ? 'bg-[#00aa55] text-[#060a0d] shadow-[0_0_15px_rgba(0,170,85,0.4)]'
                                : 'bg-[#1a3a22] text-[#6a8f72] hover:bg-[#1f4528]'
                            }`}
                          >
                            List for Sale
                          </button>
                        </div>

                        {/* Buy Mode */}
                        {marketplaceMode === 'buy' && (
                          <div>
                            <h3 className="text-lg font-bold text-[#e8f5e9] mb-4">
                              Available Listings ({listings.length})
                            </h3>
                            {listings.length === 0 ? (
                              <div className="text-[#6a8f72] text-center py-12">
                                <p>No listings available</p>
                                <p className="text-sm mt-2">Be the first to list chemicals for sale!</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {listings.map((listing) => {
                                  const chem = CHEMICALS[listing.chemId as keyof typeof CHEMICALS];
                                  const listingId = listing.listingId;
                                  const qty = buyQuantity[listingId] || 1;
                                  const totalPrice = listing.pricePerUnit * BigInt(qty);
                                  const isOwnListing = listing.seller.toLowerCase() === address?.toLowerCase();
                                  
                                  return (
                                    <motion.div
                                      key={listingId}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="p-4 bg-[#1a3a22]/50 rounded-lg border border-[#1a3a22] hover:border-[#00aa55]/50 transition-all"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                                            <img
                                              src={chem.iconPath}
                                              alt={chem.name}
                                              className="w-full h-full object-contain"
                                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[#e8f5e9]">{chem.name}</div>
                                            <div className="text-sm text-[#6a8f72] mt-1">
                                              Available: {listing.quantity.toString()} • {formatEther(listing.pricePerUnit)} $INCURE each
                                            </div>
                                            <div className="text-xs text-[#6a8f72] font-mono mt-1 truncate">
                                              Seller: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {!isOwnListing ? (
                                            <>
                                              <input
                                                type="number"
                                                min="1"
                                                max={Number(listing.quantity)}
                                                value={qty}
                                                onChange={(e) => setBuyQuantity({ ...buyQuantity, [listingId]: Math.max(1, parseInt(e.target.value) || 1) })}
                                                className="w-20 p-2 bg-[#0d1a14] border border-[#1a3a22] rounded text-[#e8f5e9] text-sm focus:border-[#00aa55] focus:outline-none"
                                              />
                                              <button
                                                onClick={() => handleBuyFromListing(listingId, qty)}
                                                disabled={isBuyingListing || isConfirmingBuy}
                                                className="px-4 py-2 bg-[#00aa55] text-[#060a0d] font-bold rounded-lg hover:bg-[#008844] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                              >
                                                {isBuyingListing || isConfirmingBuy ? 'Buying...' : 'Buy'}
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              onClick={() => handleCancelListing(listingId)}
                                              disabled={isCancelling || isConfirmingCancel}
                                              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            >
                                              {isCancelling || isConfirmingCancel ? 'Cancelling...' : 'Cancel'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {!isOwnListing && (
                                        <div className="mt-3 pt-3 border-t border-[#1a3a22] text-sm text-[#6a8f72]">
                                          Total: <span className="text-[#00aa55] font-bold">{formatEther(totalPrice)} $INCURE</span>
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sell Mode */}
                        {marketplaceMode === 'sell' && (
                          <div>
                            <h3 className="text-lg font-bold text-[#e8f5e9] mb-4">List Your Chemicals</h3>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm text-[#6a8f72] mb-2">Select Chemical</label>
                                <select
                                  value={selectedChem || ''}
                                  onChange={(e) => {
                                    setSelectedChem(Number(e.target.value) || null);
                                    setQuantity('1');
                                  }}
                                  className="w-full p-3 bg-[#1a3a22] border border-[#1a3a22] rounded-lg text-[#e8f5e9] focus:border-[#00aa55] focus:outline-none"
                                >
                                  <option value="">Choose a chemical...</option>
                                  {CHEMICAL_IDS.map((chemId) => {
                                    const chem = CHEMICALS[chemId as keyof typeof CHEMICALS];
                                    const qty = inventory[chemId] || 0;
                                    if (qty === 0) return null;
                                    return (
                                      <option key={chemId} value={chemId}>
                                        {chem.name} (You have: {qty})
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              {selectedChem && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-4"
                                >
                                  <div className="p-4 bg-[#1a3a22] rounded-lg">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="w-12 h-12 flex items-center justify-center">
                                        <img
                                          src={CHEMICALS[selectedChem as keyof typeof CHEMICALS].iconPath}
                                          alt={CHEMICALS[selectedChem as keyof typeof CHEMICALS].name}
                                          className="w-full h-full object-contain"
                                        />
                                      </div>
                                      <div>
                                        <div className="font-bold text-[#e8f5e9]">
                                          {CHEMICALS[selectedChem as keyof typeof CHEMICALS].name}
                                        </div>
                                        <div className="text-sm text-[#6a8f72]">
                                          {CHEMICALS[selectedChem as keyof typeof CHEMICALS].rarity.toUpperCase()}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-sm text-[#6a8f72] mb-2">Quantity (Max: {inventory[selectedChem] || 0})</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max={inventory[selectedChem] || 0}
                                          value={quantity}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || val === '0') {
                                              setQuantity('');
                                            } else {
                                              const num = parseInt(val);
                                              if (!isNaN(num) && num > 0) {
                                                setQuantity(Math.max(1, Math.min(inventory[selectedChem] || 0, num)).toString());
                                              }
                                            }
                                          }}
                                          onBlur={() => {
                                            if (quantity === '' || parseInt(quantity) <= 0) {
                                              setQuantity('1');
                                            }
                                          }}
                                          className="w-full p-3 bg-[#0d1a14] border border-[#1a3a22] rounded-lg text-[#e8f5e9] focus:border-[#00aa55] focus:outline-none"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm text-[#6a8f72] mb-2">Price per unit ($INCURE)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={listPrice}
                                          onChange={(e) => setListPrice(e.target.value)}
                                          placeholder="e.g., 15.5"
                                          className="w-full p-3 bg-[#0d1a14] border border-[#1a3a22] rounded-lg text-[#e8f5e9] focus:border-[#00aa55] focus:outline-none"
                                        />
                                        <p className="text-xs text-[#6a8f72] mt-1">Minimum: 1 $INCURE</p>
                                      </div>

                                      {listPrice && parseFloat(listPrice) > 0 && (
                                        <div className="p-3 bg-[#0d1a14] rounded-lg">
                                          <div className="flex justify-between text-sm">
                                            <span className="text-[#6a8f72]">Total listing value:</span>
                                            <span className="text-[#00aa55] font-bold">
                                              {(parseFloat(listPrice) * (parseInt(quantity) || 0)).toFixed(2)} $INCURE
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      <button
                                        onClick={handleListForSale}
                                        disabled={isListing || isConfirmingList || !listPrice || parseFloat(listPrice) < 1 || !quantity || quantity === '' || parseInt(quantity) < 1}
                                        className="w-full py-3 bg-[#00aa55] text-[#060a0d] font-bold rounded-lg hover:bg-[#008844] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                      >
                                        {isListing || isConfirmingList ? (
                                          <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {isListing ? 'Confirming...' : 'Listing...'}
                                          </>
                                        ) : (
                                          'List for Sale'
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
