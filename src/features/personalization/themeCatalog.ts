export type OanixThemeMode = 'dark' | 'light'

export interface OanixThemePreset {
  id: string
  name: string
  description: string
  mode: OanixThemeMode
  swatches: readonly [string, string, string]
}

export const OANIX_THEME_STORAGE_KEY = 'oanix.theme'
export const DEFAULT_OANIX_THEME = 'midnight-violet'

export const OANIX_THEMES: readonly OanixThemePreset[] = [
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    description: 'Grafito, violeta y cian',
    mode: 'dark',
    swatches: ['#0a0f18', '#6f61ee', '#67e8f9'],
  },
  {
    id: 'cyber-blue',
    name: 'Cyber Blue',
    description: 'Azul noche y cian eléctrico',
    mode: 'dark',
    swatches: ['#07111f', '#3b82f6', '#22d3ee'],
  },
  {
    id: 'graphite-neon',
    name: 'Graphite Neon',
    description: 'Grafito y verde turquesa',
    mode: 'dark',
    swatches: ['#0b1114', '#14b8a6', '#86efac'],
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold',
    description: 'Negro premium y dorado',
    mode: 'dark',
    swatches: ['#0c0b09', '#d6a84b', '#f5d58b'],
  },
  {
    id: 'crimson-core',
    name: 'Crimson Core',
    description: 'Carbón y rojo profundo',
    mode: 'dark',
    swatches: ['#110b0f', '#ef4444', '#fb7185'],
  },
  {
    id: 'aurora-rose',
    name: 'Aurora Rose',
    description: 'Ciruela oscura y rosa',
    mode: 'dark',
    swatches: ['#120b16', '#db4fa3', '#f9a8d4'],
  },
  {
    id: 'pearl-violet',
    name: 'Pearl Violet',
    description: 'Blanco perla y violeta',
    mode: 'light',
    swatches: ['#f7f5fb', '#7658d6', '#9b87f5'],
  },
  {
    id: 'blush-glass',
    name: 'Blush Glass',
    description: 'Rosa cristal y ciruela',
    mode: 'light',
    swatches: ['#fff7fb', '#d9468f', '#f3a7c8'],
  },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    description: 'Lavanda suave y violeta',
    mode: 'light',
    swatches: ['#f8f7ff', '#7c63d9', '#c4b5fd'],
  },
  {
    id: 'ocean-pearl',
    name: 'Ocean Pearl',
    description: 'Perla, azul y turquesa',
    mode: 'light',
    swatches: ['#f5fbfc', '#2387b8', '#2dd4bf'],
  },
] as const

export function isOanixThemeId(value: string | null): value is OanixThemePreset['id'] {
  return !!value && OANIX_THEMES.some((theme) => theme.id === value)
}

export function getOanixTheme(themeId: string): OanixThemePreset {
  return OANIX_THEMES.find((theme) => theme.id === themeId) ?? OANIX_THEMES[0]
}

export function readSavedOanixTheme(): string {
  try {
    const saved = window.localStorage.getItem(OANIX_THEME_STORAGE_KEY)
    return isOanixThemeId(saved) ? saved : DEFAULT_OANIX_THEME
  } catch {
    return DEFAULT_OANIX_THEME
  }
}

export function applyOanixTheme(themeId: string, persist = true): string {
  const theme = getOanixTheme(themeId)
  document.documentElement.dataset.oanixTheme = theme.id
  document.documentElement.dataset.oanixThemeMode = theme.mode
  document.documentElement.style.colorScheme = theme.mode

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
