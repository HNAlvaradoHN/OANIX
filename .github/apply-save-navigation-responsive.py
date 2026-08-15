from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if marker not in text:
        raise SystemExit(f'Marker not found in {path}: {marker[:120]!r}')
    p.write_text(text.replace(marker, marker + addition, 1), encoding='utf-8')


# Shared responsive contract used by JS behavior and tests.
Path('src/shared/responsiveLayout.ts').write_text('''export const MOBILE_LAYOUT_MAX_WIDTH = 760\nexport const TABLET_LAYOUT_MAX_WIDTH = 1100\n\nexport type ResponsiveLayout = 'mobile' | 'tablet' | 'desktop'\n\nexport function responsiveLayoutForWidth(width: number): ResponsiveLayout {\n  if (!Number.isFinite(width) || width <= MOBILE_LAYOUT_MAX_WIDTH) return 'mobile'\n  if (width <= TABLET_LAYOUT_MAX_WIDTH) return 'tablet'\n  return 'desktop'\n}\n\nexport function usesSinglePaneLayout(width: number): boolean {\n  return responsiveLayoutForWidth(width) === 'mobile'\n}\n''', encoding='utf-8')

# Storage retry / diagnostic helpers.
Path('src/storage/local/storageErrors.ts').write_text('''const TRANSIENT_STORAGE_ERROR_NAMES = new Set([\n  'AbortError',\n  'InvalidStateError',\n  'TransactionInactiveError',\n  'UnknownError',\n])\n\nfunction errorName(error: unknown): string {\n  return error instanceof Error ? error.name : ''\n}\n\nfunction errorMessage(error: unknown): string {\n  return error instanceof Error ? error.message : String(error ?? '')\n}\n\nexport function isTransientStorageError(error: unknown): boolean {\n  return TRANSIENT_STORAGE_ERROR_NAMES.has(errorName(error))\n}\n\nexport function storageSaveErrorMessage(error: unknown): string {\n  const name = errorName(error)\n  const message = errorMessage(error).toLowerCase()\n\n  if (name === 'QuotaExceededError') {\n    return 'No hay espacio local suficiente para guardar esta nota. Libera almacenamiento del dispositivo y vuelve a intentarlo.'\n  }\n\n  if (message.includes('vault is locked') || message.includes('bóveda') && message.includes('bloque')) {\n    return 'La bóveda ya no está desbloqueada. Vuelve a desbloquear OANIX antes de continuar.'\n  }\n\n  if (message.includes('upgrade is blocked') || message.includes('database upgrade is blocked')) {\n    return 'Otra pestaña o ventana de OANIX está bloqueando el almacenamiento local. Ciérrala y vuelve a intentarlo.'\n  }\n\n  if (message.includes('indexeddb is not available')) {\n    return 'Este navegador no está permitiendo usar el almacenamiento local de OANIX.'\n  }\n\n  return 'No se pudieron guardar los cambios cifrados de la nota. Pulsa Reintentar; si vuelve a ocurrir, OANIX mostrará este aviso sin cerrar la nota.'\n}\n\nexport async function retryTransientStorageOperation<T>(\n  operation: () => Promise<T>,\n  attempts = 2,\n  retryDelayMs = 70,\n): Promise<T> {\n  let lastError: unknown\n\n  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {\n    try {\n      return await operation()\n    } catch (error) {\n      lastError = error\n      if (attempt >= attempts || !isTransientStorageError(error)) throw error\n      if (retryDelayMs > 0) {\n        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs))\n      }\n    }\n  }\n\n  throw lastError\n}\n''', encoding='utf-8')

# Use shared mobile breakpoint in image layout.
replace_once(
    'src/features/images/imageLayout.ts',
    "export const MOBILE_IMAGE_BREAKPOINT = 760\n",
    "import { MOBILE_LAYOUT_MAX_WIDTH } from '../../shared/responsiveLayout'\n\nexport const MOBILE_IMAGE_BREAKPOINT = MOBILE_LAYOUT_MAX_WIDTH\n",
)

