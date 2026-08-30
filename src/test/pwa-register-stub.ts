/**
 * Double de `virtual:pwa-register` pour les tests.
 *
 * Le module virtuel n'existe que dans un build servi par vite-plugin-pwa :
 * hors de là il est irrésolvable, et tout test qui monte un composant
 * l'important échoue à la résolution, avant d'avoir rien éprouvé. L'alias de
 * `vitest.config.ts` pointe ici pour lui donner un corps ; les tests qui
 * s'intéressent au comportement le remplacent par `vi.mock` / `vi.doMock`
 * (voir `src/components/UpdateBanner.test.tsx`).
 */
export function registerSW(_options?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
