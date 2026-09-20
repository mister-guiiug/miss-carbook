import { lazy, Suspense, useEffect } from 'react';
import { ConsentBanner } from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorDialogProvider } from './contexts/ErrorDialogContext';
import { ToastProvider } from './contexts/ToastContext';
import { WorkspaceChromeProvider } from './contexts/WorkspaceChromeProvider';
import { PseudoGate } from './components/PseudoGate';
import { SiteFooter } from './components/SiteFooter';
import { TrustBanner } from './components/TrustBanner';
import { TopBar } from './components/TopBar';
import { OfflineBanner } from './components/OfflineBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { HomePage } from './pages/HomePage';
import { useI18n } from './i18n';

// CHAQUE IMPORT D'UNE PAGE PRÉCHARGÉE EST NOMMÉ, parce qu'il sert DEUX FOIS : à
// `lazy` ci-dessous, et au préchargement à l'inactivité de
// `usePrechargeLesPagesDuMenu`. Deux `import()` du même spécificateur ne
// téléchargent qu'une fois — le registre de modules dédoublonne — mais encore
// faut-il que ce soit LITTÉRALEMENT le même spécificateur, sinon le bundler
// émet deux morceaux et le préchargement ne sert plus à rien.
const chargeReglages = () => import('./pages/AccountSettingsPage');
const chargeDossier = () => import('./pages/WorkspacePage');

/**
 * Les deux pages qu'un clic de la coquille ou de l'accueil peut atteindre :
 * « Paramètres généraux » depuis le volet compte, et l'ouverture d'un dossier
 * depuis la liste de l'accueil.
 *
 * `AssistantWelcomePage` reste dehors : c'est la visite guidée, qu'on ouvre une
 * fois. La précharger pour tous ferait payer à chacun un morceau que presque
 * personne ne rouvre.
 */
const CHARGEURS_DU_MENU = [chargeReglages, chargeDossier];

const AccountSettingsPage = lazy(() =>
  chargeReglages().then(m => ({ default: m.AccountSettingsPage }))
);
const WorkspacePage = lazy(() =>
  chargeDossier().then(m => ({ default: m.WorkspacePage }))
);
const AssistantWelcomePage = lazy(() =>
  import('./pages/AssistantWelcomePage').then(m => ({
    default: m.AssistantWelcomePage,
  }))
);

/** `navigator.connection` n'est pas dans les types du DOM : il reste un brouillon. */
type NavigateurEconome = Navigator & { connection?: { saveData?: boolean } };

/**
 * PRÉCHARGE LES PAGES DU MENU DÈS QUE LE FIL PRINCIPAL SOUFFLE.
 *
 * Sans préchargement, le morceau d'une page n'est demandé qu'AU CLIC : un
 * aller-retour réseau complet, payé au pire moment — pendant que le reste du
 * bundle arrive et que le service worker précharge ses entrées. Mesuré à froid
 * le 20/09/2026 sur deux sites publiés du parc, première visite : 133 ms sur
 * mister-settle, 161 ms sur mister-molkky, pendant lesquelles l'URL indique
 * déjà la nouvelle route et l'écran affiche encore l'ancien.
 *
 * N'entre PAS dans `bundleBudget.preloadGzipKb` : ce budget ne compte que ce
 * qui est `modulepreload` dans le document, et un `import()` tardif n'y entre
 * pas.
 */
function usePrechargeLesPagesDuMenu() {
  useEffect(() => {
    // `saveData` : le visiteur a demandé qu'on épargne son forfait. On ne
    // télécharge alors que ce qu'il demande vraiment — et c'est précisément
    // pour ce cas-là que le volet compte, lui, sait désormais dire qu'il
    // charge.
    if ((navigator as NavigateurEconome).connection?.saveData) return;

    let annule = false;
    const precharge = () => {
      if (annule) return;
      // Un échec ici est sans conséquence : au clic, `lazy` redemandera le
      // morceau et c'est LUI qui portera l'erreur, dans son propre `Suspense`.
      for (const charge of CHARGEURS_DU_MENU) void charge().catch(() => {});
    };

    // `requestIdleCallback` manque encore à Safari avant la 17 ; le repli
    // minuté vaut mieux que rien.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(precharge, { timeout: 3000 });
      return () => {
        annule = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(precharge, 1200);
    return () => {
      annule = true;
      window.clearTimeout(id);
    };
  }, []);
}

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div className="shell">
      <p className="muted">{t('common.loadingPage')}</p>
    </div>
  );
}

export default function App() {
  usePrechargeLesPagesDuMenu();
  const { t } = useI18n();
  return (
    <ErrorDialogProvider>
      <ToastProvider>
        <a href="#contenu-principal" className="skip-link">
          {t('app.skipToContent')}
        </a>
        <div className="app-shell">
          {/* UN SEUL bandeau réseau, ici et nulle part ailleurs, et EN HAUT.

              POURQUOI PAS EN BAS. `UpdateBanner` (rendu plus bas dans cette
              même coquille) est fixé en bas de l'écran par index.css
              (`[data-dwc='update-banner']`, z-index 90). Deux bandeaux au même
              endroit se recouvrent — un défaut qu'aucun test ne verrait.

              POURQUOI HORS DE `PseudoGate`. La porte d'entrée demande un
              pseudo, ce qui est déjà une écriture réseau : être prévenu AVANT
              d'essayer vaut mieux qu'un formulaire qui échoue. */}
          <OfflineBanner />
          <PseudoGate>
            <WorkspaceChromeProvider>
              <TrustBanner />
              <TopBar />
              <main className="app-main" id="contenu-principal" tabIndex={-1}>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route
                      path="/assistant"
                      element={<AssistantWelcomePage />}
                    />
                    <Route
                      path="/parametres"
                      element={<AccountSettingsPage />}
                    />
                    <Route path="/w/:workspaceId" element={<WorkspacePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </WorkspaceChromeProvider>
          </PseudoGate>
          <ConsentBanner
            posthogKey={import.meta.env.VITE_POSTHOG_KEY}
            loader={() => import('posthog-js/dist/module.slim.js')}
          />
          <SiteFooter />
          <UpdateBanner />
        </div>
      </ToastProvider>
    </ErrorDialogProvider>
  );
}
