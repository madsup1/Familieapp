import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Den anonyme nøgle er beregnet til browseren. Brug aldrig service_role-nøglen i frontend.
export const configured = Boolean(url && anonKey);
export const supabase = configured ? createClient(url, anonKey) : null;
