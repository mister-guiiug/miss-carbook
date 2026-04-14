import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorDialogProvider } from './contexts/ErrorDialogContext'
import { ToastProvider } from './contexts/ToastContext'
import { WorkspaceChromeProvider } from './contexts/WorkspaceChromeContext'
import { PseudoGate } from './components/PseudoGate'
import { SiteFooter } from './components/SiteFooter'
import { TrustBanner } from './components/TrustBanner'
import { TopBar } from './components/TopBar'
import { UpdateBanner } from './components/UpdateBanner'
import { HomePage } from './pages/HomePage'

const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage }))
)
const WorkspacePage = lazy(() =>
  import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage }))
)
const AssistantWelcomePage = lazy(() =>
  import('./pages/AssistantWelcomePage').then((m) => ({ default: m.AssistantWelcomePage }))
)

function RouteFallback() {
  return (
    <div className="shell">
      <p className="muted">Chargement de la page…</p>
    </div>
  )
}

export default function App() {
  return (
    <ErrorDialogProvider>
      <ToastProvider>
        <a href="#contenu-principal" className="skip-link">
          Aller au contenu principal
        </a>
        <div className="app-shell">
          <PseudoGate>
            <WorkspaceChromeProvider>
              <TrustBanner />
              <TopBar />
              <main className="app-main" id="contenu-principal" tabIndex={-1}>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/assistant" element={<AssistantWelcomePage />} />
                    <Route path="/parametres" element={<AccountSettingsPage />} />
                    <Route path="/w/:workspaceId" element={<WorkspacePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </WorkspaceChromeProvider>
          </PseudoGate>
          <SiteFooter />
          <UpdateBanner />
        </div>
      </ToastProvider>
    </ErrorDialogProvider>
  )
}
