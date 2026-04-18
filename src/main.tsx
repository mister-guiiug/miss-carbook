import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initTheme } from './lib/theme'
import { initWebVitals } from './monitoring/web-vitals'
import './index.css'

// Initialiser le thème
initTheme()

// Initialiser le monitoring des Web Vitals
initWebVitals()

const base = import.meta.env.BASE_URL

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={base}>
      <App />
    </BrowserRouter>
  </StrictMode>
)
