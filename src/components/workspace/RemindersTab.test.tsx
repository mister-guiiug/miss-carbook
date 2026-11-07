import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

/**
 * Les deux dialogues de l'onglet « Visites et rappels », migrés vers le socle :
 *
 *  - la suppression d'un rappel ou d'une visite → `ConfirmDialog` (deux
 *    actions, destructive) ;
 *  - la checklist d'essai → `Sheet`, parce que ce n'est pas une confirmation
 *    mais un panneau de contenu, avec une seule issue : fermer.
 *
 * Ce qui est vérifié ici est APPLICATIF : la bonne boîte s'ouvre sur la bonne
 * ligne, la confirmation supprime vraiment, l'annulation ne touche à rien, et
 * la feuille rend bien la checklist. Échap, le piège de focus et le clic sur le
 * fond appartiennent au socle, qui les verrouille chez lui.
 */

/** Tables sur lesquelles un `.delete()` a été demandé. */
const deleted: string[] = [];

const reminder = {
  id: 'r1',
  title: 'Appeler le garage',
  body: '',
  due_at: null,
  done: false,
  candidate_id: null,
  place: null,
  kind: 'contact',
  created_at: '2026-01-05T10:00:00.000Z',
};

const visit = {
  id: 'v1',
  visit_at: '2026-01-06T09:00:00.000Z',
  location: 'Garage du centre',
  notes: '',
  candidate_id: null,
};

const dataByTable: Record<string, unknown[]> = {
  reminders: [reminder],
  visits: [visit],
  candidates: [],
};

/** Constructeur de requête Supabase minimal : chaînable, et qui note les suppressions. */
function queryBuilder(table: string) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.insert = self;
  chain.update = self;
  chain.delete = () => {
    deleted.push(table);
    return chain;
  };
  chain.eq = self;
  chain.order = self;
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: dataByTable[table] ?? [], error: null }).then(
      resolve
    );
  return chain;
}

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => queryBuilder(table),
  }),
}));

vi.mock('../../lib/activity', () => ({ logActivity: vi.fn() }));

/** Fichiers que l'export agenda a demandé de télécharger. */
const downloads: Array<{ text: string; filename: string; type?: string }> = [];

vi.mock('@mister-guiiug/dev-pwa-config/download', () => ({
  downloadText: (text: string, filename: string, type?: string) => {
    downloads.push({ text, filename, type });
    return true;
  },
}));

// La checklist a ses propres requêtes et son propre écran : ce qui se teste ici
// est la FEUILLE qui l'accueille, pas son contenu.
vi.mock('./TrialChecklist', () => ({
  TrialChecklist: ({ visitId }: { visitId: string }) => (
    <p>checklist de la visite {visitId}</p>
  ),
}));

const { RemindersTab } = await import('./RemindersTab');
const { I18nProvider } = await import('../../i18n');
const { ErrorDialogProvider } =
  await import('../../contexts/ErrorDialogContext');
const { ToastProvider } = await import('../../contexts/ToastContext');

function renderTab(props: { canWrite?: boolean; workspaceName?: string } = {}) {
  return render(
    <I18nProvider>
      <ErrorDialogProvider>
        <ToastProvider>
          <RemindersTab
            workspaceId="w1"
            canWrite={props.canWrite ?? true}
            userId="u1"
            workspaceName={props.workspaceName}
          />
        </ToastProvider>
      </ErrorDialogProvider>
    </I18nProvider>
  );
}

describe('RemindersTab — confirmation de suppression', () => {
  beforeEach(() => {
    // Hors navigateur, la détection tombe sur `navigator.language` (en-US) :
    // on fixe la langue, les libellés attendus plus bas sont les français.
    localStorage.setItem('carbook_locale', 'fr');
    deleted.length = 0;
  });

  /** Ouvre la confirmation depuis le bouton « Supprimer » du rappel listé. */
  async function openConfirm() {
    renderTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Supprimer ce rappel' })
    );
    return await screen.findByRole('alertdialog');
  }

  it('ouvre la boîte du socle en nommant le rappel visé', async () => {
    const dialog = await openConfirm();
    expect(dialog).toHaveAccessibleName('Confirmer la suppression');
    expect(within(dialog).getByText('Appeler le garage')).toBeInTheDocument();
  });

  it('annule sans rien supprimer, et le focus part sur « Annuler »', async () => {
    const dialog = await openConfirm();
    const cancel = within(dialog).getByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deleted).toEqual([]);
  });

  it('confirme et supprime le rappel', async () => {
    const dialog = await openConfirm();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(deleted).toContain('reminders'));
  });
});

