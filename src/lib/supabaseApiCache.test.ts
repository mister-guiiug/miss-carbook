import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CE QUE CE TEST TIENT. Le service worker garde les lectures Supabase sous
 * leur URL, sans tenir compte du compte qui les a faites. Fermer la session
 * sans vider ce cache, c'est laisser le compte suivant relire hors ligne les
 * dossiers du précédent. On éprouve le CÂBLAGE — le client de l'app, tel que
 * `getSupabase()` le crée —, pas seulement la fonction de purge : c'est le
 * câblage qui manquait.
 */

type Ecouteur = (event: string) => void;
let ecouteurs: Ecouteur[] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (ecouteur: Ecouteur) => {
        ecouteurs.push(ecouteur);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
}));

const effacer = vi.fn<(nom: string) => Promise<boolean>>();

/** La session telle que le client l'annonce à ses abonnés. */
function annoncer(event: string) {
  for (const ecouteur of ecouteurs) ecouteur(event);
}

beforeEach(() => {
  ecouteurs = [];
  effacer.mockReset().mockResolvedValue(true);
  vi.stubGlobal('caches', { delete: effacer });
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'cle-anonyme-de-test');
  // `getSupabase` garde son client en module : chaque test repart d'un neuf.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('le cache des lectures Supabase, à la déconnexion', () => {
  it('est vidé quand la session se ferme', async () => {
    const { getSupabase } = await import('./supabase');
    getSupabase();

    annoncer('SIGNED_OUT');

    expect(effacer).toHaveBeenCalledWith('supabase-api');
  });

  it('reste en place tant que la session vit', async () => {
    const { getSupabase } = await import('./supabase');
    getSupabase();

    annoncer('INITIAL_SESSION');
    annoncer('SIGNED_IN');
    annoncer('TOKEN_REFRESHED');

    expect(effacer).not.toHaveBeenCalled();
  });

  it('un seul abonnement, quel que soit le nombre d’appels', async () => {
    const { getSupabase } = await import('./supabase');
    getSupabase();
    getSupabase();

    annoncer('SIGNED_OUT');

    expect(effacer).toHaveBeenCalledTimes(1);
  });

  it('sans Cache Storage, la purge ne lève pas', async () => {
    vi.stubGlobal('caches', undefined);
    const { purgeSupabaseApiCache } = await import('./supabaseApiCache');

    await expect(purgeSupabaseApiCache()).resolves.toBe(false);
  });

  it('un refus du navigateur ne fait pas échouer la déconnexion', async () => {
    effacer.mockRejectedValue(new DOMException('verrouillé', 'SecurityError'));
    const { purgeSupabaseApiCache } = await import('./supabaseApiCache');

    await expect(purgeSupabaseApiCache()).resolves.toBe(false);
  });
});
