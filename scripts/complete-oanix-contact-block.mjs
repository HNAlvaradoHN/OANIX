import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/features/editor/implementations/OanixNotesSheetSurface.tsx'
let source = readFileSync(path, 'utf8')
function replaceOnce(search, replacement, label) {
  const index = source.indexOf(search)
  if (index < 0) throw new Error(`Patch anchor not found: ${label}`)
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`Patch anchor ambiguous: ${label}`)
  source = source.slice(0, index) + replacement + source.slice(index + search.length)
}

replaceOnce("import { insertOanixChecklistBlock } from '../oanixChecklistBlockLayer'", "import { insertOanixChecklistBlock } from '../oanixChecklistBlockLayer'\nimport { insertOanixContactBlock } from '../oanixContactBlockLayer'", 'contact import')
replaceOnce("  const [checklistBusy, setChecklistBusy] = useState(false)\n  const [integrationError, setIntegrationError] = useState('')", "  const [checklistBusy, setChecklistBusy] = useState(false)\n  const [contactBusy, setContactBusy] = useState(false)\n  const [integrationError, setIntegrationError] = useState('')", 'contact state')
replaceOnce("    if (saving || imageBusy || fileBusy || codeBusy || checklistBusy || closingRef.current) return", "    if (saving || imageBusy || fileBusy || codeBusy || checklistBusy || contactBusy || closingRef.current) return", 'close guard')

const functions = `
  async function insertContactBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || contactBusy || checklistBusy || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Contacto todavía no está disponible en el estado actual de esta nota.')
      return
    }
    setPanelOpen(false)
    setContactBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixContactBlock({
          mode: 'plain', title, text, cursorOffset: lastPlainCursorRef.current, existingBlocks,
          saveBlockChanges: onRequestBlockSave, savePlainSnapshot: onRequestSave,
        })
        if (result.status !== 'committed') {
          setIntegrationError(\`No se pudo insertar el contacto de forma segura (\${result.status}).\`)
          return
        }
        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.contactBlockId, result.plan.afterTextBlockId)
        return
      }
      const target = pendingMixedImageTargetRef.current ?? fallbackMixedCursor()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar el contacto.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar el contacto.')
        return
      }
      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixContactBlock({
        mode: 'mixed', blocks: confirmedBlocks, targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset, saveBlockChanges: onRequestBlockSave,
      })
      if (result.status !== 'committed') {
        setIntegrationError(\`No se pudo insertar el contacto de forma segura (\${result.status}).\`)
        return
      }
      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.contactBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar el contacto de forma segura.')
    } finally {
      setContactBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeContactBlock(blockId: string) {
    if (!onRequestBlockSave || contactBusy || checklistBusy || codeBusy || imageBusy || fileBusy) return
    setContactBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar el contacto.')
        return
      }
      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({ deletes: [blockId], order: nextBlocks.map((block) => block.id) })
      if (!removed) {
        setIntegrationError('No se pudo eliminar el contacto.')
        return
      }
      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar el contacto.')
    } finally {
      setContactBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

`
replaceOnce("  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {", functions + "  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {", 'contact functions')
replaceOnce("  const editingDisabled = saving || closing || imageBusy || fileBusy || codeBusy || checklistBusy\n  const showImageProgress = imageBusy && imageFeedback.visible\n  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy || codeBusy || checklistBusy ? 'saving' : dirty ? 'unsaved' : 'saved'\n  const statusLabel = checklistBusy\n    ? 'Guardando checklist…'", "  const editingDisabled = saving || closing || imageBusy || fileBusy || codeBusy || checklistBusy || contactBusy\n  const showImageProgress = imageBusy && imageFeedback.visible\n  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy || codeBusy || checklistBusy || contactBusy ? 'saving' : dirty ? 'unsaved' : 'saved'\n  const statusLabel = contactBusy\n    ? 'Guardando contacto…'\n    : checklistBusy\n      ? 'Guardando checklist…'", 'contact status')
replaceOnce("                  onRemoveChecklistBlock={removeChecklistBlock}\n                  onActivity={markActivity}", "                  onRemoveChecklistBlock={removeChecklistBlock}\n                  onRemoveContactBlock={removeContactBlock}\n                  onActivity={markActivity}", 'contact prop')
replaceOnce("            if (tool === 'checklist') void insertChecklistBlockFromMenu()", "            if (tool === 'checklist') void insertChecklistBlockFromMenu()\n            if (tool === 'contact') void insertContactBlockFromMenu()", 'contact menu')
writeFileSync(path, source)
