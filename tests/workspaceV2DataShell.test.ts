import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const css = readFileSync('src/features/notes/workspaceV2.css', 'utf8')
const orderService = readFileSync('src/features/notes/workspaceV2OrderService.ts', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const dragRuntime = readFileSync('src/features/notes/WorkspaceV2DragRuntime.tsx', 'utf8')

test('workspace v2 consumes real note/folder/tag records instead of prototype storage', () => {
  for (const required of [
    'FolderRecord[]',
    'TagRecord[]',
    'NoteRecord[]',
    'loadFolderColors()',
    'loadFolderIcons()',
    'loadFolderCovers()',
    'loadFolderAppearanceFlags()',
    'visualDescription',
    'visualCategoryTagId',
    'visualIcon',
    'visualColor',
  ]) {
    assert.ok(source.includes(required), `missing ${required}`)
  }

  assert.doesNotMatch(source, /datos\.js|localStorage|sessionStorage/)
  assert.doesNotMatch(source, /https?:\/\//)
})

test('workspace v2 owns persistence only through existing encrypted order services', () => {
  assert.match(orderService, /persistFolderOrder\(ids\)/)
  assert.match(orderService, /persistTagOrder\(ids\)/)
  assert.match(orderService, /persistNoteOrder\(ids, shouldContinue\)/)
  assert.doesNotMatch(orderService, /localStorage|sessionStorage|indexedDB/)
})

test('workspace v2 visual surface is namespaced and reduced-motion aware', () => {
  assert.match(source, /notes-sidebar oanix-workspace-v2/)
  assert.match(css, /^\.oanix-workspace-v2\s*\{/m)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /:focus-visible/)
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*oanix-workspace-v2__note-card[\s\S]*backdrop-filter: none/)
  assert.doesNotMatch(css, /(^|\n)\s*(html|body|:root|button|input|main|aside)\s*[,{]/)
  assert.doesNotMatch(css, /transition:\s*all/)
  assert.doesNotMatch(css, /animation:[^;]*infinite/)
})

test('workspace v2 keeps mobile scrolling on the real scroll container and preserves momentum', () => {
  assert.match(dragRuntime, /item\.closest<HTMLElement>\(\`\[data-v2-scroll-kind="/)
  assert.match(dragRuntime, /gesture\.scrollContainer\.scrollTop = gesture\.startScroll - dy/)
  assert.match(dragRuntime, /gesture\.scrollContainer\.scrollLeft = gesture\.startScroll - dx/)
  assert.match(dragRuntime, /startMomentumScroll/)
  assert.match(dragRuntime, /window\.requestAnimationFrame\(tick\)/)
})

test('workspace v2 dock keeps Todas and utility controls fixed around user folders', () => {
  assert.match(source, /oanix-workspace-v2__folder--all/)
  assert.match(source, /oanix-workspace-v2__folder-scroll/)
  assert.match(source, /oanix-workspace-v2__dock-actions/)
  assert.match(source, /applyOanixTheme\(nextTheme\)/)
  assert.match(source, /activeFolderCover/)
  assert.match(css, /grid-template-columns: 4\.2rem minmax\(0, 1fr\) 2\.7rem/)
  assert.match(css, /oanix-workspace-v2__dock-actions[\s\S]*grid-template-columns: 1fr/)
  assert.match(css, /oanix-workspace-v2__wallpaper[\s\S]*z-index: 0[\s\S]*background-image: var\(--v2-folder-wallpaper\)/)
  assert.match(css, /oanix-workspace-v2\.has-wallpaper::before[\s\S]*z-index: 1/)
  assert.match(css, /oanix-workspace-v2__menu-backdrop/)
})

test('workspace v2 desktop timeline owns the exact center axis and compact card geometry', () => {
  assert.match(css, /oanix-workspace-v2__timeline::before[\s\S]*left: 50%/)
  assert.match(css, /html\[data-oanix-theme\] \.oanix-workspace-v2 \.oanix-workspace-v2__timeline-item\.note-row[\s\S]*width: 50% !important/)
  assert.match(css, /oanix-workspace-v2__timeline-item\.note-row:nth-child\(even\)[\s\S]*left: 50% !important/)
  assert.match(css, /oanix-workspace-v2__note-card\.note-row__open[\s\S]*width: min\(100%, 22rem\) !important/)
  assert.match(css, /note-row:not\(:nth-child\(even\)\)[\s\S]*margin-left: auto !important/)
  assert.match(css, /note-row:nth-child\(even\)[\s\S]*margin-right: auto !important/)
})

test('workspace v2 note card keyboard activation does not hijack nested action buttons', () => {
  assert.match(source, /onKeyDown=\{\(event\) => \{[\s\S]*event\.target !== event\.currentTarget[\s\S]*event\.currentTarget\.click\(\)/)
})


test('workspace v2 coalesces rapid reorder persistence so the latest gesture wins', () => {
  for (const kind of ['Folder', 'Tag', 'Note']) {
    assert.match(workspace, new RegExp(`pendingV2${kind}OrderRef\\.current = \\[\\...`))
    assert.match(workspace, new RegExp(`if \\(v2${kind}OrderLoopRef\\.current\\) return`))
    assert.match(workspace, new RegExp(`while \\(pendingV2${kind}OrderRef\\.current\\)`))
    assert.match(workspace, new RegExp(`if \\(pendingV2${kind}OrderRef\\.current\\) continue`))
  }
  assert.match(workspace, /saveWorkspaceV2NoteOrder\([\s\S]*\(\) => pendingV2NoteOrderRef\.current === null/)
  assert.match(orderService, /shouldContinue: \(\) => boolean = \(\) => true/)
})