# Retry idempotent encrypted note writes by reopening IndexedDB for transient mobile errors.
record = 'src/storage/repositories/encryptedRecordRepository.ts'
replace_once(
    record,
    "import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'\n",
    "import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'\nimport { retryTransientStorageOperation } from '../local/storageErrors'\n",
)
replace_once(
    record,
    '''  const database = await openLocalDatabase()\n\n  try {\n    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')\n    const completion = transactionCompleted(transaction)\n    const storedRecord: StoredEncryptedRecord = {\n      key: encryptedRecordKey(recordType, recordId),\n      payload,\n    }\n    transaction.objectStore(ENCRYPTED_RECORDS_STORE).put(storedRecord)\n    await completion\n  } finally {\n    database.close()\n  }\n''',
    '''  await retryTransientStorageOperation(async () => {\n    const database = await openLocalDatabase()\n\n    try {\n      const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')\n      const completion = transactionCompleted(transaction)\n      const storedRecord: StoredEncryptedRecord = {\n        key: encryptedRecordKey(recordType, recordId),\n        payload,\n      }\n      transaction.objectStore(ENCRYPTED_RECORDS_STORE).put(storedRecord)\n      await completion\n    } finally {\n      database.close()\n    }\n  })\n''',
)

# Retry image/blob writes too, to keep mobile storage behavior consistent.
blob = 'src/storage/repositories/encryptedBlobRepository.ts'
replace_once(
    blob,
    "import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'\n",
    "import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'\nimport { retryTransientStorageOperation } from '../local/storageErrors'\n",
)
replace_once(
    blob,
    '''  const database = await openLocalDatabase()\n\n  try {\n    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')\n    const completion = transactionCompleted(transaction)\n    const storedRecord: StoredEncryptedBlob = {\n      key: encryptedBlobKey(recordType, recordId),\n      payload,\n    }\n    transaction.objectStore(ENCRYPTED_RECORDS_STORE).put(storedRecord)\n    await completion\n  } finally {\n    database.close()\n  }\n''',
    '''  await retryTransientStorageOperation(async () => {\n    const database = await openLocalDatabase()\n\n    try {\n      const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')\n      const completion = transactionCompleted(transaction)\n      const storedRecord: StoredEncryptedBlob = {\n        key: encryptedBlobKey(recordType, recordId),\n        payload,\n      }\n      transaction.objectStore(ENCRYPTED_RECORDS_STORE).put(storedRecord)\n      await completion\n    } finally {\n      database.close()\n    }\n  })\n''',
)

