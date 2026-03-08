import { create } from 'zustand';

interface GameState {
  // Infection data: ISO code -> infection percentage
  infectionData: Record<string, number>;
  
  // Selected region
  selectedRegion: string | null; // ISO code
  
  // Player inventory: chemical ID -> quantity
  inventory: Record<number, number>;
  
  // Player balance
  incureBalance: string;
  
  // Current strain
  currentStrain: number;
  
  // Leaderboard
  leaderboard: Array<{ address: string; score: number; deployments: number }>;
  
  // Spread countdown (seconds)
  spreadCountdown: number;
  
  // Sidebar open state
  sidebarOpen: boolean;
  
  // Actions
  updateInfection: (iso: string, pct: number) => void;
  selectRegion: (iso: string | null) => void;
  updateInventory: (chemId: number, quantity: number) => void;
  setBalance: (balance: string) => void;
  setStrain: (strain: number) => void;
  setLeaderboard: (leaderboard: Array<{ address: string; score: number; deployments: number }>) => void;
  setSpreadCountdown: (seconds: number | ((prev: number) => number)) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  infectionData: {},
  selectedRegion: null,
  inventory: {},
  incureBalance: '0',
  currentStrain: 1,
  leaderboard: [],
  spreadCountdown: 300, // 5 minutes
  sidebarOpen: false,
  
  updateInfection: (iso, pct) =>
    set((state) => ({
      infectionData: { ...state.infectionData, [iso]: pct },
    })),
  
  selectRegion: (iso) => set({ selectedRegion: iso }),
  
  updateInventory: (chemId, quantity) =>
    set((state) => ({
      inventory: { ...state.inventory, [chemId]: quantity },
    })),
  
  setBalance: (balance) => set({ incureBalance: balance }),
  
  setStrain: (strain) => set({ currentStrain: strain }),
  
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  
  setSpreadCountdown: (seconds) => set((state) => ({ 
    spreadCountdown: typeof seconds === 'function' ? seconds(state.spreadCountdown) : seconds 
  })),
  
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
