import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// only the homepage is open for now, everything else waits for early access
if (location.pathname !== '/') history.replaceState(null, '', '/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
