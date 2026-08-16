import { createClient, type Session } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kpnhdtiscxckveqeyqfq.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WouuStU5HcKeGYOL60Eelw_kyzaPJLZ'
const GOOGLE_POPUP_NAME = 'oanix-google-auth'

export const ACCOUNT_PASSWORD_MIN_CHARACTERS = 12

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'oanix-v2-auth',
  },
})

export interface CreateOnlineAccountResult {
  email: string
  requiresEmailConfirmation: boolean
}

export interface OnlineAccountSession {
  userId: string
  email: string
  providers: string[]
}

function normalizeEmail(rawEmail: string) {
  return rawEmail.trim().toLocaleLowerCase()
}

function validateEmail(rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  if (!email || !email.includes('@')) {
    throw new Error('Escribe un correo electrónico válido.')
  }
  return email
}

function redirectUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

function describeAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLocaleLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.'
  }
  if (normalized.includes('provider') && (normalized.includes('not enabled') || normalized.includes('unsupported'))) {
    return 'Google todavía no está habilitado para OANIX. La cuenta por correo sigue disponible.'
  }
  if (normalized.includes('rate limit')) {
    return 'Se alcanzó temporalmente el límite de intentos. Espera un momento y vuelve a intentar.'
  }

  return message || fallback
}

function sessionInfo(session: Session | null): OnlineAccountSession | null {
  const user = session?.user
  if (!user) return null

  const providers = Array.from(new Set(
    (user.identities ?? [])
      .map((identity) => identity.provider)
      .filter((provider): provider is string => Boolean(provider)),
  ))

  const primaryProvider = typeof user.app_metadata?.provider === 'string'
    ? user.app_metadata.provider
    : null
  if (primaryProvider && !providers.includes(primaryProvider)) {
    providers.push(primaryProvider)
  }

  return {
    userId: user.id,
    email: user.email ?? 'Cuenta OANIX',
    providers,
  }
}

function googlePopupFeatures() {
  const width = Math.min(520, Math.max(320, window.outerWidth - 48))
  const height = Math.min(720, Math.max(520, window.outerHeight - 80))
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))

  return `popup=yes,width=${Math.round(width)},height=${Math.round(height)},left=${left},top=${top}`
}

function waitForGooglePopupSession(popup: Window): Promise<OnlineAccountSession> {
  return new Promise((resolve, reject) => {
    let settled = false
    let intervalId = 0
    let timeoutId = 0
    let unsubscribe = () => undefined

    const cleanup = () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      unsubscribe()
    }

    const finish = (session: OnlineAccountSession) => {
      if (settled) return
      settled = true
      cleanup()
      try {
        popup.close()
      } catch {
        // The session is already established; failing to close the auxiliary window is harmless.
      }
      resolve(session)
    }

    const fail = (message: string) => {
      if (settled) return
      settled = true
      cleanup()
      try {
        popup.close()
      } catch {
        // Nothing else to clean up.
      }
      reject(new Error(message))
    }

    unsubscribe = subscribeOnlineAccountSession((nextSession) => {
      if (nextSession) finish(nextSession)
    })

    intervalId = window.setInterval(() => {
      void getOnlineAccountSession()
        .then((nextSession) => {
          if (nextSession) {
            finish(nextSession)
            return
          }
          if (popup.closed) {
            fail('Se cerró la ventana de Google antes de completar el acceso.')
          }
        })
        .catch(() => {
          if (popup.closed) {
            fail('No se pudo comprobar la sesión después de cerrar Google.')
          }
        })
    }, 700)

    timeoutId = window.setTimeout(() => {
      fail('Google tardó demasiado en responder. Vuelve a intentarlo.')
    }, 2 * 60 * 1000)
  })
}

export async function createOnlineAccount(
  rawEmail: string,
  password: string,
): Promise<CreateOnlineAccountResult> {
  const email = validateEmail(rawEmail)

  if (password.length < ACCOUNT_PASSWORD_MIN_CHARACTERS) {
    throw new Error(`La contraseña de la cuenta debe tener al menos ${ACCOUNT_PASSWORD_MIN_CHARACTERS} caracteres.`)
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl(),
    },
  })

  if (error) {
    throw new Error(describeAuthError(error, 'No se pudo crear la cuenta de OANIX.'))
  }

  return {
    email: data.user?.email ?? email,
    requiresEmailConfirmation: data.session === null,
  }
}

export async function signInOnlineAccount(
  rawEmail: string,
  password: string,
): Promise<OnlineAccountSession> {
  const email = validateEmail(rawEmail)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    throw new Error(describeAuthError(error, 'No se pudo iniciar sesión en OANIX.'))
  }

  const info = sessionInfo(data.session)
  if (!info) {
    throw new Error('OANIX no pudo leer la sesión iniciada.')
  }
  return info
}

export async function continueWithGoogle(): Promise<OnlineAccountSession> {
  // Open synchronously from the user's click so popup blockers do not mistake it for an unsolicited window.
  const popup = window.open('', GOOGLE_POPUP_NAME, googlePopupFeatures())
  if (!popup) {
    throw new Error('El navegador bloqueó la ventana de Google. Permite ventanas emergentes para OANIX e inténtalo otra vez.')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl(),
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error || !data.url) {
    popup.close()
    throw new Error(describeAuthError(error, 'No se pudo iniciar con Google.'))
  }

  popup.location.replace(data.url)
  popup.focus()

  return await waitForGooglePopupSession(popup)
}

export async function getOnlineAccountSession(): Promise<OnlineAccountSession | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(describeAuthError(error, 'No se pudo comprobar la sesión de OANIX.'))
  }
  return sessionInfo(data.session)
}

export function subscribeOnlineAccountSession(
  onChange: (session: OnlineAccountSession | null) => void,
) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(sessionInfo(session))
  })
  return () => data.subscription.unsubscribe()
}

export async function signOutOnlineAccount() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(describeAuthError(error, 'No se pudo cerrar la sesión online.'))
  }
}
