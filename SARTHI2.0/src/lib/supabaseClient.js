import { createClient } from "@supabase/supabase-js";

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// The app runs in two modes:
//  - DEMO mode (default): no env vars set, uses src/lib/localDb.js — works
//    instantly with zero setup, all data stays in this browser.
//  - PRODUCTION mode: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set in .env
//    → real Postgres, real Auth, real cross-device realtime sync.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
