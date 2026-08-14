const foundationItems = [
  'React + TypeScript',
  'PWA instalable',
  'Diseño adaptable',
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
          Estamos construyendo la base de OANIX: una aplicación de notas segura,
          offline-first y preparada para crecer por módulos sin perder el orden.
        </p>

        <div className="status-card" aria-label="Estado de la base técnica">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Base técnica activa</strong>
            <p>La bóveda y el editor se incorporarán en los siguientes pasos de la V1.</p>
          </div>
        </div>

        <ul className="foundation-list" aria-label="Tecnologías preparadas">
          {foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
