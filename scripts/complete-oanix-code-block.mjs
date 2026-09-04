import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/features/editor/implementations/OanixNotesSheetSurface.tsx'
let source = readFileSync(path, 'utf8')

function replaceOnce(search, replacement, label) {
  const index = source.indexOf(search)
  if (index < 0) throw new Error(`Patch anchor not found: ${label}`)
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`)
  source = source.slice(0, index) + replacement + source.slice(index + search.length)
}

replaceOnce(
  "import { decideOanixMixedDocumentLoad } from '../oanixMixedDocumentLoadPolicy'",
  "import { insertOanixCodeBlock } from '../oanixCodeBlockLayer'\nimport { decideOanixMixedDocumentLoad } from '../oanixMixedDocumentLoadPolicy'",
  'code layer import',
)

replaceOnce(
  "  const [fileBusy, setFileBusy] = useState(false)\n  const [fileProgress, setFileProgress] = useState<OanixFileGroupProgress | null>(null)",
  "  const [fileBusy, setFileBusy] = useState(false)\n  const [fileProgress, setFileProgress] = useState<OanixFileGroupProgress | null>(null)\n  const [codeBusy, setCodeBusy] = useState(false)",
  'code busy state',
)

replaceOnce(
  "    if (saving || imageBusy || fileBusy || closingRef.current) return",
  "    if (saving || imageBusy || fileBusy || codeBusy || closingRef.current) return",
  'close busy guard',
)

const codeFunctions = `
  async function insertCodeBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Código todavía no está disponible en el estado actual de esta nota.')
      return
    }

    setPanelOpen(false)
    setCodeBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current

      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixCodeBlock({
          mode: 'plain',
          title,
          text,
          cursorOffset: lastPlainCursorRef.current,
          existingBlocks,
          saveBlockChanges: onRequestBlockSave,
          savePlainSnapshot: onRequestSave,
        })

        if (result.status !== 'committed') {
          setIntegrationError(\`No se pudo insertar el bloque de código de forma segura (\${result.status}).\`)
          return
        }

        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.codeBlockId, result.plan.afterTextBlockId)
        return
      }

      const target = pendingMixedImageTargetRef.current ?? fallbackMixedCursor()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar el bloque de código.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar el bloque de código.')
        return
      }

      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixCodeBlock({
        mode: 'mixed',
        blocks: confirmedBlocks,
        targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset,
        saveBlockChanges: onRequestBlockSave,
      })

      if (result.status !== 'committed') {
        setIntegrationError(\`No se pudo insertar el bloque de código de forma segura (\${result.status}).\`)
        return
      }

      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.codeBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar el bloque de código de forma segura.')
    } finally {
      setCodeBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeCodeBlock(blockId: string) {
    if (!onRequestBlockSave || codeBusy || imageBusy || fileBusy) return
    setCodeBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar el bloque de código.')
        return
      }

      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({
        deletes: [blockId],
        order: nextBlocks.map((block) => block.id),
      })
      if (!removed) {
        setIntegrationError('No se pudo eliminar el bloque de código.')
        return
      }

      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar el bloque de código.')
    } finally {
      setCodeBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

`

replaceOnce(
  "  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {",
  codeFunctions + "  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {",
  'code insertion functions',
)

replaceOnce(
  "  const editingDisabled = saving || closing || imageBusy || fileBusy\n  const showImageProgress = imageBusy && imageFeedback.visible\n  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy ? 'saving' : dirty ? 'unsaved' : 'saved'\n  const statusLabel = fileBusy\n    ? fileProgressLabel(fileProgress)\n    : showImageProgress",
  "  const editingDisabled = saving || closing || imageBusy || fileBusy || codeBusy\n  const showImageProgress = imageBusy && imageFeedback.visible\n  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy || codeBusy ? 'saving' : dirty ? 'unsaved' : 'saved'\n  const statusLabel = codeBusy\n    ? 'Guardando código…'\n    : fileBusy\n      ? fileProgressLabel(fileProgress)\n      : showImageProgress",
  'busy status',
)

replaceOnce(
  "                  onRemoveFileGroup={removeFileGroup}\n                  onActivity={markActivity}",
  "                  onRemoveFileGroup={removeFileGroup}\n                  onRemoveCodeBlock={removeCodeBlock}\n                  onActivity={markActivity}",
  'code removal prop',
)

replaceOnce(
  "            if (tool === 'image') openImagePicker()\n            if (tool === 'file') openFilePicker()",
  "            if (tool === 'image') openImagePicker()\n            if (tool === 'file') openFilePicker()\n            if (tool === 'code') void insertCodeBlockFromMenu()",
  'code menu action',
)

writeFileSync(path, source)
