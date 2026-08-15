from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


Path('src/features/editor/protectedBlocks.ts').write_text(r'''import type { StoredNoteBlock } from '../notes/noteTypes'

export interface ProtectedBlockReconcileOptions {
  allowedRemovedIds?: ReadonlySet<string>
  mutableCodeIds?: ReadonlySet<string>
}

export interface ProtectedBlockReconcileResult {
  blocks: StoredNoteBlock[]
  repaired: boolean
}

function cloneBlock(block: StoredNoteBlock): StoredNoteBlock {
  return structuredClone(block)
}

function isProtectedBlock(block: StoredNoteBlock): boolean {
  return block.type === 'image' || block.type === 'code'
}

function stableInsertionIndex(
  previous: StoredNoteBlock[],
  previousIndex: number,
  result: StoredNoteBlock[],
): number {
  for (let index = previousIndex - 1; index >= 0; index -= 1) {
    const neighborIndex = result.findIndex((block) => block.id === previous[index].id)
    if (neighborIndex >= 0) return neighborIndex + 1
  }

  for (let index = previousIndex + 1; index < previous.length; index += 1) {
    const neighborIndex = result.findIndex((block) => block.id === previous[index].id)
    if (neighborIndex >= 0) return neighborIndex
  }

  return result.length
}

export function reconcileProtectedBlocks(
  previous: StoredNoteBlock[],
  next: StoredNoteBlock[],
  options: ProtectedBlockReconcileOptions = {},
): ProtectedBlockReconcileResult {
  const allowedRemovedIds = options.allowedRemovedIds ?? new Set<string>()
  const mutableCodeIds = options.mutableCodeIds ?? new Set<string>()
  const result = next.map(cloneBlock)
  let repaired = false

  previous.forEach((previousBlock, previousIndex) => {
    if (!isProtectedBlock(previousBlock) || allowedRemovedIds.has(previousBlock.id)) return

    const currentIndex = result.findIndex((block) => block.id === previousBlock.id)
    if (currentIndex < 0) {
      result.splice(stableInsertionIndex(previous, previousIndex, result), 0, cloneBlock(previousBlock))
      repaired = true
      return
    }

    const currentBlock = result[currentIndex]
    if (
      previousBlock.type === 'code' &&
      currentBlock.type === 'code' &&
      !mutableCodeIds.has(previousBlock.id) &&
      JSON.stringify(currentBlock) !== JSON.stringify(previousBlock)
    ) {
      result[currentIndex] = cloneBlock(previousBlock)
      repaired = true
    }
  })

  return { blocks: result, repaired }
}
''', encoding='utf-8')


