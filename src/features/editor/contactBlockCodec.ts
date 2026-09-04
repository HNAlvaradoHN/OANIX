import type { EditorSurfaceBlock, EditorSurfaceBlockValue } from './editorSurfaceContract.ts'

export const CONTACT_BLOCK_KIND = 'contact'
export const MAX_CONTACT_FIELD_LENGTH = 10_000
export const MAX_CONTACT_EDIT_LENGTH = MAX_CONTACT_FIELD_LENGTH
export const MAX_CONTACT_NAME_LENGTH = 200
export const MAX_CONTACT_PHONE_LENGTH = 20
export const MAX_CONTACT_EMAIL_LENGTH = 254
export const MAX_CONTACT_ORGANIZATION_LENGTH = 200
export const MAX_CONTACT_NOTES_LENGTH = MAX_CONTACT_FIELD_LENGTH

export interface EditorContactBlock {
  id: string
  kind: typeof CONTACT_BLOCK_KIND
  name: string
  phone: string
  email: string
  organization: string
  notes: string
}

function stringField(value: EditorSurfaceBlockValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

export function sanitizeContactPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, MAX_CONTACT_PHONE_LENGTH)
}

export function isValidContactEmail(value: string): boolean {
  const email = value.trim()
  if (email.length === 0) return true
  if (email.length > MAX_CONTACT_EMAIL_LENGTH || /\s/.test(email)) return false
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@') || at >= email.length - 1) return false
  const domain = email.slice(at + 1)
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false
  return domain.split('.').every((label) => label.length > 0 && !label.startsWith('-') && !label.endsWith('-'))
}

/**
 * Decode follows the persisted contact model exactly: every field must be a string,
 * but existing values are not rejected merely for being longer than the editor's
 * input guard. This keeps older/private contact data reopenable without truncation.
 */
export function decodeContactBlock(block: EditorSurfaceBlock): EditorContactBlock | null {
  if (block.kind !== CONTACT_BLOCK_KIND) return null
  const name = stringField(block.data.name)
  const phone = stringField(block.data.phone)
  const email = stringField(block.data.email)
  const organization = stringField(block.data.organization)
  const notes = stringField(block.data.notes)
  if (name === null || phone === null || email === null || organization === null || notes === null) return null
  return { id: block.id, kind: CONTACT_BLOCK_KIND, name, phone, email, organization, notes }
}

export function encodeContactBlock(block: EditorContactBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: CONTACT_BLOCK_KIND,
    data: {
      name: block.name,
      phone: block.phone,
      email: block.email,
      organization: block.organization,
      notes: block.notes,
    },
  }
}
