import {
  describeEnvironment,
  issueReportUrl,
} from '@mister-guiiug/dev-pwa-config/issue-report';
import { readBuildInfo } from '@mister-guiiug/dev-pwa-config/version';
import { useI18n } from '../i18n';

const REPO_URL = 'https://github.com/mister-guiiug/miss-carbook';
const BMC_URL = 'https://buymeacoffee.com/mister.guiiug';

/**
 * « SIGNALER UN PROBLÈME » PASSE PAR `issue-report`, PAS PAR `AppFooter`. Ce
 * pied de page est maison (titre, accroche, liste de liens) ; adopter celui du
 * socle pour sa prop `issues` aurait dupliqué le lien source et le soutien
 * qu'il rend déjà. On appelle donc le module qui nourrit cette prop, comme
 * mister-puzzle et miss-badminton : l'URL ouvre le gabarit `bug.yml` du compte,
 * préremplie avec la version, le commit, l'écran courant et le navigateur.
 *
 * L'ÉCRAN, C'EST LE CHEMIN SEUL — et c'est pourquoi on n'appelle pas
 * `currentIssueReportUrl`, qui y verse aussi la requête et le fragment. Or
 * l'accueil reçoit le jeton d'invitation en `?invite=…`, et il y RESTE quand
 * l'acceptation échoue : c'est justement le moment où l'on signale un
 * problème, et le champ prérempli finit dans une issue PUBLIQUE, où le jeton
 * ouvrirait le dossier à qui le lit. Le retour d'un lien magique Supabase
 * passe lui aussi par l'adresse. Carbook route par le chemin
 * (`BrowserRouter`) : le chemin suffit à dire quel écran.
 *
 * L'URL est RECALCULÉE AU CLIC, comme le fait `AppFooter` : la route change
 * sans que ce pied de page se rende à nouveau, et figée au rendu, elle
 * désignerait l'écran où il a été monté. Le `href` du rendu reste le repli
 * d'un clic milieu ou d'un « ouvrir dans un nouvel onglet ».
 */
function issueUrl(): string {
  const build = readBuildInfo();
  return issueReportUrl({
    repoUrl: REPO_URL,
    version: build.version,
    commit: build.commit,
    buildTime: build.buildTime,
    route: typeof window === 'undefined' ? '' : window.location.pathname,
    environment: describeEnvironment(),
  });
}

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
              jour du service worker lit, lui, et qui reste en place. Le numéro
              voyage aussi dans « Signaler un problème », prérempli. */}
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
            <li>
              <a
                href={issueUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={event => {
                  event.currentTarget.href = issueUrl();
                }}
              >
                {t('app.footerReportIssue')}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
