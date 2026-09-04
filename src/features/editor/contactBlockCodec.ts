import type { EditorSurfaceBlock, EditorSurfaceBlockValue } from './editorSurfaceContract.ts'

export const CONTACT_BLOCK_KIND = 'contact'
export const MAX_CONTACT_FIELD_LENGTH = 2_000

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
  return typeof value === 'string' && value.length <= MAX_CONTACT_FIELD_LENGTH ? value : null
}

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
      name: block.name.slice(0, MAX_CONTACT_FIELD_LENGTH),
      phone: block.phone.slice(0, MAX_CONTACT_FIELD_LENGTH),
      email: block.email.slice(0, MAX_CONTACT_FIELD_LENGTH),
      organization: block.organization.slice(0, MAX_CONTACT_FIELD_LENGTH),
      notes: block.notes.slice(0, MAX_CONTACT_FIELD_LENGTH),
    },
  }
}
