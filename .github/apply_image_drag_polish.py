from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')

replace_once(
    'src/features/images/imageLayout.ts',
    '''export function defaultImageWidthPercent(mobile: boolean): number {\n  return mobile ? MOBILE_DEFAULT_IMAGE_WIDTH_PERCENT : DESKTOP_DEFAULT_IMAGE_WIDTH_PERCENT\n}\n''',
    '''export function defaultImageWidthPercent(mobile: boolean): number {\n  return mobile ? MOBILE_DEFAULT_IMAGE_WIDTH_PERCENT : DESKTOP_DEFAULT_IMAGE_WIDTH_PERCENT\n}\n\nexport function imageAlignmentFromCenterRatio(centerRatio: number): 'left' | 'center' | 'right' {\n  if (!Number.isFinite(centerRatio)) return 'center'\n  if (centerRatio < 1 / 3) return 'left'\n  if (centerRatio > 2 / 3) return 'right'\n  return 'center'\n}\n''',
)

replace_once(
    'tests/imageLayout.test.ts',
    '''  defaultImageWidthPercent,\n  isMobileImageViewport,\n  resizeImageWidthPercent,\n''',
    '''  defaultImageWidthPercent,\n  imageAlignmentFromCenterRatio,\n  isMobileImageViewport,\n  resizeImageWidthPercent,\n''',
)
append_once(
    'tests/imageLayout.test.ts',
    "snaps horizontal image drag to responsive alignment zones",
    '''test('snaps horizontal image drag to responsive alignment zones', () => {\n  assert.equal(imageAlignmentFromCenterRatio(0.1), 'left')\n  assert.equal(imageAlignmentFromCenterRatio(0.5), 'center')\n  assert.equal(imageAlignmentFromCenterRatio(0.9), 'right')\n  assert.equal(imageAlignmentFromCenterRatio(Number.NaN), 'center')\n})''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    "import { defaultImageWidthPercent, isMobileImageViewport, resizeImageWidthPercent } from './imageLayout'\n",
    "import { defaultImageWidthPercent, imageAlignmentFromCenterRatio, isMobileImageViewport, resizeImageWidthPercent } from './imageLayout'\n",
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''interface ResizeState {\n  pointerId: number\n  blockId: string\n  figure: HTMLElement\n  startX: number\n  startY: number\n  startWidthPercent: number\n  editorWidth: number\n  previewWidth: number\n  previewHeight: number\n  direction: string\n}\n''',
    '''interface ResizeState {\n  pointerId: number\n  blockId: string\n  figure: HTMLElement\n  startX: number\n  startY: number\n  startWidthPercent: number\n  editorWidth: number\n  previewWidth: number\n  previewHeight: number\n  direction: string\n}\n\ninterface ImageDragState {\n  pointerId: number\n  blockId: string\n  figure: HTMLElement\n  preview: HTMLElement\n  startX: number\n  startY: number\n  startLeft: number\n  figureWidth: number\n  editorLeft: number\n  editorWidth: number\n  dragging: boolean\n}\n''',
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''    const root: HTMLDivElement = currentRoot\n    let resizeState: ResizeState | null = null\n''',
    '''    const root: HTMLDivElement = currentRoot\n    let resizeState: ResizeState | null = null\n    let imageDragState: ImageDragState | null = null\n''',
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''      const handle = target.closest<HTMLButtonElement>('[data-image-resize]')\n      if (!handle || !root.contains(handle)) return\n\n      const figure = handle.closest<HTMLElement>('[data-image-block="true"]')\n''',
    '''      const handle = target.closest<HTMLButtonElement>('[data-image-resize]')\n      if (!handle || !root.contains(handle)) {\n        const preview = target.closest<HTMLElement>('[data-image-preview="true"]')\n        const figure = preview?.closest<HTMLElement>('[data-image-block="true"]')\n        const blockId = figure?.dataset.blockId\n        const block = blockId ? imagesRef.current.get(blockId) : null\n        const editor = root.querySelector<HTMLElement>('.editor-surface')\n\n        if (preview && figure && blockId && block && editor && !imageLocked(block) && event.isPrimary) {\n          const figureRect = figure.getBoundingClientRect()\n          const editorRect = editor.getBoundingClientRect()\n          imageDragState = {\n            pointerId: event.pointerId,\n            blockId,\n            figure,\n            preview,\n            startX: event.clientX,\n            startY: event.clientY,\n            startLeft: figureRect.left,\n            figureWidth: figureRect.width,\n            editorLeft: editorRect.left,\n            editorWidth: editorRect.width,\n            dragging: false,\n          }\n        }\n        return\n      }\n\n      const figure = handle.closest<HTMLElement>('[data-image-block="true"]')\n''',
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''    function handlePointerMove(event: PointerEvent) {\n      if (!resizeState || resizeState.pointerId !== event.pointerId) return\n\n      const nextWidth = resizeImageWidthPercent({\n''',
    '''    function handlePointerMove(event: PointerEvent) {\n      if (imageDragState && imageDragState.pointerId === event.pointerId) {\n        const deltaX = event.clientX - imageDragState.startX\n        const deltaY = event.clientY - imageDragState.startY\n\n        if (!imageDragState.dragging) {\n          if (Math.abs(deltaX) < 7 || Math.abs(deltaX) <= Math.abs(deltaY)) return\n          imageDragState.dragging = true\n          imageDragState.preview.setPointerCapture?.(event.pointerId)\n          imageDragState.figure.dataset.imageDragging = 'true'\n          forceHistoryBoundaryRef.current = true\n        }\n\n        event.preventDefault()\n        const minLeft = imageDragState.editorLeft\n        const maxLeft = imageDragState.editorLeft + imageDragState.editorWidth - imageDragState.figureWidth\n        const desiredLeft = imageDragState.startLeft + deltaX\n        const clampedLeft = Math.min(maxLeft, Math.max(minLeft, desiredLeft))\n        imageDragState.figure.style.translate = `${Math.round(clampedLeft - imageDragState.startLeft)}px 0`\n        return\n      }\n\n      if (!resizeState || resizeState.pointerId !== event.pointerId) return\n\n      const nextWidth = resizeImageWidthPercent({\n''',
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''    function handlePointerUp(event: PointerEvent) {\n      if (!resizeState || resizeState.pointerId !== event.pointerId) return\n      resizeState = null\n      emitEditorInput(root)\n    }\n''',
    '''    function handlePointerUp(event: PointerEvent) {\n      if (imageDragState && imageDragState.pointerId === event.pointerId) {\n        const drag = imageDragState\n        imageDragState = null\n\n        if (drag.dragging) {\n          const deltaX = event.clientX - drag.startX\n          const minLeft = drag.editorLeft\n          const maxLeft = drag.editorLeft + drag.editorWidth - drag.figureWidth\n          const desiredLeft = Math.min(maxLeft, Math.max(minLeft, drag.startLeft + deltaX))\n          const centerRatio = drag.editorWidth > 0\n            ? ((desiredLeft - drag.editorLeft) + drag.figureWidth / 2) / drag.editorWidth\n            : 0.5\n          const alignment = imageAlignmentFromCenterRatio(centerRatio)\n\n          drag.figure.style.translate = ''\n          delete drag.figure.dataset.imageDragging\n          drag.figure.dataset.imageJustDragged = 'true'\n          window.setTimeout(() => delete drag.figure.dataset.imageJustDragged, 0)\n          updateImageBlock(root, drag.blockId, (current) => ({ ...current, alignment }))\n          selectImageFigure(root, drag.figure)\n        }\n        return\n      }\n\n      if (!resizeState || resizeState.pointerId !== event.pointerId) return\n      resizeState = null\n      emitEditorInput(root)\n    }\n''',
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''      const previewButton = target.closest<HTMLElement>('[data-image-preview="true"]')\n      if (previewButton && figure && root.contains(previewButton)) {\n''',
    '''      const previewButton = target.closest<HTMLElement>('[data-image-preview="true"]')\n      if (previewButton && figure && root.contains(previewButton)) {\n        if (figure.dataset.imageJustDragged === 'true') {\n          event.preventDefault()\n          event.stopPropagation()\n          return\n        }\n''',
)

append_once(
    'src/features/images/images.css',
    '/* OANIX image drag and close-button polish */',
    '''/* OANIX image drag and close-button polish */\n.image-note-editor-root .editor-image-block__preview { touch-action: pan-y; }\n.image-note-editor-root .editor-image-block[data-image-dragging='true'] {\n  z-index: 8;\n  transition: none !important;\n  cursor: grabbing;\n}\n.image-note-editor-root .editor-image-block[data-image-locked='false'] .editor-image-block__preview { cursor: grab; }\n.image-note-editor-root .editor-image-block[data-image-dragging='true'] .editor-image-block__preview { cursor: grabbing; }\n\n.image-note-editor-root .editor-image-block[data-image-info-open='true'] .editor-image-block__info {\n  width: 2.45rem !important;\n  min-width: 2.45rem !important;\n  height: 2.45rem;\n  padding: 0 !important;\n  border: 0 !important;\n  border-radius: 999px !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  color: #64748b !important;\n  font-size: 1.65rem !important;\n  line-height: 1 !important;\n}\n.image-note-editor-root .editor-image-block[data-image-info-open='true'] .editor-image-block__info:hover,\n.image-note-editor-root .editor-image-block[data-image-info-open='true'] .editor-image-block__info:focus-visible {\n  background: rgba(148,163,184,.14) !important;\n  color: #0f172a !important;\n}\n\n@container (max-width: 48rem) {\n  .image-note-editor-root .editor-surface > .editor-image-block[data-image-compact='true'] {\n    float: none !important;\n    clear: both;\n  }\n}\n''',
)

append_once(
    'docs/CHANGELOG.md',
    'Arrastre horizontal de imágenes desbloqueadas',
    '''- Arrastre horizontal de imágenes desbloqueadas con ajuste responsive a izquierda, centro o derecha; alineación estable también en contenedores tipo tablet.\n- Cierre `×` de opciones de imagen sin marco visual, conservando accesibilidad táctil.''',
)
