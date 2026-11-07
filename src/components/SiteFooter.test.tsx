import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { SiteFooter } from './SiteFooter';

/**
 * « Signaler un problème » : l'URL vient d'`issue-report` du socle, qui la
 * compose et la teste. Ce qui est vérifié ici : le lien est là, dans les deux
 * langues, il vise le gabarit `bug.yml` de CE dépôt, il est recalculé au
 * clic — l'écran courant a pu changer depuis le rendu —, et il ne recopie de
 * l'adresse que le CHEMIN : ni le jeton d'invitation, ni un retour d'auth.
 */
const ISSUES = 'https://github.com/mister-guiiug/miss-carbook/issues/new?';

function renderFooter(locale: 'fr' | 'en') {
  localStorage.setItem('carbook_locale', locale);
  return render(
    <I18nProvider>
      <SiteFooter />
    </I18nProvider>
  );
}

/** Le `href` après un clic — jsdom ne navigue pas, il ne fait que le réécrire. */
function hrefAfterClick(link: HTMLElement): string {
  fireEvent.click(link);
  return decodeURIComponent(link.getAttribute('href') ?? '');
}

describe('SiteFooter — signaler un problème', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('vise le gabarit bug.yml du dépôt, dans un nouvel onglet', () => {
    renderFooter('fr');
    const link = screen.getByRole('link', { name: 'Signaler un problème' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith(ISSUES)).toBe(true);
    expect(new URL(href).searchParams.get('template')).toBe('bug.yml');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('parle anglais avec l’app', () => {
    renderFooter('en');
    expect(
      screen.getByRole('link', { name: 'Report a problem' })
    ).toBeInTheDocument();
  });

  it('recalcule l’URL au clic : l’écran courant y entre', () => {
    renderFooter('fr');
    const link = screen.getByRole('link', { name: 'Signaler un problème' });
    window.history.replaceState(null, '', '/parametres');
    expect(hrefAfterClick(link)).toContain('/parametres');
  });

  it('ne recopie ni la requête ni le fragment : le jeton d’invitation reste chez soi', () => {
    window.history.replaceState(
      null,
      '',
      '/?invite=jeton-secret-123#access_token=jeton-auth-456'
    );
    renderFooter('fr');
    const href = hrefAfterClick(
      screen.getByRole('link', { name: 'Signaler un problème' })
    );
    expect(href).not.toContain('jeton-secret-123');
    expect(href).not.toContain('invite');
    expect(href).not.toContain('jeton-auth-456');
  });
});
