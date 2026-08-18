import { syncOanixSystemTheme } from './systemThemeBridge'

export type OanixThemeMode = 'dark' | 'light'
export type OanixThemeKind = 'base' | 'style'

export interface OanixThemePreset {
  id: string
  name: string
  description: string
  mode: OanixThemeMode
  kind: OanixThemeKind
  swatches: readonly [string, string, string]
}

export const OANIX_THEME_STORAGE_KEY = 'oanix.theme'
export const DEFAULT_OANIX_THEME = 'midnight-violet'

const CLASSIC_DAY_TOKENS: Record<string, string> = {
  '--theme-bg': '#ffffff',
  '--theme-bg-deep': '#f7f9fc',
  '--theme-surface': '#ffffff',
  '--theme-surface-2': '#f8fbff',
  '--theme-surface-3': '#edf4fb',
  '--theme-surface-hover': '#eef5ff',
  '--theme-text': '#101828',
  '--theme-text-soft': '#344054',
  '--theme-muted': '#667085',
  '--theme-muted-2': '#98a2b3',
  '--theme-accent': '#2563eb',
  '--theme-accent-2': '#38bdf8',
  '--theme-accent-soft': '#3b82f6',
  '--theme-border': 'rgba(52,64,84,.16)',
  '--theme-border-strong': 'rgba(37,99,235,.36)',
  '--theme-glow': 'rgba(37,99,235,.09)',
  '--theme-grid': 'rgba(71,85,105,.025)',
  '--theme-danger': '#b42318',
}

export const OANIX_THEMES: readonly OanixThemePreset[] = [
  {
    id: 'classic-day',
    name: 'Día',
    description: 'Blanco, azul y luz limpia',
    mode: 'light',
    kind: 'base',
    swatches: ['#ffffff', '#f4f7fb', '#2563eb'],
  },
  {
    id: 'classic-night',
    name: 'Noche',
    description: 'Negro neutro y contraste alto',
    mode: 'dark',
    kind: 'base',
    swatches: ['#05070b', '#10141c', '#dbe7ff'],
  },
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    description: 'Grafito, violeta y cian',
    mode: 'dark',
    kind: 'style',
    swatches: ['#0a0f18', '#6f61ee', '#67e8f9'],
  },
  {
    id: 'cyber-blue',
    name: 'Cyber Blue',
    description: 'Azul noche y cian eléctrico',
    mode: 'dark',
    kind: 'style',
    swatches: ['#07111f', '#3b82f6', '#22d3ee'],
  },
  {
    id: 'graphite-neon',
    name: 'Graphite Neon',
    description: 'Grafito y verde turquesa',
    mode: 'dark',
    kind: 'style',
    swatches: ['#0b1114', '#14b8a6', '#86efac'],
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold',
    description: 'Negro premium y dorado',
    mode: 'dark',
    kind: 'style',
    swatches: ['#0c0b09', '#d6a84b', '#f5d58b'],
  },
  {
    id: 'crimson-core',
    name: 'Crimson Core',
    description: 'Carbón y rojo profundo',
    mode: 'dark',
    kind: 'style',
    swatches: ['#110b0f', '#ef4444', '#fb7185'],
  },
  {
    id: 'aurora-rose',
    name: 'Aurora Rose',
    description: 'Ciruela oscura y rosa',
    mode: 'dark',
    kind: 'style',
    swatches: ['#120b16', '#db4fa3', '#f9a8d4'],
  },
  {
    id: 'pearl-violet',
    name: 'Pearl Violet',
    description: 'Blanco perla y violeta',
    mode: 'light',
    kind: 'style',
    swatches: ['#f7f5fb', '#7658d6', '#9b87f5'],
  },
  {
    id: 'blush-glass',
    name: 'Blush Glass',
    description: 'Rosa cristal y ciruela',
    mode: 'light',
    kind: 'style',
    swatches: ['#fff7fb', '#d9468f', '#f3a7c8'],
  },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    description: 'Lavanda suave y violeta',
    mode: 'light',
    kind: 'style',
    swatches: ['#f8f7ff', '#7c63d9', '#c4b5fd'],
  },
  {
    id: 'ocean-pearl',
    name: 'Ocean Pearl',
    description: 'Perla, azul y turquesa',
    mode: 'light',
    kind: 'style',
    swatches: ['#f5fbfc', '#2387b8', '#2dd4bf'],
  },
] as const

export const OANIX_BASE_THEMES = OANIX_THEMES.filter((theme) => theme.kind === 'base')
export const OANIX_STYLE_THEMES = OANIX_THEMES.filter((theme) => theme.kind === 'style')

export function isOanixThemeId(value: string | null): value is OanixThemePreset['id'] {
  return !!value && OANIX_THEMES.some((theme) => theme.id === value)
}

export function getOanixTheme(themeId: string): OanixThemePreset {
  return OANIX_THEMES.find((theme) => theme.id === themeId) ?? OANIX_THEMES.find((theme) => theme.id === DEFAULT_OANIX_THEME) ?? OANIX_THEMES[0]
}

export function readSavedOanixTheme(): string {
  try {
    const saved = window.localStorage.getItem(OANIX_THEME_STORAGE_KEY)
    return isOanixThemeId(saved) ? saved : DEFAULT_OANIX_THEME
  } catch {
    return DEFAULT_OANIX_THEME
  }
}

function applyClassicDayHardening(enabled: boolean) {
  const root = document.documentElement
  root.classList.toggle('oanix-classic-day', enabled)
  document.body?.classList.toggle('oanix-classic-day', enabled)

  for (const [property, value] of Object.entries(CLASSIC_DAY_TOKENS)) {
    if (enabled) root.style.setProperty(property, value)
    else root.style.removeProperty(property)
  }
}

export function applyOanixTheme(themeId: string, persist = true): string {
  const theme = getOanixTheme(themeId)
  document.documentElement.dataset.oanixTheme = theme.id
  document.documentElement.dataset.oanixThemeMode = theme.mode
  document.documentElement.style.colorScheme = theme.mode
  document.body?.setAttribute('data-oanix-theme', theme.id)
  document.body?.setAttribute('data-oanix-theme-mode', theme.mode)
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
