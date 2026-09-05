import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
/** Le ré-encodage rend un blob du type demandé, sans métadonnées. */
const stripImageMetadata = vi.fn(
  (
    _file: Blob,
    options?: { maxDimension?: number; type?: string; quality?: number }
  ) =>
    Promise.resolve(
      new Blob(['reencode'], { type: options?.type ?? 'image/webp' })
    )
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
 * Seules les deux fonctions qui passent par un canvas sont doublées — elles ont
 * besoin de `createImageBitmap` et `canvas.toBlob`, que jsdom n'implémente pas.
 * `validateImageFile` reste le VRAI code du socle : c'est lui qui trie le
 * fichier ci-dessous en « trop lourd ».
 */
vi.mock('@mister-guiiug/dev-pwa-config/image', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@mister-guiiug/dev-pwa-config/image')
  >()),
  compressImageToMaxBytes: (file: File) => compressImageToMaxBytes(file),
  stripImageMetadata: (
    file: Blob,
    options?: { maxDimension?: number; type?: string; quality?: number }
  ) => stripImageMetadata(file, options),
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

/** Le fichier réellement remis à l'envoi (`noUncheckedIndexedAccess` oblige). */
function sentFile(): File {
  const call = uploadCandidateImage.mock.calls.at(-1);
  if (!call) throw new Error('aucun envoi enregistré');
  return call[2];
}

/** Les options passées au ré-encodage. */
function stripOptions() {
  const call = stripImageMetadata.mock.calls.at(-1);
  if (!call) throw new Error('aucun ré-encodage enregistré');
  return { file: call[0], options: call[1] };
}

/** Remet à zéro les trois doublures avant chaque cas. */
function resetImageMocks() {
  // Hors navigateur, la détection tombe sur `navigator.language` (en-US) :
  // on fixe la langue, les libellés attendus plus bas sont les français.
  localStorage.setItem('carbook_locale', 'fr');
  uploadCandidateImage.mockClear();
  compressImageToMaxBytes.mockClear();
  stripImageMetadata.mockClear();
}

describe('CandidateDetail — offre de compression d’une photo trop lourde', () => {
  beforeEach(resetImageMocks);

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
  beforeEach(resetImageMocks);

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

/**
 * Retrait des métadonnées avant l'envoi au bucket, partagé entre les membres du
 * dossier. Une photo prise au smartphone porte l'EXIF de l'appareil : position
 * GPS du lieu de la prise de vue, numéro de série. Jusqu'ici, tout fichier sous
 * les 5 Mo partait tel quel — seuls les trop lourds étaient ré-encodés par la
 * compression, qui supprime l'EXIF au passage.
 *
 * Le ré-encodage ne vise QUE les formats qui portent de l'EXIF (JPEG, WebP) :
 * le GIF n'en a pas et perdrait son animation, le PNG n'en a pas en pratique et
 * perdrait sa netteté. Le format d'origine est conservé, contrairement aux
 * valeurs par défaut du socle (WebP / 0,85 / 2048 px).
 */
describe('CandidateDetail — retrait des métadonnées avant envoi', () => {
  beforeEach(resetImageMocks);

  it('ré-encode un JPEG sous la limite, dans son format, avant l’envoi', async () => {
    const original = imageOfSize('IMG_4242.jpg', 'image/jpeg', 2 * 1024 * 1024);
    pickPhoto(original);
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());

    const { file, options } = stripOptions();
    expect(file).toBe(original);
    // Pas les défauts du socle : même type en sortie qu'en entrée, qualité
    // haute, et les 2560 px de la compression déjà en place.
    expect(options).toEqual({
      type: 'image/jpeg',
      quality: 0.92,
      maxDimension: 2560,
    });

    // Ce n'est plus le fichier d'origine qui part, mais la copie ré-encodée.
    expect(sentFile()).not.toBe(original);
    expect(sentFile().type).toBe('image/jpeg');
    expect(sentFile().name).toBe('IMG_4242.jpg');
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
  });

  it('ré-encode aussi un WebP, qui porte lui aussi de l’EXIF', async () => {
    pickPhoto(imageOfSize('photo.webp', 'image/webp', 1024));
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());
    expect(stripOptions().options?.type).toBe('image/webp');
    expect(sentFile().type).toBe('image/webp');
    expect(sentFile().name).toBe('photo.webp');
  });

  it('envoie un PNG et un GIF tels quels, sans les ré-encoder', async () => {
    const png = imageOfSize('capture.png', 'image/png', 1024);
    pickPhoto(png);
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());
    expect(sentFile()).toBe(png);

    const gif = imageOfSize('anime.gif', 'image/gif', 1024);
    pickPhoto(gif);
    await waitFor(() => expect(sentFile()).toBe(gif));

    expect(stripImageMetadata).not.toHaveBeenCalled();
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
  });

  it('nomme le fichier d’après ce qui sort vraiment du ré-encodage', async () => {
    // `canvas.toBlob` retombe sur le PNG quand il ne sait pas produire le type
    // demandé : le nom doit suivre, pas rester en `.webp`.
    stripImageMetadata.mockImplementationOnce(() =>
      Promise.resolve(new Blob(['reencode'], { type: 'image/png' }))
    );
    pickPhoto(imageOfSize('photo.webp', 'image/webp', 1024));
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());
    expect(sentFile().name).toBe('photo.png');
    expect(sentFile().type).toBe('image/png');
  });

  it('repasse par la compression si le ré-encodage dépasse la limite', async () => {
    // Un JPEG déjà très compressé peut grossir au ré-encodage et sortir du
    // budget du bucket : la compression, elle, le garantit.
    stripImageMetadata.mockImplementationOnce(() =>
      Promise.resolve(
        new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' })
      )
    );
    const original = imageOfSize('photo.jpg', 'image/jpeg', 4 * 1024 * 1024);
    pickPhoto(original);

    await waitFor(() => expect(compressImageToMaxBytes).toHaveBeenCalled());
    expect(compressImageToMaxBytes).toHaveBeenCalledWith(original);
    await waitFor(() => expect(uploadCandidateImage).toHaveBeenCalled());
    expect(sentFile().size).toBeLessThanOrEqual(5 * 1024 * 1024);
    // Le poids change vraiment : on le dit, comme sur l'autre chemin compressé.
    expect(
      await screen.findByText(
        'Photo envoyée (image compressée automatiquement)'
      )
    ).toBeInTheDocument();
    // Aucune boîte de confirmation : le fichier choisi tenait sous la limite.
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('n’envoie rien si le ré-encodage échoue, plutôt que l’original', async () => {
    stripImageMetadata.mockImplementationOnce(() =>
      Promise.reject(new Error('[dwc] Canvas 2D indisponible.'))
    );
    pickPhoto(imageOfSize('IMG_4242.jpg', 'image/jpeg', 1024));
    expect(
      await screen.findByText('Canvas 2D indisponible.')
    ).toBeInTheDocument();
    expect(uploadCandidateImage).not.toHaveBeenCalled();
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
  });
});

/**
 * L'ENVOI DE PHOTO HORS CONNEXION.
 *
 * C'est l'écriture la plus coûteuse de l'application, et la seule en deux
 * temps : le fichier vers le bucket, puis la ligne `attachments`. Sans garde,
 * hors connexion, l'utilisateur choisit un fichier, attend une compression de
 * plusieurs secondes, et récolte une erreur.
 *
 * Le champ est ici VRAIMENT désactivé, pas seulement `aria-disabled` : le
 * socle préfère `aria-disabled` pour qu'un bouton bloqué reste focusable et
 * que son motif reste découvrable, mais un sélecteur de fichier ouvrirait
 * l'explorateur du système pour ne rien en faire. Le motif est écrit juste en
 * dessous, en toutes lettres — donc rien ne se perd.
 */
describe('CandidateDetail — envoi de photo hors connexion', () => {
  beforeEach(() => {
    resetImageMocks();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  it('désactive le champ photo ET affiche le motif', () => {
    pickPhoto(oversizedJpeg());

    // `document`, pas `screen` : l'accordéon « Photos » est replié au montage,
    // et une requête par rôle sur du contenu masqué est une fausse piste.
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-disabled', 'true');

    const reason = document.querySelector('[role="status"]');
    expect(reason).toHaveTextContent('Indisponible hors ligne');
  });

  it('ne compresse ni n’envoie rien, même si un fichier est déposé', () => {
    pickPhoto(oversizedJpeg());

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(compressImageToMaxBytes).not.toHaveBeenCalled();
    expect(uploadCandidateImage).not.toHaveBeenCalled();
  });
});
