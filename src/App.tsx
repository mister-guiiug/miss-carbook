import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorDialogProvider } from './contexts/ErrorDialogContext'
import { ToastProvider } from './contexts/ToastContext'
import { PseudoGate } from './components/PseudoGate'
import { SiteFooter } from './components/SiteFooter'
import { TrustBanner } from './components/TrustBanner'
import { TopBar } from './components/TopBar'
import { UpdateBanner } from './components/UpdateBanner'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { HomePage } from './pages/HomePage'
import { WorkspacePage } from './pages/WorkspacePage'

export default function App() {
  return (
    <ErrorDialogProvider>
      <ToastProvider>
        <a href="#contenu-principal" className="skip-link">
          Aller au contenu principal
        </a>
        <div className="app-layout">
          <div className="app-main" id="contenu-principal" tabIndex={-1}>
            <TrustBanner />
            <PseudoGate>
              <>
                <TopBar />
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/parametres" element={<AccountSettingsPage />} />
                  <Route path="/w/:workspaceId" element={<WorkspacePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </>
            </PseudoGate>
          </div>
          <SiteFooter />
          <UpdateBanner />
        </div>
      </ToastProvider>
    </ErrorDialogProvider>
  )
}
