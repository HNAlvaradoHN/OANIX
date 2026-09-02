import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const contract = readFileSync('src/features/editor/editorSurfaceContract.ts', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
const attachmentAdapter = readFileSync(
  'src/features/editor/editorAttachmentAdapter.ts',
  'utf8',
)
const selectedSurface = readFileSync(
  'src/features/editor/implementations/QwenSheetSurface.tsx',
  'utf8',
)
const replicaSurface = readFileSync(
  'src/features/editor/implementations/ReplicaV16SheetSurface.tsx',
  'utf8',
)
const plainTextAdapter = readFileSync(
  'src/features/editor/implementations/PlainTextEditorSurface.tsx',
  'utf8',
)

test('Home depends on the replaceable editor host instead of a concrete sheet implementation', () => {
  assert.match(home, /import \{ EditorSurface \} from '\.\.\/editor\/EditorSurface'/)
  assert.match(
    home,
    /import type \{[^}]*EditorSurfaceSnapshot[^}]*\} from '\.\.\/editor\/editorSurfaceContract'/,
  )
  assert.match(home, /<EditorSurface[\s\S]*onRequestSave=\{saveEditorSnapshot\}[\s\S]*onRequestClose=\{closeEditor\}/)
  assert.doesNotMatch(home, /from '\.\.\/editor\/NoteEditor'/)
  assert.doesNotMatch(
    home,
    /^\s*import .*from ['"][^'"]*(?:ruledSheet|Aurora|qwen|ReplicaV16)[^'"]*['"]/im,
  )
})

