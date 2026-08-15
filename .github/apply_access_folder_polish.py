from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


# ---------------------------------------------------------------------------
# Prevent PWA updates from reloading the password screen while the user types.
# ---------------------------------------------------------------------------
replace_once(
    'vite.config.ts',
    "registerType: 'autoUpdate',",
    "registerType: 'prompt',",
)
replace_once(
    'src/main.tsx',
    "registerSW({ immediate: true })",
    "// Register after the initial page load. New versions wait for the next safe reload instead of\n// interrupting the vault password screen while somebody is typing.\nregisterSW({ immediate: false })",
)

# ---------------------------------------------------------------------------
# Rebuild the vault gate as a stable, animated professional landing screen.
# ---------------------------------------------------------------------------
Path('src/app/VaultGate.tsx').write_text(r'''import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  createMasterPassword,
  initializeLocalVault,
  lockLocalVault,
  MASTER_PASSWORD_MIN_CHARACTERS,
  unlockLocalVault,
  verifyLocalEncryption,
} from '../security/vault/vaultService'

type GateState = 'checking' | 'setup' | 'locked' | 'unlocked' | 'error'

interface VaultGateProps {
  renderUnlocked: (lockVault: () => void) => ReactNode
}

export function VaultGate({ renderUnlocked }: VaultGateProps) {
  const [state, setState] = useState<GateState>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let active = true

    void initializeLocalVault().then((result) => {
      if (!active) return

      if (result.status === 'error') {
        setMessage(result.message)
        setState('error')
        return
      }

      setState(result.access)
    })

    return () => {
      active = false
    }
  }, [])

  function handleLock() {
    lockLocalVault()
    setPassword('')
    setConfirmation('')
    setMessage('')
    setShowPassword(false)
    setState('locked')
  }

  async function verifyUnlockedVault(createdPassword: boolean): Promise<boolean> {
    const verification = await verifyLocalEncryption()

    if (verification.status === 'error') {
      handleLock()
      setMessage(
        createdPassword
          ? `La contraseña maestra se creó, pero ${verification.message.toLowerCase()}`
          : verification.message,
      )
      return false
    }

    setPassword('')
    setConfirmation('')
    setMessage('')
    setState('unlocked')
    return true
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (password.normalize('NFC') !== confirmation.normalize('NFC')) {
      setMessage('Las dos contraseñas no coinciden.')
      return
    }

    setBusy(true)
    const result = await createMasterPassword(password)

    if (result.status === 'error') {
      setBusy(false)
      setMessage(result.message)
      return
    }

    await verifyUnlockedVault(true)
    setBusy(false)
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setBusy(true)
    const result = await unlockLocalVault(password)

    if (result.status === 'error') {
      setBusy(false)
      setMessage(result.message)
      return
    }

    await verifyUnlockedVault(false)
    setBusy(false)
  }

  if (state === 'unlocked') {
    return <>{renderUnlocked(handleLock)}</>
  }

  const isSetup = state === 'setup'

  let gateContent: ReactNode
  if (state === 'checking') {
    gateContent = (
      <div className="vault-state" aria-live="polite">
        <span className="vault-loader" aria-hidden="true" />
        <div>
          <strong>Preparando tu bóveda</strong>
          <p>Comprobando el almacenamiento cifrado de este dispositivo.</p>
        </div>
      </div>
    )
  } else if (state === 'error') {
    gateContent = (
      <div className="vault-state vault-state--error" role="alert">
        <span className="vault-state__icon" aria-hidden="true">!</span>
        <div>
          <strong>No se pudo abrir la bóveda local</strong>
          <p>{message || 'El navegador no pudo preparar el almacenamiento local de OANIX.'}</p>
        </div>
      </div>
    )
  } else {
    gateContent = (
      <div className="vault-access">
        <div className="vault-access__heading">
          <span className="vault-access__lock" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>{isSetup ? 'Crea tu llave maestra' : 'Bienvenido de vuelta'}</strong>
            <p>
              {isSetup
                ? `Protege tu bóveda con al menos ${MASTER_PASSWORD_MIN_CHARACTERS} caracteres.`
                : 'Introduce tu contraseña maestra para descifrar tus notas en este dispositivo.'}
            </p>
          </div>
        </div>

        <form className="vault-form" onSubmit={isSetup ? handleSetup : handleUnlock}>
          <label className="field" htmlFor="master-password">
            <span>Contraseña maestra</span>
            <div className="password-input">
              <input
                id="master-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                minLength={isSetup ? MASTER_PASSWORD_MIN_CHARACTERS : undefined}
                maxLength={256}
                required
                disabled={busy}
              />
              <button
                className="input-action"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={busy}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {isSetup && (
            <label className="field" htmlFor="master-password-confirmation">
              <span>Repite la contraseña</span>
              <input
                id="master-password-confirmation"
                type={showPassword ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                minLength={MASTER_PASSWORD_MIN_CHARACTERS}
                maxLength={256}
                required
                disabled={busy}
              />
            </label>
          )}

          {message && <p className="form-message" role="alert">{message}</p>}

          <button className="primary-button" type="submit" disabled={busy}>
            <span>{busy ? 'Procesando…' : isSetup ? 'Crear bóveda segura' : 'Entrar a OANIX'}</span>
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>

        {isSetup && (
          <p className="security-note">
            OANIX no guarda tu contraseña. En V1 no existe recuperación si la olvidas.
          </p>
        )}
      </div>
    )
  }

  return (
    <main className="vault-shell">
      <div className="vault-atmosphere" aria-hidden="true">
        <span className="vault-glow vault-glow--one" />
        <span className="vault-glow vault-glow--two" />
        <span className="vault-glow vault-glow--three" />
      </div>

      <section className="vault-landing" aria-labelledby="oanix-title">
        <div className="vault-intro">
          <div className="vault-brandline">
            <div className="vault-logo" aria-hidden="true">O</div>
            <div>
              <strong>OANIX</strong>
              <span>Secure private notes</span>
            </div>
          </div>

          <div className="vault-copy">
            <p className="vault-kicker"><span aria-hidden="true" /> OFFLINE-FIRST · CIFRADO LOCAL</p>
            <h1 className="vault-title" id="oanix-title">
              Tu espacio privado, <em>siempre contigo.</em>
            </h1>
            <p className="vault-lead">
              Escribe, organiza y conserva lo importante en una bóveda diseñada para funcionar primero en tu dispositivo.
            </p>
          </div>

          <div className="vault-core" aria-hidden="true">
            <span className="vault-core__ring vault-core__ring--outer" />
            <span className="vault-core__ring vault-core__ring--middle" />
            <span className="vault-core__ring vault-core__ring--inner" />
            <span className="vault-core__scan" />
            <strong>O</strong>
            <i className="vault-core__node vault-core__node--one" />
            <i className="vault-core__node vault-core__node--two" />
            <i className="vault-core__node vault-core__node--three" />
          </div>

          <div className="vault-assurances" aria-label="Características de privacidad">
            <div><span className="vault-assurance__mark" aria-hidden="true" /><strong>Local</strong><small>Tus datos viven primero aquí</small></div>
            <div><span className="vault-assurance__mark" aria-hidden="true" /><strong>Cifrado</strong><small>Contenido protegido en reposo</small></div>
            <div><span className="vault-assurance__mark" aria-hidden="true" /><strong>Offline</strong><small>Disponible sin depender de la nube</small></div>
          </div>
        </div>

        <div className="vault-card">
          <header className="vault-card__header">
            <div>
              <span className="vault-card__pulse" aria-hidden="true" />
              <strong>Bóveda local</strong>
            </div>
            <span className="vault-card__version">V1</span>
          </header>

          <div className="vault-card__body">{gateContent}</div>

          <footer className="vault-card__footer">
            <span><i aria-hidden="true" /> Privacidad por diseño</span>
            <span>OANIX</span>
          </footer>
        </div>
      </section>
    </main>
  )
}
''', encoding='utf-8')