describe('RemindersTab — feuille de la checklist d’essai', () => {
  beforeEach(() => {
    localStorage.setItem('carbook_locale', 'fr');
    deleted.length = 0;
  });

  /** Passe sur l'onglet « Visites » et ouvre la checklist de la visite listée. */
  async function openSheet() {
    renderTab();
    fireEvent.click(await screen.findByRole('tab', { name: /^Visites/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: "Checklist d'essai" })
    );
    return await screen.findByRole('dialog');
  }

  it('ouvre la feuille du socle sur la visite visée', async () => {
    const sheet = await openSheet();
    expect(sheet).toHaveAccessibleName("Checklist d'essai");
    expect(
      within(sheet).getByText('checklist de la visite v1')
    ).toBeInTheDocument();
  });

  // Une feuille n'a pas de « confirmer » : la seule issue est de fermer, et
  // c'est le socle qui rend la croix (l'en-tête était écrit à la main avant).
  it('ne propose aucune action de confirmation, seulement fermer', async () => {
    const sheet = await openSheet();
    expect(within(sheet).queryByRole('button', { name: 'Annuler' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/**
 * Le bouton d'export agenda. Le contenu du `.ics` est vérifié par
 * `lib/remindersIcs.test.ts` ; ici, le branchement : qui voit le bouton, ce
 * qui est téléchargé, et ce qui est dit quand il n'y a rien à exporter.
 */
describe('RemindersTab — export agenda (.ics)', () => {
  const EXPORT_ALL =
    'Ajouter à mon agenda (.ics) : rappels à faire et visites à venir du dossier';

  beforeEach(() => {
    localStorage.setItem('carbook_locale', 'fr');
    downloads.length = 0;
  });

  // Un test ajoute un rappel daté : les autres blocs retrouvent le jeu commun.
  afterEach(() => {
    dataByTable.reminders = [reminder];
  });

  it('lire suffit : le bouton est là sans droit d’écriture', async () => {
    renderTab({ canWrite: false });
    expect(
      await screen.findByRole('button', { name: EXPORT_ALL })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ajouter un rappel' })
    ).toBeNull();
  });

  it('rien à faire de daté ni de visite à venir : rien n’est téléchargé, et c’est dit', async () => {
    // Le rappel listé n'a pas d'échéance, la visite est passée.
    renderTab();
    await screen.findByText('Appeler le garage');
    fireEvent.click(screen.getByRole('button', { name: EXPORT_ALL }));
    expect(
      await screen.findByText(/^Rien à ajouter à l’agenda/)
    ).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it('télécharge le calendrier du dossier, nommé d’après lui', async () => {
    dataByTable.reminders = [
      reminder,
      {
        ...reminder,
        id: 'r2',
        title: 'Relancer',
        due_at: '2099-03-01T09:00:00Z',
      },
    ];
    renderTab({ workspaceName: 'Deuxième voiture' });
    await screen.findByText('Relancer');
    fireEvent.click(screen.getByRole('button', { name: EXPORT_ALL }));
    expect(await screen.findByText(/^1 événement exporté/)).toBeInTheDocument();
    expect(downloads).toHaveLength(1);
    const [file] = downloads;
    expect(file?.filename).toBe('deuxieme-voiture-visites-et-rappels.ics');
    expect(file?.type).toBe('text/calendar;charset=utf-8');
    expect(file?.text).toContain('UID:rappel-r2@miss-carbook');
    expect(file?.text).toContain(
      'X-WR-CALNAME:Deuxième voiture — visites et rappels'
    );
    expect(file?.text).not.toContain('rappel-r1');
  });
});
