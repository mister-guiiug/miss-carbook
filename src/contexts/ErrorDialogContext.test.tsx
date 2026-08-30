import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorDialogProvider, useErrorDialog } from './ErrorDialogContext';
import { I18nProvider } from '../i18n';

function Probe() {
  const { reportMessage } = useErrorDialog();
  return (
    <button
      type="button"
      onClick={() => reportMessage('Message utilisateur', 'détail technique')}
    >
      Déclencher erreur
    </button>
  );
}

function ExceptionProbe({ error }: { error: unknown }) {
  const { reportException } = useErrorDialog();
  return (
    <button type="button" onClick={() => reportException(error, 'Contexte')}>
      Déclencher exception
    </button>
  );
}

function mount(children: ReactNode) {
  render(
    <I18nProvider>
      <ErrorDialogProvider>{children}</ErrorDialogProvider>
    </I18nProvider>
  );
}

async function open() {
  mount(<Probe />);
  fireEvent.click(screen.getByRole('button', { name: /Déclencher erreur/i }));
  return await screen.findByRole('alertdialog');
}

describe('ErrorDialogProvider', () => {
  beforeEach(() => {
    // Hors navigateur la détection tombe sur `navigator.language` (en-US) :
    // on fixe la langue, les libellés attendus plus bas sont les français.
    localStorage.setItem('carbook_locale', 'fr');
  });

  it('affiche le message après reportMessage', async () => {
    await open();
    expect(screen.getByText('Message utilisateur')).toBeInTheDocument();
  });

  // Mode mono-action du ConfirmDialog du socle (`cancelLabel={null}`) : c'est
  // une alerte, il n'y a rien à annuler.
  it('ne rend qu’une seule action, « OK », qui reçoit le focus initial', async () => {
    await open();
    const ok = screen.getByRole('button', { name: 'OK' });
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    expect(ok).toHaveFocus();
    fireEvent.click(ok);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('ferme sur Échap', async () => {
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('ferme au clic sur le voile', async () => {
    const dialog = await open();
    const backdrop = dialog.parentElement!.querySelector(
      '[data-dwc="confirm-backdrop"]'
    )!;
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('ne ferme pas au clic dans le panneau', async () => {
    const dialog = await open();
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  // Détails dépliables + bouton copier : le socle ne les embarque pas, ils
  // restent applicatifs et passent en `children`.
  it('déplie les détails techniques et les copie', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    await open();
    expect(screen.queryByText('détail technique')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /Afficher les détails techniques/i })
    );
    expect(screen.getByText('détail technique')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Copier les détails techniques/i })
    );
    expect(writeText).toHaveBeenCalledWith('détail technique');

    fireEvent.click(
      screen.getByRole('button', { name: /Masquer les détails techniques/i })
    );
    expect(screen.queryByText('détail technique')).toBeNull();

    vi.unstubAllGlobals();
  });

  // Les fonctions du socle préfixent leurs messages par `[dwc]` (marqueur
  // d'origine). L'utilisateur n'a que faire de ce préfixe ; le support, si.
  it('retire le préfixe « [dwc] » du message, mais pas des détails', async () => {
    mount(<ExceptionProbe error={new Error('[dwc] Image invalide.')} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Déclencher exception/i })
    );
    await screen.findByRole('alertdialog');

    expect(screen.getByText('Image invalide.')).toBeInTheDocument();
    expect(screen.queryByText(/\[dwc\]/)).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /Afficher les détails techniques/i })
    );
    expect(screen.getByText(/\[dwc\] Image invalide\./)).toBeInTheDocument();
  });
});
