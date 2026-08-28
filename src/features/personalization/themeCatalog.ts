import { syncOanixSystemTheme } from './systemThemeBridge'

export type OanixThemeMode = 'dark' | 'light'

export interface OanixThemePreset {
  id: 'classic-day' | 'classic-night'
  name: string
  description: string
  mode: OanixThemeMode
  swatches: readonly [string, string, string]
}

export const OANIX_THEME_STORAGE_KEY = 'oanix.theme'
export const DEFAULT_OANIX_THEME: OanixThemePreset['id'] = 'classic-night'

const LEGACY_LIGHT_THEMES = new Set([
  'pearl-violet',
  'blush-glass',
  'lavender-mist',
  'ocean-pearl',
])

const CLASSIC_DAY_TOKENS: Record<string, string> = {
  '--theme-bg': '#f5eaf1',
  '--theme-bg-deep': '#e8eff5',
  '--theme-surface': '#fff9fc',
  '--theme-surface-2': '#f7f3f8',
  '--theme-surface-3': '#edf4f5',
  '--theme-surface-hover': '#f4eaf2',
  '--theme-text': '#273144',
  '--theme-text-soft': '#455067',
  '--theme-muted': '#6f7689',
  '--theme-muted-2': '#9aa1b0',
  '--theme-accent': '#5876d8',
  '--theme-accent-2': '#43b9b2',
  '--theme-accent-soft': '#8b78d8',
  '--theme-border': 'rgba(78,74,98,.15)',
  '--theme-border-strong': 'rgba(88,118,216,.30)',
  '--theme-glow': 'rgba(139,120,216,.10)',
  '--theme-grid': 'rgba(94,85,110,.018)',
  '--theme-danger': '#b42342',
  '--oanix-organic-text': '#273144',
  '--oanix-organic-muted': '#626a7c',
  '--oanix-organic-border': 'rgba(255,255,255,.52)',
  '--oanix-organic-card': 'rgba(255,250,253,.58)',
  '--oanix-organic-header': 'rgba(255,250,253,.44)',
  '--oanix-organic-dock': 'linear-gradient(180deg,rgba(255,250,253,.34),rgba(230,238,247,.42))',
  '--oanix-organic-chip': 'rgba(255,255,255,.28)',
  '--oanix-organic-shadow': 'rgba(73,56,87,.10)',
}

export const OANIX_THEMES: readonly OanixThemePreset[] = [
  {
    id: 'classic-day',
    name: 'Día',
    description: 'Luz suave, pastel y degradados relajantes',
    mode: 'light',
    swatches: ['#f5eaf1', '#dff3e9', '#7f8fe8'],
  },
  {
    id: 'classic-night',
    name: 'Noche',
    description: 'Noche profunda con violeta, teal y azul calmado',
    mode: 'dark',
    swatches: ['#171323', '#0d2830', '#6375c9'],
  },
] as const

export const OANIX_BASE_THEMES = OANIX_THEMES

export function isOanixThemeId(value: string | null): value is OanixThemePreset['id'] {
  return value === 'classic-day' || value === 'classic-night'
}

function normalizeThemeId(value: string | null): OanixThemePreset['id'] {
  if (isOanixThemeId(value)) return value
  if (value && LEGACY_LIGHT_THEMES.has(value)) return 'classic-day'
  return 'classic-night'
}

export function getOanixTheme(themeId: string): OanixThemePreset {
  const normalized = normalizeThemeId(themeId)
  return OANIX_THEMES.find((theme) => theme.id === normalized) ?? OANIX_THEMES[1]
}

export function readSavedOanixTheme(): OanixThemePreset['id'] {
  try {
    return normalizeThemeId(window.localStorage.getItem(OANIX_THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_OANIX_THEME
  }
}

function applyClassicDayHardening(enabled: boolean) {
  const root = document.documentElement
  const targets = [document.body, document.getElementById('root')]
  root.classList.toggle('oanix-classic-day', enabled)
  targets.forEach((target) => target?.classList.toggle('oanix-classic-day', enabled))

  for (const [property, value] of Object.entries(CLASSIC_DAY_TOKENS)) {
    if (enabled) root.style.setProperty(property, value)
    else root.style.removeProperty(property)
  }
}

export function applyOanixTheme(themeId: string, persist = true): OanixThemePreset['id'] {
  const theme = getOanixTheme(themeId)
  const root = document.documentElement
  const targets = [document.body, document.getElementById('root')]
  const colorScheme = theme.mode === 'light' ? 'only light' : 'dark'

  root.dataset.oanixTheme = theme.id
  root.dataset.oanixThemeMode = theme.mode
  root.style.setProperty('color-scheme', colorScheme, 'important')

  targets.forEach((target) => {
    target?.setAttribute('data-oanix-theme', theme.id)
    target?.setAttribute('data-oanix-theme-mode', theme.mode)
    target?.style.setProperty('color-scheme', colorScheme, 'important')
  })

  applyClassicDayHardening(theme.id === 'classic-day')
  syncOanixSystemTheme(theme.swatches[0], theme.mode)

  if (persist) {
    try {
      window.localStorage.setItem(OANIX_THEME_STORAGE_KEY, theme.id)
    } catch {
      // Theme persistence is a convenience only; never block OANIX if storage is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent('oanix:theme-change', { detail: theme.id }))
  return theme.id
}
