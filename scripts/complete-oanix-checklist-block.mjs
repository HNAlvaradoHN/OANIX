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
  "import { insertOanixCodeBlock } from '../oanixCodeBlockLayer'",
  "import { insertOanixCodeBlock } from '../oanixCodeBlockLayer'\nimport { insertOanixChecklistBlock } from '../oanixChecklistBlockLayer'",
  'checklist layer import',
)

replaceOnce(
  "  const [codeBusy, setCodeBusy] = useState(false)\n  const [integrationError, setIntegrationError] = useState('')",
  "  const [codeBusy, setCodeBusy] = useState(false)\n  const [checklistBusy, setChecklistBusy] = useState(false)\n  const [integrationError, setIntegrationError] = useState('')",
  'checklist busy state',
)

replaceOnce(
  "    if (saving || imageBusy || fileBusy || codeBusy || closingRef.current) return",
  "    if (saving || imageBusy || fileBusy || codeBusy || checklistBusy || closingRef.current) return",
  'close busy guard',
)

const checklistFunctions = `
  async function insertChecklistBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || checklistBusy || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Checklist todavía no está disponible en el estado actual de esta nota.')
      return
    }

    setPanelOpen(false)
    setChecklistBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current

      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixChecklistBlock({
          mode: 'plain',
          title,
          text,
          cursorOffset: lastPlainCursorRef.current,
          existingBlocks,
          saveBlockChanges: onRequestBlockSave,
          savePlainSnapshot: onRequestSave,
        })

        if (result.status !== 'committed') {
          setIntegrationError(\`No se pudo insertar la checklist de forma segura (\${result.status}).\`)
          return
        }

        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.checklistBlockId, result.plan.afterTextBlockId)
        return
      }

      const target = pendingMixedImageTargetRef.current ?? fallbackMixedCursor()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar la checklist.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar la checklist.')
        return
      }

      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixChecklistBlock({
        mode: 'mixed',
        blocks: confirmedBlocks,
        targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset,
        saveBlockChanges: onRequestBlockSave,
      })

      if (result.status !== 'committed') {
        setIntegrationError(\`No se pudo insertar la checklist de forma segura (\${result.status}).\`)
        return
      }

      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.checklistBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar la checklist de forma segura.')
    } finally {
      setChecklistBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeChecklistBlock(blockId: string) {
    if (!onRequestBlockSave || checklistBusy || codeBusy || imageBusy || fileBusy) return
    setChecklistBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar la checklist.')
        return
      }

      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({
        deletes: [blockId],
        order: nextBlocks.map((block) => block.id),
      })
      if (!removed) {
        setIntegrationError('No se pudo eliminar la checklist.')
        return
      }

      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar la checklist.')
    } finally {
      setChecklistBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

`

replaceOnce(
  "  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {",
  checklistFunctions + "  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {",
  'checklist functions',
)

replaceOnce(
  "  const editingDisabled = saving || closing || imageBusy || fileBusy || codeBusy\n  const showImageProgress = imageBusy && imageFeedback.visible\n  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy || codeBusy ? 'saving' : dirty ? 'unsaved' : 'saved'\n  const statusLabel = codeBusy\n    ? 'Guardando código…'",
  "  const editingDisabled = saving || closing || imageBusy || fileBusy || codeBusy || checklistBusy\n  const showImageProgress = imageBusy && imageFeedback.visible\n  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy || codeBusy || checklistBusy ? 'saving' : dirty ? 'unsaved' : 'saved'\n  const statusLabel = checklistBusy\n    ? 'Guardando checklist…'\n    : codeBusy\n      ? 'Guardando código…'",
  'checklist busy status',
)

replaceOnce(
  "                  onRemoveCodeBlock={removeCodeBlock}\n                  onActivity={markActivity}",
  "                  onRemoveCodeBlock={removeCodeBlock}\n                  onRemoveChecklistBlock={removeChecklistBlock}\n                  onActivity={markActivity}",
  'checklist removal prop',
)

replaceOnce(
  "            if (tool === 'code') void insertCodeBlockFromMenu()",
  "            if (tool === 'code') void insertCodeBlockFromMenu()\n            if (tool === 'checklist') void insertChecklistBlockFromMenu()",
  'checklist menu action',
)

writeFileSync(path, source)
