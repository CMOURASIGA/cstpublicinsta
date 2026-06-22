import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicRuntimeConfig } from './runtime-config';

let supabasePromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (!supabasePromise) {
    supabasePromise = getPublicRuntimeConfig().then((config) => {
      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY não disponíveis no backend.');
      }

      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    });
  }

  return supabasePromise;
}