Path('tests/protectedBlocks.test.ts').write_text(r'''import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileProtectedBlocks } from '../src/features/editor/protectedBlocks.ts'
import type { StoredNoteBlock } from '../src/features/notes/noteTypes.ts'

type Paragraph = Extract<StoredNoteBlock, { type: 'paragraph' }>
type Code = Extract<StoredNoteBlock, { type: 'code' }>
type Image = Extract<StoredNoteBlock, { type: 'image' }>

function paragraph(id: string, text: string): Paragraph {
  return { id, type: 'paragraph', runs: text ? [{ text }] : [] }
}

function code(id: string, text: string): Code {
  return { id, type: 'code', language: 'typescript', text }
}

function image(id: string): Image {
  return {
    id,
    type: 'image',
    imageId: `blob-${id}`,
    mimeType: 'image/jpeg',
    name: `${id}.jpg`,
    byteLength: 1024,
  }
}

test('accidental select-all deletion restores image and code blocks', () => {
  const previous: StoredNoteBlock[] = [
    paragraph('p-before', 'Antes'),
    image('image-1'),
    code('code-1', 'const safe = true'),
    paragraph('p-after', 'Después'),
  ]
  const next: StoredNoteBlock[] = [paragraph('empty-after-delete', '')]

  const result = reconcileProtectedBlocks(previous, next)

  assert.equal(result.repaired, true)
  assert.deepEqual(
    result.blocks.filter((block) => block.type === 'image' || block.type === 'code'),
    [image('image-1'), code('code-1', 'const safe = true')],
  )
})

test('protected blocks are restored close to surviving neighbors', () => {
  const previous: StoredNoteBlock[] = [
    paragraph('a', 'A'),
    image('img'),
    paragraph('b', 'B'),
    code('code', 'x'),
    paragraph('c', 'C'),
  ]
  const next: StoredNoteBlock[] = [paragraph('a', 'A'), paragraph('b', ''), paragraph('c', 'C')]

  const result = reconcileProtectedBlocks(previous, next)
  assert.deepEqual(result.blocks.map((block) => block.id), ['a', 'img', 'b', 'code', 'c'])
})

test('external selection cannot silently alter code contents', () => {
  const previous: StoredNoteBlock[] = [paragraph('a', 'A'), code('code', 'original'), paragraph('b', 'B')]
  const next: StoredNoteBlock[] = [paragraph('a', ''), code('code', 'damaged'), paragraph('b', '')]

  const result = reconcileProtectedBlocks(previous, next)
  const restored = result.blocks.find((block) => block.id === 'code')
  assert.deepEqual(restored, code('code', 'original'))
})

test('direct editing inside a code block remains allowed', () => {
  const previous: StoredNoteBlock[] = [code('code', 'old')]
  const next: StoredNoteBlock[] = [code('code', 'new')]

  const result = reconcileProtectedBlocks(previous, next, {
    mutableCodeIds: new Set(['code']),
  })

  assert.equal(result.repaired, false)
  assert.deepEqual(result.blocks, next)
})

test('explicit protected-block deletion is allowed', () => {
  const previous: StoredNoteBlock[] = [paragraph('a', 'A'), image('img'), code('code', 'x'), paragraph('b', 'B')]
  const next: StoredNoteBlock[] = [paragraph('a', 'A'), paragraph('b', 'B')]

  const result = reconcileProtectedBlocks(previous, next, {
    allowedRemovedIds: new Set(['img', 'code']),
  })

  assert.equal(result.repaired, false)
  assert.deepEqual(result.blocks, next)
})

test('new code blocks are accepted and image metadata changes are not rolled back', () => {
  const oldImage = image('img')
  const nextImage: Image = { ...oldImage, alignment: 'right', widthPercent: 45 }
  const previous: StoredNoteBlock[] = [oldImage]
  const next: StoredNoteBlock[] = [nextImage, code('new-code', 'hello')]

  const result = reconcileProtectedBlocks(previous, next)
  assert.equal(result.repaired, false)
  assert.deepEqual(result.blocks, next)
})
''', encoding='utf-8')


replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    "import { CodeBlockEditor } from '../editor/CodeBlockEditor'\n",
    "import { CodeBlockEditor } from '../editor/CodeBlockEditor'\nimport { reconcileProtectedBlocks } from '../editor/protectedBlocks'\n",
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    "function formatImageSize(byteLength: number): string {",
    r'''function mutableCodeIdsFromEditor(root: HTMLElement): Set<string> {
  const mutable = new Set<string>()
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  if (!editor) return mutable

  const active = document.activeElement
  if (active instanceof Element && editor.contains(active) && active.matches('[data-code-language="true"]')) {
    const block = active.closest<HTMLElement>('[data-code-block="true"]')
    if (block?.dataset.blockId) mutable.add(block.dataset.blockId)
  }

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return mutable

  const elementFor = (node: Node | null): Element | null =>
    node instanceof Element ? node : node?.parentElement ?? null
  const anchorContent = elementFor(selection.anchorNode)?.closest<HTMLElement>('[data-code-content="true"]') ?? null
  const focusContent = elementFor(selection.focusNode)?.closest<HTMLElement>('[data-code-content="true"]') ?? null

  if (anchorContent && anchorContent === focusContent && editor.contains(anchorContent)) {
    const block = anchorContent.closest<HTMLElement>('[data-code-block="true"]')
    if (block?.dataset.blockId) mutable.add(block.dataset.blockId)
  }

  return mutable
}

function formatImageSize(byteLength: number): string {''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    "  const historyRef = useRef<StoredNoteBlock[][]>([])\n  const currentBlocksRef = useRef(cloneStoredBlocks(initialBlocks))\n",
    "  const undoHistoryRef = useRef<StoredNoteBlock[][]>([])\n  const redoHistoryRef = useRef<StoredNoteBlock[][]>([])\n  const authorizedProtectedRemovalsRef = useRef(new Set<string>())\n  const currentBlocksRef = useRef(cloneStoredBlocks(initialBlocks))\n",
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''  function updateUndoButton(root: HTMLElement | null = rootRef.current) {
    const button = root?.querySelector<HTMLButtonElement>('[data-undo-tool="true"]')
    if (button) button.disabled = historyRef.current.length === 0
  }

  function rememberHistory(nextBlocks: StoredNoteBlock[]): boolean {
    const current = currentBlocksRef.current
    if (storedBlocksEqual(current, nextBlocks)) return false

    const now = Date.now()
    if (
      forceHistoryBoundaryRef.current ||
      historyRef.current.length === 0 ||
      now - lastHistoryAtRef.current > HISTORY_GROUP_MS
    ) {
      historyRef.current.push(cloneStoredBlocks(current))
      if (historyRef.current.length > MAX_HISTORY_ENTRIES) historyRef.current.shift()
    }

    currentBlocksRef.current = cloneStoredBlocks(nextBlocks)
    lastHistoryAtRef.current = now
    forceHistoryBoundaryRef.current = false
    updateUndoButton()
    return true
  }

  function handleEditorChange(editorBlocks: NoteBlock[]) {
    const nextBlocks = mergedBlocks(editorBlocks)
    if (!rememberHistory(nextBlocks)) return
    onChange(nextBlocks)
  }
''',
    r'''  function updateHistoryButtons(root: HTMLElement | null = rootRef.current) {
    const undo = root?.querySelector<HTMLButtonElement>('[data-undo-tool="true"]')
    const redo = root?.querySelector<HTMLButtonElement>('[data-redo-tool="true"]')
    if (undo) undo.disabled = undoHistoryRef.current.length === 0
    if (redo) redo.disabled = redoHistoryRef.current.length === 0
  }

  function rememberHistory(nextBlocks: StoredNoteBlock[]): boolean {
    const current = currentBlocksRef.current
    if (storedBlocksEqual(current, nextBlocks)) return false

    redoHistoryRef.current = []
    const now = Date.now()
    if (
      forceHistoryBoundaryRef.current ||
      undoHistoryRef.current.length === 0 ||
      now - lastHistoryAtRef.current > HISTORY_GROUP_MS
    ) {
      undoHistoryRef.current.push(cloneStoredBlocks(current))
      if (undoHistoryRef.current.length > MAX_HISTORY_ENTRIES) undoHistoryRef.current.shift()
    }

    currentBlocksRef.current = cloneStoredBlocks(nextBlocks)
    lastHistoryAtRef.current = now
    forceHistoryBoundaryRef.current = false
    updateHistoryButtons()
    return true
  }

  function restoreEditorModel(blocks: StoredNoteBlock[]) {
    imagesRef.current = new Map(
      blocks
        .filter((block): block is ImageBlock => block.type === 'image')
        .map((block) => [block.id, block]),
    )
    initialEditorBlocksRef.current = toEditorBlocks(blocks)
    setEditorEpoch((currentEpoch) => currentEpoch + 1)
  }

  function handleEditorChange(editorBlocks: NoteBlock[]) {
    const root = rootRef.current
    const editor = root?.querySelector<HTMLElement>('.editor-surface') ?? null
    const allowedRemovedIds = new Set(authorizedProtectedRemovalsRef.current)
    authorizedProtectedRemovalsRef.current.clear()

    const domAuthorizedRemoval = editor?.dataset.oanixAuthorizedProtectedRemoval
    if (domAuthorizedRemoval) {
      allowedRemovedIds.add(domAuthorizedRemoval)
      delete editor.dataset.oanixAuthorizedProtectedRemoval
    }

    const rawBlocks = mergedBlocks(editorBlocks)
    const reconciliation = reconcileProtectedBlocks(currentBlocksRef.current, rawBlocks, {
      allowedRemovedIds,
      mutableCodeIds: root ? mutableCodeIdsFromEditor(root) : new Set<string>(),
    })
    const nextBlocks = reconciliation.blocks
    const changed = rememberHistory(nextBlocks)

    if (reconciliation.repaired) restoreEditorModel(nextBlocks)
    if (!changed) return
    onChange(nextBlocks)
  }
''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''    if (!toolbar.querySelector('[data-undo-tool="true"]')) {
      const undo = document.createElement('button')
      undo.type = 'button'
      undo.className = 'editor-tool'
      undo.dataset.undoTool = 'true'
      undo.textContent = '↶'
      undo.title = 'Deshacer último cambio'
      undo.setAttribute('aria-label', 'Deshacer último cambio')
      toolbar.append(undo)
    }

    updateUndoButton(root)
''',
    r'''    if (!toolbar.querySelector('[data-undo-tool="true"]')) {
      const undo = document.createElement('button')
      undo.type = 'button'
      undo.className = 'editor-tool'
      undo.dataset.undoTool = 'true'
      undo.textContent = '↶'
      undo.title = 'Deshacer último cambio (Ctrl/Cmd+Z)'
      undo.setAttribute('aria-label', 'Deshacer último cambio')
      toolbar.append(undo)
    }

    if (!toolbar.querySelector('[data-redo-tool="true"]')) {
      const redo = document.createElement('button')
      redo.type = 'button'
      redo.className = 'editor-tool'
      redo.dataset.redoTool = 'true'
      redo.textContent = '↷'
      redo.title = 'Rehacer último cambio (Ctrl/Cmd+Shift+Z o Ctrl+Y)'
      redo.setAttribute('aria-label', 'Rehacer último cambio')
      toolbar.append(redo)
    }

    updateHistoryButtons(root)
''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''  function undoLastChange(root: HTMLElement) {
    const previous = historyRef.current.pop()
    if (!previous) {
      updateUndoButton(root)
      return
    }

    const current = currentBlocksRef.current
    const currentImageIds = imageIdsFromBlocks(current)
    const previousImageIds = imageIdsFromBlocks(previous)

    for (const imageId of currentImageIds) {
      if (!previousImageIds.has(imageId)) {
        revokeImageUrls(imageId)
        void onRemoveImage(imageId)
      }
    }
    for (const imageId of previousImageIds) {
      if (!currentImageIds.has(imageId)) onRestoreImage(imageId)
    }

    imagesRef.current = new Map(
      previous
        .filter((block): block is ImageBlock => block.type === 'image')
        .map((block) => [block.id, block]),
    )
    initialEditorBlocksRef.current = toEditorBlocks(previous)
    currentBlocksRef.current = cloneStoredBlocks(previous)
    lastHistoryAtRef.current = 0
    forceHistoryBoundaryRef.current = true
    onChange(cloneStoredBlocks(previous))
    setEditorEpoch((currentEpoch) => currentEpoch + 1)
    updateUndoButton(root)
  }
''',
    r'''  function applyHistoryState(
    root: HTMLElement,
    source: { current: StoredNoteBlock[][] },
    destination: { current: StoredNoteBlock[][] },
  ) {
    const target = source.current.pop()
    if (!target) {
      updateHistoryButtons(root)
      return
    }

    const current = cloneStoredBlocks(currentBlocksRef.current)
    destination.current.push(current)
    if (destination.current.length > MAX_HISTORY_ENTRIES) destination.current.shift()

    const currentImageIds = imageIdsFromBlocks(current)
    const targetImageIds = imageIdsFromBlocks(target)
    for (const imageId of currentImageIds) {
      if (!targetImageIds.has(imageId)) {
        revokeImageUrls(imageId)
        void onRemoveImage(imageId)
      }
    }
    for (const imageId of targetImageIds) {
      if (!currentImageIds.has(imageId)) onRestoreImage(imageId)
    }

    currentBlocksRef.current = cloneStoredBlocks(target)
    lastHistoryAtRef.current = 0
    forceHistoryBoundaryRef.current = true
    onChange(cloneStoredBlocks(target))
    restoreEditorModel(target)
    updateHistoryButtons(root)
  }

  function undoLastChange(root: HTMLElement) {
    applyHistoryState(root, undoHistoryRef, redoHistoryRef)
  }

  function redoLastChange(root: HTMLElement) {
    applyHistoryState(root, redoHistoryRef, undoHistoryRef)
  }
''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''      const imageTool = target.closest<HTMLElement>('[data-image-tool="true"]')
''',
    r'''      const redoTool = target.closest<HTMLElement>('[data-redo-tool="true"]')
      if (redoTool && root.contains(redoTool)) {
        event.preventDefault()
        event.stopPropagation()
        redoLastChange(root)
        return
      }

      const imageTool = target.closest<HTMLElement>('[data-image-tool="true"]')
''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''        const imageBlock = imagesRef.current.get(blockId)
        forceHistoryBoundaryRef.current = true
        if (imageBlock) revokeImageUrls(imageBlock.imageId)

        imagesRef.current.delete(blockId)
''',
    r'''        const imageBlock = imagesRef.current.get(blockId)
        forceHistoryBoundaryRef.current = true
        authorizedProtectedRemovalsRef.current.add(blockId)
        if (imageBlock) revokeImageUrls(imageBlock.imageId)

        imagesRef.current.delete(blockId)
''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        const target = event.target
        if (target instanceof Node && root.contains(target)) {
          event.preventDefault()
          undoLastChange(root)
          return
        }
      }

      if (event.key === 'Escape') {
''',
    r'''    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) {
        const target = event.target
        const key = event.key.toLowerCase()
        if (target instanceof Node && root.contains(target)) {
          if (key === 'z') {
            event.preventDefault()
            if (event.shiftKey) redoLastChange(root)
            else undoLastChange(root)
            return
          }

          if (!event.shiftKey && key === 'y') {
            event.preventDefault()
            redoLastChange(root)
            return
          }
        }
      }

      if (event.key === 'Escape') {
''',
)