# Notes: visible save error, retry, and browser/system Back history on mobile.
notes = 'src/features/notes/NotesWorkspace.tsx'
replace_once(
    notes,
    "import { deleteEncryptedImage } from '../images/imageService'\n",
    "import { deleteEncryptedImage } from '../images/imageService'\nimport { storageSaveErrorMessage } from '../../storage/local/storageErrors'\nimport { usesSinglePaneLayout } from '../../shared/responsiveLayout'\n",
)
replace_once(
    notes,
    '''interface PendingContent {\n  noteId: string\n  blocks: StoredNoteBlock[]\n}\n''',
    '''interface PendingContent {\n  noteId: string\n  blocks: StoredNoteBlock[]\n}\n\ninterface OanixHistoryState {\n  oanixView?: 'list' | 'note'\n  noteId?: string\n}\n\nfunction mobileSinglePane(): boolean {\n  const width = window.visualViewport?.width ?? window.innerWidth\n  return usesSinglePaneLayout(width)\n}\n\nfunction currentHistoryState(): Record<string, unknown> {\n  const value = window.history.state\n  return value && typeof value === 'object' ? value as Record<string, unknown> : {}\n}\n''',
)
replace_once(
    notes,
    '''  const selectedIdRef = useRef<string | null>(null)\n  const pendingImageDeletesRef = useRef(new Set<string>())\n''',
    '''  const selectedIdRef = useRef<string | null>(null)\n  const notesRef = useRef<NoteRecord[]>([])\n  const historyBackAlreadySavedRef = useRef(false)\n  const pendingImageDeletesRef = useRef(new Set<string>())\n''',
)
replace_once(
    notes,
    '''  useEffect(() => {\n    selectedIdRef.current = selectedId\n  }, [selectedId])\n''',
    '''  useEffect(() => {\n    selectedIdRef.current = selectedId\n  }, [selectedId])\n\n  useEffect(() => {\n    notesRef.current = notes\n  }, [notes])\n\n  useEffect(() => {\n    if (!mobileSinglePane()) return\n\n    const state = currentHistoryState() as OanixHistoryState\n    if (state.oanixView !== 'note') {\n      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')\n    }\n\n    function closeNoteView() {\n      selectedIdRef.current = null\n      setSelectedId(null)\n      setSaveState('idle')\n    }\n\n    function handlePopState(event: PopStateEvent) {\n      if (!mobileSinglePane()) return\n      const nextState = (event.state ?? {}) as OanixHistoryState\n\n      if (nextState.oanixView === 'note' && nextState.noteId) {\n        if (notesRef.current.some((note) => note.id === nextState.noteId)) {\n          selectedIdRef.current = nextState.noteId\n          setSelectedId(nextState.noteId)\n          setSaveState('idle')\n        }\n        return\n      }\n\n      const openId = selectedIdRef.current\n      if (!openId) return\n\n      if (historyBackAlreadySavedRef.current) {\n        historyBackAlreadySavedRef.current = false\n        closeNoteView()\n        return\n      }\n\n      void (async () => {\n        if (!(await flushPendingContent())) {\n          window.history.pushState(\n            { ...currentHistoryState(), oanixView: 'note', noteId: openId },\n            '',\n          )\n          return\n        }\n        await finalizeRemovedImages()\n        closeNoteView()\n      })()\n    }\n\n    window.addEventListener('popstate', handlePopState)\n    return () => window.removeEventListener('popstate', handlePopState)\n  }, [])\n''',
)
replace_once(
    notes,
    '''      } catch {\n        if (!pendingContentRef.current) pendingContentRef.current = pending\n        if (selectedIdRef.current === pending.noteId) setSaveState('error')\n        setError('No se pudieron guardar los cambios cifrados de la nota.')\n        return false\n      }\n''',
    '''      } catch (saveError) {\n        console.error('OANIX encrypted note save failed', saveError)\n        if (!pendingContentRef.current) pendingContentRef.current = pending\n        if (selectedIdRef.current === pending.noteId) setSaveState('error')\n        setError(storageSaveErrorMessage(saveError))\n        return false\n      }\n''',
)
replace_once(
    notes,
    '''  async function handleCreateNote() {\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n\n    setCreating(true)\n''',
    '''  function pushMobileNoteHistory(noteId: string) {\n    if (!mobileSinglePane()) return\n    window.history.pushState(\n      { ...currentHistoryState(), oanixView: 'note', noteId },\n      '',\n    )\n  }\n\n  async function handleCreateNote() {\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n\n    setCreating(true)\n''',
)
replace_once(
    notes,
    '''      setNotes((current) => [note, ...current])\n      setSelectedId(note.id)\n      setSaveState('idle')\n''',
    '''      setNotes((current) => [note, ...current])\n      selectedIdRef.current = note.id\n      setSelectedId(note.id)\n      pushMobileNoteHistory(note.id)\n      setSaveState('idle')\n''',
)
replace_once(
    notes,
    '''    setSelectedId(noteId)\n    setSaveState('idle')\n  }\n\n  async function handleBack() {\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n    setSelectedId(null)\n    setSaveState('idle')\n  }\n''',
    '''    selectedIdRef.current = noteId\n    setSelectedId(noteId)\n    pushMobileNoteHistory(noteId)\n    setSaveState('idle')\n  }\n\n  async function handleBack() {\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n\n    const state = (window.history.state ?? {}) as OanixHistoryState\n    if (mobileSinglePane() && state.oanixView === 'note') {\n      historyBackAlreadySavedRef.current = true\n      window.history.back()\n      return\n    }\n\n    selectedIdRef.current = null\n    setSelectedId(null)\n    setSaveState('idle')\n  }\n''',
)
replace_once(
    notes,
    '''              <ImageNoteEditor\n                key={selectedNote.id}\n''',
    '''              {saveState === 'error' && error && (\n                <div className="note-save-error" role="alert">\n                  <span>{error}</span>\n                  <button type="button" onClick={() => void flushPendingContent()}>\n                    Reintentar\n                  </button>\n                </div>\n              )}\n\n              <ImageNoteEditor\n                key={selectedNote.id}\n''',
)

# Auto-close floating toolbar after selecting any editor tool (after event finishes).
image_editor = 'src/features/images/ImageNoteEditor.tsx'
replace_once(
    image_editor,
    '''    function handleClick(event: MouseEvent) {\n      const target = event.target\n      if (!(target instanceof Element)) return\n\n      const undoTool = target.closest<HTMLElement>('[data-undo-tool="true"]')\n''',
    '''    function handleClick(event: MouseEvent) {\n      const target = event.target\n      if (!(target instanceof Element)) return\n\n      const selectedToolbarTool = target.closest<HTMLButtonElement>('.editor-toolbar button')\n      if (selectedToolbarTool && root.contains(selectedToolbarTool)) {\n        queueMicrotask(() => setMobileToolsOpen(false))\n      }\n\n      const undoTool = target.closest<HTMLElement>('[data-undo-tool="true"]')\n''',
)

