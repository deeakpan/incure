import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
// This ensures environment variables are loaded before we try to access them
let supabase = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Warning: Supabase credentials not found. Database operations will fail.');
      return null;
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// Initialize database schema (run migration SQL in Supabase dashboard first)
export async function initDB() {
  const client = getSupabase();
  if (!client) {
    console.error('Supabase not initialized. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    return;
  }

  try {
    // Verify tables exist by checking regions table
    const { error } = await client.from('regions').select('id').limit(1);
    if (error) {
      console.error('Database tables not found. Please run supabase-migration.sql in your Supabase SQL Editor.');
      console.error('Error:', error.message);
    } else {
      console.log('Database connection verified');
    }
  } catch (error) {
    console.error('Database init error:', error);
  }
}

// Get all regions with infection data
export async function getGameState() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('regions')
    .select('id, iso_code, infection_pct')
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Update infection percentage for a region
export async function updateRegionInfection(regionId, infectionPct) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('regions')
    .update({ 
      infection_pct: infectionPct,
      updated_at: new Date().toISOString()
    })
    .eq('id', regionId);

  if (error) throw error;
}

// Batch update infection percentages
export async function batchUpdateInfection(updates) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  // Supabase doesn't support batch updates directly, so we do them sequentially
  // For better performance, you could use a stored procedure or RPC call
  const promises = updates.map(({ regionId, pct }) =>
    supabase
      .from('regions')
      .update({ 
        infection_pct: pct,
        updated_at: new Date().toISOString()
      })
      .eq('id', regionId)
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error).map(r => r.error);
  
  if (errors.length > 0) {
    throw new Error(`Batch update failed: ${errors.map(e => e.message).join(', ')}`);
  }
}

// Update leaderboard with new $INCURE earnings
export async function updateLeaderboard(address, amount) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  // Get current total or default to 0
  const { data: existing } = await supabase
    .from('leaderboard')
    .select('total_incure')
    .eq('address', address)
    .single();

  const newTotal = (existing?.total_incure || 0) + parseFloat(amount);

  const { error } = await supabase
    .from('leaderboard')
    .upsert({
      address,
      total_incure: newTotal,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'address'
    });

  if (error) throw error;
}

// Get leaderboard top N players
export async function getLeaderboard(limit = 10) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('leaderboard')
    .select('address, total_incure')
    .order('total_incure', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get all chemicals
export async function getChemicals() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('chemicals')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get chemical by ID
export async function getChemicalById(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('chemicals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Record infection history (optional, for analytics)
export async function recordInfectionHistory(regionId, infectionPct) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('infection_history')
    .insert({
      region_id: regionId,
      infection_pct: infectionPct,
      recorded_at: new Date().toISOString()
    });

  if (error) throw error;
}
