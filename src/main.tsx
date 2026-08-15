import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import './styles/global.css'

// Register after the initial page load. New versions wait for the next safe reload instead of
// interrupting the vault password screen while somebody is typing.
registerSW({ immediate: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
