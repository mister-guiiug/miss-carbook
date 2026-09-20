import {
  supabaseAuthAdapter,
  type SupabaseAuthAdapter,
} from '@mister-guiiug/dev-pwa-config/auth/supabase';
import { getSupabase } from './supabase';

let cache: SupabaseAuthAdapter | null = null;

/**
 * L'adaptateur du socle autour du client de l'app — jamais un second client :
 * il dupliquerait la session et son rafraîchissement de jetons.
 *
 * CRÉÉ AU PREMIER APPEL, PAS À L'IMPORT. `getSupabase()` lève quand les
 * variables manquent, et il doit lever sous l'`ErrorBoundary` de `main.tsx`
 * — pendant le rendu d'`App`, où `AuthProvider` le demande — et non pendant
 * l'évaluation du module d'entrée, qui ferait un écran blanc sans diagnostic
 * (la doctrine de `src/lib/supabase.ts`).
 *
 * MÉMORISÉ, parce que `AuthProvider` recrée son client à chaque nouvelle
 * identité d'adaptateur : un adaptateur neuf par rendu, c'est un abonnement
 * neuf par rendu.
 */
export function authAdapter(): SupabaseAuthAdapter {
  cache ??= supabaseAuthAdapter({ client: getSupabase() });
  return cache;
}
