import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  readEncryptedRecord,
  writeEncryptedRecord,
} from './encryptedRecordRepository'
import { isTagRecord, type TagRecord } from '../../features/tags/tagTypes'

const TAG_RECORD_TYPE = 'tag'

export function saveTag(tag: TagRecord): Promise<void> {
  return writeEncryptedRecord(TAG_RECORD_TYPE, tag.id, tag)
}

export function deleteTagRecord(tagId: string): Promise<void> {
  return deleteEncryptedRecord(TAG_RECORD_TYPE, tagId)
}

export async function readTag(tagId: string): Promise<TagRecord | null> {
  const value = await readEncryptedRecord<unknown>(TAG_RECORD_TYPE, tagId)
  if (value === null) return null
  if (!isTagRecord(value) || value.id !== tagId) {
    throw new Error('Stored tag data is invalid.')
  }
  return value
}

export async function listTags(): Promise<TagRecord[]> {
  const records = await listEncryptedRecords<unknown>(TAG_RECORD_TYPE)
  return records.map(({ recordId, value }) => {
    if (!isTagRecord(value) || value.id !== recordId) {
      throw new Error('Stored tag data is invalid.')
    }
    return value
  })
}
