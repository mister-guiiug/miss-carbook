import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Le cache du service worker qui garde les LECTURES Supabase (`/rest/v1/`,
 * règle `runtimeCaching` de `vite.config.ts`). Même nom des deux côtés : le
 * changer ici, c'est le changer là.
 */
export const SUPABASE_API_CACHE = 'supabase-api';

/**
 * Vide ce cache, depuis la page. Rend `true` si un cache a été effacé.
 *
 * POURQUOI. Workbox range une réponse sous son URL et ignore l'en-tête
 * `Authorization` : deux comptes qui lisent la même table partagent la même
 * entrée. Sur un appareil partagé, le compte suivant relirait hors ligne les
 * dossiers du précédent (audit hors ligne du 05/11/2026).
 *
 * Sans Cache Storage (contexte non sécurisé, navigateur ancien), rien à
 * vider : le service worker n'a rien pu y mettre non plus.
 */
export async function purgeSupabaseApiCache(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    return await caches.delete(SUPABASE_API_CACHE);
  } catch {
    // Un refus du navigateur (stockage verrouillé) ne doit pas faire échouer
    // la déconnexion : la session, elle, est déjà fermée.
    return false;
  }
}

/**
 * Purge à CHAQUE fin de session, quel qu'en soit le geste : « Déconnexion »
 * de la barre ou de l'espace de travail, suppression du compte, ou jeton
 * révoqué que le client ferme de lui-même. Tous passent par `SIGNED_OUT` ;
 * s'abonner une fois, à la création du client, évite que chaque bouton ait à
 * s'en souvenir — et qu'un quatrième l'oublie.
 */
export function purgeSupabaseApiCacheOnSignOut(
  client: Pick<SupabaseClient, 'auth'>
): () => void {
  const { data } = client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') void purgeSupabaseApiCache();
  });
  return () => data.subscription.unsubscribe();
}
