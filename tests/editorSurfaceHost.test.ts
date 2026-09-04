import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const contract = readFileSync('src/features/editor/editorSurfaceContract.ts', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
const mobileGuard = readFileSync(
  'src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx',
  'utf8',
)
const selectedSurface = readFileSync(
  'src/features/editor/implementations/OanixNotesSheetSurface.tsx',
  'utf8',
)
const plainTextAdapter = readFileSync(
  'src/features/editor/implementations/PlainTextEditorSurface.tsx',
  'utf8',
)

test('Home depends on the replaceable editor host instead of a concrete sheet implementation', () => {
  assert.match(home, /import \{ EditorSurface \} from '\.\.\/editor\/EditorSurface'/)
  assert.match(home, /import type \{[^}]*EditorSurfaceSnapshot[^}]*\} from '\.\.\/editor\/editorSurfaceContract'/)
  assert.match(home, /<EditorSurface[\s\S]*onRequestSave=\{saveEditorSnapshot\}[\s\S]*onRequestClose=\{closeEditor\}/)
  assert.doesNotMatch(home, /from '\.\.\/editor\/NoteEditor'/)
  assert.doesNotMatch(home, /^\s*import .*from ['"][^'"]*(?:ruledSheet|Aurora|qwen)[^'"]*['"]/im)
})

test('the host delegates concrete selection to the editor surface registry and mounts it lazily', () => {
  assert.match(host, /import \{[^}]*lazy[^}]*Suspense[^}]*useMemo[^}]*\} from 'react'/)
  assert.match(host, /from '\.\/editorSurfaceRegistry'/)
  assert.match(host, /const ActiveSurface = lazy\(activeEditorSurface\.load\)/)
  assert.match(host, /<Suspense fallback=\{null\}>/)
  assert.match(host, /<ActiveSurface \{\.\.\.surfaceProps\} \/>/)
  assert.match(host, /activeEditorSurface\.capabilities/)
  assert.doesNotMatch(host, /from '\.\/NoteEditor'/)
  assert.doesNotMatch(host, /from '\.\/implementations\//)
})

test('rich block boundary stays generic and does not import persistence or a concrete sheet', () => {
  assert.match(contract, /export type EditorSurfaceBlockValue/)
  assert.match(contract, /export interface EditorSurfaceBlock/)
  assert.match(contract, /export interface EditorSurfaceBlockChangeSet/)
  assert.match(contract, /loadBlocks\?: \(\) => Promise<EditorSurfaceBlock\[\]>/)
  assert.match(contract, /onRequestBlockSave\?: \(changes: EditorSurfaceBlockChangeSet\) => Promise<boolean>/)
  assert.doesNotMatch(contract, /^\s*import .*from ['"][^'"]*(?:rebuild|storage|security)[^'"]*['"]/im)
  assert.doesNotMatch(contract, /indexedDB|localStorage|sessionStorage/)
  assert.doesNotMatch(contract, /QwenSheetSurface|OanixNotesSheetSurface|PlainTextEditorSurface|NoteEditor/)
})

test('the host gates rich callbacks through the selected surface capability', () => {
  assert.match(host, /activeEditorSurface\.capabilities\.richBlocks[\s\S]*\? props[\s\S]*loadBlocks: undefined[\s\S]*onRequestBlockSave: undefined/)
  assert.match(registry, /richBlocks: true/)
})

test('the registry is the only composition point and lazily selects the guarded OANIX Notes surface', () => {
  assert.match(registry, /export const activeEditorSurface: EditorSurfaceDefinition/)
  assert.match(registry, /id: 'oanix-notes-sheet-v1'/)
  assert.match(registry, /load: async \(\) => \{/)
  assert.match(registry, /await import\([\s\S]*\.\/implementations\/OanixNotesSheetMobileGuard/)
  assert.match(registry, /return \{ default: OanixNotesSheetMobileGuard \}/)
  assert.match(mobileGuard, /OanixNotesSheetSurface/)
  assert.match(registry, /plainText: true/)
  assert.match(registry, /richBlocks: true/)
  assert.match(registry, /attachments: true/)
  assert.doesNotMatch(registry, /^\s*import .*OanixNotesSheetSurface/m)
  assert.doesNotMatch(registry, /from '\.\/NoteEditor'/)
})

test('the selected OANIX Notes sheet owns visual mixed editing while storage stays behind callbacks', () => {
  assert.match(selectedSurface, /export function OanixNotesSheetSurface\(\{/)
  assert.match(selectedSurface, /\}: EditorSurfaceProps\)/)
  assert.match(selectedSurface, /defaultValue=\{initialTitle\}/)
  assert.match(selectedSurface, /defaultValue=\{initialText\}/)
  assert.match(selectedSurface, /AUTOSAVE_IDLE_MS = 3_000/)
  assert.match(selectedSurface, /onRequestSave\(snapshot\)/)
  assert.match(selectedSurface, /onRequestClose\(snapshot\)|onRequestClose\(null\)/)
  assert.match(selectedSurface, /decideOanixMixedDocumentLoad/)
  assert.match(selectedSurface, /insertOanixImageBatch/)
  assert.match(selectedSurface, /OanixMixedDocumentWithFiles/)
  assert.match(selectedSurface, /pendingMixedUpsertsRef/)
  assert.match(selectedSurface, /oanix-notes__slide-handle/)
  assert.match(selectedSurface, /oanix-notes__side-panel/)
  assert.doesNotMatch(selectedSurface, /insertOanixImageAtCursor/)
  assert.doesNotMatch(selectedSurface, /indexedDB|localStorage|sessionStorage/)
  assert.doesNotMatch(selectedSurface, /QwenRichBlocks|NoteEditor|PlainTextEditorSurface/)
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
  assert.doesNotMatch(plainTextAdapter, /<NoteEditor \{\.\.\.props\}/)
})