# Responsive notes layout: explicit tablet band plus visible mobile save error.
notes_css = 'src/features/notes/notes.css'
append_once(
    notes_css,
    '''.note-view__empty p { max-width: 440px; }\n''',
    '''\n\n.note-save-error {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 0.75rem;\n  margin-top: 1rem;\n  padding: 0.75rem 0.85rem;\n  border: 1px solid #fecaca;\n  border-radius: 12px;\n  background: #fff1f2;\n  color: #991b1b;\n  font-size: 0.84rem;\n  line-height: 1.4;\n}\n\n.note-save-error span { min-width: 0; overflow-wrap: anywhere; }\n\n.note-save-error button {\n  flex: 0 0 auto;\n  min-height: 2.35rem;\n  padding: 0 0.75rem;\n  border: 1px solid #b42318;\n  border-radius: 9px;\n  background: #fff;\n  color: #b42318;\n  font: inherit;\n  font-weight: 800;\n}\n\n@media (min-width: 761px) and (max-width: 1100px) {\n  .notes-shell {\n    grid-template-columns: minmax(260px, 31vw) minmax(0, 1fr);\n  }\n\n  .notes-header {\n    gap: 0.55rem;\n    padding-inline: 0.75rem;\n  }\n\n  .notes-brand { gap: 0.55rem; }\n  .notes-brand__mark { width: 2.35rem; height: 2.35rem; }\n  .notes-brand span { display: none; }\n\n  .new-note-button {\n    min-width: 2.55rem;\n    padding-inline: 0.65rem;\n  }\n\n  .note-row__open {\n    gap: 0.6rem;\n    padding-left: 0.65rem;\n  }\n\n  .note-row__avatar { width: 2.6rem; height: 2.6rem; }\n\n  .note-view__header { padding-inline: 0.85rem; }\n\n  .note-canvas {\n    width: min(100% - 1.25rem, 880px);\n    padding-top: 1.5rem;\n  }\n\n  .note-title-field input {\n    font-size: clamp(2rem, 4.5vw, 3rem);\n  }\n}\n''',
)
append_once(
    notes_css,
    '''@media (max-width: 760px) {\n  .note-row__menu button,\n  .empty-action {\n    white-space: normal;\n  }\n}\n''',
    '''\n\n@media (max-width: 760px) {\n  .note-save-error {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .note-save-error button { width: 100%; }\n}\n''',
)

# Tablet editor: wrap toolbar instead of horizontal scrolling.
editor_css = 'src/features/editor/editor.css'
append_once(
    editor_css,
    '''.editor-link-popover__actions button:hover,\n.editor-link-popover__actions button:focus-visible {\n  outline: none;\n  background: #eaf2ff;\n  color: #1d4ed8;\n}\n''',
    '''\n\n@media (min-width: 761px) and (max-width: 1100px) {\n  .editor-frame {\n    margin-top: 1.15rem;\n    grid-template-rows: auto minmax(390px, auto);\n  }\n\n  .editor-toolbar {\n    flex-wrap: wrap;\n    overflow-x: visible;\n    row-gap: 0.25rem;\n  }\n\n  .editor-tool {\n    min-width: 2.15rem;\n    height: 2.15rem;\n    padding-inline: 0.5rem;\n    font-size: 0.78rem;\n  }\n\n  .editor-surface {\n    min-height: 390px;\n    padding-inline: clamp(1rem, 2.2vw, 1.5rem);\n  }\n}\n''',
)

# Tablet code toolbar: predictable grid, no compressed labels.
code_css = 'src/features/editor/codeBlockEditor.css'
append_once(
    code_css,
    '''.code-block-editor-root .editor-code-block__expand:hover,\n.code-block-editor-root .editor-code-block__expand:focus-visible {\n  outline: none;\n  background: rgba(59, 130, 246, 0.16);\n  color: #dbeafe;\n}\n''',
    '''\n\n@media (min-width: 641px) and (max-width: 1100px) {\n  .code-block-editor-root .editor-code-block__toolbar {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    align-items: stretch;\n    gap: 0.35rem;\n  }\n\n  .code-block-editor-root .editor-code-block__language {\n    grid-column: 1 / -1;\n    width: 100%;\n    max-width: none;\n  }\n\n  .code-block-editor-root .editor-code-block__convert,\n  .code-block-editor-root .editor-code-block__delete,\n  .code-block-editor-root .editor-code-block__expand,\n  .code-block-editor-root .editor-code-block__copy {\n    width: 100%;\n    min-width: 0;\n    margin: 0;\n    white-space: normal;\n    overflow-wrap: anywhere;\n  }\n}\n''',
)

