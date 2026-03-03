-- InCure Game Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Regions table: Maps region IDs (0-19) to ISO codes and tracks infection
CREATE TABLE IF NOT EXISTS regions (
  id SMALLINT PRIMARY KEY,
  iso_code CHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  infection_pct SMALLINT NOT NULL DEFAULT 0 CHECK (infection_pct >= 0 AND infection_pct <= 100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chemicals table: Stores all 15 chemical compounds with metadata
-- Note: icon_path is stored in frontend code, not in database
CREATE TABLE IF NOT EXISTS chemicals (
  id SMALLINT PRIMARY KEY CHECK (id >= 1 AND id <= 15),
  name VARCHAR(100) NOT NULL UNIQUE,
  rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard table: Tracks player $INCURE earnings
CREATE TABLE IF NOT EXISTS leaderboard (
  address VARCHAR(42) PRIMARY KEY CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
  total_incure DECIMAL(18, 2) DEFAULT 0 CHECK (total_incure >= 0),
  week_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Historical infection data (optional, for analytics/charts)
CREATE TABLE IF NOT EXISTS infection_history (
  id BIGSERIAL PRIMARY KEY,
  region_id SMALLINT NOT NULL REFERENCES regions(id),
  infection_pct SMALLINT NOT NULL CHECK (infection_pct >= 0 AND infection_pct <= 100),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_regions_iso_code ON regions(iso_code);
CREATE INDEX IF NOT EXISTS idx_regions_infection ON regions(infection_pct);
CREATE INDEX IF NOT EXISTS idx_chemicals_rarity ON chemicals(rarity);
CREATE INDEX IF NOT EXISTS idx_chemicals_id ON chemicals(id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_incure ON leaderboard(total_incure DESC);
CREATE INDEX IF NOT EXISTS idx_infection_history_region_time ON infection_history(region_id, recorded_at DESC);

-- Seed 20 regions
INSERT INTO regions (id, iso_code, name, infection_pct) VALUES
  (0, 'US', 'United States', 45),
  (1, 'CA', 'Canada', 32),
  (2, 'BR', 'Brazil', 78),
  (3, 'AR', 'Argentina', 0),
  (4, 'GB', 'United Kingdom', 56),
  (5, 'FR', 'France', 67),
  (6, 'DE', 'Germany', 43),
  (7, 'RU', 'Russia', 89),
  (8, 'CN', 'China', 64),
  (9, 'IN', 'India', 52),
  (10, 'AU', 'Australia', 28),
  (11, 'JP', 'Japan', 0),
  (12, 'NG', 'Nigeria', 71),
  (13, 'ZA', 'South Africa', 59),
  (14, 'EG', 'Egypt', 0),
  (15, 'SA', 'Saudi Arabia', 0),
  (16, 'PK', 'Pakistan', 82),
  (17, 'ID', 'Indonesia', 46),
  (18, 'TR', 'Turkey', 0),
  (19, 'MX', 'Mexico', 41)
ON CONFLICT (id) DO UPDATE SET
  iso_code = EXCLUDED.iso_code,
  name = EXCLUDED.name;

-- Seed 15 chemicals
-- Icon paths are stored in frontend code (app/utils/chemicals.ts), not in database
INSERT INTO chemicals (id, name, rarity, description) VALUES
  -- Common (1-7)
  (1, 'Artemis', 'common', 'From artemisia plant, the most powerful natural antimalarial ever found'),
  (2, 'Quinine', 'common', 'From cinchona tree bark, been fighting malaria for 400 years'),
  (3, 'Berberine', 'common', 'From goldenseal root, kills bacteria by disrupting their cell division'),
  (4, 'Allicin', 'common', 'What garlic actually produces when crushed, proven antimicrobial'),
  (5, 'Curcumin', 'common', 'Active compound in turmeric, disrupts pathogen membranes'),
  (6, 'Thymol', 'common', 'From thyme oil, used in antiseptics and mouthwash globally'),
  (7, 'Resveratrol', 'common', 'Found in grape skin, inhibits viral replication'),
  
  -- Uncommon (8-11)
  (8, 'Lactoferrin', 'uncommon', 'Protein in human milk, binds iron that pathogens need to survive'),
  (9, 'Cryptolepine', 'uncommon', 'From West African shrub cryptolepis, potent antimicrobial alkaloid'),
  (10, 'Andrographine', 'uncommon', 'From andrographis plant, used across Asia for infections'),
  (11, 'Piperin', 'uncommon', 'From black pepper, enhances bioavailability and has direct antimicrobial action'),
  
  -- Rare (12-15)
  (12, 'Defensin', 'rare', 'Antimicrobial peptide your own immune cells produce'),
  (13, 'Cathelicidin', 'rare', 'Human peptide that punches holes directly in pathogen membranes'),
  (14, 'Squalamine', 'rare', 'From shark liver, broad spectrum antimicrobial, kills viruses and bacteria'),
  (15, 'Retrocyclin', 'rare', 'Ancient human peptide reactivated from dormant DNA, kills HIV and flu')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaderboard_updated_at
  BEFORE UPDATE ON leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Allow public read access, restrict writes to authenticated users
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE infection_history ENABLE ROW LEVEL SECURITY;

-- Policies: Allow public read access
CREATE POLICY "Public read access for regions" ON regions FOR SELECT USING (true);
CREATE POLICY "Public read access for chemicals" ON chemicals FOR SELECT USING (true);
CREATE POLICY "Public read access for leaderboard" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Public read access for infection_history" ON infection_history FOR SELECT USING (true);

-- Policies: Allow service role to write (for backend)
-- Note: Service role bypasses RLS, so these are optional but good practice
CREATE POLICY "Service role can write regions" ON regions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write chemicals" ON chemicals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write leaderboard" ON leaderboard FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write infection_history" ON infection_history FOR ALL USING (auth.role() = 'service_role');
