import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Crée paresseusement le client Supabase à partir des variables publiques.
 *
 * L'init au chargement du module tuait l'app avant `createRoot()` quand les
 * variables manquaient — supabase-js lève « supabaseUrl is required. » sur une
 * URL vide —, donc écran blanc sans le moindre diagnostic (et Lighthouse mort
 * en NO_FCP). Le `console.warn` prévu pour ça n'était jamais lu : l'app était
 * déjà morte. En paresseux, React monte, l'ErrorBoundary peut afficher
 * l'erreur, et les écrans qui ne touchent pas à Supabase restent utilisables.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      'Miss Carbook : Supabase non configuré, définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir .env.example).'
    );
  }
  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
