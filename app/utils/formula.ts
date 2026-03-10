import { keccak256, encodePacked, hexToBytes } from 'viem';

/**
 * Derive formula from seed, regionId, and strain
 * This matches the logic in app/api/evaluate/route.ts
 */
export function deriveFormula(
  formulaSeed: `0x${string}`,
  regionId: number,
  currentStrain: number
): {
  targetChemIds: number[];
  targetRatios: number[];
} {
  // Derive a deterministic but unpredictable formula from the seed
  // Mix regionId and strain into the derivation for per-region variation
  const packed = encodePacked(
    ['bytes32', 'uint8', 'uint8'],
    [formulaSeed, regionId, currentStrain]
  );
  const hash = keccak256(packed);

  // Convert hash to bytes
  const hashBytes = hexToBytes(hash);
  
  // Select 3 unique chemical IDs from the hash
  const chemIds: number[] = [];
  let used = new Set<number>();
  for (let i = 0; i < 6 && chemIds.length < 3; i += 2) {
    const value = (hashBytes[i] % 15) + 1; // 1-15
    if (!used.has(value)) {
      chemIds.push(value);
      used.add(value);
    }
  }
  
  // If we didn't get 3 unique IDs, fill with defaults
  while (chemIds.length < 3) {
    let candidate = 1;
    while (used.has(candidate) && candidate <= 15) candidate++;
    if (candidate <= 15) {
      chemIds.push(candidate);
      used.add(candidate);
    } else {
      chemIds.push(chemIds.length + 1); // Fallback
    }
  }

  // Derive ratios from hash bytes (must sum to 100, each 5-90)
  const ratio1 = 5 + (hashBytes[6] % 86); // 5-90
  const ratio2 = 5 + (hashBytes[7] % 86);
  const remaining = 100 - ratio1 - ratio2;
  const ratio3 = Math.max(5, Math.min(90, remaining));

  // Normalize to ensure sum is exactly 100
  const ratios = [ratio1, ratio2, ratio3];
  const total = ratios.reduce((a, b) => a + b, 0);
  const diff = 100 - total;
  if (diff !== 0) {
    ratios[0] += diff;
  }

  return {
    targetChemIds: chemIds.slice(0, 3),
    targetRatios: ratios,
  };
}