Path('src/styles/global.css').write_text(r''':root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e8eef8;
  background: #070b14;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
html { min-width: 320px; background: #070b14; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, input, textarea { font: inherit; }
button { cursor: pointer; }
button:disabled, input:disabled { cursor: not-allowed; opacity: .62; }

.vault-shell {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3vw, 2.5rem);
  background:
    linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px),
    radial-gradient(circle at 15% 10%, rgba(65,105,225,.12), transparent 30rem),
    radial-gradient(circle at 88% 86%, rgba(16,185,129,.08), transparent 28rem),
    #070b14;
  background-size: 48px 48px, 48px 48px, auto, auto, auto;
  isolation: isolate;
}

.vault-shell::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,.035) 48%, transparent 74%);
  transform: translateX(-120%);
  animation: vaultSweep 10s ease-in-out infinite;
}

.vault-atmosphere { position: absolute; z-index: -2; inset: 0; overflow: hidden; pointer-events: none; }
.vault-glow { position: absolute; width: clamp(18rem, 42vw, 38rem); aspect-ratio: 1; border-radius: 50%; filter: blur(72px); opacity: .2; animation: vaultDrift 14s ease-in-out infinite alternate; }
.vault-glow--one { top: -18%; left: -9%; background: #315cff; }
.vault-glow--two { right: -16%; bottom: -30%; background: #00b894; animation-delay: -5s; animation-duration: 18s; }
.vault-glow--three { top: 34%; left: 46%; width: clamp(10rem, 24vw, 20rem); background: #7c3aed; opacity: .12; animation-delay: -9s; }

.vault-landing {
  width: min(100%, 76rem);
  min-height: min(45rem, calc(100dvh - clamp(2rem, 6vw, 5rem)));
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(21rem, .88fr);
  align-items: center;
  gap: clamp(2rem, 7vw, 6.5rem);
}

.vault-intro { min-width: 0; display: grid; align-content: center; }
.vault-brandline { display: flex; align-items: center; gap: .8rem; }
.vault-logo {
  width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: .95rem;
  border: 1px solid rgba(148,163,184,.24); background: linear-gradient(145deg, rgba(30,41,59,.94), rgba(15,23,42,.72));
  box-shadow: inset 0 1px rgba(255,255,255,.08), 0 12px 35px rgba(0,0,0,.28); color: #f8fbff; font-size: 1.25rem; font-weight: 900; letter-spacing: -.08em;
}
.vault-brandline > div:last-child { display: grid; gap: .05rem; }
.vault-brandline strong { color: #f8fbff; font-size: .92rem; letter-spacing: .16em; }
.vault-brandline span { color: #718096; font-size: .7rem; }

.vault-copy { margin-top: clamp(2.4rem, 6vh, 5rem); }
.vault-kicker { display: flex; align-items: center; gap: .55rem; margin: 0 0 1rem; color: #91a3bc; font-size: .7rem; font-weight: 800; letter-spacing: .16em; }
.vault-kicker > span { width: .5rem; height: .5rem; border-radius: 50%; background: #44d7a8; box-shadow: 0 0 0 5px rgba(68,215,168,.09), 0 0 20px rgba(68,215,168,.45); animation: vaultPulse 2s ease-in-out infinite; }
.vault-title { margin: 0; max-width: 43rem; color: #f5f8fd; font-size: clamp(3rem, 7vw, 6.6rem); line-height: .9; letter-spacing: -.067em; text-wrap: balance; }
.vault-title em { display: block; margin-top: .12em; color: transparent; background: linear-gradient(92deg, #8fb0ff, #69e7c1 58%, #c3a8ff); -webkit-background-clip: text; background-clip: text; font-style: normal; }
.vault-lead { max-width: 39rem; margin: 1.55rem 0 0; color: #98a6ba; font-size: clamp(.98rem, 1.7vw, 1.14rem); line-height: 1.7; }

.vault-core { position: relative; width: clamp(9.5rem, 18vw, 13rem); aspect-ratio: 1; margin: clamp(2rem, 4vh, 3rem) 0 clamp(1.6rem, 3vh, 2.5rem); display: grid; place-items: center; }
.vault-core::before { content: ''; position: absolute; inset: 23%; border-radius: 50%; background: radial-gradient(circle at 35% 25%, rgba(255,255,255,.15), transparent 28%), #0e1729; box-shadow: 0 0 50px rgba(83,125,255,.18), inset 0 0 28px rgba(118,166,255,.08); }
.vault-core > strong { position: relative; z-index: 4; color: #ecf5ff; font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; letter-spacing: -.1em; animation: vaultFloat 5s ease-in-out infinite; }
.vault-core__ring { position: absolute; border: 1px solid rgba(123,156,219,.2); border-radius: 50%; }
.vault-core__ring--outer { inset: 0; border-style: dashed; animation: vaultOrbit 22s linear infinite; }
.vault-core__ring--middle { inset: 12%; border-color: rgba(96,165,250,.24); animation: vaultOrbit 16s linear infinite reverse; }
.vault-core__ring--inner { inset: 25%; border-color: rgba(110,231,183,.22); }
.vault-core__scan { position: absolute; z-index: 3; width: 55%; height: 1px; background: linear-gradient(90deg, transparent, #80f5d2, transparent); box-shadow: 0 0 12px rgba(128,245,210,.5); animation: vaultScan 3.6s ease-in-out infinite; }
.vault-core__node { position: absolute; z-index: 3; width: .48rem; height: .48rem; border-radius: 50%; background: #8fb0ff; box-shadow: 0 0 14px currentColor; }
.vault-core__node--one { top: 8%; left: 50%; }
.vault-core__node--two { right: 8%; bottom: 27%; background: #69e7c1; }
.vault-core__node--three { bottom: 10%; left: 22%; background: #b69cff; }

.vault-assurances { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: .65rem; }
.vault-assurances > div { min-width: 0; padding: .85rem .8rem; border: 1px solid rgba(148,163,184,.11); border-radius: .9rem; background: rgba(15,23,42,.36); backdrop-filter: blur(10px); }
.vault-assurance__mark { display: block; width: .48rem; height: .48rem; margin-bottom: .55rem; border-radius: 50%; background: #6f91ff; box-shadow: 0 0 14px rgba(111,145,255,.42); }
.vault-assurances > div:nth-child(2) .vault-assurance__mark { background: #69e7c1; box-shadow: 0 0 14px rgba(105,231,193,.4); }
.vault-assurances > div:nth-child(3) .vault-assurance__mark { background: #b69cff; box-shadow: 0 0 14px rgba(182,156,255,.42); }
.vault-assurances strong, .vault-assurances small { display: block; min-width: 0; }
.vault-assurances strong { color: #dbe7f7; font-size: .78rem; }
.vault-assurances small { margin-top: .18rem; color: #718096; font-size: .66rem; line-height: 1.35; }

.vault-card { min-width: 0; min-height: 31rem; display: grid; grid-template-rows: auto minmax(0,1fr) auto; overflow: hidden; border: 1px solid rgba(148,163,184,.18); border-radius: 1.5rem; background: linear-gradient(160deg, rgba(18,27,45,.88), rgba(10,15,27,.82)); box-shadow: 0 36px 100px rgba(0,0,0,.42), inset 0 1px rgba(255,255,255,.05); backdrop-filter: blur(24px); }
.vault-card__header, .vault-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1.05rem; }
.vault-card__header { border-bottom: 1px solid rgba(148,163,184,.1); }
.vault-card__header > div { display: flex; align-items: center; gap: .55rem; }
.vault-card__header strong { color: #cdd9e9; font-size: .76rem; letter-spacing: .04em; }
.vault-card__pulse { width: .5rem; height: .5rem; border-radius: 50%; background: #52ddb0; box-shadow: 0 0 0 4px rgba(82,221,176,.08), 0 0 12px rgba(82,221,176,.4); animation: vaultPulse 2.1s ease-in-out infinite; }
.vault-card__version { padding: .25rem .45rem; border: 1px solid rgba(148,163,184,.12); border-radius: .45rem; color: #718096; font-size: .62rem; font-weight: 850; letter-spacing: .08em; }
.vault-card__body { min-height: 25rem; display: grid; align-content: center; padding: clamp(1.2rem, 4vw, 2rem); }
.vault-card__footer { border-top: 1px solid rgba(148,163,184,.08); color: #5f6d81; font-size: .64rem; }
.vault-card__footer span:first-child { display: flex; align-items: center; gap: .4rem; }
.vault-card__footer i { width: .38rem; height: .38rem; border-radius: 50%; background: #52ddb0; }

.vault-state { display: flex; align-items: flex-start; gap: .9rem; min-height: 8rem; padding: 1rem; border: 1px solid rgba(148,163,184,.11); border-radius: 1rem; background: rgba(8,13,24,.42); }
.vault-state strong, .vault-access__heading strong { color: #e8eef8; font-size: 1rem; }
.vault-state p, .vault-access__heading p { margin: .3rem 0 0; color: #8391a5; font-size: .82rem; line-height: 1.55; }
.vault-loader { flex: 0 0 auto; width: 1rem; height: 1rem; margin-top: .1rem; border: 2px solid rgba(143,176,255,.18); border-top-color: #8fb0ff; border-radius: 50%; animation: vaultOrbit .9s linear infinite; }
.vault-state--error { border-color: rgba(248,113,113,.22); background: rgba(127,29,29,.12); }
.vault-state__icon { width: 1.5rem; height: 1.5rem; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: rgba(248,113,113,.15); color: #fca5a5; font-weight: 900; }

.vault-access { width: 100%; }
.vault-access__heading { display: flex; align-items: flex-start; gap: .85rem; }
.vault-access__lock { position: relative; width: 2.65rem; height: 2.65rem; display: grid; place-items: center; flex: 0 0 auto; border: 1px solid rgba(143,176,255,.16); border-radius: .85rem; background: rgba(77,110,210,.08); }
.vault-access__lock::before { content: ''; width: .72rem; height: .62rem; position: absolute; top: .52rem; border: 2px solid #8fb0ff; border-bottom: 0; border-radius: .6rem .6rem 0 0; }
.vault-access__lock > span { width: .98rem; height: .78rem; margin-top: .55rem; border-radius: .22rem; background: #8fb0ff; box-shadow: 0 0 18px rgba(143,176,255,.2); }

.vault-form { display: grid; gap: 1rem; margin-top: 1.45rem; }
.field { display: grid; gap: .45rem; color: #9aa8bc; font-size: .72rem; font-weight: 800; letter-spacing: .025em; }
.field input { width: 100%; min-height: 3rem; padding: .76rem .85rem; border: 1px solid rgba(148,163,184,.18); border-radius: .8rem; outline: none; background: rgba(4,9,18,.5); color: #f3f7fc; caret-color: #8fb0ff; transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
.field input:focus { border-color: rgba(143,176,255,.62); background: rgba(8,14,27,.72); box-shadow: 0 0 0 3px rgba(79,112,219,.1), 0 0 24px rgba(79,112,219,.07); }
.password-input { position: relative; }
.password-input input { padding-right: 5.7rem; }
.input-action { position: absolute; top: 50%; right: .4rem; transform: translateY(-50%); padding: .42rem .55rem; border: 0; border-radius: .5rem; background: transparent; color: #7f91aa; font-size: .72rem; font-weight: 800; }
.input-action:hover:not(:disabled), .input-action:focus-visible { outline: none; background: rgba(148,163,184,.09); color: #b9c7da; }
.primary-button { min-height: 3.15rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .72rem .9rem .72rem 1rem; border: 1px solid rgba(124,157,255,.55); border-radius: .82rem; background: linear-gradient(120deg, #4d6fe0, #5877ea 52%, #4773d9); color: #fff; box-shadow: 0 12px 30px rgba(44,78,180,.22), inset 0 1px rgba(255,255,255,.16); font-weight: 850; transition: transform .18s ease, box-shadow .18s ease; }
.primary-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 16px 38px rgba(44,78,180,.3), inset 0 1px rgba(255,255,255,.18); }
.primary-button span:last-child { font-size: 1.15rem; }
.form-message { margin: 0; padding: .7rem .8rem; border: 1px solid rgba(248,113,113,.16); border-radius: .7rem; background: rgba(127,29,29,.14); color: #fecaca; font-size: .78rem; line-height: 1.45; }
.security-note { margin: .9rem 0 0; color: #68778b; font-size: .69rem; line-height: 1.5; }

@keyframes vaultOrbit { to { transform: rotate(360deg); } }
@keyframes vaultPulse { 0%,100% { opacity: .65; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes vaultFloat { 0%,100% { transform: translateY(-2px); } 50% { transform: translateY(3px); } }
@keyframes vaultScan { 0%,100% { transform: translateY(-2.2rem); opacity: .15; } 50% { transform: translateY(2.2rem); opacity: .95; } }
@keyframes vaultDrift { 0% { transform: translate3d(-2%, -2%, 0) scale(.95); } 100% { transform: translate3d(8%, 6%, 0) scale(1.08); } }
@keyframes vaultSweep { 0%,20% { transform: translateX(-120%); } 58%,100% { transform: translateX(120%); } }

@media (max-width: 860px) {
  .vault-shell { place-items: start center; overflow-y: auto; }
  .vault-landing { min-height: auto; grid-template-columns: 1fr; gap: 1.8rem; padding: max(1rem, env(safe-area-inset-top)) 0 max(1.5rem, env(safe-area-inset-bottom)); }
  .vault-intro { align-content: start; }
  .vault-copy { margin-top: 2.3rem; }
  .vault-title { max-width: 46rem; font-size: clamp(3rem, 12vw, 5.5rem); }
  .vault-core { width: clamp(8rem, 28vw, 11rem); margin-block: 1.6rem; }
  .vault-card { width: min(100%, 36rem); min-height: 29rem; justify-self: center; }
}

@media (max-width: 560px) {
  .vault-shell { padding: 0; }
  .vault-landing { padding: max(1.1rem, env(safe-area-inset-top)) .9rem max(1rem, env(safe-area-inset-bottom)); }
  .vault-brandline { padding-inline: .2rem; }
  .vault-copy { margin-top: 2.25rem; padding-inline: .2rem; }
  .vault-kicker { font-size: .6rem; letter-spacing: .12em; }
  .vault-title { font-size: clamp(2.85rem, 15vw, 4.6rem); }
  .vault-lead { margin-top: 1.15rem; font-size: .92rem; }
  .vault-core { margin-left: .2rem; }
  .vault-assurances { grid-template-columns: 1fr; gap: .45rem; }
  .vault-assurances > div { display: grid; grid-template-columns: auto auto minmax(0,1fr); align-items: center; gap: .55rem; padding: .65rem .7rem; }
  .vault-assurance__mark { margin: 0; }
  .vault-assurances small { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vault-card { min-height: 28rem; border-radius: 1.25rem; }
  .vault-card__body { min-height: 22rem; padding: 1.05rem; }
}

@media (prefers-reduced-motion: reduce) {
  .vault-shell::after, .vault-glow, .vault-kicker > span, .vault-core > strong, .vault-core__ring, .vault-core__scan, .vault-loader, .vault-card__pulse { animation: none !important; }
}
''', encoding='utf-8')

