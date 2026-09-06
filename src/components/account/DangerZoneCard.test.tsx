import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

/**
 * CE QUE CE FICHIER PROUVE : qu'on ne supprime pas son compte par accident, et
 * que la suppression, une fois voulue, ferme bien la session.
 *
 * Ce qui n'est PAS vérifié ici, faute de base : ce que `delete_my_account()`
 * fait des dossiers partagés. C'est le rôle de
 * `supabase/tests/delete_my_account.test.sql` — un test d'interface ne peut
 * pas prouver une règle qui vit dans Postgres.
 */

const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
const signOut = vi.fn(() => Promise.resolve({ error: null }));
const navigate = vi.fn();

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ rpc, auth: { signOut } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

const { DangerZoneCard } = await import('./DangerZoneCard');
const { I18nProvider } = await import('../../i18n');
const { ErrorDialogProvider } =
  await import('../../contexts/ErrorDialogContext');

function renderCard() {
  render(
    <I18nProvider>
      <ErrorDialogProvider>
        <DangerZoneCard />
      </ErrorDialogProvider>
    </I18nProvider>
  );
  return screen.getByRole('button', { name: 'Supprimer mon compte' });
}

describe('DangerZoneCard — la confirmation délibérée', () => {
  beforeEach(() => {
    // Hors navigateur, la détection tombe sur `navigator.language` (en-US) :
    // on fixe la langue, les libellés attendus plus bas sont les français.
    localStorage.setItem('carbook_locale', 'fr');
    rpc.mockClear();
    signOut.mockClear();
    navigate.mockClear();
  });

  it('le bouton est inerte tant que le mot n’est pas recopié', () => {
    const button = renderCard();
    expect(button).toBeDisabled();

    // Un mot approchant ne suffit pas : c'est TOUT l'intérêt du verrou.
    fireEvent.change(screen.getByLabelText(/recopiez/i), {
      target: { value: 'supprim' },
    });
    expect(button).toBeDisabled();
  });

  it('le mot recopié débloque le bouton, sans rien supprimer pour autant', () => {
    const button = renderCard();
    fireEvent.change(screen.getByLabelText(/recopiez/i), {
      target: { value: 'supprimer' },
    });
    expect(button).toBeEnabled();
    expect(rpc).not.toHaveBeenCalled();

    // Le clic ouvre la confirmation ; il ne supprime pas.
    fireEvent.click(button);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('annuler referme la boîte ET vide le champ : se raviser coûte le même geste', () => {
    const button = renderCard();
    const field = screen.getByLabelText(/recopiez/i);
    fireEvent.change(field, { target: { value: 'SUPPRIMER' } });
    fireEvent.click(button);

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Annuler',
      })
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(field).toHaveValue('');
    expect(button).toBeDisabled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('confirmer appelle la fonction serveur, ferme la session et renvoie à l’accueil', async () => {
    const button = renderCard();
    fireEvent.change(screen.getByLabelText(/recopiez/i), {
      target: { value: 'SUPPRIMER' },
    });
    fireEvent.click(button);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Supprimer mon compte',
      })
    );

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_my_account'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
