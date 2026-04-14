import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { initTheme } from './lib/theme'
import './index.css'

initTheme()

const base = import.meta.env.BASE_URL

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[PWA] Cache prêt — coque disponible hors ligne.')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={base}>
      <App />
    </BrowserRouter>
  </StrictMode>
)