# Mobile image info popup stays within viewport; tablet gets comfortable action wrapping.
images_css = 'src/features/images/images.css'
append_once(
    images_css,
    '''/* OANIX mobile image sizing and floating editor dock */\n.mobile-editor-dock {\n  display: none;\n}\n''',
    '''\n\n@media (min-width: 761px) and (max-width: 1100px) {\n  .image-note-editor-root .editor-image-block__actions,\n  .image-note-editor-root .editor-image-block__secondary {\n    flex-wrap: wrap;\n  }\n\n  .image-note-editor-root .editor-image-block__details {\n    grid-template-columns: minmax(0, 1fr);\n  }\n}\n''',
)

# Roadmap records this repair explicitly before Checklists.
roadmap = Path('docs/ROADMAP.md')
text = roadmap.read_text(encoding='utf-8')
marker = '- [ ] Validar visualmente en móvil y pasar CI antes de continuar.\n'
addition = marker + '- [ ] Confirmar guardado cifrado real en móvil, navegación Atrás/gesto y auditoría responsive en móvil, tablet y PC.\n'
if marker not in text:
    raise SystemExit('ROADMAP marker missing')
roadmap.write_text(text.replace(marker, addition, 1), encoding='utf-8')

# Changelog.
changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
heading = '## '
pos = text.find(heading)
if pos == -1:
    raise SystemExit('CHANGELOG heading missing')
line_end = text.find('\n', pos)
entry = '\n- Refuerzo de guardado local móvil con reintento de IndexedDB, error visible/reintentable, navegación Atrás integrada al historial, cierre automático de herramientas y breakpoints explícitos móvil/tablet/PC.\n'
if entry.strip() not in text:
    text = text[:line_end+1] + entry + text[line_end+1:]
changelog.write_text(text, encoding='utf-8')

# Tests for responsive contract and storage retry/error mapping.
Path('tests/responsiveLayout.test.ts').write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport { responsiveLayoutForWidth, usesSinglePaneLayout } from '../src/shared/responsiveLayout.ts'\n\ntest('classifies mobile tablet and desktop widths explicitly', () => {\n  assert.equal(responsiveLayoutForWidth(360), 'mobile')\n  assert.equal(responsiveLayoutForWidth(760), 'mobile')\n  assert.equal(responsiveLayoutForWidth(761), 'tablet')\n  assert.equal(responsiveLayoutForWidth(1024), 'tablet')\n  assert.equal(responsiveLayoutForWidth(1100), 'tablet')\n  assert.equal(responsiveLayoutForWidth(1101), 'desktop')\n  assert.equal(responsiveLayoutForWidth(1440), 'desktop')\n})\n\ntest('only mobile uses the single-pane note navigation model', () => {\n  assert.equal(usesSinglePaneLayout(412), true)\n  assert.equal(usesSinglePaneLayout(800), false)\n  assert.equal(usesSinglePaneLayout(1366), false)\n})\n''', encoding='utf-8')

Path('tests/storageErrors.test.ts').write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport {\n  isTransientStorageError,\n  retryTransientStorageOperation,\n  storageSaveErrorMessage,\n} from '../src/storage/local/storageErrors.ts'\n\nfunction namedError(name: string, message = name): Error {\n  const error = new Error(message)\n  error.name = name\n  return error\n}\n\ntest('retries transient IndexedDB failures once', async () => {\n  let attempts = 0\n  const value = await retryTransientStorageOperation(async () => {\n    attempts += 1\n    if (attempts === 1) throw namedError('AbortError')\n    return 'saved'\n  }, 2, 0)\n\n  assert.equal(value, 'saved')\n  assert.equal(attempts, 2)\n})\n\ntest('does not retry quota failures', async () => {\n  let attempts = 0\n  await assert.rejects(\n    retryTransientStorageOperation(async () => {\n      attempts += 1\n      throw namedError('QuotaExceededError')\n    }, 2, 0),\n  )\n  assert.equal(attempts, 1)\n})\n\ntest('maps common save failures to actionable messages', () => {\n  assert.equal(isTransientStorageError(namedError('UnknownError')), true)\n  assert.match(storageSaveErrorMessage(namedError('QuotaExceededError')), /espacio local/i)\n  assert.match(storageSaveErrorMessage(new Error('The OANIX vault is locked.')), /bóveda/i)\n  assert.match(storageSaveErrorMessage(new Error('The local database upgrade is blocked by another OANIX tab.')), /pestaña/i)\n})\n''', encoding='utf-8')