# ---------------------------------------------------------------------------
# Persist a user-defined folder order as its own encrypted record.
# ---------------------------------------------------------------------------
append_once(
    'src/features/folders/folderTypes.ts',
    'export function applyFolderOrder',
    r'''export function applyFolderOrder(folders: FolderRecord[], orderedIds: string[]): FolderRecord[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return [...folders].sort((left, right) => {
    const leftRank = rank.get(left.id)
    const rightRank = rank.get(right.id)
    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank
    if (leftRank !== undefined) return -1
    if (rightRank !== undefined) return 1
    return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
  })
}

export function moveFolderId(
  orderedIds: string[],
  folderId: string,
  direction: 'up' | 'down',
): string[] {
  const currentIndex = orderedIds.indexOf(folderId)
  if (currentIndex < 0) return [...orderedIds]
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= orderedIds.length) return [...orderedIds]

  const next = [...orderedIds]
  ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
  return next
}''',
)

replace_once(
    'src/storage/repositories/folderRepository.ts',
    "const FOLDER_RECORD_TYPE = 'folder'",
    "const FOLDER_RECORD_TYPE = 'folder'\nconst FOLDER_ORDER_RECORD_TYPE = 'folder-order'\nconst FOLDER_ORDER_RECORD_ID = 'primary'",
)
append_once(
    'src/storage/repositories/folderRepository.ts',
    'export async function readFolderOrder',
    r'''export async function readFolderOrder(): Promise<string[]> {
  const value = await readEncryptedRecord<unknown>(FOLDER_ORDER_RECORD_TYPE, FOLDER_ORDER_RECORD_ID)
  if (value === null) return []
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
    throw new Error('Stored folder order is invalid.')
  }
  return [...new Set(value)]
}

export function saveFolderOrder(folderIds: string[]): Promise<void> {
  return writeEncryptedRecord(FOLDER_ORDER_RECORD_TYPE, FOLDER_ORDER_RECORD_ID, [...new Set(folderIds)])
}''',
)

