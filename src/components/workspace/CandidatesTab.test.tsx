import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { CandidateRow } from './candidates/candidateTypes';

/**
 * Confirmation de suppression d'une fiche, rendue par le `ConfirmDialog` du
 * socle depuis la migration des derniers dialogues écrits à la main.
 *
 * Ce qui est vérifié ici est ce qui reste APPLICATIF : la boîte s'ouvre sur la
 * bonne fiche, « Supprimer » déclenche vraiment la suppression, « Annuler » la
 * referme sans rien toucher. Le piège de focus, Échap et le clic sur le fond
 * appartiennent au socle, qui les verrouille chez lui.
 */

/** Tables sur lesquelles un `.delete()` a été demandé. */
const deleted: string[] = [];

/** Constructeur de requête Supabase minimal : chaînable, et qui note les suppressions. */
function queryBuilder(table: string) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.update = self;
  chain.delete = () => {
    deleted.push(table);
    return chain;
  };
  chain.eq = self;
  chain.order = self;
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return chain;
}

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => queryBuilder(table),
  }),
}));

vi.mock('../../lib/activity', () => ({ logActivity: vi.fn() }));

// L'abonnement temps réel a son propre test (`useRealtimeTable.test.ts`) : ici
// il n'apporte que du bruit, et un faux client Supabase de plus.
vi.mock('../../hooks/useRealtimeTable', () => ({
  useRealtimeTable: () => ({ status: 'idle' }),
}));

const candidate: CandidateRow = {
  id: 'c1',
  parent_candidate_id: null,
  sort_order: 0,
  brand: 'Peugeot',
  model: '308',
  trim: '',
  engine: '',
  price: null,
  mileage_km: null,
  first_registration: '',
  gearbox: '',
  energy: '',
  options: '',
  garage_location: '',
  manufacturer_url: '',
  manufacturer_links: [],
  event_date: null,
  status: 'to_see',
  reject_reason: '',
  candidate_specs: null,
};

const load = vi.fn(() => Promise.resolve());

vi.mock('./candidates/useWorkspaceCandidates', () => ({
  useWorkspaceCandidates: () => ({
    candidates: [candidate],
    reviews: [],
    load,
    rootCandidates: [candidate],
    childrenOf: () => [],
    orphanVariations: [],
  }),
}));

// Import APRÈS les mocks : ces modules touchent Supabase au montage.
const { CandidatesTab } = await import('./CandidatesTab');
const { I18nProvider } = await import('../../i18n');
const { ErrorDialogProvider } =
  await import('../../contexts/ErrorDialogContext');
const { ToastProvider } = await import('../../contexts/ToastContext');

/** Ouvre la confirmation depuis le bouton « Supprimer » de la fiche. */
async function openConfirm() {
  render(
    <I18nProvider>
      <ErrorDialogProvider>
        <ToastProvider>
          <CandidatesTab workspaceId="w1" canWrite userId="u1" />
        </ToastProvider>
      </ErrorDialogProvider>
    </I18nProvider>
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /^Supprimer la fiche « / })
  );
  return await screen.findByRole('alertdialog');
}

describe('CandidatesTab — confirmation de suppression', () => {
  beforeEach(() => {
    // Hors navigateur, la détection tombe sur `navigator.language` (en-US) :
    // on fixe la langue, les libellés attendus plus bas sont les français.
    localStorage.setItem('carbook_locale', 'fr');
    deleted.length = 0;
    load.mockClear();
  });

  it('ouvre la boîte du socle en nommant la fiche visée', async () => {
    const dialog = await openConfirm();
    expect(dialog).toHaveAccessibleName('Confirmer la suppression');
    expect(
      within(dialog).getByText('Peugeot 308 · Générique')
    ).toBeInTheDocument();
  });

  it('annule sans rien supprimer, et le focus part sur « Annuler »', async () => {
    const dialog = await openConfirm();
    const cancel = within(dialog).getByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deleted).toEqual([]);
  });

  it('confirme et supprime la fiche', async () => {
    const dialog = await openConfirm();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(deleted).toContain('candidates'));
    await waitFor(() => expect(load).toHaveBeenCalled());
  });
});

/**
 * LE GARDE HORS CONNEXION, ÉPROUVÉ PAR L'USAGE.
 *
 * Carbook ne garde aucune copie locale : supprimer une fiche est une requête
 * réseau, une par ligne de l'arbre. Hors connexion, ouvrir la confirmation ne
 * mène nulle part — le clic sur « Supprimer » échouerait à la première
 * requête, après avoir demandé confirmation d'un geste impossible.
 *
 * Ce qui est vérifié n'est PAS « le socle sait griser un bouton » (il a ses
 * propres tests) mais l'usage : la corbeille est-elle inerte, et DIT-ELLE
 * pourquoi ? Un bouton bloqué et muet est le défaut que `useActionGuard`
 * existe pour empêcher ; une icône seule ne peut porter de phrase, alors c'est
 * son nom accessible (`aria-label`, doublé en infobulle) qui devient le motif.
 */
describe('CandidatesTab — suppression hors connexion', () => {
  beforeEach(() => {
    localStorage.setItem('carbook_locale', 'fr');
    deleted.length = 0;
    load.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  function renderOffline() {
    // Avant le rendu : `useOnline` lit `navigator.onLine` à l'initialisation.
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    render(
      <I18nProvider>
        <ErrorDialogProvider>
          <ToastProvider>
            <CandidatesTab workspaceId="w1" canWrite userId="u1" />
          </ToastProvider>
        </ErrorDialogProvider>
      </I18nProvider>
    );
  }

  it('la corbeille est désactivée ET porte le motif, plutôt que le libellé habituel', async () => {
    renderOffline();

    const trash = await screen.findByRole('button', {
      name: 'Indisponible hors ligne',
    });
    expect(trash).toHaveAttribute('aria-disabled', 'true');
    // `aria-disabled` et non `disabled` : le bouton reste atteignable au
    // clavier, donc le motif reste DÉCOUVRABLE.
    expect(trash).not.toBeDisabled();
    expect(trash).toHaveAttribute('title', 'Indisponible hors ligne');
    expect(
      screen.queryByRole('button', { name: /^Supprimer la fiche « / })
    ).toBeNull();
  });

  it('le clic n’ouvre pas la confirmation et ne supprime rien', async () => {
    renderOffline();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Indisponible hors ligne' })
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deleted).toEqual([]);
  });

  it('le retour du réseau rend la corbeille à son libellé et à son action', async () => {
    renderOffline();
    await screen.findByRole('button', { name: 'Indisponible hors ligne' });

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    const trash = await screen.findByRole('button', {
      name: /^Supprimer la fiche « /,
    });
    expect(trash).not.toHaveAttribute('aria-disabled');
    fireEvent.click(trash);
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});
