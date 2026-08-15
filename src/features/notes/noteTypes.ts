export interface NoteRecord {
  version: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  content: {
    format: 'blocks-v1'
    blocks: []
  }
}

export function isNoteRecord(value: unknown): value is NoteRecord {
  if (!value || typeof value !== 'object') return false

  const note = value as Partial<NoteRecord>
  return (
    note.version === 1 &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string' &&
    !!note.content &&
    note.content.format === 'blocks-v1' &&
    Array.isArray(note.content.blocks) &&
    note.content.blocks.length === 0
  )
}
