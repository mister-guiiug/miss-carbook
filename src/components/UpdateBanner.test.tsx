import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * CE QUE CES TESTS VERROUILLENT : que le bandeau PEUT s'afficher.
 *
 * `UpdatePromptBanner` ne s'affiche que si on lui injecte le `registerSW` de
 * `virtual:pwa-register`. Oublier cette prop ne casse ni la compilation, ni le
 * typage, ni le rendu : le bandeau reste simplement muet, pour toujours — un
 * piège dans lequel une app de la famille est déjà tombée. Le mock par défaut
 * du socle (`vitest-setup`) rend un `registerSW` qui n'appelle jamais
 * `onNeedRefresh` : il ne prouverait rien. On le remplace par un mock qui
 * CAPTURE les rappels, afin de déclencher une mise à jour disponible et de
 * vérifier que le bandeau apparaît réellement.
 *
 * UNE FONCTION `registerSW` NEUVE PAR TEST. Le hook du socle mémorise sa
 * connexion PAR RÉFÉRENCE de fonction (WeakMap) : réutiliser le même mock
 * ferait fuir `needRefresh` d'un test au suivant. D'où `vi.resetModules()` +
 * `vi.doMock`, qui refabriquent le module virtuel — et donc la fonction — à
 * chaque montage.
 */
async function mountBanner() {
  vi.resetModules();
  // jsdom annonce `en-US` : sans épinglage, les libellés basculeraient en
  // anglais selon la machine.
  localStorage.setItem('carbook_locale', 'fr');

  let onNeedRefresh: (() => void) | undefined;
  let registered = false;

  vi.doMock('virtual:pwa-register', () => ({
    registerSW: (options?: { onNeedRefresh?: () => void }) => {
      registered = true;
      onNeedRefresh = options?.onNeedRefresh;
      return () => Promise.resolve();
    },
  }));

  const { UpdateBanner } = await import('./UpdateBanner');
  const { I18nProvider } = await import('../i18n');

  render(
    <I18nProvider>
      <UpdateBanner />
    </I18nProvider>
  );

  return {
    /** Le socle s'est-il abonné, c'est-à-dire `registerSW` a-t-il été passé ? */
    get registered() {
      return registered;
    },
    /** Le service worker annonce une nouvelle version. */
    announceUpdate() {
      expect(onNeedRefresh).toBeTypeOf('function');
      act(() => onNeedRefresh?.());
    },
  };
}

afterEach(() => {
  vi.doUnmock('virtual:pwa-register');
});

describe('UpdateBanner', () => {
  it('reste invisible tant qu’aucune mise à jour n’est annoncée', async () => {
    const banner = await mountBanner();

    expect(banner.registered).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('s’affiche quand le service worker annonce une nouvelle version', async () => {
    const banner = await mountBanner();

    banner.announceUpdate();

    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('data-dwc', 'update-banner');
    expect(node).toHaveTextContent(
      'Une nouvelle version de l’application est disponible.'
    );
    expect(
      screen.getByRole('button', { name: 'Mettre à jour' })
    ).toBeInTheDocument();
  });

  it('offre une sortie : « Plus tard » masque le bandeau pour la session', async () => {
    const banner = await mountBanner();
    banner.announceUpdate();

    // Nouveauté par rapport à la copie locale, qui n'offrait AUCUNE sortie
    // autre que le rechargement. Libellé fourni par le `LabelsProvider` que
    // monte `I18nProvider` : il suit la locale sans câblage supplémentaire.
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));

    expect(screen.queryByRole('status')).toBeNull();
  });
});
