import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// `supabase` is null whenever the env vars aren't set. Every caller must handle that case by
// falling back to the local defaults in `data/pricelistData.js` — this lets the app run normally
// before Supabase is configured, and keeps working if Supabase is briefly unreachable.
//
// Add to your `.env` (or `.env.local`) once you have a Supabase project:
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-public-key
//
// Requires the SDK: npm install @supabase/supabase-js
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
