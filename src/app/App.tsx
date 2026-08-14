import { VaultGate } from './VaultGate'

const foundationItems = [
  'React + TypeScript',
  'PWA instalable',
  'Diseño adaptable',
  'Bóveda local',
  'Contraseña maestra',
  'Validación automática',
]

export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="oanix-title">
        <div className="brand-mark" aria-hidden="true">O</div>
        <p className="eyebrow">OANIX · V1</p>
        <h1 id="oanix-title">Tus notas. Tu dispositivo. Tu privacidad.</h1>
        <p className="hero-copy">
          OANIX está construyendo su núcleo local paso a paso. La contraseña maestra
          protege la clave de la bóveda; el cifrado del contenido será el siguiente bloque de la V1.
        </p>

        <VaultGate />

        <ul className="foundation-list" aria-label="Base técnica preparada">
          {foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
