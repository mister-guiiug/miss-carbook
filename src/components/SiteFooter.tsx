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
          {/* PAS DE NUMÉRO DE VERSION ICI. Il y en avait un, et il portait un
              lien vers `…/releases/tag/vX.Y.Z` : aucune app du parc ne pose de
              tag git, ce lien répondait donc 404. `versionPlugin` continue
              d'écrire `version.json` au build — ce que le bandeau de mise à
              jour du service worker lit, lui, et qui reste en place. */}
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
