/**
 * 15 chemicals - Common (1-7), Uncommon (8-11), Rare (12-15)
 * Icons stored locally in public/icons/
 */
export const CHEMICALS = {
  // Common (IDs 1-7)
  1: { id: 1, name: 'Artemis', rarity: 'common', description: 'From artemisia plant, the most powerful natural antimalarial ever found', iconPath: '/icons/artemis.png' },
  2: { id: 2, name: 'Quinine', rarity: 'common', description: 'From cinchona tree bark, been fighting malaria for 400 years', iconPath: '/icons/quinine.png' },
  3: { id: 3, name: 'Berberine', rarity: 'common', description: 'From goldenseal root, kills bacteria by disrupting their cell division', iconPath: '/icons/berberine.png' },
  4: { id: 4, name: 'Allicin', rarity: 'common', description: 'What garlic actually produces when crushed, proven antimicrobial', iconPath: '/icons/allicin.png' },
  5: { id: 5, name: 'Curcumin', rarity: 'common', description: 'Active compound in turmeric, disrupts pathogen membranes', iconPath: '/icons/curcumin.png' },
  6: { id: 6, name: 'Thymol', rarity: 'common', description: 'From thyme oil, used in antiseptics and mouthwash globally', iconPath: '/icons/thymol.png' },
  7: { id: 7, name: 'Resveratrol', rarity: 'common', description: 'Found in grape skin, inhibits viral replication', iconPath: '/icons/resveratrol.png' },
  
  // Uncommon (IDs 8-11)
  8: { id: 8, name: 'Lactoferrin', rarity: 'uncommon', description: 'Protein in human milk, binds iron that pathogens need to survive', iconPath: '/icons/lactoferrin.png' },
  9: { id: 9, name: 'Cryptolepine', rarity: 'uncommon', description: 'From West African shrub cryptolepis, potent antimicrobial alkaloid', iconPath: '/icons/cryptolepine.png' },
  10: { id: 10, name: 'Andrographine', rarity: 'uncommon', description: 'From andrographis plant, used across Asia for infections', iconPath: '/icons/andrographine.png' },
  11: { id: 11, name: 'Piperin', rarity: 'uncommon', description: 'From black pepper, enhances bioavailability and has direct antimicrobial action', iconPath: '/icons/piperin.png' },
  
  // Rare (IDs 12-15)
  12: { id: 12, name: 'Defensin', rarity: 'rare', description: 'Antimicrobial peptide your own immune cells produce', iconPath: '/icons/defensin.png' },
  13: { id: 13, name: 'Cathelicidin', rarity: 'rare', description: 'Human peptide that punches holes directly in pathogen membranes', iconPath: '/icons/cathelicidin.png' },
  14: { id: 14, name: 'Squalamine', rarity: 'rare', description: 'From shark liver, broad spectrum antimicrobial, kills viruses and bacteria', iconPath: '/icons/squalamine.png' },
  15: { id: 15, name: 'Retrocyclin', rarity: 'rare', description: 'Ancient human peptide reactivated from dormant DNA, kills HIV and flu', iconPath: '/icons/retrocyclin.png' },
} as const;

export const COMMON_CHEMICALS = [1, 2, 3, 4, 5, 6, 7]; // Starter pack chemicals
export const UNCOMMON_CHEMICALS = [8, 9, 10, 11];
export const RARE_CHEMICALS = [12, 13, 14, 15];
export const CHEMICAL_IDS = Object.keys(CHEMICALS).map(Number) as number[];
