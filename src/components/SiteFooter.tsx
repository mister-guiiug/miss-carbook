const REPO_URL = 'https://github.com/mister-guiiug/miss-carbook'
const BMC_URL = 'https://buymeacoffee.com/mister.guiiug'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="muted site-footer-lead" style={{ fontSize: '0.85rem' }}>
          Dans un dossier ouvert, <kbd>Ctrl</kbd>+<kbd>K</kbd> lance la recherche rapide (exigences,
          modèles, rappels).
        </span>
        <span className="site-footer-sep" aria-hidden="true">
          ·
        </span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Code source sur GitHub
        </a>
        <span className="site-footer-sep" aria-hidden="true">
          ·
        </span>
        <a href={BMC_URL} target="_blank" rel="noopener noreferrer">
          Buy me a coffee
        </a>
      </div>
    </footer>
  )
}
