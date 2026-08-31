import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const planner = readFileSync('src/features/rebuild/incrementalNoteText.ts', 'utf8')
const service = readFileSync('src/features/rebuild/rebuildService.ts', 'utf8')
const repository = readFileSync('src/storage/repositories/encryptedV2RecordRepository.ts', 'utf8')
const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')

test('incremental text persistence uses bounded stable chunks instead of rewriting the whole note', () => {
  assert.match(planner, /TARGET_CHUNK_CHARS = 16 \* 1024/)
  assert.match(planner, /MIN_CHUNK_CHARS = 8 \* 1024/)
  assert.match(planner, /MAX_CHUNK_CHARS = 24 \* 1024/)
  assert.match(planner, /RESYNC_LOOKAHEAD_CHUNKS = 32/)
  assert.match(planner, /nextText\.startsWith\(piece, newOffset\)/)
  assert.match(planner, /findResyncAnchor/)
  assert.match(planner, /Probe exponentially farther anchors/)
  assert.match(planner, /const revision = previous \? previous\.revision \+ 1 : 1/)
  assert.match(planner, /manifest\.revision \+ 1/)
})

test('pending sync state is durable and deduplicated by unit identity', () => {
  assert.match(planner, /pendingRecordId\(unitType: string, unitId: string\)/)
  assert.match(planner, /JSON\.stringify\(\[unitType, unitId\]\)/)
  assert.match(planner, /operation: 'upsert' \| 'delete'/)
  assert.match(planner, /createPendingSyncWrite/)
  assert.match(planner, /'delete',\s*queuedAt/)
})

test('unchanged saves and title-only saves avoid unnecessary body work', () => {
  assert.match(service, /const titleChanged = normalizedTitle !== existing\.title/)
  assert.match(service, /const textChanged = text !== previousText/)
  assert.match(service, /if \(!titleChanged && !textChanged\) return existing/)
  assert.match(service, /if \(textChanged\) \{/)
  assert.match(service, /readEncryptedV2Record<NoteV2Manifest>/)
})

test('editor keeps the latest committed baseline across idle and close saves', () => {
  assert.match(rebuild, /editorRef = useRef<OpenedEditor \| null>/)
  assert.match(rebuild, /async function saveEditorSnapshot/)
  assert.match(rebuild, /commitOpenedEditor\(next\)/)
  assert.match(rebuild, /async function closeEditor/)
  assert.match(rebuild, /current\.meta,[\s\S]*current\.text,[\s\S]*snapshot\.title,[\s\S]*snapshot\.text/)
  assert.doesNotMatch(rebuild, /saveRebuildNote\([^\n]*onInput/)
})

test('encrypted repository batches requested reads and atomic writes/deletes', () => {
  assert.match(repository, /export async function readEncryptedV2Records/)
  assert.match(repository, /store\.get\(\[recordType, recordId\]\)/)
  assert.match(repository, /export async function applyEncryptedV2Changes/)
  assert.match(repository, /const transaction = database\.transaction\(V2_ENCRYPTED_RECORDS_STORE, 'readwrite'\)/)
  assert.match(repository, /encrypted\.forEach\(\(record\) => store\.put\(record\)\)/)
  assert.match(repository, /deletes\.forEach/)
})