replace_once(
    'src/features/folders/folderService.ts',
    '''  listFolders,
  readFolder,
  saveFolder,
} from '../../storage/repositories/folderRepository'
import { normalizeFolderName, type FolderRecord } from './folderTypes'
''',
    '''  listFolders,
  readFolder,
  readFolderOrder,
  saveFolder,
  saveFolderOrder,
} from '../../storage/repositories/folderRepository'
import { applyFolderOrder, moveFolderId, normalizeFolderName, type FolderRecord } from './folderTypes'
''',
)
replace_once(
    'src/features/folders/folderService.ts',
    r'''function sortFolders(folders: FolderRecord[]): FolderRecord[] {
  return folders.sort((left, right) =>
    left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
  )
}

''',
    '',
)
replace_once(
    'src/features/folders/folderService.ts',
    '''export async function loadFolders(): Promise<FolderRecord[]> {
  return sortFolders(await listFolders())
}
''',
    '''export async function loadFolders(): Promise<FolderRecord[]> {
  const [folders, orderedIds] = await Promise.all([listFolders(), readFolderOrder()])
  return applyFolderOrder(folders, orderedIds)
}
''',
)
replace_once(
    'src/features/folders/folderService.ts',
    '''export async function createFolder(name: string): Promise<FolderRecord> {
  const now = new Date().toISOString()
  const folder: FolderRecord = {
''',
    '''export async function createFolder(name: string): Promise<FolderRecord> {
  const existingFolders = await loadFolders()
  const now = new Date().toISOString()
  const folder: FolderRecord = {
''',
)
replace_once(
    'src/features/folders/folderService.ts',
    '''  await saveFolder(folder)
  return folder
}
''',
    '''  await saveFolder(folder)
  await saveFolderOrder([...existingFolders.map((item) => item.id), folder.id])
  return folder
}
''',
)
replace_once(
    'src/features/folders/folderService.ts',
    '''      await deleteFolderRecord(folderId)
      return existing
''',
    '''      await deleteFolderRecord(folderId)
      const orderedIds = await readFolderOrder()
      await saveFolderOrder(orderedIds.filter((id) => id !== folderId))
      return existing
''',
)
append_once(
    'src/features/folders/folderService.ts',
    'export async function reorderFolder',
    r'''export async function reorderFolder(
  folderId: string,
  direction: 'up' | 'down',
): Promise<FolderRecord[]> {
  const folders = await loadFolders()
  const currentIds = folders.map((folder) => folder.id)
  const nextIds = moveFolderId(currentIds, folderId, direction)
  if (nextIds.every((id, index) => id === currentIds[index])) return folders

  await saveFolderOrder(nextIds)
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  return nextIds.flatMap((id) => {
    const folder = byId.get(id)
    return folder ? [folder] : []
  })
}''',
)