test('the host delegates concrete selection to the registry and lazily caches non-default surfaces', () => {
  assert.match(host, /lazy, Suspense/)
  assert.match(host, /from '\.\/editorSurfaceRegistry'/)
  assert.match(host, /const ActiveSurface = lazy\(activeEditorSurface\.load\)/)
  assert.match(host, /resolveEditorSurface\(surfaceId\)/)
  assert.match(host, /lazySurfaceCache/)
  assert.match(host, /<Suspense fallback=\{null\}>/)
  assert.match(host, /<SelectedSurface \{\.\.\.surfaceProps\} \/>/)
  assert.match(host, /selectedSurface\.capabilities\.richBlocks/)
  assert.doesNotMatch(host, /from '\.\/NoteEditor'/)
  assert.doesNotMatch(host, /from '\.\/implementations\//)
})

test('rich block boundary stays generic and does not import persistence or a concrete sheet', () => {
  assert.match(contract, /export type EditorSurfaceBlockValue/)
  assert.match(contract, /export interface EditorSurfaceBlock/)
  assert.match(contract, /export interface EditorSurfaceBlockChangeSet/)
  assert.match(contract, /loadBlocks\?: \(\) => Promise<EditorSurfaceBlock\[\]>/)
  assert.match(contract, /onRequestBlockSave\?: \(changes: EditorSurfaceBlockChangeSet\) => Promise<boolean>/)
  assert.doesNotMatch(
    contract,
    /^\s*import .*from ['"][^'"]*(?:rebuild|storage|security)[^'"]*['"]/im,
  )
  assert.doesNotMatch(contract, /indexedDB|localStorage|sessionStorage/)
  assert.doesNotMatch(contract, /QwenSheetSurface|ReplicaV16SheetSurface|PlainTextEditorSurface|NoteEditor/)
})

test('attachment boundary exposes opaque metadata and lazy binary callbacks only', () => {
  assert.match(contract, /export interface EditorSurfaceAttachment/)
  assert.match(contract, /loadAttachments\?: \(\) => Promise<EditorSurfaceAttachment\[\]>/)
  assert.match(contract, /onRequestAttachmentStore\?: \(file: File\) => Promise<EditorSurfaceAttachment>/)
  assert.match(contract, /loadAttachmentFile\?: \(attachmentId: string\) => Promise<File \| null>/)
  assert.match(contract, /onRequestAttachmentRemove\?: \(attachmentId: string\) => Promise<boolean>/)
  assert.doesNotMatch(contract, /\bAttachmentMetadata\b|\bEncryptedBlob\b|\bDriveStorage\b/)
  assert.doesNotMatch(contract, /^\s*import .*from ['"][^'"]*attachments[^'"]*['"]/im)
})

test('the host gates rich and attachment callbacks through selected capabilities', () => {
  assert.match(host, /selectedSurface\.capabilities\.richBlocks[\s\S]*loadBlocks: undefined[\s\S]*onRequestBlockSave: undefined/)
  assert.match(host, /selectedSurface\.capabilities\.attachments/)
  assert.match(host, /import\('\.\/editorAttachmentAdapter'\)/)
  assert.match(host, /loadAttachments: undefined/)
  assert.match(host, /onRequestAttachmentStore: undefined/)
  assert.match(host, /loadAttachmentFile: undefined/)
  assert.match(host, /onRequestAttachmentRemove: undefined/)
  assert.match(registry, /'qwen-sanitized-v1'[\s\S]*attachments: false/)
  assert.match(registry, /'replica-v16'[\s\S]*attachments: true/)
})

test('attachment adapter keeps storage/provider metadata outside visual implementations', () => {
  assert.match(attachmentAdapter, /from '\.\.\/attachments\/attachmentService'/)
  assert.match(attachmentAdapter, /from '\.\.\/attachments\/attachmentTypes'/)
  assert.match(attachmentAdapter, /createEditorAttachmentAdapter/)
  assert.match(attachmentAdapter, /loadEncryptedAttachments\(noteId\)/)
  assert.match(attachmentAdapter, /storeEncryptedAttachment\(noteId, file\)/)
  assert.match(attachmentAdapter, /loadEncryptedAttachmentFile\(metadata\)/)
  assert.match(attachmentAdapter, /removeEncryptedAttachment\(noteId, attachmentId\)/)
  assert.doesNotMatch(replicaSurface, /attachmentService|attachmentTypes|encryptedBlob|encryptedRecord|Drive/)
})

test('the registry keeps stable and experimental implementations in one composition catalog', () => {
  assert.match(registry, /export const editorSurfaceDefinitions/)
  assert.match(registry, /'qwen-sanitized-v1'/)
  assert.match(registry, /'replica-v16'/)
  assert.match(registry, /experimental: true/)
  assert.match(registry, /await import\([\s\S]*\.\/implementations\/QwenSheetSurface/)
  assert.match(registry, /await import\([\s\S]*\.\/implementations\/ReplicaV16SheetSurface/)
  assert.match(registry, /DEFAULT_EDITOR_SURFACE_ID/)
  assert.match(registry, /resolveEditorSurface/)
  assert.doesNotMatch(registry, /^\s*import .*QwenSheetSurface/m)
  assert.doesNotMatch(registry, /^\s*import .*ReplicaV16SheetSurface/m)
  assert.doesNotMatch(registry, /from '\.\/NoteEditor'/)
})

test('the stable selected sheet still owns only visual editing and the EditorSurface lifecycle', () => {
  assert.match(selectedSurface, /export function QwenSheetSurface\(\{/)
  assert.match(selectedSurface, /\}: EditorSurfaceProps\)/)
  assert.match(selectedSurface, /defaultValue=\{initialTitle\}/)
  assert.match(selectedSurface, /defaultValue=\{initialText\}/)
  assert.match(selectedSurface, /AUTOSAVE_IDLE_MS = 3_000/)
  assert.match(selectedSurface, /await onRequestSave\(snapshot\)/)
  assert.match(selectedSurface, /await onRequestClose\(snapshot\)/)
  assert.match(selectedSurface, /data-oanix-save-and-close="true"/)
  assert.match(selectedSurface, /data-oanix-back-close="true"/)
})

test('the replica preserves the same safe save/close contract without importing app layers', () => {
  assert.match(replicaSurface, /export function ReplicaV16SheetSurface\(\{/)
  assert.match(replicaSurface, /AUTOSAVE_IDLE_MS = 3_000/)
  assert.match(replicaSurface, /defaultValue=\{initialTitle\}/)
  assert.match(replicaSurface, /defaultValue=\{initialText\}/)
  assert.match(replicaSurface, /await onRequestSave\(snapshot\)/)
  assert.match(replicaSurface, /await onRequestClose\(snapshot\)/)
  assert.match(replicaSurface, /data-oanix-sheet="replica-v16"/)
  assert.match(replicaSurface, /data-oanix-save-and-close="true"/)
  assert.match(replicaSurface, /data-oanix-back-close="true"/)
  assert.doesNotMatch(replicaSurface, /rebuild|vault|repository|storage|crypto|indexedDB|localStorage|sessionStorage/)
})

test('the superseded plain-text adapter remains isolated and reusable during transition', () => {
  assert.match(plainTextAdapter, /import \{ NoteEditor \} from '\.\.\/NoteEditor'/)
  assert.match(plainTextAdapter, /export function PlainTextEditorSurface\(\{/)
  assert.match(plainTextAdapter, /\}: EditorSurfaceProps\)/)
  assert.match(plainTextAdapter, /<NoteEditor/)
  assert.match(plainTextAdapter, /initialTitle=\{initialTitle\}/)
  assert.match(plainTextAdapter, /initialText=\{initialText\}/)
  assert.match(plainTextAdapter, /onRequestSave=\{onRequestSave\}/)
  assert.match(plainTextAdapter, /onRequestClose=\{onRequestClose\}/)
})
