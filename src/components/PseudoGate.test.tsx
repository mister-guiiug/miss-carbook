import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AuthProvider } from '@mister-guiiug/dev-pwa-config/react/auth-provider';

/**
 * CE QUE CE FICHIER PROUVE : la porte d'entrée est câblée sur le socle, et le
 * câblage tient ce que la copie locale tenait — « Chargement… » d'abord, puis
 * la connexion ou l'application selon la session, et le suivi des évènements
 * du service.
 *
 * Le client Supabase est un double minimal ; tout le reste est RÉEL :
 * l'adaptateur `auth/supabase`, le port `auth/index`, `AuthProvider`,
 * `AuthGate`, et le `useAuth` de l'app qui les lit.
 */

const hoisted = vi.hoisted(() => {
  type Ecouteur = (event: string, session: unknown) => void;
  const ecouteurs = new Set<Ecouteur>();
  const auth = {
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null })
    ),
    onAuthStateChange: vi.fn((cb: Ecouteur) => {
      ecouteurs.add(cb);
      return {
        data: { subscription: { unsubscribe: () => ecouteurs.delete(cb) } },
      };
    }),
  };
  return {
    client: { auth },
    /** Ce que Supabase ferait : prévenir chaque abonné. */
    emettre(event: string, session: unknown) {
      for (const cb of ecouteurs) cb(event, session);
    },
  };
});

vi.mock('../lib/supabase', () => ({ getSupabase: () => hoisted.client }));

const { PseudoGate } = await import('./PseudoGate');
const { useAuth } = await import('../hooks/useAuth');
const { authAdapter } = await import('../lib/authAdapter');
const { I18nProvider } = await import('../i18n');
const { ErrorDialogProvider } = await import('../contexts/ErrorDialogContext');

/** Un écran derrière la porte, qui lit la session comme les pages le font. */
function Application() {
  const { user, loading } = useAuth();
  return (
    <p data-testid="application">
      {loading ? 'chargement' : (user?.email ?? 'personne')}
    </p>
  );
}

function monter() {
  return render(
    <I18nProvider>
      <ErrorDialogProvider>
        <AuthProvider adapter={authAdapter()}>
          <PseudoGate>
            <Application />
          </PseudoGate>
        </AuthProvider>
      </ErrorDialogProvider>
    </I18nProvider>
  );
}

const SESSION = {
  access_token: 'jeton',
  refresh_token: 'rafraichissement',
  expires_at: 4102444800,
  user: { id: 'u1', email: 'test@example.org' },
};

const connexion = () =>
  screen.findByRole('tablist', { name: 'Méthode de connexion' });

beforeEach(() => {
  localStorage.clear();
  // Force la locale FR : jsdom rapporte `navigator.language = en-US`.
  localStorage.setItem('carbook_locale', 'fr');
  hoisted.client.auth.getSession.mockClear();
  hoisted.client.auth.onAuthStateChange.mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('PseudoGate — la porte d’entrée, sur le socle', () => {
  it('dit « Chargement… », puis propose la connexion sans session', async () => {
    monter();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByTestId('application')).toBeNull();

    expect(await connexion()).toBeInTheDocument();
    expect(screen.queryByText('Chargement…')).toBeNull();
    expect(screen.queryByTestId('application')).toBeNull();
  });

  it('ouvre l’application sur SIGNED_IN et la referme sur SIGNED_OUT', async () => {
    monter();
    await connexion();

    await act(async () => {
      hoisted.emettre('SIGNED_IN', SESSION);
    });
    // L'écran derrière la porte lit la même session, par `useAuth` de l'app.
    expect(screen.getByTestId('application')).toHaveTextContent(
      'test@example.org'
    );
    expect(screen.queryByRole('tablist')).toBeNull();

    await act(async () => {
      hoisted.emettre('SIGNED_OUT', null);
    });
    expect(await connexion()).toBeInTheDocument();
    expect(screen.queryByTestId('application')).toBeNull();
  });

  it('n’ouvre qu’UN abonnement, quel que soit le nombre d’écrans qui lisent', async () => {
    monter();
    await connexion();
    await act(async () => {
      hoisted.emettre('SIGNED_IN', SESSION);
    });
    expect(screen.getByTestId('application')).toBeInTheDocument();

    // La porte ET l'écran lisent la session ; Supabase n'est interrogé qu'une
    // fois — la copie locale ouvrait un `getSession` et un abonnement par
    // écran qui appelait `useAuth`.
    expect(hoisted.client.auth.getSession).toHaveBeenCalledTimes(1);
    expect(hoisted.client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });
});
