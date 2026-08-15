import { VaultGate } from './VaultGate'

const foundationItems = [
  'React + TypeScript',
  'PWA instalable',
  'Diseño adaptable',
  'Bóveda local',
  'Contraseña maestra',
  'Cifrado local',
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
          OANIX ya tiene bóveda, contraseña maestra y almacenamiento cifrado local.
          El siguiente bloque de la V1 será el sistema de notas.
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
