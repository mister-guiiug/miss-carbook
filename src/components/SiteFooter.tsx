import { AppVersion } from '@mister-guiiug/dev-pwa-config/react/app-version';
import { useI18n } from '../i18n';

const REPO_URL = 'https://github.com/mister-guiiug/miss-carbook';
const BMC_URL = 'https://buymeacoffee.com/mister.guiiug';

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer" aria-label={t('app.footerAria')}>
      <div className="site-footer-inner">
        <div className="site-footer-meta">
          <span className="site-footer-title">{t('common.appName')}</span>
          <span className="site-footer-tagline">{t('app.footerTagline')}</span>
          {/* LE NUMÉRO DE BUILD, là où on le cherche pour un rapport de bug.
              `versionPlugin({ manifest: true })` écrit déjà `version.json` au
              build (vite.config.ts) et rien ne le lisait : quand quelqu'un
              signale un comportement, personne ne pouvait dire sur quelle
              version il était.
              `updates` fait sonder ce fichier au montage : une PWA installée
              apprend ainsi qu'une version l'attend, sans fournisseur à poser.
              Sans version injectée, le composant rend `null` — il n'y a pas de
              « v » solitaire à craindre. */}
          <AppVersion repoUrl={REPO_URL} updates />
        </div>
        <nav
          className="site-footer-nav"
          aria-label={t('app.footerExternalLinks')}
        >
          <ul className="site-footer-links">
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                {t('app.footerSource')}
              </a>
            </li>
            <li>
              <a href={BMC_URL} target="_blank" rel="noopener noreferrer">
                {t('app.footerSupport')}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