# ---------------------------------------------------------------------------
# Folder UX: close note on folder switch, scroll affordance, manual ordering.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    "import { createFolder, deleteFolder, loadFolders, renameFolder } from '../folders/folderService'",
    "import { createFolder, deleteFolder, loadFolders, renameFolder, reorderFolder } from '../folders/folderService'",
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
''',
    '''  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [folderScrollHint, setFolderScrollHint] = useState<'left' | 'right' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  const pendingContentRef = useRef<PendingContent | null>(null)
''',
    '''  const folderTabsRef = useRef<HTMLElement | null>(null)
  const pendingContentRef = useRef<PendingContent | null>(null)
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  useEffect(() => {
    setDraftTitle(selectedNote?.title ?? '')
  }, [selectedNote?.id, selectedNote?.title])

''',
    '''  useEffect(() => {
    setDraftTitle(selectedNote?.title ?? '')
  }, [selectedNote?.id, selectedNote?.title])

  useEffect(() => {
    const tabs = folderTabsRef.current
    if (!tabs) return

    function updateHint() {
      const overflow = tabs.scrollWidth > tabs.clientWidth + 4
      if (!overflow) {
        setFolderScrollHint(null)
        return
      }
      const hasRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4
      setFolderScrollHint(hasRight ? 'right' : tabs.scrollLeft > 4 ? 'left' : null)
    }

    const frame = window.requestAnimationFrame(updateHint)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHint)
    observer?.observe(tabs)
    window.addEventListener('resize', updateHint)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', updateHint)
    }
  }, [folders.length])

