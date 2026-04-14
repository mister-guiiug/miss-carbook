const REPO_URL = 'https://github.com/mister-guiiug/miss-carbook'
const BMC_URL = 'https://buymeacoffee.com/mister.guiiug'

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Pied de page">
      <div className="site-footer-inner">
        <div className="site-footer-meta">
          <span className="site-footer-title">Miss Carbook</span>
          <span className="site-footer-tagline">Choix de véhicule collaboratif</span>
        </div>
        <nav className="site-footer-nav" aria-label="Liens externes">
          <ul className="site-footer-links">
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Code source (GitHub)
              </a>
            </li>
            <li>
              <a href={BMC_URL} target="_blank" rel="noopener noreferrer">
                Soutenir le projet
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
