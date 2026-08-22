export const DEFAULT_FOLDER_COLOR = '#111b31'
export const DEFAULT_FOLDER_ICON = '📁'

// Bright accents inspired by the approved immersive folder reference, plus
// darker OANIX-friendly options. All values are plain colors so the existing
// encrypted appearance record remains compact and deterministic.
export const FOLDER_COLOR_PRESETS = [
  '#111b31', '#172554', '#241a3b', '#17342f', '#3a281d', '#252a37',
  '#ec4899', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
  '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e', '#d946ef', '#c084fc',
  '#f472b6', '#fb7185', '#7c3aed', '#2563eb', '#0891b2', '#059669',
] as const

// Avoid empty/unsupported placeholders from the visual prototype. These are
// widely supported emoji glyphs on modern web and Android system fonts.
export const FOLDER_ICON_OPTIONS = [
  '⭐', '✨', '💡', '🎯', '🎨', '🎮', '🎵', '🎬', '🎤', '🎧',
  '📁', '📂', '📄', '📝', '📋', '📌', '📐', '📏', '📔', '📕',
  '📖', '📚', '🔗', '🔐', '🔒', '🔑', '💼', '🚀', '⚡', '💎',
  '🧪', '💻', '🌐', '📊', '📷', '🧭', '🗂️', '🏠', '💰', '🛒',
  '🎓', '🧠', '☕', '🏋️', '❤️', '🌙', '☀️', '🌱',
] as const

export const FOLDER_DEFAULT_ICONS = [
  '⭐', '📁', '🔗', '🧪', '🎨', '📐', '🔐', '📔', '💼', '🚀', '💡', '📚',
] as const

export type FolderIcon = typeof FOLDER_ICON_OPTIONS[number]

export function isFolderIcon(value: unknown): value is FolderIcon {
  return typeof value === 'string' && (FOLDER_ICON_OPTIONS as readonly string[]).includes(value)
}
