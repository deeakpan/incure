'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useGameStore } from '@/app/store/gameStore';
import { REGIONS, REGION_ISOS } from '@/app/utils/regionData';
import { CHEMICALS, CHEMICAL_IDS, COMMON_CHEMICALS, UNCOMMON_CHEMICALS, RARE_CHEMICALS } from '@/app/utils/chemicals';
import { X, FlaskConical, Send, Zap } from 'lucide-react';

interface SelectedChemical {
  id: number;
  ratio: number;
}

interface EvaluationResult {
  cureEffect: number;
  success: boolean;
  signature: string;
  nonce: number;
}

const GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
const CHEMICAL_INVENTORY_ADDRESS = process.env.NEXT_PUBLIC_CHEMICAL_CONTRACT_ADDRESS as `0x${string}` | undefined;

// ERC1155 ABI for approval
const ERC1155_ABI = [
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const GAME_ABI = [
  {
    inputs: [
      { name: 'regionId', type: 'uint8' },
      { name: 'chemIds', type: 'uint8[3]' },
      { name: 'ratios', type: 'uint8[3]' },
      { name: 'cureEffect', type: 'uint8' },
      { name: 'success', type: 'bool' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'deployAntidote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export default function DeployLab() {
  const { selectedRegion, inventory, selectRegion, infectionData } = useGameStore();
  const { address, isConnected } = useAccount();
  const [selectedChemicals, setSelectedChemicals] = useState<SelectedChemical[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<number | null>(null);
  const [activeRarityTab, setActiveRarityTab] = useState<'common' | 'uncommon' | 'rare'>('common');

  const { writeContract: writeDeploy, isPending: isDeploying, data: deployHash } = useWriteContract();
  const { writeContract: writeApprove, isPending: isApproving, data: approveHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isDeploySuccess, error: deployError } = useWaitForTransactionReceipt({
    hash: deployHash,
  });
  const { isLoading: isConfirmingApprove } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Check if Game contract is approved to spend chemicals
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: CHEMICAL_INVENTORY_ADDRESS,
    abi: ERC1155_ABI,
    functionName: 'isApprovedForAll',
    args: address && GAME_CONTRACT_ADDRESS ? [address, GAME_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: isConnected && !!address && !!CHEMICAL_INVENTORY_ADDRESS && !!GAME_CONTRACT_ADDRESS,
      refetchInterval: 5000,
    },
  });

  // Get current nonce from contract
  const { data: currentNonce } = useReadContract({
    address: GAME_CONTRACT_ADDRESS,
    abi: GAME_ABI,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && !!GAME_CONTRACT_ADDRESS,
    },
  });

  const handleApprove = () => {
    if (!CHEMICAL_INVENTORY_ADDRESS || !GAME_CONTRACT_ADDRESS) return;
    writeApprove({
      address: CHEMICAL_INVENTORY_ADDRESS,
      abi: ERC1155_ABI,
      functionName: 'setApprovalForAll',
      args: [GAME_CONTRACT_ADDRESS, true],
    });
  };

  const isOpen = selectedRegion !== null;
  const regionData = selectedRegion
    ? REGIONS[REGION_ISOS.indexOf(selectedRegion) as keyof typeof REGIONS]
    : null;
  const regionId = selectedRegion ? REGION_ISOS.indexOf(selectedRegion) : null;
  const infectionPct = selectedRegion ? (infectionData[selectedRegion] || 0) : 0;

  const totalRatio = selectedChemicals.reduce((sum, chem) => sum + chem.ratio, 0);
  const canEvaluate = selectedChemicals.length === 3 && totalRatio === 100;
  const canDeploy = evaluationResult !== null && !isDeploying && !isConfirming && isApproved === true && infectionPct > 0;

  const handleAddChemical = (chemId: number) => {
    if (activeSlot === null) return;
    if (selectedChemicals.length >= 3) return;
    if (selectedChemicals.some((c) => c.id === chemId)) return;
    if ((inventory[chemId] || 0) < 1) return;

    const newChemicals = [...selectedChemicals];
    if (activeSlot < newChemicals.length) {
      newChemicals[activeSlot] = { id: chemId, ratio: 0 };
    } else {
      newChemicals.push({ id: chemId, ratio: 0 });
    }

    // Auto-set ratios
    if (newChemicals.length === 1) {
      newChemicals[0].ratio = 100;
    } else {
      const ratioPer = Math.floor(100 / newChemicals.length);
      newChemicals.forEach((chem) => {
        chem.ratio = ratioPer;
      });
      newChemicals[0].ratio += 100 - ratioPer * newChemicals.length;
    }

    setSelectedChemicals(newChemicals);
    setActiveSlot(null);
    setEvaluationResult(null); // Reset evaluation when chemicals change
  };

  const handleRemoveChemical = (index: number) => {
    const newChemicals = selectedChemicals.filter((_, i) => i !== index);
    if (newChemicals.length === 1) {
      newChemicals[0].ratio = 100;
    }
    setSelectedChemicals(newChemicals);
    setEvaluationResult(null);
  };

  const handleRatioChange = (index: number, newRatio: number) => {
    if (selectedChemicals.length === 1) return;

    // Allow individual slider control - no auto-adjustment
    const clamped = Math.max(5, Math.min(90, newRatio));
    const newChemicals = [...selectedChemicals];
    newChemicals[index].ratio = clamped;

    setSelectedChemicals(newChemicals);
    setEvaluationResult(null); // Reset evaluation when ratios change
  };

  const handleEvaluate = async () => {
    if (!canEvaluate || !selectedRegion || !address || regionId === null) return;

    setIsEvaluating(true);
    setEvaluationError(null);

    try {
      const chemIds = selectedChemicals.map((c) => c.id);
      const ratios = selectedChemicals.map((c) => c.ratio);

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: address,
          regionId: regionId,
          chemIds,
          ratios,
        }),
      });

      // Extract rate limit info from headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const resetAt = response.headers.get('X-RateLimit-Reset');
      
      if (remaining !== null) {
        setRateLimitRemaining(parseInt(remaining, 10));
      }
      if (resetAt !== null) {
        setRateLimitResetAt(parseInt(resetAt, 10));
      }

      if (!response.ok) {
        const error = await response.json();
        // Update rate limit info from error response if available
        if (error.rateLimit) {
          setRateLimitRemaining(0);
          setRateLimitResetAt(error.rateLimit.resetAt);
        }
        throw new Error(error.error || 'Evaluation failed');
      }

      const data = await response.json();
      setEvaluationResult({
        cureEffect: data.cureEffect,
        success: data.success,
        signature: data.signature,
        nonce: data.nonce,
      });
    } catch (error: any) {
      setEvaluationError(error.message || 'Failed to evaluate formula');
      console.error('Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Refetch approval after approval transaction
  useEffect(() => {
    if (approveHash && !isConfirmingApprove) {
      refetchApproval();
    }
  }, [approveHash, isConfirmingApprove, refetchApproval]);

  const handleDeploy = () => {
    // Check infection FIRST - this is the critical check
    if (!selectedRegion) return;
    const currentInfection = infectionData[selectedRegion] || 0;
    if (currentInfection === 0) {
      setEvaluationError('Cannot deploy to a cured region (0% infection)');
      return;
    }
    
    // Then check other conditions
    if (!canDeploy || !evaluationResult || regionId === null || !GAME_CONTRACT_ADDRESS) return;

    const chemIds = selectedChemicals.map((c) => c.id) as [number, number, number];
    const ratios = selectedChemicals.map((c) => c.ratio) as [number, number, number];

    // Pad arrays to length 3
    const paddedChemIds: [number, number, number] = [chemIds[0] || 0, chemIds[1] || 0, chemIds[2] || 0];
    const paddedRatios: [number, number, number] = [ratios[0] || 0, ratios[1] || 0, ratios[2] || 0];

    writeDeploy({
      address: GAME_CONTRACT_ADDRESS,
      abi: GAME_ABI,
      functionName: 'deployAntidote',
      args: [
        regionId,
        paddedChemIds,
        paddedRatios,
        evaluationResult.cureEffect,
        evaluationResult.success,
        BigInt(evaluationResult.nonce),
        evaluationResult.signature as `0x${string}`,
      ],
    });
  };

  // Reset on success
  if (isDeploySuccess) {
    setTimeout(() => {
      setSelectedChemicals([]);
      setEvaluationResult(null);
      selectRegion(null);
    }, 2000);
  }

  // Log deploy errors
  useEffect(() => {
    if (deployError) {
      console.error('Deploy transaction error:', deployError);
      const errorMessage = (deployError as any)?.message || (deployError as any)?.shortMessage || String(deployError);
      console.error('Error details:', {
        message: errorMessage,
        cause: (deployError as any)?.cause,
        name: (deployError as any)?.name,
      });
    }
  }, [deployError]);

  if (!isOpen || !regionData || regionId === null) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Deploy Lab - Center, Compact - No backdrop, Slide animation */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] z-[90] rounded-xl overflow-hidden"
            style={{
              background: 'rgba(13, 26, 20, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 170, 85, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1a3a22]/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-[#00aa55]" />
                <div>
                  <h2 className="text-sm font-bold text-[#e8f5e9]">Deploy Antidote</h2>
                  <p className="text-[10px] text-[#6a8f72]">{regionData.name}</p>
                </div>
              </div>
              <button
                onClick={() => selectRegion(null)}
                className="p-1 rounded transition-colors hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5 text-[#6a8f72]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[70vh] scrollbar-hide">
              {/* Infection Status */}
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(198,40,40,0.08)', border: '1px solid rgba(198,40,40,0.2)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#6a8f72]">Infection</span>
                  <span className="text-sm font-bold text-[#c62828] tabular-nums">{infectionPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#1a3a22] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6f00] to-[#c62828] transition-all duration-500"
                    style={{ width: `${infectionPct}%` }}
                  />
                </div>
              </div>

              {/* Chemical Selection */}
              <div className="mb-4">
                <h3 className="text-xs font-bold text-[#e8f5e9] mb-2">Select Chemicals (3 required)</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((slotIndex) => {
                    const chem = selectedChemicals[slotIndex];
                    return (
                      <motion.button
                        key={slotIndex}
                        onClick={() => {
                          if (!chem) setActiveSlot(slotIndex);
                        }}
                        className={`relative p-2.5 rounded-lg border transition-all ${
                          activeSlot === slotIndex
                            ? 'border-[#00aa55] bg-[#00aa55]/10'
                            : chem
                            ? 'border-[#1a3a22] bg-[#0d1a14]'
                            : 'border-dashed border-[#1a3a22] bg-transparent hover:border-[#6a8f72]'
                        }`}
                        whileHover={{ scale: chem ? 1.02 : 1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {chem ? (
                          <>
                            <div className="w-8 h-8 mx-auto mb-1.5 flex items-center justify-center">
                              <img
                                src={CHEMICALS[chem.id as keyof typeof CHEMICALS].iconPath}
                                alt={CHEMICALS[chem.id as keyof typeof CHEMICALS].name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="text-[10px] text-[#e8f5e9] font-medium text-center leading-tight">
                              {CHEMICALS[chem.id as keyof typeof CHEMICALS].name}
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveChemical(slotIndex);
                              }}
                              className="absolute top-1 right-1 p-0.5 rounded hover:bg-white/5 cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5 text-[#6a8f72]" />
                            </div>
                          </>
                        ) : (
                          <div className="text-center text-[#6a8f72] py-3">
                            <div className="text-xl mb-0.5">+</div>
                            <div className="text-[10px]">Add</div>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Ratio Sliders - Attractive styling */}
              {selectedChemicals.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-[#e8f5e9] mb-3">Adjust Ratios</h3>
                  <div className="space-y-4">
                    {selectedChemicals.map((chem, index) => (
                      <div key={index} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#e8f5e9] truncate mr-2">
                            {CHEMICALS[chem.id as keyof typeof CHEMICALS].name}
                          </span>
                          <span className="text-sm font-bold text-[#00aa55] tabular-nums shrink-0 px-2 py-0.5 rounded bg-[#00aa55]/10 border border-[#00aa55]/20">
                            {chem.ratio}%
                          </span>
                        </div>
                        <div className="relative">
                          <div className="relative w-full h-3 rounded-full overflow-hidden" style={{ background: '#1a3a22' }}>
                            {/* Filled portion - colorful gradient that fills as you slide */}
                            <div
                              className="absolute left-0 top-0 h-full rounded-full transition-all duration-150 z-0"
                              style={{
                                width: `${((chem.ratio - 5) / (90 - 5)) * 100}%`,
                                background: 'linear-gradient(90deg, #00aa55 0%, #00cc66 15%, #00aaff 30%, #0088ff 45%, #9c27b0 60%, #ff6f00 75%, #c62828 90%, #ff1744 100%)',
                                boxShadow: 'inset 0 0 8px rgba(0, 170, 85, 0.3)',
                              }}
                            />
                            <input
                              type="range"
                              min="5"
                              max="90"
                              value={chem.ratio}
                              onChange={(e) => handleRatioChange(index, parseInt(e.target.value))}
                              disabled={selectedChemicals.length === 1}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            {/* Colorful visible thumb that matches the position */}
                            <div
                              className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150 pointer-events-none z-20"
                              style={{
                                left: `calc(${((chem.ratio - 5) / (90 - 5)) * 100}% - 12px)`,
                                width: '24px',
                                height: '24px',
                                background: `linear-gradient(135deg, ${
                                  chem.ratio < 30 ? '#00aa55' : chem.ratio < 60 ? '#00aaff' : '#ff6f00'
                                } 0%, ${
                                  chem.ratio < 30 ? '#00cc66' : chem.ratio < 60 ? '#0088ff' : '#c62828'
                                } 100%)`,
                                border: '3px solid #ffffff',
                                boxShadow: '0 0 16px rgba(0, 170, 85, 1), 0 0 24px rgba(0, 170, 85, 0.6), 0 4px 8px rgba(0, 0, 0, 0.5)',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className={`text-xs mt-3 text-center font-medium px-3 py-1.5 rounded-lg ${
                      totalRatio === 100
                        ? 'text-[#00aa55] bg-[#00aa55]/10 border border-[#00aa55]/20'
                        : 'text-[#c62828] bg-[#c62828]/10 border border-[#c62828]/20'
                    }`}
                  >
                    Total: <span className="font-bold">{totalRatio}%</span>
                    {totalRatio !== 100 && <span className="block text-[10px] mt-0.5">Must equal 100% to evaluate</span>}
                  </div>
                </div>
              )}

              {/* Evaluation Result */}
              {evaluationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 p-2.5 rounded-lg"
                  style={{
                    background: evaluationResult.success
                      ? 'rgba(0,170,85,0.12)'
                      : 'rgba(198,40,40,0.12)',
                    border: `1px solid ${evaluationResult.success ? 'rgba(0,170,85,0.3)' : 'rgba(198,40,40,0.3)'}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-[#6a8f72] mb-0.5">Result</div>
                      <div className={`text-sm font-bold ${evaluationResult.success ? 'text-[#00aa55]' : 'text-[#c62828]'}`}>
                        {evaluationResult.success ? '✓ Success' : '✗ Failed'}
                      </div>
                      {evaluationResult.success && (
                        <div className="text-xs text-[#6a8f72] mt-0.5">
                          Cure: {evaluationResult.cureEffect}%
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error Message */}
              {evaluationError && (
                <div className="mb-3 p-2 rounded-lg bg-[#c62828]/10 border border-[#c62828]/30 text-xs text-[#c62828]">
                  {evaluationError}
                </div>
              )}

              {/* Rate Limit Display */}
              {rateLimitRemaining !== null && (
                <div className="mb-2 text-xs text-[#6a8f72] flex items-center justify-between">
                  <span>Evaluations remaining this hour:</span>
                  <span className={`font-bold ${rateLimitRemaining === 0 ? 'text-[#c62828]' : rateLimitRemaining <= 3 ? 'text-[#ff6f00]' : 'text-[#00aa55]'}`}>
                    {rateLimitRemaining} / 10
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <motion.button
                  onClick={handleEvaluate}
                  disabled={!canEvaluate || isEvaluating || (rateLimitRemaining !== null && rateLimitRemaining === 0)}
                  className="flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: canEvaluate && !isEvaluating && (rateLimitRemaining === null || rateLimitRemaining > 0) ? 'linear-gradient(90deg, #00aa55, #00cc66)' : 'rgba(0,170,85,0.2)',
                    color: canEvaluate && !isEvaluating && (rateLimitRemaining === null || rateLimitRemaining > 0) ? '#060a0d' : '#6a8f72',
                    opacity: canEvaluate && !isEvaluating && (rateLimitRemaining === null || rateLimitRemaining > 0) ? 1 : 0.5,
                  }}
                  whileHover={canEvaluate && !isEvaluating && (rateLimitRemaining === null || rateLimitRemaining > 0) ? { scale: 1.02 } : {}}
                  whileTap={canEvaluate && !isEvaluating && (rateLimitRemaining === null || rateLimitRemaining > 0) ? { scale: 0.98 } : {}}
                >
                  {isEvaluating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      Evaluate
                    </>
                  )}
                </motion.button>

                {isApproved === false && evaluationResult !== null ? (
                  <motion.button
                    onClick={handleApprove}
                    disabled={isApproving || isConfirmingApprove || !CHEMICAL_INVENTORY_ADDRESS || !GAME_CONTRACT_ADDRESS}
                    className="flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 bg-[#00aa55] text-[#060a0d] disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={!isApproving && !isConfirmingApprove ? { scale: 1.02 } : {}}
                    whileTap={!isApproving && !isConfirmingApprove ? { scale: 0.98 } : {}}
                  >
                    {isApproving || isConfirmingApprove ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {isConfirmingApprove ? 'Confirming...' : 'Approving...'}
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        Approve Chemicals
                      </>
                    )}
                  </motion.button>
                ) : (
                  <>
                    {infectionPct === 0 && evaluationResult !== null && (
                      <div className="mb-2 text-xs text-[#6a8f72] text-center">
                        This region is already cured (0% infection)
                      </div>
                    )}
                    <motion.button
                      onClick={canDeploy ? handleDeploy : undefined}
                      disabled={!canDeploy}
                      className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${!canDeploy ? 'cursor-not-allowed pointer-events-none' : ''}`}
                      style={{
                        background: canDeploy ? 'linear-gradient(90deg, #00aaff, #0088cc)' : 'rgba(0,170,255,0.2)',
                        color: canDeploy ? '#060a0d' : '#6a8f72',
                        opacity: canDeploy ? 1 : 0.5,
                      }}
                      whileHover={canDeploy ? { scale: 1.02 } : {}}
                      whileTap={canDeploy ? { scale: 0.98 } : {}}
                    >
                    {isDeploying || isConfirming ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {isConfirming ? 'Confirming...' : 'Deploying...'}
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        Deploy
                      </>
                    )}
                  </motion.button>
                  </>
                )}
              </div>

              {/* Success Message */}
              {isDeploySuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-2 rounded-lg bg-[#00aa55]/20 border border-[#00aa55]/50 text-xs text-[#00aa55] text-center"
                >
                  ✓ Deployed successfully!
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Chemical Selection Popup - Compact with Tabs - No backdrop */}
          <AnimatePresence>
            {activeSlot !== null && (
              <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] max-w-[90vw] max-h-[60vh] z-[100] rounded-lg overflow-hidden"
                  style={{
                    background: 'rgba(13, 26, 20, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0, 170, 85, 0.2)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-[#e8f5e9]">Select Chemical</h3>
                      <button
                        onClick={() => setActiveSlot(null)}
                        className="p-1 rounded transition-colors hover:bg-white/5"
                      >
                        <X className="w-3.5 h-3.5 text-[#6a8f72]" />
                      </button>
                    </div>

                    {/* Rarity Tabs */}
                    <div className="flex gap-1 mb-3 p-1 rounded-lg bg-[#0d1a14] border border-[#1a3a22]">
                      <button
                        onClick={() => setActiveRarityTab('common')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                          activeRarityTab === 'common'
                            ? 'bg-[#00aa55] text-[#060a0d]'
                            : 'text-[#6a8f72] hover:text-[#e8f5e9]'
                        }`}
                      >
                        Common
                      </button>
                      <button
                        onClick={() => setActiveRarityTab('uncommon')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                          activeRarityTab === 'uncommon'
                            ? 'bg-[#00aa55] text-[#060a0d]'
                            : 'text-[#6a8f72] hover:text-[#e8f5e9]'
                        }`}
                      >
                        Uncommon
                      </button>
                      <button
                        onClick={() => setActiveRarityTab('rare')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                          activeRarityTab === 'rare'
                            ? 'bg-[#00aa55] text-[#060a0d]'
                            : 'text-[#6a8f72] hover:text-[#e8f5e9]'
                        }`}
                      >
                        Rare
                      </button>
                    </div>

                    {/* Chemical Grid - Filtered by Rarity */}
                    <div className="grid grid-cols-5 gap-2 max-h-[45vh] overflow-y-auto scrollbar-hide">
                      {(activeRarityTab === 'common'
                        ? COMMON_CHEMICALS
                        : activeRarityTab === 'uncommon'
                        ? UNCOMMON_CHEMICALS
                        : RARE_CHEMICALS
                      ).map((chemId) => {
                        const chem = CHEMICALS[chemId as keyof typeof CHEMICALS];
                        const qty = inventory[chemId] || 0;
                        const isSelected = selectedChemicals.some((c) => c.id === chemId);
                        const canSelect = qty > 0 && !isSelected;

                        return (
                          <motion.button
                            key={chemId}
                            onClick={() => {
                              if (canSelect) {
                                handleAddChemical(chemId);
                              }
                            }}
                            disabled={!canSelect}
                            className={`p-2 rounded-lg border transition-all ${
                              canSelect
                                ? 'border-[#1a3a22] bg-[#0d1a14] hover:border-[#00aa55] cursor-pointer'
                                : 'border-[#1a3a22]/50 bg-[#0d1a14]/50 opacity-50 cursor-not-allowed'
                            }`}
                            whileHover={canSelect ? { scale: 1.05 } : {}}
                            whileTap={canSelect ? { scale: 0.95 } : {}}
                          >
                            <div className="w-6 h-6 mb-1.5 mx-auto flex items-center justify-center">
                              <img
                                src={chem.iconPath}
                                alt={chem.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="text-[10px] text-[#6a8f72] mb-0.5 text-center leading-tight">{chem.name}</div>
                            <div className="text-[10px] text-[#00aa55] font-bold text-center">Qty: {qty}</div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
