import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { OfflineBanner } from './OfflineBanner';

/**
 * CE QUE CES TESTS VERROUILLENT : que le bandeau se TAIT quand il faut, et
 * qu'il PARLE quand il faut — dans cet ordre, parce que le premier défaut est
 * le plus insidieux.
 *
 * La temporisation du socle (1,5 s hors ligne CONTINU) n'est pas une
 * coquetterie : sans elle, tout basculement wifi/4G, tout tunnel de métro,
 * ferait clignoter une alerte rouge en haut de l'écran. Un test qui se
 * contenterait de « offline ⇒ bandeau » passerait aussi bien avec une version
 * sans temporisation. On éprouve donc les DEUX bords : rien à 1499 ms, le
 * bandeau à 1500 ms.
 *
 * `navigator.onLine` est une propriété en lecture seule : jsdom la laisse
 * redéfinir, et c'est le seul moyen de faire croire au socle qu'on démarre
 * hors connexion. Les évènements `online`/`offline`, eux, se rejouent
 * directement sur `window` — c'est ce à quoi `useOnline` s'abonne.
 */
function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function goOffline() {
  setNavigatorOnline(false);
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

function goOnline() {
  setNavigatorOnline(true);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

/** Laisse passer `ms` de temps simulé, rendus React compris. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function mount() {
  return render(
    <I18nProvider>
      <OfflineBanner />
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom annonce `en-US` : sans épinglage, les libellés basculeraient en
  // anglais selon la machine.
  localStorage.setItem('carbook_locale', 'fr');
  setNavigatorOnline(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  setNavigatorOnline(true);
});

describe('OfflineBanner', () => {
  it('ne rend rien tant que le réseau est là', () => {
    const { container } = mount();

    expect(container).toBeEmptyDOMElement();
  });

  it('ne clignote pas sur une micro-coupure : rien avant la temporisation', () => {
    mount();

    goOffline();
    advance(1499);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('s’affiche après 1,5 s hors ligne continu', () => {
    mount();

    goOffline();
    advance(1500);

    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('data-dwc', 'connection-banner');
    // Le texte est celui de Carbook, pas le défaut français en dur du socle :
    // il dit ce qui est vrai ici — ni lecture, ni écriture sans réseau.
    expect(node).toHaveTextContent(
      'Hors connexion — Miss Carbook ne peut ni charger ni enregistrer tant que le réseau ne revient pas.'
    );
  });

  it('disparaît dès le retour du réseau, sans attendre', () => {
    mount();
    goOffline();
    advance(1500);
    expect(screen.getByRole('status')).toBeInTheDocument();

    goOnline();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('une coupure brève suivie d’une autre ne cumule pas : le compteur repart de zéro', () => {
    mount();

    goOffline();
    advance(1000);
    goOnline();
    goOffline();
    advance(1000);

    // 1000 + 1000 = 2000 ms hors ligne au total, mais jamais 1500 d'affilée.
    expect(screen.queryByRole('status')).toBeNull();

    advance(500);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('parle la langue choisie dans l’application', () => {
    localStorage.setItem('carbook_locale', 'en');
    mount();

    goOffline();
    advance(1500);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Offline — Miss Carbook can neither load nor save until the network is back.'
    );
  });
});
