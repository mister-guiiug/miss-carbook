import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '@mister-guiiug/dev-wpa-config/react';
import { THEME_LEGACY_KEYS } from './theme';

/**
 * La garantie qui compte pour l'utilisateur, et que rien ne couvrait.
 *
 * Le socle stocke le thème sous `dwc_theme` ; miss-carbook stockait sous
 * `mc-theme`. Adopter `useTheme` sans reprendre l'ancienne clé orpheline la
 * préférence de chaque utilisateur déjà installé — une seule fois, sans erreur,
 * sans trace : l'app « oublie » son thème sombre au premier chargement.
 *
 * Le stub `matchMedia` du setup partagé répond `matches: false`, donc `system`
 * se résout en clair : si la reprise échouait, l'assertion « sombre » tomberait.
 * C'est exactement ce que vérifie le cas témoin plus bas.
 */

/** Ce que `main.tsx` monte, sans le reste de l'arbre. */
function mount(props: { legacyKeys?: string[] } = {}) {
  return render(
    <ThemeProvider legacyKeys={props.legacyKeys}>
      <span>contenu</span>
    </ThemeProvider>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('reprise de la préférence de thème', () => {
  it('démarre en sombre quand la préférence était stockée sous mc-theme', () => {
    localStorage.setItem('mc-theme', 'dark');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('réécrit la préférence sous la clé du socle, une seule fois', () => {
    localStorage.setItem('mc-theme', 'dark');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(localStorage.getItem('dwc_theme')).toBe('dark');
  });

  it('témoin : sans reprise, la même préférence est perdue', () => {
    localStorage.setItem('mc-theme', 'dark');

    // Sans `legacyKeys`, `dwc_theme` est vide → défaut `system` → le stub
    // matchMedia répond « pas sombre » → clair. C'est le bug silencieux.
    mount();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('un choix déjà migré prime sur la valeur restée dans mc-theme', () => {
    localStorage.setItem('mc-theme', 'dark');
    localStorage.setItem('dwc_theme', 'light');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  /**
   * Le script anti-FOUC reçoit les mêmes anciennes clés, mais depuis
   * `vite.config.ts`, qui s'exécute côté Node et ne peut pas importer ce
   * module. Deux listes divergentes = le script pose un thème que React
   * repeint aussitôt, soit le scintillement que le script existe pour
   * supprimer. Rien d'autre ne surveille cet accord.
   */
  it('le script anti-FOUC déclare les mêmes anciennes clés', () => {
    // `import.meta.url` est une URL http sous jsdom : la racine du projet
    // (le cwd de Vitest) est le seul point de départ fiable ici.
    const config = readFileSync(resolve('vite.config.ts'), 'utf8');

    for (const key of THEME_LEGACY_KEYS) {
      expect(config).toContain(`legacyKeys: ['${key}']`);
    }
  });
});
