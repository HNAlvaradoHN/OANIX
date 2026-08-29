import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')
const shell = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const contract = readFileSync('src/features/notes/workspaceThemeContract.ts', 'utf8')
const css = readFileSync('src/features/notes/themes/infographic/infographicTheme.css', 'utf8')
const orderService = readFileSync('src/features/notes/workspaceV2OrderService.ts', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const dragRuntime = readFileSync('src/features/notes/themes/infographic/InfographicThemeDragRuntime.tsx', 'utf8')

test('workspace consumes real note folder and tag records through a swappable theme contract', () => {
  for (const required of [
    'FolderRecord[]',
    'TagRecord[]',
    'NoteRecord[]',
    'onCreateFolder',
    'onCreateTag',
    'onSelectNote',
    'onFolderOrder',
    'onTagOrder',
    'onNoteOrder',
  ]) {
    assert.ok(contract.includes(required), `missing ${required}`)
  }

  for (const required of [
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

  assert.match(shell, /<InfographicWorkspace \.\.\.props/)
  assert.doesNotMatch(source, /datos\.js|localStorage|sessionStorage/)
  assert.doesNotMatch(source, /https?:\/\//)
})

test('workspace persistence stays behind existing encrypted order services', () => {
  assert.match(orderService, /persistFolderOrder\(ids\)/)
  assert.match(orderService, /persistTagOrder\(ids\)/)
  assert.match(orderService, /persistNoteOrder\(ids, shouldContinue\)/)
  assert.doesNotMatch(orderService, /localStorage|sessionStorage|indexedDB/)
})

test('infographic theme is isolated and reduced-motion aware', () => {
  assert.match(source, /oanix-infographic-theme/)
  assert.match(source, /data-oanix-workspace-theme="infographic"/)
  assert.match(css, /^\.oanix-infographic-theme\s*\{/m)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /:focus-visible/)
  assert.doesNotMatch(css, /transition:\s*all/)
  assert.match(css, /oanix-infographic-slide-arrows/)
  assert.match(css, /oanix-infographic-ios-jiggle/)
})

test('infographic drag keeps long press ghost edge autoscroll and momentum', () => {
  assert.match(dragRuntime, /folder:\s*500/)
  assert.match(dragRuntime, /tag:\s*400/)
  assert.match(dragRuntime, /note:\s*400/)
  assert.match(dragRuntime, /cloneNode\(true\)/)
  assert.match(dragRuntime, /document\.elementFromPoint\(x, y\)/)
  assert.match(dragRuntime, /scrollLeft \+= speed/)
  assert.match(dragRuntime, /scrollTop \+= speed/)
  assert.match(dragRuntime, /startMomentumScroll/)
  assert.match(dragRuntime, /requestAnimationFrame\(tick\)/)
})

test('prototype day night is local to the workspace theme', () => {
  assert.match(source, /const \[darkMode, setDarkMode\] = useState\(false\)/)
  assert.match(source, /setDarkMode\(\(current\) => !current\)/)
  assert.match(source, /classList\.toggle\('oanix-infographic-dark', darkMode\)/)
  assert.match(css, /\.oanix-infographic-theme\.dark-mode/)
  assert.doesNotMatch(source, /applyOanixTheme|readSavedOanixTheme/)
})

test('infographic timeline owns a true centered divider with alternating cards', () => {
  assert.match(css, /\.timeline-container::before[\s\S]*left: 50%/)
  assert.match(css, /\.timeline-item\.note-row[\s\S]*width: 50% !important/)
  assert.match(css, /\.timeline-item\.note-row:nth-child\(odd\)[\s\S]*left: 0 !important/)
  assert.match(css, /\.timeline-item\.note-row:nth-child\(even\)[\s\S]*left: 50% !important/)
  assert.match(css, /\.infographic-card\.note-row__open/)
})

test('infographic timeline collapses to one mobile lane without moving the desktop axis contract', () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.timeline-container::before[\s\S]*left: 20px/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.timeline-item\.note-row,[\s\S]*nth-child\(even\)[\s\S]*left: 0 !important[\s\S]*width: 100% !important/)
})

test('real note colors drive prototype card variables and remain editable', () => {
  assert.match(source, /note\.visualColor \?\? category\?\.color \?\? DEFAULT_NOTE_VISUAL_COLOR/)
  assert.match(source, /--card-r/)
  assert.match(source, /--card-g/)
  assert.match(source, /--card-b/)
  assert.match(source, /luminance > 0\.5 \? '#1e293b' : '#ffffff'/)
})

test('note card keyboard activation still crosses the real click path', () => {
  assert.match(source, /onKeyDown=\{\(event\) => \{[\s\S]*event\.target !== event\.currentTarget[\s\S]*event\.currentTarget\.click\(\)/)
})

test('workspace coalesces rapid reorder persistence so latest gesture wins', () => {
  for (const kind of ['Folder', 'Tag', 'Note']) {
    assert.match(workspace, new RegExp(`pendingV2${kind}OrderRef\\.current = \\[\\...`))
    assert.match(workspace, new RegExp(`if \\(v2${kind}OrderLoopRef\\.current\\) return`))
    assert.match(workspace, new RegExp(`while \\(pendingV2${kind}OrderRef\\.current\\)`))
  }
  assert.match(workspace, /saveWorkspaceV2NoteOrder\([\s\S]*\(\) => pendingV2NoteOrderRef\.current === null/)
  assert.match(orderService, /shouldContinue: \(\) => boolean = \(\) => true/)
})
