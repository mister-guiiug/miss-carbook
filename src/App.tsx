import { Routes, Route, Navigate } from 'react-router-dom'
import { PseudoGate } from './components/PseudoGate'
import { SiteFooter } from './components/SiteFooter'
import { HomePage } from './pages/HomePage'
import { WorkspacePage } from './pages/WorkspacePage'

export default function App() {
  return (
    <div className="app-layout">
      <div className="app-main">
        <PseudoGate>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/w/:workspaceId" element={<WorkspacePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PseudoGate>
      </div>
      <SiteFooter />
    </div>
  )
}