''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    r'''  function sortFolderState(nextFolders: FolderRecord[]): FolderRecord[] {
    return [...nextFolders].sort((left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
    )
  }

''',
    '',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  async function handleCreateNote() {
''',
    '''  async function handleSelectFolder(folderId: string | 'all') {
    if (folderId === activeFolderId) return
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setActiveFolderId(folderId)
    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setNoteInfoOpen(false)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }
  }

  async function handleCreateNote() {
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''      const folder = await createFolder(name)
      setFolders((current) => sortFolderState([...current, folder]))
      setNewFolderName('')
      setActiveFolderId(folder.id)
''',
    '''      const folder = await createFolder(name)
      setFolders((current) => [...current, folder])
      setNewFolderName('')
      await handleSelectFolder(folder.id)
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''      const updated = await renameFolder(folder.id, name)
      setFolders((current) => sortFolderState(
        current.map((item) => item.id === updated.id ? updated : item),
      ))
''',
    '''      const updated = await renameFolder(folder.id, name)
      setFolders((current) => current.map((item) => item.id === updated.id ? updated : item))
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  async function handleMoveNote(targetNote: NoteRecord, folderId: string | null) {
''',
    '''  async function handleReorderFolder(folder: FolderRecord, direction: 'up' | 'down') {
    setFolderBusyId(folder.id)
    setError('')
    try {
      const reordered = await reorderFolder(folder.id, direction)
      setFolders(reordered)
    } catch {
      setError('No se pudo guardar el nuevo orden de las carpetas.')
    } finally {
      setFolderBusyId(null)
    }
  }

  async function handleMoveNote(targetNote: NoteRecord, folderId: string | null) {
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''      setFolders((current) => current.filter((item) => item.id !== folder.id))
      if (activeFolderId === folder.id) setActiveFolderId('all')
''',
    '''      setFolders((current) => current.filter((item) => item.id !== folder.id))
      if (activeFolderId === folder.id) await handleSelectFolder('all')
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''        <nav className="notes-tabs" aria-label="Carpetas de notas">
          <button
            className={`notes-tab${activeFolderId === 'all' ? ' notes-tab--active' : ''}`}
            type="button"
            aria-current={activeFolderId === 'all' ? 'page' : undefined}
            onClick={() => setActiveFolderId('all')}
          >
            Todas
          </button>
          {folders.map((folder) => (
            <button
              className={`notes-tab${activeFolderId === folder.id ? ' notes-tab--active' : ''}`}
              type="button"
              key={folder.id}
              aria-current={activeFolderId === folder.id ? 'page' : undefined}
              title={folder.name}
              onClick={() => setActiveFolderId(folder.id)}
            >
              {folder.name}
            </button>
          ))}
          <button
            className="notes-tab notes-tab--add"
            type="button"
            aria-label="Crear o administrar carpetas"
            title="Carpetas"
            onClick={() => setFolderManagerOpen(true)}
          >
            ＋
          </button>
        </nav>
''',
    '''        <div className={`notes-tabs-shell${folderScrollHint ? ` notes-tabs-shell--hint-${folderScrollHint}` : ''}`}>
          <nav
            className="notes-tabs"
            aria-label="Carpetas de notas"
            ref={folderTabsRef}
            onScroll={() => {
              const tabs = folderTabsRef.current
              if (!tabs) return
              const hasRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4
              setFolderScrollHint(hasRight ? 'right' : tabs.scrollLeft > 4 ? 'left' : null)
            }}
          >
            <button
              className={`notes-tab${activeFolderId === 'all' ? ' notes-tab--active' : ''}`}
              type="button"
              aria-current={activeFolderId === 'all' ? 'page' : undefined}
              onClick={() => void handleSelectFolder('all')}
            >
              Todas
            </button>
            {folders.map((folder) => (
              <button
                className={`notes-tab${activeFolderId === folder.id ? ' notes-tab--active' : ''}`}
                type="button"
                key={folder.id}
                aria-current={activeFolderId === folder.id ? 'page' : undefined}
                title={folder.name}
                onClick={() => void handleSelectFolder(folder.id)}
              >
                {folder.name}
              </button>
            ))}
            <button
              className="notes-tab notes-tab--add"
              type="button"
              aria-label="Crear o administrar carpetas"
              title="Carpetas"
              onClick={() => setFolderManagerOpen(true)}
            >
              ＋
            </button>
          </nav>
          {folderScrollHint && (
            <span className="notes-tabs-scroll-hint" aria-hidden="true">
              {folderScrollHint === 'right' ? 'Desliza →' : '← Desliza'}
            </span>
          )}
        </div>
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''              ) : folders.map((folder) => (
                <div className="folder-list__row" key={folder.id}>
''',
    '''              ) : folders.map((folder, folderIndex) => (
                <div className="folder-list__row" key={folder.id}>
''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''                      <div className="folder-list__actions">
                        <button type="button" onClick={() => beginFolderRename(folder)}>Renombrar</button>
                        <button className="folder-list__delete" type="button" onClick={() => void handleDeleteFolder(folder)} disabled={folderBusyId === folder.id}>Eliminar</button>
                      </div>
''',
    '''                      <div className="folder-list__actions">
                        <span className="folder-list__order" aria-label={`Orden de ${folder.name}`}>
                          <button type="button" title="Mover arriba" aria-label={`Mover ${folder.name} arriba`} onClick={() => void handleReorderFolder(folder, 'up')} disabled={folderBusyId === folder.id || folderIndex === 0}>↑</button>
                          <button type="button" title="Mover abajo" aria-label={`Mover ${folder.name} abajo`} onClick={() => void handleReorderFolder(folder, 'down')} disabled={folderBusyId === folder.id || folderIndex === folders.length - 1}>↓</button>
                        </span>
                        <button type="button" onClick={() => beginFolderRename(folder)}>Renombrar</button>
                        <button className="folder-list__delete" type="button" onClick={() => void handleDeleteFolder(folder)} disabled={folderBusyId === folder.id}>Eliminar</button>
                      </div>
''',
)

# Folder scroll affordance and compact ordering controls.
append_once(
    'src/features/notes/notes.css',
    '.notes-tabs-scroll-hint',
    r'''/* Folder navigation polish */
.notes-tabs-shell { position: relative; min-width: 0; border-bottom: 1px solid #e8edf2; }
.notes-tabs-shell .notes-tabs { border-bottom: 0; }
.notes-tabs-scroll-hint {
  position: absolute;
  z-index: 4;
  top: 50%;
  right: .35rem;
  transform: translateY(-50%);
  pointer-events: none;
  padding: .3rem .5rem;
  border: 1px solid rgba(37,99,235,.14);
  border-radius: 999px;
  background: rgba(255,255,255,.94);
  color: #2563eb;
  box-shadow: 0 5px 16px rgba(15,23,42,.12);
  font-size: .62rem;
  font-weight: 850;
  white-space: nowrap;
  animation: folderHintNudge 1.8s ease-in-out infinite;
}
.notes-tabs-shell--hint-left .notes-tabs-scroll-hint { right: auto; left: .35rem; }
.notes-tabs-shell--hint-right::after,
.notes-tabs-shell--hint-left::before {
  content: '';
  position: absolute;
  z-index: 3;
  top: 0;
  bottom: 0;
  width: 4.5rem;
  pointer-events: none;
}
.notes-tabs-shell--hint-right::after { right: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.98)); }
.notes-tabs-shell--hint-left::before { left: 0; background: linear-gradient(90deg, rgba(255,255,255,.98), transparent); }
.folder-list__order { display: inline-flex; gap: .25rem; }
.folder-list__order button { width: 2.35rem; padding-inline: 0; font-size: 1rem; }
@keyframes folderHintNudge { 0%,100% { transform: translateY(-50%) translateX(0); } 50% { transform: translateY(-50%) translateX(3px); } }
.notes-tabs-shell--hint-left .notes-tabs-scroll-hint { animation-name: folderHintNudgeLeft; }
@keyframes folderHintNudgeLeft { 0%,100% { transform: translateY(-50%) translateX(0); } 50% { transform: translateY(-50%) translateX(-3px); } }
@media (prefers-reduced-motion: reduce) {
  .notes-tabs-scroll-hint { animation: none; }
}''',
)

# ---------------------------------------------------------------------------
# Regression tests and documentation.
# ---------------------------------------------------------------------------
Path('tests/folderOrder.test.ts').write_text(r'''import assert from 'node:assert/strict'
import test from 'node:test'
import { applyFolderOrder, moveFolderId, type FolderRecord } from '../src/features/folders/folderTypes.ts'

function folder(id: string, name: string): FolderRecord {
  return { version: 1, id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}

test('saved folder order wins over alphabetical order', () => {
  const folders = [folder('a', 'Alpha'), folder('b', 'Beta'), folder('c', 'Gamma')]
  assert.deepEqual(applyFolderOrder(folders, ['c', 'a', 'b']).map((item) => item.id), ['c', 'a', 'b'])
})

test('folders missing from an older order record remain available', () => {
  const folders = [folder('a', 'Alpha'), folder('b', 'Beta'), folder('c', 'Gamma')]
  assert.deepEqual(applyFolderOrder(folders, ['b']).map((item) => item.id), ['b', 'a', 'c'])
})

test('folder order moves one position and respects boundaries', () => {
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c'])
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b'])
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'a', 'up'), ['a', 'b', 'c'])
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'c', 'down'), ['a', 'b', 'c'])
})
''', encoding='utf-8')

Path('tests/pwaUpdatePolicy.test.ts').write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('PWA updates never auto-reload the vault password screen', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')
  assert.match(viteConfig, /registerType:\s*'prompt'/)
  assert.doesNotMatch(viteConfig, /registerType:\s*'autoUpdate'/)
  assert.match(main, /registerSW\(\{ immediate: false \}\)/)
})
''', encoding='utf-8')

append_once(
    'docs/CHANGELOG.md',
    'Portada de acceso renovada',
    '''- Portada de acceso renovada con composición visual animada, glass UI y movimiento respetuoso de `prefers-reduced-motion`.
- Las actualizaciones PWA dejan de recargar automáticamente la pantalla de contraseña; una versión nueva espera un reinicio seguro de la aplicación.
- Carpetas con orden manual cifrado, indicación de desplazamiento horizontal y cierre automático de la nota abierta al cambiar de carpeta.''',
)
