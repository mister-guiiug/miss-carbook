import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { CandidateRow } from './candidateTypes';

/**
 * Offre de compression d'une photo trop lourde, rendue par le `ConfirmDialog`
 * du socle depuis la migration des derniers dialogues écrits à la main.
 *
 * C'est la seule des quatre boîtes de l'application qui n'est PAS destructive :
 * rien n'est supprimé, on propose une conversion. Elle garde donc deux actions,
 * mais sans `destructive` et avec un libellé de confirmation explicite.
 *
 * Ce qui est vérifié ici est APPLICATIF : la boîte s'ouvre sur le fichier
 * refusé, « Compresser et envoyer » lance vraiment la compression puis l'envoi,
 * « Annuler » la referme sans rien envoyer.
 */

const uploadCandidateImage = vi.fn(
  (_workspaceId: string, _candidateId: string, _file: File, _userId: string) =>
    Promise.resolve()
);
/** La compression rend un fichier plus léger, sous la limite. */
const compressImageToMaxBytes = vi.fn((_file: File) =>
  Promise.resolve(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))
);

/** Constructeur de requête Supabase minimal, chaînable et toujours vide. */
function queryBuilder() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.insert = self;
  chain.update = self;
  chain.delete = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = self;
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return chain;
}

vi.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({ from: () => queryBuilder() }),
}));

vi.mock('../../../lib/activity', () => ({ logActivity: vi.fn() }));

// L'abonnement temps réel a son propre test (`useRealtimeTable.test.ts`).
vi.mock('../../../hooks/useRealtimeTable', () => ({
  useRealtimeTable: () => ({ status: 'idle' }),
}));

vi.mock('../../../lib/storageUpload', () => ({
  uploadCandidateImage: (
    workspaceId: string,
    candidateId: string,
    file: File,
    userId: string
  ) => uploadCandidateImage(workspaceId, candidateId, file, userId),
  signedUrlForPath: () => Promise.resolve(''),
}));

/**
 * Seule la compression est doublée — elle a besoin de `canvas.toBlob`, que
 * jsdom n'implémente pas. `validateImageFile` reste le VRAI code du socle :
 * c'est lui qui trie le fichier ci-dessous en « trop lourd ».
 */
vi.mock('@mister-guiiug/dev-wpa-config/image', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@mister-guiiug/dev-wpa-config/image')
  >()),
  compressImageToMaxBytes: (file: File) => compressImageToMaxBytes(file),
}));

const { CandidateDetail } = await import('./CandidateDetail');
const { I18nProvider } = await import('../../../i18n');
const { ErrorDialogProvider } =
  await import('../../../contexts/ErrorDialogContext');
const { ToastProvider } = await import('../../../contexts/ToastContext');

/** Une variation : l'envoi de photos n'est offert que sur les fiches filles. */
const candidate: CandidateRow = {
  id: 'c2',
  parent_candidate_id: 'c1',
  sort_order: 0,
  brand: 'Peugeot',
  model: '308',
  trim: 'GT',
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

function imageOfSize(name: string, type: string, size: number) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Un JPEG de 6 Mo : au-dessus de la limite de 5 Mo, donc refusé tel quel. */
function oversizedJpeg() {
  return imageOfSize('photo.jpg', 'image/jpeg', 6 * 1024 * 1024);
}

/** Rend la fiche et choisit `file` dans le champ photo. */
function pickPhoto(file: File) {
  const { container } = render(
    <I18nProvider>
      <ErrorDialogProvider>
        <ToastProvider>
          <CandidateDetail
            candidate={candidate}
            rootCandidates={[]}
            variationCount={0}
            workspaceId="w1"
            canWrite
            userId="u1"
            onChanged={() => {}}
            garageSuggestions={[]}
          />
        </ToastProvider>
      </ErrorDialogProvider>
    </I18nProvider>
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('champ de sélection de photo introuvable');
  fireEvent.change(input, { target: { files: [file] } });
}

/** Choisit une photo trop lourde et retourne la boîte ouverte. */
async function openOffer() {
  pickPhoto(oversizedJpeg());
  return await screen.findByRole('alertdialog');
}

describe('CandidateDetail — offre de compression d’une photo trop lourde', () => {
  beforeEach(() => {
    // Hors navigateur, la détection tombe sur `navigator.language` (en-US) :
    // on fixe la langue, les libellés attendus plus bas sont les français.
    localStorage.setItem('carbook_locale', 'fr');
    uploadCandidateImage.mockClear();
    compressImageToMaxBytes.mockClear();
  });

  it('ouvre la boîte du socle en donnant la taille du fichier refusé', async () => {
    const dialog = await openOffer();
    expect(dialog).toHaveAccessibleName('Image trop volumineuse');
    expect(within(dialog).getByText('6,0 Mo')).toBeInTheDocument();
    // Non destructive : le libellé de confirmation est explicite, pas
    // « Supprimer ».
    expect(
      within(dialog).getByRole('button', { name: 'Compresser et envoyer' })
    ).toBeInTheDocument();
  });

  it('annule sans rien envoyer, et le focus part sur « Annuler »', async () => {
    const dialog = await openOffer();
    const cancel = within(dialog).getByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
    expect(uploadCandidateImage).not.toHaveBeenCalled();
  });

  it('confirme, compresse puis envoie la photo', async () => {
    const dialog = await openOffer();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Compresser et envoyer' })
    );
    await waitFor(() => expect(compressImageToMaxBytes).toHaveBeenCalled());
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

/**
 * Le tri des fichiers est celui du socle (`validateImageFile`), mais nourri
 * avec la liste de types de Miss Carbook. Ces deux cas gardent ce câblage : le
 * GIF, que le défaut du socle refuserait, passe ; un type hors liste est
 * refusé sans jamais atteindre l'envoi.
 */
describe('CandidateDetail — tri du fichier choisi', () => {
  beforeEach(() => {
    localStorage.setItem('carbook_locale', 'fr');
    uploadCandidateImage.mockClear();
    compressImageToMaxBytes.mockClear();
  });

  it('envoie un GIF sous la limite sans proposer de compression', async () => {
    pickPhoto(imageOfSize('anime.gif', 'image/gif', 1024));
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('refuse un type hors liste sans rien envoyer', async () => {
    pickPhoto(imageOfSize('scan.avif', 'image/avif', 1024));
    expect(
      await screen.findByText('Type non autorisé (JPEG, PNG, WebP, GIF)')
    ).toBeInTheDocument();
    expect(uploadCandidateImage).not.toHaveBeenCalled();
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
  });
});
