import { useEffect, useState } from 'react'
import { initializeLocalVault } from '../security/vault/vaultService'

const foundationItems = [
  'React + TypeScript',
  'PWA instalable',
  'Diseño adaptable',
  'Bóveda local',
  'Validación automática',
]

type VaultUiState = 'checking' | 'ready' | 'error'

export function App() {
  const [vaultState, setVaultState] = useState<VaultUiState>('checking')

  useEffect(() => {
    let active = true

    void initializeLocalVault().then((result) => {
      if (!active) return
      setVaultState(result.status === 'ready' ? 'ready' : 'error')
    })

    return () => {
      active = false
    }
  }, [])

  const vaultStatus = {
    checking: {
      title: 'Preparando bóveda local',
      description: 'OANIX está comprobando el almacenamiento privado de este dispositivo.',
    },
    ready: {
      title: 'Bóveda local preparada',
      description: 'El contenedor local ya existe. La contraseña maestra y el cifrado son los siguientes pasos de la V1.',
    },
    error: {
      title: 'Bóveda local no disponible',
      description: 'El navegador no pudo preparar el almacenamiento local de OANIX en este dispositivo.',
    },
  }[vaultState]

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="oanix-title">
        <div className="brand-mark" aria-hidden="true">O</div>
        <p className="eyebrow">OANIX · V1</p>
        <h1 id="oanix-title">Tus notas. Tu dispositivo. Tu privacidad.</h1>
        <p className="hero-copy">
          Estamos construyendo OANIX como una aplicación de notas segura,
          offline-first y preparada para crecer por módulos sin perder el orden.
        </p>

        <div className="status-card" aria-live="polite" aria-label="Estado de la bóveda local">
          <span className={`status-dot status-dot--${vaultState}`} aria-hidden="true" />
          <div>
            <strong>{vaultStatus.title}</strong>
            <p>{vaultStatus.description}</p>
          </div>
        </div>

        <ul className="foundation-list" aria-label="Base técnica preparada">
          {foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