replace_once(
    'src/features/editor/CodeBlockEditor.tsx',
    "function convertCodeBlockToText(root: HTMLElement, block: HTMLElement): void {\n",
    r'''function authorizeProtectedRemoval(editor: HTMLElement, block: HTMLElement): string | null {
  const blockId = block.dataset.blockId ?? null
  if (blockId) editor.dataset.oanixAuthorizedProtectedRemoval = blockId
  return blockId
}

function clearProtectedRemovalAuthorization(editor: HTMLElement, blockId: string | null): void {
  if (blockId && editor.dataset.oanixAuthorizedProtectedRemoval === blockId) {
    delete editor.dataset.oanixAuthorizedProtectedRemoval
  }
}

function convertCodeBlockToText(root: HTMLElement, block: HTMLElement): void {
''',
)

replace_once(
    'src/features/editor/CodeBlockEditor.tsx',
    r'''  block.replaceWith(paragraph)
  placeCaretAtEnd(paragraph)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  editor.focus()
''',
    r'''  const authorizedBlockId = authorizeProtectedRemoval(editor, block)
  block.replaceWith(paragraph)
  placeCaretAtEnd(paragraph)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  clearProtectedRemovalAuthorization(editor, authorizedBlockId)
  editor.focus()
''',
)

replace_once(
    'src/features/editor/CodeBlockEditor.tsx',
    r'''  const previous = block.previousElementSibling instanceof HTMLElement ? block.previousElementSibling : null
  const next = block.nextElementSibling instanceof HTMLElement ? block.nextElementSibling : null
  block.remove()
''',
    r'''  const previous = block.previousElementSibling instanceof HTMLElement ? block.previousElementSibling : null
  const next = block.nextElementSibling instanceof HTMLElement ? block.nextElementSibling : null
  const authorizedBlockId = authorizeProtectedRemoval(editor, block)
  block.remove()
''',
)

