import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Suspense, lazy, type ComponentType } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * LE DÉFAUT QUE CES TESTS VERROUILLENT : le volet compte se refermait AU CLIC.
 *
 * C'est le cas de miss-badminton (PR #80) à la lettre. « Paramètres généraux »
 * mène à `AccountSettingsPage`, chargée à la demande : le volet s'escamotait
 * avant que son morceau soit là, l'écran restait sur la page précédente, et
 * rien n'indiquait un travail en cours. Il emportait le seul endroit qui
 * pouvait dire « je charge ».
 *
 * Et le repli de `<Suspense>` ne pouvait pas prendre le relais : react-router 7
 * enveloppe tout changement d'URL dans `startTransition`, et React 19 garde
 * alors délibérément l'écran déjà affiché plutôt que de montrer le repli.
 * Mesuré à froid sur deux sites publiés du parc le 20/09/2026 : 133 ms d'écran
 * figé sur mister-settle, 161 ms sur mister-molkky, `aria-busy` faux d'un bout
 * à l'autre.
 *
 * Ces tests tiennent le CONTRAT, pas la mise en forme : tant que la page n'est
 * pas là, le volet reste ouvert et l'entrée cliquée se dit occupée.
 */

// La barre lit la session, le thème et deux contextes de coquille. Rien de tout
// cela ne participe au contrat éprouvé ici : on les remplace par le minimum.
vi.mock('../lib/supabase', () => {
  // La barre lit le pseudo du profil au montage : un client chaînable qui rend
  // une ligne suffit, le contrat éprouvé ici ne dépend pas de son contenu.
  const requete = {
    select: () => requete,
    eq: () => requete,
    maybeSingle: () =>
      Promise.resolve({ data: { display_name: 'Dr Test' }, error: null }),
  };
  return {
    getSupabase: () => ({
      auth: { signOut: () => Promise.resolve() },
      from: () => requete,
    }),
  };
});
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.org' } }),
}));
vi.mock('@mister-guiiug/dev-pwa-config/react', () => ({
  useThemeContext: () => ({ mode: 'light', toggle: () => {} }),
}));
vi.mock('../contexts/ErrorDialogContext', () => ({
  useErrorDialog: () => ({ reportException: () => {} }),
}));
vi.mock('../contexts/useWorkspaceChrome', () => ({
  useWorkspaceChrome: () => ({
    workspaceId: null,
    showWorkspaceToolbar: false,
  }),
}));

const { TopBar } = await import('./TopBar');
const { I18nProvider } = await import('../i18n');

/** Monte la barre face à une page dont on décide nous-même de l'arrivée. */
function monterFaceAUnePageLente() {
  // Une page qui n'arrive JAMAIS : tout ce que ce fichier éprouve se passe
  // pendant l'attente.
  const PageLente = lazy(
    () => new Promise<{ default: ComponentType }>(() => {})
  );

  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/']}>
        <TopBar />
        <Suspense fallback={<p>repli de route</p>}>
          <Routes>
            <Route path="/" element={<h1>Mes dossiers</h1>} />
            <Route path="/parametres" element={<PageLente />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </I18nProvider>
  );

  // Le volet ne s'ouvre qu'au clic sur le bouton du compte.
  // Le bouton du compte porte son nom accessible de son contenu (initiales +
  // pseudo) : c'est `aria-haspopup` qui le désigne sans ambiguïté.
  const boutonCompte = document.querySelector<HTMLButtonElement>(
    'button[aria-haspopup="menu"]'
  );
  if (!boutonCompte) throw new Error('bouton du compte introuvable');
  fireEvent.click(boutonCompte);

  return {
    entree: () => screen.getByRole('menuitem', { name: /Paramètres généraux/ }),
    volet: () => screen.queryByRole('menu'),
    /* `resous` n'est pas exposé : sous jsdom, la barre garde des promesses en
       vol (le pseudo du profil) qui empêchent `act` de rendre la main, et le
       contrat tenu ici se lit ENTIÈREMENT pendant l'attente. */
  };
}

beforeEach(() => {
  localStorage.clear();
  // Force la locale FR : jsdom rapporte `navigator.language = en-US`.
  localStorage.setItem('carbook_locale', 'fr');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('le clic sur « Paramètres généraux » répond avant que la page soit là', () => {
  it('garde le volet OUVERT et dit l’entrée occupée', () => {
    const { entree, volet } = monterFaceAUnePageLente();

    fireEvent.click(entree());

    // LA PIÈCE MAÎTRESSE, et la régression que ce test interdit : le volet
    // portait un `onClick={closeAccountMenu}` qui l'escamotait AVANT que la
    // page soit là. Il reste désormais ouvert — c'est le seul endroit qui peut
    // dire « je charge », le repli de `Suspense` ne paraîtra pas.
    expect(volet()).not.toBeNull();
    expect(entree()).toHaveAttribute('aria-busy', 'true');

    // CE QUE LE REPLI DE `Suspense` NE FERA PAS. React 19 garde l'écran déjà
    // affiché pendant la transition ouverte par react-router.
    expect(screen.queryByText('repli de route')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Mes dossiers' })
    ).toBeInTheDocument();

    // Le chargement est annoncé HORS du lien : son nom accessible ne bouge pas.
    expect(
      screen.getAllByRole('status').some(z => z.textContent === 'Chargement…')
    ).toBe(true);
    expect(entree()).toHaveAccessibleName('Paramètres généraux');

    // Le volet se refermera sur le changement de `location.pathname` —
    // l'effet existait déjà, et il se déclenche quand la route a RÉELLEMENT
    // changé, donc la vue prête à peindre. C'est le bon instant, gratuitement.
  });

  it('laisse le navigateur faire quand le clic porte un modificateur', () => {
    const { entree, volet } = monterFaceAUnePageLente();

    fireEvent.click(entree(), { ctrlKey: true });

    // Ouvrir dans un nouvel onglet n'est pas une navigation de cette page :
    // rien ne doit être mis en attente ici.
    expect(entree()).not.toHaveAttribute('aria-busy');
    expect(volet()).not.toBeNull();
  });
});
