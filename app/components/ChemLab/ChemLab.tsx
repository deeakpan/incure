'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReadContract } from 'wagmi';
import { useGameStore } from '@/app/store/gameStore';
import { REGIONS, REGION_ISOS } from '@/app/utils/regionData';
import { CHEMICALS, CHEMICAL_IDS } from '@/app/utils/chemicals';
import { deriveFormula } from '@/app/utils/formula';
import { X } from 'lucide-react';
import DeployLab from '../DeployLab/DeployLab';

const GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;

const GAME_ABI = [
  {
    name: 'formulaSeed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'currentStrain',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

interface SelectedChemical {
  id: number;
  ratio: number;
}

export default function ChemLab() {
  const { selectedRegion, inventory, selectRegion, currentStrain: storeStrain } = useGameStore();
  const [showDeployLab, setShowDeployLab] = useState(false);

  const isOpen = selectedRegion !== null;
  const regionData = useMemo(() => {
    if (!selectedRegion) return null;
    const regionIndex = REGION_ISOS.indexOf(selectedRegion as any);
    if (regionIndex < 0) return null;
    return REGIONS[regionIndex as keyof typeof REGIONS] || null;
  }, [selectedRegion]);
  const infectionPct = selectedRegion ? useGameStore.getState().infectionData[selectedRegion] || 0 : 0;

  // Get region ID for formula derivation
  const regionId = useMemo(() => {
    if (!selectedRegion) return null;
    const regionIndex = REGION_ISOS.indexOf(selectedRegion as any);
    return regionIndex >= 0 ? regionIndex : null;
  }, [selectedRegion]);

  // Read formulaSeed and currentStrain from contract
  const { data: formulaSeed } = useReadContract({
    address: GAME_CONTRACT_ADDRESS,
    abi: GAME_ABI,
    functionName: 'formulaSeed',
    query: {
      enabled: !!GAME_CONTRACT_ADDRESS && regionId !== null,
      refetchInterval: 60000, // Refetch every minute
    },
  });

  const { data: contractStrain } = useReadContract({
    address: GAME_CONTRACT_ADDRESS,
    abi: GAME_ABI,
    functionName: 'currentStrain',
    query: {
      enabled: !!GAME_CONTRACT_ADDRESS,
      refetchInterval: 60000,
    },
  });

  // Derive formula to get the 3 required chemicals
  const requiredChemicals = useMemo(() => {
    if (!formulaSeed || regionId === null || !contractStrain) return null;
    try {
      const formula = deriveFormula(formulaSeed as `0x${string}`, regionId, Number(contractStrain));
      return formula.targetChemIds.map(id => CHEMICALS[id as keyof typeof CHEMICALS]);
    } catch (error) {
      console.error('Error deriving formula:', error);
      return null;
    }
  }, [formulaSeed, regionId, contractStrain]);

  // Reset deploy lab when region changes
  useEffect(() => {
    if (!selectedRegion) {
      setShowDeployLab(false);
    }
  }, [selectedRegion]);

  if (!isOpen || !regionData) return null;

  const handleClose = () => {
    selectRegion(null);
    setShowDeployLab(false);
  };

  const handleDeployClick = () => {
    setShowDeployLab(true);
  };

  // Determine status text
  const getStatusText = () => {
    if (infectionPct === 0) return 'Cured ✓';
    if (infectionPct < 20) return 'Low Risk';
    if (infectionPct < 50) return 'Moderate Risk';
    if (infectionPct < 80) return 'High Risk';
    return 'Critical';
  };

  return (
    <>
      {/* DeployLab - Opens in center when Deploy is clicked */}
      {showDeployLab && <DeployLab />}

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-1/2 -translate-y-1/2 w-[280px] max-h-[80vh] z-40 bg-[#0d1a14] border-r border-[#1a3a22] backdrop-blur-md overflow-y-auto rounded-r-lg scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#e8f5e9]">
              {regionData.name}
            </h2>
            <button
              onClick={handleClose}
              className="text-[#6a8f72] hover:text-[#e8f5e9] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Country Details */}
          <>
            {/* Infection Status */}
            <div className="mb-6">
              <div className="text-sm text-[#6a8f72] mb-2">Infection</div>
              <div className="w-full h-3 bg-[#1a3a22] rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-[#ff6f00] to-[#c62828] transition-all duration-500"
                  style={{ width: `${infectionPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#c62828] font-bold tabular-nums text-lg">
                  {infectionPct}%
                </span>
                <span className="text-[#e8f5e9] text-sm">
                  {getStatusText()}
                </span>
              </div>
            </div>

            {/* Region Info */}
            <div className="mb-6 space-y-3">
              <div>
                <div className="text-sm text-[#6a8f72]">Country</div>
                <div className="text-[#e8f5e9] font-bold">{regionData.name}</div>
              </div>
              <div>
                <div className="text-sm text-[#6a8f72]">ISO Code</div>
                <div className="text-[#e8f5e9] font-mono">{selectedRegion}</div>
              </div>
            </div>

            {/* Active Chemicals Hints */}
            {requiredChemicals && requiredChemicals.length === 3 && (
              <div className="mb-6">
                <div className="text-sm text-[#6a8f72] mb-3">Active Compounds Detected</div>
                <div className="flex gap-3 justify-center">
                  {requiredChemicals.map((chem, index) => (
                    <div
                      key={chem.id}
                      className="relative w-16 h-16 rounded-lg overflow-hidden"
                      style={{
                        background: 'rgba(0,170,85,0.1)',
                        border: '1px solid rgba(0,170,85,0.3)',
                      }}
                    >
                      <img
                        src={chem.iconPath}
                        alt={chem.name}
                        className="w-full h-full object-contain"
                        style={{
                          filter: 'blur(12px)',
                          opacity: 0.4,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-[#6a8f72] text-center mt-2 italic">
                  Compounds obscured for analysis
                </div>
              </div>
            )}

            {/* Deploy Button - Opens DeployLab component */}
            <button
              onClick={handleDeployClick}
              className="w-full py-3 bg-[#00aa55] text-[#060a0d] rounded-lg font-bold text-base hover:bg-[#008844] hover:shadow-[0_0_20px_rgba(0,170,85,0.3)] transition-all"
            >
              Deploy
            </button>
          </>
        </div>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
