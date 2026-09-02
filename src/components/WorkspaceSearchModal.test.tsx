import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * OÙ ATTERRIT LE FOCUS quand la recherche s'ouvre.
 *
 * La question n'est pas décorative : le premier élément focusable du panneau
 * est le bouton « fermer », qui précède le champ dans le DOM. Le piège de
 * focus local focalisait ce premier élément — on ouvrait donc une recherche
 * pour tomber sur sa croix, et l'`autoFocus` posé sur le champ ne gagnait pas
 * la course. Celui du socle prend un `initialFocusRef`, qui nomme la cible au
 * lieu de la deviner.
 *
 * Ce test échoue sur l'ancienne implémentation. C'est tout son intérêt.
 */

/** Constructeur de requête Supabase minimal : chaînable, et vide. */
function queryBuilder() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = self;
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return chain;
}

vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ from: () => queryBuilder() }),
}));

const { WorkspaceSearchModal } = await import('./WorkspaceSearchModal');
const { I18nProvider } = await import('../i18n');

function ouvrir() {
  return render(
    <I18nProvider>
      <WorkspaceSearchModal
        workspaceId="w1"
        open
        onClose={() => {}}
        onPick={() => {}}
      />
    </I18nProvider>
  );
}

describe('WorkspaceSearchModal', () => {
  it('donne le focus au champ de recherche, pas au bouton de fermeture', async () => {
    ouvrir();

    const champ = await screen.findByPlaceholderText(/.+/);
    await waitFor(() => expect(document.activeElement).toBe(champ));

    // Et le bouton « fermer » existe bien AVANT le champ dans le DOM : sans
    // cette assertion, le test passerait aussi sur un panneau qui n'aurait
    // qu'un seul élément focusable, et ne prouverait plus rien.
    const boutons = screen.getAllByRole('button');
    expect(boutons.length).toBeGreaterThan(0);
    const premier = boutons[0]!;
    expect(
      premier.compareDocumentPosition(champ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