replace_once(
    'src/features/editor/CodeBlockEditor.tsx',
    r'''  editor.dispatchEvent(new Event('input', { bubbles: true }))
  editor.focus()
}

function decorateCodeBlocks''',
    r'''  editor.dispatchEvent(new Event('input', { bubbles: true }))
  clearProtectedRemovalAuthorization(editor, authorizedBlockId)
  editor.focus()
}

function decorateCodeBlocks''',
)

replace_once(
    'src/features/editor/CodeBlockEditor.tsx',
    "    'Se eliminará este bloque y todo el código que contiene. Esta acción no se puede deshacer.'",
    "    'Se eliminará este bloque y todo el código que contiene. Puedes recuperarlo con Deshacer mientras sigas en esta nota.'",
)


images_css = Path('src/features/images/images.css')
css = images_css.read_text(encoding='utf-8')
if '/* Protected image selection */' not in css:
    css += r'''

/* Protected image selection */
.image-note-editor-root .editor-surface > [data-image-block="true"] {
  -webkit-user-select: none;
  user-select: none;
}

.image-note-editor-root .editor-image-block__alt {
  -webkit-user-select: text;
  user-select: text;
}
'''
    images_css.write_text(css, encoding='utf-8')

code_css = Path('src/features/editor/codeBlockEditor.css')
css = code_css.read_text(encoding='utf-8')
if '/* Protected code-block selection */' not in css:
    css += r'''

/* Protected code-block selection */
.code-block-editor-root .editor-surface > [data-code-block="true"],
.code-block-editor-root .editor-code-block__content {
  -webkit-user-select: none;
  user-select: none;
}

.code-block-editor-root .editor-code-block:focus-within .editor-code-block__content {
  -webkit-user-select: text;
  user-select: text;
}
'''
    code_css.write_text(css, encoding='utf-8')

replace_once(
    'docs/CHANGELOG.md',
    '- Historial de deshacer para cambios del contenido de la nota, accesible desde la barra del editor y Ctrl/Cmd+Z.\n',
    '- Historial bidireccional de Deshacer/Rehacer para cambios del contenido de la nota, con botones ↶/↷ y atajos Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z y Ctrl+Y.\n- Imágenes y bloques de código protegidos contra borrado accidental por selección global, Delete/Backspace, cortar, pegar o reemplazar texto; solo sus acciones explícitas pueden eliminarlos.\n',
)

Path('.github/workflows/apply-editor-protection-redo.yml').unlink()
Path('.github/apply_editor_protection_redo.py').unlink()
