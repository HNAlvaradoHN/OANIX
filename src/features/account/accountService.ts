import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kpnhdtiscxckveqeyqfq.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WouuStU5HcKeGYOL60Eelw_kyzaPJLZ'

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

export async function createOnlineAccount(
  rawEmail: string,
  password: string,
): Promise<CreateOnlineAccountResult> {
  const email = rawEmail.trim().toLocaleLowerCase()

  if (!email || !email.includes('@')) {
    throw new Error('Escribe un correo electrónico válido.')
  }

  if (password.length < ACCOUNT_PASSWORD_MIN_CHARACTERS) {
    throw new Error(`La contraseña de la cuenta debe tener al menos ${ACCOUNT_PASSWORD_MIN_CHARACTERS} caracteres.`)
  }

  const redirectUrl = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  })

  if (error) {
    throw new Error(error.message || 'No se pudo crear la cuenta de OANIX.')
  }

  return {
    email: data.user?.email ?? email,
    requiresEmailConfirmation: data.session === null,
  }
}
