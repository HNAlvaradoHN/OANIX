import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../notes/noteService'
import type { NoteRecord } from '../notes/noteTypes'
import {
  cleanupOrphanNotePrivacy,
  createNotePrivacyLock,
  listNotePrivacy,
  setNotePrivateBox,
  setNotePrivacyLock,
  validateNotePrivacyCode,
  verifyNotePrivacyLock,
  type NotePrivacyRecord,
} from './notePrivacyService'
import {
  canUsePrivateBoxDeviceAuth,
  reauthenticatePrivateBoxWithDevice,
  reauthenticatePrivateBoxWithPassword,
} from './privateBoxAuth'
import './notePrivacy.css'
import './manualNoteRelock.css'

type LockDialogMode = 'set' | 'unlock' | 'remove'

interface LockDialogState {
  mode: LockDialogMode
  noteId: string
  openAfterUnlock?: boolean
}

type PrivateAuthAction =
  | { kind: 'open-box' }
  | { kind: 'open-note'; noteId: string }
  | { kind: 'remove-private'; noteId: string }

const PRIVACY_SURFACE_SELECTOR = [
  '.note-row',
  '.note-row__menu',
  '.note-row__menu-button',
  '.note-view',
  '.note-view__menu',
  '.note-view__menu-button',
  '.workspace-menu',
  '.workspace-menu-wrap',
  '.note-canvas',
  '.notes-search',
  '.notes-search__meta',
].join(', ')

const PRIVACY_CLASS_NAMES = [
  'note-row',
  'note-row--selected',
  'note-row__menu',
  'note-row__menu-button',
  'note-view',
  'note-view__menu',
  'note-view__menu-button',
  'workspace-menu',
  'workspace-menu-wrap',
  'note-canvas',
  'notes-search',
  'notes-search__meta',
]

function elementTouchesPrivacySurface(element: Element): boolean {
  return element.matches(PRIVACY_SURFACE_SELECTOR)
    || element.querySelector(PRIVACY_SURFACE_SELECTOR) !== null
}

function mutationTouchesPrivacySurface(record: MutationRecord): boolean {
  if (record.type === 'attributes') {
    const target = record.target
    if (!(target instanceof Element)) return false
    if (target.matches(PRIVACY_SURFACE_SELECTOR)) return true
    if (record.attributeName !== 'class' || !record.oldValue) return false
    const oldClasses = record.oldValue.split(/\s+/)
    return PRIVACY_CLASS_NAMES.some((className) => oldClasses.includes(className))
  }

  const target = record.target
  if (target instanceof Element && target.matches(PRIVACY_SURFACE_SELECTOR)) return true
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => node instanceof Element && elementTouchesPrivacySurface(node))
}

function normalizedSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

function selectedNoteIdFromDom(): string | null {
  return document.querySelector<HTMLElement>('.note-row--selected[data-reorder-note-id]')?.dataset.reorderNoteId ?? null
}

function rowForNote(noteId: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
    .find((row) => row.dataset.reorderNoteId === noteId) ?? null
}

function noteTitleFromRow(row: HTMLElement): string {
  return row.querySelector<HTMLElement>('.note-row__topline strong')?.textContent?.replace(/^📌\s*/, '').trim() ?? ''
}

function closeMenuHost(host: HTMLElement) {
  const row = host.closest<HTMLElement>('.note-row')
  const rowOpener = row?.querySelector<HTMLButtonElement>('.note-row__menu-button[aria-expanded="true"]')
  if (rowOpener) {
    rowOpener.click()
    return
  }

  const activeOpener = host.closest('.note-view')?.querySelector<HTMLButtonElement>('.note-view__menu-button[aria-expanded="true"]')
  if (activeOpener) {
    activeOpener.click()
    return
  }

  const workspaceOpener = document.querySelector<HTMLButtonElement>('.workspace-menu-wrap > button[aria-expanded="true"]')
  workspaceOpener?.click()
}

function privateRecordMap(records: NotePrivacyRecord[]): Map<string, NotePrivacyRecord> {
  return new Map(records.map((record) => [record.noteId, record]))
}

function replacePrivacyRecord(
  current: Map<string, NotePrivacyRecord>,
  noteId: string,
  record: NotePrivacyRecord | null,
): Map<string, NotePrivacyRecord> {
  const next = new Map(current)
  if (record) next.set(noteId, record)
  else next.delete(noteId)
  return next
}

function noteDate(note: NoteRecord): string {
  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(note.updatedAt))
}

export function NotePrivacyRuntime() {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [privacyById, setPrivacyById] = useState<Map<string, NotePrivacyRecord>>(() => new Map())
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<Set<string>>(() => new Set())
  const [privateSession, setPrivateSession] = useState(false)
  const [privateBoxOpen, setPrivateBoxOpen] = useState(false)
  const [visiblePrivateNoteId, setVisiblePrivateNoteId] = useState<string | null>(null)
  const [privacyManagerNoteId, setPrivacyManagerNoteId] = useState<string | null>(null)
  const [lockDialog, setLockDialog] = useState<LockDialogState | null>(null)
  const [lockCode, setLockCode] = useState('')
  const [lockCodeConfirm, setLockCodeConfirm] = useState('')
  const [lockBusy, setLockBusy] = useState(false)
  const [lockError, setLockError] = useState('')
  const [privateAuthAction, setPrivateAuthAction] = useState<PrivateAuthAction | null>(null)
  const [privatePassword, setPrivatePassword] = useState('')
  const [privateAuthBusy, setPrivateAuthBusy] = useState(false)
  const [privateAuthError, setPrivateAuthError] = useState('')
  const [privacyBusyNoteId, setPrivacyBusyNoteId] = useState<string | null>(null)
  const [domRevision, setDomRevision] = useState(0)

  async function refreshData() {
    const [storedNotes, records] = await Promise.all([loadNotes(), listNotePrivacy()])
    setNotes(storedNotes)
    setPrivacyById(privateRecordMap(records))
    void cleanupOrphanNotePrivacy(storedNotes.map((note) => note.id))
  }

  useEffect(() => {
    void refreshData()
  }, [])

  useEffect(() => {
    let frame = 0
    const bump = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setDomRevision((value) => value + 1)
      })
    }

    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    const observer = new MutationObserver((records) => {
      if (records.some(mutationTouchesPrivacySurface)) bump()
    })
    if (workspace) {
      observer.observe(workspace, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-expanded'],
        attributeOldValue: true,
      })
    }

    const onInput = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.matches('.notes-search input[type="search"]')) bump()
    }
    window.addEventListener('input', onInput, true)

    return () => {
      observer.disconnect()
      window.removeEventListener('input', onInput, true)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes])
  const privateNotes = useMemo(
    () => notes
      .filter((note) => privacyById.get(note.id)?.privateBox === true)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [notes, privacyById],
  )

  const rowMenuHosts = useMemo(() => {
    void domRevision
    return Array.from(document.querySelectorAll<HTMLElement>('.note-row__menu')).flatMap((host) => {
      const noteId = host.closest<HTMLElement>('.note-row[data-reorder-note-id]')?.dataset.reorderNoteId
      return noteId ? [{ host, noteId }] : []
    })
  }, [domRevision])

  const activeMenuHost = useMemo(() => {
    void domRevision
    const host = document.querySelector<HTMLElement>('.note-view__menu')
    const noteId = selectedNoteIdFromDom()
    return host && noteId ? { host, noteId } : null
  }, [domRevision])

  const workspaceMenuHost = useMemo(() => {
    void domRevision
    return document.querySelector<HTMLElement>('.workspace-menu[role="menu"]')
  }, [domRevision])

  const noteCanvasHost = useMemo(() => {
    void domRevision
    return document.querySelector<HTMLElement>('.note-canvas')
  }, [domRevision])

  const rowPrivacyHosts = useMemo(() => {
    void domRevision
    return Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]')).flatMap((host) => {
      const noteId = host.dataset.reorderNoteId
      return noteId ? [{ host, noteId }] : []
    })
  }, [domRevision])

  const selectedNoteId = selectedNoteIdFromDom()
  const selectedPrivacy = selectedNoteId ? privacyById.get(selectedNoteId) ?? null : null
  const selectedNeedsPrivateAuth = !!selectedNoteId && selectedPrivacy?.privateBox === true && !privateSession
  const selectedNeedsNoteCode = !!selectedNoteId
    && !!selectedPrivacy?.lock
    && !unlockedNoteIds.has(selectedNoteId)
    && !selectedNeedsPrivateAuth

  useEffect(() => {
    const searchInput = document.querySelector<HTMLInputElement>('.notes-search input[type="search"]')
    const query = normalizedSearch(searchInput?.value ?? '')
    const hasProtectedRecords = [...privacyById.values()].some((record) => !!record.lock || record.privateBox === true)

    for (const row of document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]')) {
      const noteId = row.dataset.reorderNoteId
      if (!noteId) continue
      const privacy = privacyById.get(noteId)
      const locked = !!privacy?.lock && !unlockedNoteIds.has(noteId)
      const privateHidden = privacy?.privateBox === true
        && !(privateSession && visiblePrivateNoteId === noteId)
      const titleMatches = query.length === 0
        || normalizedSearch(noteTitleFromRow(row)).includes(query)
      const searchHidden = query.length > 0 && locked && !titleMatches
      const shouldHide = privateHidden || searchHidden

      row.dataset.oanixNoteLocked = locked ? 'true' : 'false'
      row.dataset.oanixNoteHasLock = privacy?.lock ? 'true' : 'false'
      row.dataset.oanixPrivateNote = privacy?.privateBox === true ? 'true' : 'false'

      if (shouldHide) {
        row.dataset.oanixPrivacyHidden = 'true'
        row.style.setProperty('display', 'none', 'important')
      } else if (row.dataset.oanixPrivacyHidden === 'true') {
        delete row.dataset.oanixPrivacyHidden
        row.style.removeProperty('display')
      }
    }

    const noteView = document.querySelector<HTMLElement>('.note-view')
    if (noteView) {
      noteView.dataset.oanixNoteLocked = selectedNeedsNoteCode ? 'true' : 'false'
      noteView.dataset.oanixNoteHasLock = selectedPrivacy?.lock ? 'true' : 'false'
      noteView.dataset.oanixPrivateNote = selectedPrivacy?.privateBox === true ? 'true' : 'false'
      noteView.dataset.oanixPrivateAuthorized = selectedPrivacy?.privateBox === true && privateSession ? 'true' : 'false'
    }

    if (noteCanvasHost) {
      noteCanvasHost.dataset.oanixPrivacyGated = selectedNeedsPrivateAuth || selectedNeedsNoteCode ? 'true' : 'false'
    }

    if (query && hasProtectedRecords) {
      const meta = document.querySelector<HTMLElement>('.notes-search__meta')
      if (meta) {
        const hasPrivate = [...privacyById.values()].some((record) => record.privateBox === true)
        const hasLocked = [...privacyById.values()].some((record) => !!record.lock)
        const parts = [
          hasLocked ? 'notas protegidas: solo título' : '',
          hasPrivate ? 'Caja privada: excluida' : '',
        ].filter(Boolean)
        meta.textContent = `Búsqueda privada · ${parts.join(' · ')}`
      }
    }
  }, [domRevision, noteCanvasHost, privacyById, privateSession, selectedNeedsNoteCode, selectedNeedsPrivateAuth, selectedPrivacy, unlockedNoteIds, visiblePrivateNoteId])

  useEffect(() => {
    function captureWorkspaceClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const openButton = target.closest<HTMLButtonElement>('.note-row__open')
      if (openButton) {
        const noteId = openButton.closest<HTMLElement>('.note-row[data-reorder-note-id]')?.dataset.reorderNoteId
        if (!noteId) return

        if (visiblePrivateNoteId && noteId !== visiblePrivateNoteId) {
          setVisiblePrivateNoteId(null)
          setPrivateSession(false)
        }

        const privacy = privacyById.get(noteId)
        if (privacy?.privateBox === true && !privateSession) {
          event.preventDefault()
          event.stopPropagation()
          setPrivateAuthAction({ kind: 'open-note', noteId })
          void requestPrivateAuthentication({ kind: 'open-note', noteId })
          return
        }
        if (privacy?.lock && !unlockedNoteIds.has(noteId)) {
          event.preventDefault()
          event.stopPropagation()
          openLockDialog('unlock', noteId, true)
          return
        }
      }

      if (target.closest('.back-button') && selectedNoteId) {
        const privacy = privacyById.get(selectedNoteId)
        if (privacy?.privateBox === true) {
          window.setTimeout(() => {
            setVisiblePrivateNoteId(null)
            setPrivateSession(false)
          }, 0)
        }
      }
    }

    document.addEventListener('click', captureWorkspaceClick, true)
    return () => document.removeEventListener('click', captureWorkspaceClick, true)
  }, [privacyById, privateSession, selectedNoteId, unlockedNoteIds, visiblePrivateNoteId])

  useEffect(() => {
    function handleOpenNotePrivacy(event: Event) {
      const detail = event instanceof CustomEvent
        ? event.detail as { noteId?: unknown } | null
        : null
      if (typeof detail?.noteId !== 'string' || !detail.noteId) return
      if (!noteById.has(detail.noteId)) return
      setPrivacyManagerNoteId(detail.noteId)
    }

    window.addEventListener('oanix:open-note-privacy', handleOpenNotePrivacy)
    return () => window.removeEventListener('oanix:open-note-privacy', handleOpenNotePrivacy)
  }, [noteById])

  function manuallyRelockNote(noteId: string) {
    const focused = document.activeElement
    const noteView = document.querySelector<HTMLElement>('.note-view')
    const relockingSelectedNote = selectedNoteIdFromDom() === noteId
    if (relockingSelectedNote && focused instanceof HTMLElement && noteView?.contains(focused)) focused.blur()

    setUnlockedNoteIds((current) => {
      const next = new Set(current)
      next.delete(noteId)
      return next
    })
  }

  function openLockDialog(mode: LockDialogMode, noteId: string, openAfterUnlock = false) {
    setPrivacyManagerNoteId(null)
    setLockDialog({ mode, noteId, openAfterUnlock })
    setLockCode('')
    setLockCodeConfirm('')
    setLockError('')
  }

  function closeLockDialog() {
    if (lockBusy) return
    setLockDialog(null)
    setLockCode('')
    setLockCodeConfirm('')
    setLockError('')
  }

  async function handleLockSubmit() {
    if (!lockDialog || lockBusy) return
    const privacy = privacyById.get(lockDialog.noteId)
    setLockBusy(true)
    setLockError('')

    try {
      if (lockDialog.mode === 'set') {
        const validation = validateNotePrivacyCode(lockCode)
        if (validation) throw new Error(validation)
        if (lockCode !== lockCodeConfirm) throw new Error('Los códigos no coinciden.')
        const lock = await createNotePrivacyLock(lockCode)
        const record = await setNotePrivacyLock(lockDialog.noteId, lock)
        setPrivacyById((current) => replacePrivacyRecord(current, lockDialog.noteId, record))
        setUnlockedNoteIds((current) => {
          const next = new Set(current)
          next.delete(lockDialog.noteId)
          return next
        })
        closeLockDialogAfterBusy()
        return
      }

      if (!privacy?.lock) throw new Error('Esta nota ya no tiene protección individual.')
      const valid = await verifyNotePrivacyLock(lockCode, privacy.lock)
      if (!valid) throw new Error('Código incorrecto.')

      if (lockDialog.mode === 'remove') {
        const record = await setNotePrivacyLock(lockDialog.noteId, null)
        setPrivacyById((current) => replacePrivacyRecord(current, lockDialog.noteId, record))
        setUnlockedNoteIds((current) => {
          const next = new Set(current)
          next.delete(lockDialog.noteId)
          return next
        })
        closeLockDialogAfterBusy()
        return
      }

      const shouldOpen = lockDialog.openAfterUnlock === true
      const noteId = lockDialog.noteId
      setUnlockedNoteIds((current) => new Set(current).add(noteId))
      closeLockDialogAfterBusy()
      if (shouldOpen) window.setTimeout(() => void revealAndOpenNote(noteId), 50)
    } catch (error) {
      setLockError(error instanceof Error ? error.message : 'No se pudo completar la protección de la nota.')
    } finally {
      setLockBusy(false)
    }
  }

  function closeLockDialogAfterBusy() {
    setLockDialog(null)
    setLockCode('')
    setLockCodeConfirm('')
    setLockError('')
  }

  async function updatePrivateFlag(noteId: string, privateBox: boolean) {
    if (privacyBusyNoteId) return
    setPrivacyBusyNoteId(noteId)
    try {
      const record = await setNotePrivateBox(noteId, privateBox)
      setPrivacyById((current) => replacePrivacyRecord(current, noteId, record))
      setPrivacyManagerNoteId(null)
      if (!privateBox) {
        if (visiblePrivateNoteId === noteId) setVisiblePrivateNoteId(null)
      } else if (!privateSession) {
        setVisiblePrivateNoteId(null)
      }
    } finally {
      setPrivacyBusyNoteId(null)
    }
  }

  async function requestPrivateAuthentication(action: PrivateAuthAction) {
    setPrivateAuthAction(action)
    setPrivatePassword('')
    setPrivateAuthError('')

    if (privateSession) {
      await completePrivateAuthAction(action)
      return
    }

    setPrivateAuthBusy(true)
    try {
      if (await canUsePrivateBoxDeviceAuth()) {
        const result = await reauthenticatePrivateBoxWithDevice()
        if (result.status === 'success') {
          setPrivateSession(true)
          await completePrivateAuthAction(action, true)
          setPrivateAuthAction(null)
          return
        }
        if (!result.cancelled) setPrivateAuthError(result.message)
      }
    } finally {
      setPrivateAuthBusy(false)
    }
  }

  async function handlePrivatePasswordSubmit() {
    if (!privateAuthAction || privateAuthBusy || !privatePassword) return
    setPrivateAuthBusy(true)
    setPrivateAuthError('')
    try {
      const result = await reauthenticatePrivateBoxWithPassword(privatePassword)
      if (result.status !== 'success') {
        setPrivateAuthError(result.message)
        return
      }
      const action = privateAuthAction
      setPrivateSession(true)
      setPrivatePassword('')
      setPrivateAuthAction(null)
      await completePrivateAuthAction(action, true)
    } finally {
      setPrivateAuthBusy(false)
    }
  }

  async function completePrivateAuthAction(action: PrivateAuthAction, newlyAuthorized = false) {
    if (action.kind === 'open-box') {
      const storedNotes = await loadNotes()
      setNotes(storedNotes)
      if (newlyAuthorized) setPrivateSession(true)
      setPrivateBoxOpen(true)
      return
    }
    if (action.kind === 'remove-private') {
      if (newlyAuthorized) setPrivateSession(true)
      await updatePrivateFlag(action.noteId, false)
      return
    }
    if (newlyAuthorized) setPrivateSession(true)
    setVisiblePrivateNoteId(action.noteId)
    const privacy = privacyById.get(action.noteId)
    if (privacy?.lock && !unlockedNoteIds.has(action.noteId)) {
      openLockDialog('unlock', action.noteId, true)
      return
    }
    window.setTimeout(() => void revealAndOpenNote(action.noteId), 50)
  }

  async function revealAndOpenNote(noteId: string) {
    const note = noteById.get(noteId) ?? (await loadNotes()).find((item) => item.id === noteId)
    if (!note) return
    setVisiblePrivateNoteId(noteId)

    let searchInput = document.querySelector<HTMLInputElement>('.notes-search input[type="search"]')
    if (!searchInput) {
      const openSearch = document.querySelector<HTMLButtonElement>('.notes-header__actions button[aria-label="Buscar en notas"]')
      openSearch?.click()
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      searchInput = document.querySelector<HTMLInputElement>('.notes-search input[type="search"]')
    }

    if (searchInput) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(searchInput, note.title)
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())))
    }

    const row = rowForNote(noteId)
    const opener = row?.querySelector<HTMLButtonElement>('.note-row__open')
    opener?.click()

    if (opener) {
      window.setTimeout(() => {
        const closeSearch = document.querySelector<HTMLButtonElement>('.notes-header__actions button[aria-label="Cerrar búsqueda"]')
        closeSearch?.click()
      }, 120)
    }
  }

  function closePrivateBox() {
    setPrivateBoxOpen(false)
    setPrivateSession(false)
    setVisiblePrivateNoteId(null)
  }

  function openPrivacyManager(noteId: string, host: HTMLElement) {
    closeMenuHost(host)
    setPrivacyManagerNoteId(noteId)
  }

  function privacyActionButton(host: HTMLElement, noteId: string) {
    return createPortal(
      <button
        className="oanix-note-privacy-menuitem"
        type="button"
        role="menuitem"
        onClick={() => openPrivacyManager(noteId, host)}
      >
        <span aria-hidden="true">🔐</span> Privacidad
      </button>,
      host,
      `privacy-${noteId}`,
    )
  }

  const managerNote = privacyManagerNoteId ? noteById.get(privacyManagerNoteId) ?? null : null
  const managerPrivacy = privacyManagerNoteId ? privacyById.get(privacyManagerNoteId) ?? null : null
  const managerUnlocked = !!privacyManagerNoteId && unlockedNoteIds.has(privacyManagerNoteId)

  return (
    <>
      {rowMenuHosts.map(({ host, noteId }) => privacyActionButton(host, noteId))}
      {activeMenuHost && privacyActionButton(activeMenuHost.host, activeMenuHost.noteId)}
      {workspaceMenuHost && createPortal(
        <button
          className="oanix-private-box-menuitem"
          type="button"
          role="menuitem"
          onClick={() => {
            closeMenuHost(workspaceMenuHost)
            void requestPrivateAuthentication({ kind: 'open-box' })
          }}
        >
          <span aria-hidden="true">🗄️</span>
          <span>
            <strong>Caja privada</strong>
            <small>{privateNotes.length > 0 ? `${privateNotes.length} nota${privateNotes.length === 1 ? '' : 's'}` : 'Notas fuera de la vista normal'}</small>
          </span>
        </button>,
        workspaceMenuHost,
      )}

      {rowPrivacyHosts.map(({ host, noteId }) => {
        const privacy = privacyById.get(noteId)
        if (!privacy?.lock) return null
        const isUnlocked = unlockedNoteIds.has(noteId)
        return createPortal(
          <button
            className={`oanix-note-row-lock${isUnlocked ? ' oanix-note-row-lock--unlocked' : ''}`}
            type="button"
            aria-label={isUnlocked ? 'Bloquear esta nota ahora' : 'Desbloquear esta nota'}
            title={isUnlocked ? 'Bloquear nota ahora' : 'Desbloquear nota'}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (isUnlocked) {
                manuallyRelockNote(noteId)
                return
              }
              openLockDialog('unlock', noteId)
            }}
          >
            <svg className="oanix-note-row-lock__icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5.5" y="10" width="13" height="10" rx="2.4" />
              {isUnlocked ? (
                <path d="M9 10V7.8a4 4 0 0 1 7.7-1.5" />
              ) : (
                <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
              )}
              <path d="M12 14v2.4" />
            </svg>
          </button>,
          host,
          `note-row-lock-${noteId}`,
        )
      })}

      {noteCanvasHost && (selectedNeedsPrivateAuth || selectedNeedsNoteCode) && createPortal(
        <div className="oanix-note-privacy-gate" role="region" aria-label="Contenido protegido">
          <div className="oanix-note-privacy-gate__icon" aria-hidden="true">
            {selectedNeedsPrivateAuth ? '🗄️' : '🔒'}
          </div>
          <strong>{selectedNeedsPrivateAuth ? 'Nota en Caja privada' : 'Nota protegida'}</strong>
          <p>
            {selectedNeedsPrivateAuth
              ? 'Confirma tu identidad para ver el contenido de esta nota.'
              : 'El título permanece visible, pero el contenido está oculto hasta introducir su código.'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!selectedNoteId) return
              if (selectedNeedsPrivateAuth) void requestPrivateAuthentication({ kind: 'open-note', noteId: selectedNoteId })
              else openLockDialog('unlock', selectedNoteId)
            }}
          >
            {selectedNeedsPrivateAuth ? 'Abrir Caja privada' : 'Desbloquear nota'}
          </button>
        </div>,
        noteCanvasHost,
      )}

      {privacyManagerNoteId && managerNote && (
        <div className="oanix-privacy-dialog" role="presentation" onClick={() => setPrivacyManagerNoteId(null)}>
          <section
            className="oanix-privacy-dialog__panel oanix-privacy-manager"
            role="dialog"
            aria-modal="true"
            aria-label={`Privacidad de ${managerNote.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>PRIVACIDAD</span>
                <strong>{managerNote.title}</strong>
              </div>
              <button type="button" onClick={() => setPrivacyManagerNoteId(null)} aria-label="Cerrar">×</button>
            </header>

            <div className="oanix-privacy-status">
              <div>
                <span aria-hidden="true">🔒</span>
                <p><strong>Protección individual</strong><small>{managerPrivacy?.lock ? 'Código activado' : 'Sin código adicional'}</small></p>
              </div>
              <div>
                <span aria-hidden="true">🗄️</span>
                <p><strong>Caja privada</strong><small>{managerPrivacy?.privateBox ? 'Fuera de la vista normal' : 'Visible normalmente'}</small></p>
              </div>
            </div>

            <div className="oanix-privacy-actions">
              {!managerPrivacy?.lock ? (
                <button type="button" onClick={() => openLockDialog('set', managerNote.id)}>
                  🔒 Proteger nota
                  <small>Código libre de 1 a 20 caracteres</small>
                </button>
              ) : (
                <>
                  {!managerUnlocked && (
                    <button type="button" onClick={() => openLockDialog('unlock', managerNote.id)}>
                      🔓 Desbloquear temporalmente
                      <small>Solo durante esta sesión de OANIX</small>
                    </button>
                  )}
                  <button type="button" onClick={() => openLockDialog('remove', managerNote.id)}>
                    🗝️ Quitar protección
                    <small>Solicita el código actual</small>
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={privacyBusyNoteId === managerNote.id}
                onClick={() => {
                  if (managerPrivacy?.privateBox && !privateSession) {
                    setPrivacyManagerNoteId(null)
                    void requestPrivateAuthentication({ kind: 'remove-private', noteId: managerNote.id })
                    return
                  }
                  void updatePrivateFlag(managerNote.id, managerPrivacy?.privateBox !== true)
                }}
              >
                {managerPrivacy?.privateBox ? '📤 Sacar de Caja privada' : '🗄️ Mover a Caja privada'}
                <small>{managerPrivacy?.privateBox ? 'Volverá a la lista normal' : 'Dejará de aparecer en listas y búsquedas normales'}</small>
              </button>
            </div>

            <p className="oanix-privacy-footnote">
              El código de nota es una barrera adicional dentro de tu bóveda ya cifrada. No sustituye la contraseña maestra.
            </p>
          </section>
        </div>
      )}

      {lockDialog && (
        <div className="oanix-privacy-dialog" role="presentation" onClick={closeLockDialog}>
          <form
            className="oanix-privacy-dialog__panel oanix-lock-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Código de protección de nota"
            onSubmit={(event) => {
              event.preventDefault()
              void handleLockSubmit()
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>NOTA PROTEGIDA</span>
                <strong>
                  {lockDialog.mode === 'set' ? 'Crear código' : lockDialog.mode === 'remove' ? 'Quitar protección' : 'Desbloquear nota'}
                </strong>
              </div>
              <button type="button" onClick={closeLockDialog} aria-label="Cerrar">×</button>
            </header>

            <p>
              {lockDialog.mode === 'set'
                ? 'Puede ser una letra, un número, símbolos o una combinación. Tú decides.'
                : 'Introduce el código de esta nota.'}
            </p>

            <label>
              <span>Código</span>
              <input
                type="password"
                value={lockCode}
                onChange={(event) => setLockCode(event.target.value)}
                autoComplete="off"
                maxLength={40}
                autoFocus
                aria-invalid={!!lockError}
              />
            </label>

            {lockDialog.mode === 'set' && (
              <label>
                <span>Repetir código</span>
                <input
                  type="password"
                  value={lockCodeConfirm}
                  onChange={(event) => setLockCodeConfirm(event.target.value)}
                  autoComplete="off"
                  maxLength={40}
                />
              </label>
            )}

            <small className="oanix-lock-dialog__rule">1–20 caracteres · sin requisitos de letras, números o símbolos</small>
            {lockError && <p className="oanix-privacy-error" role="alert">{lockError}</p>}

            <div className="oanix-dialog-actions">
              <button type="button" onClick={closeLockDialog} disabled={lockBusy}>Cancelar</button>
              <button className="oanix-dialog-actions__primary" type="submit" disabled={lockBusy || lockCode.length === 0}>
                {lockBusy ? 'Comprobando…' : lockDialog.mode === 'set' ? 'Proteger' : lockDialog.mode === 'remove' ? 'Quitar protección' : 'Desbloquear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {privateAuthAction && (
        <div className="oanix-privacy-dialog" role="presentation" onClick={() => !privateAuthBusy && setPrivateAuthAction(null)}>
          <form
            className="oanix-privacy-dialog__panel oanix-private-auth"
            role="dialog"
            aria-modal="true"
            aria-label="Abrir Caja privada"
            onSubmit={(event) => {
              event.preventDefault()
              void handlePrivatePasswordSubmit()
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>CAJA PRIVADA</span><strong>Confirma que eres tú</strong></div>
              <button type="button" onClick={() => setPrivateAuthAction(null)} disabled={privateAuthBusy} aria-label="Cerrar">×</button>
            </header>
            <p>En Android intentamos primero huella o credencial del dispositivo. También puedes usar tu contraseña maestra.</p>
            <label>
              <span>Contraseña maestra</span>
              <input
                type="password"
                value={privatePassword}
                onChange={(event) => setPrivatePassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </label>
            {privateAuthError && <p className="oanix-privacy-error" role="alert">{privateAuthError}</p>}
            <div className="oanix-dialog-actions">
              <button type="button" onClick={() => setPrivateAuthAction(null)} disabled={privateAuthBusy}>Cancelar</button>
              <button className="oanix-dialog-actions__primary" type="submit" disabled={privateAuthBusy || !privatePassword}>
                {privateAuthBusy ? 'Verificando…' : 'Abrir con contraseña'}
              </button>
            </div>
          </form>
        </div>
      )}

      {privateBoxOpen && privateSession && (
        <div className="oanix-privacy-dialog" role="presentation" onClick={closePrivateBox}>
          <section
            className="oanix-privacy-dialog__panel oanix-private-box"
            role="dialog"
            aria-modal="true"
            aria-label="Caja privada"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>CAJA PRIVADA</span><strong>Tus notas apartadas</strong></div>
              <button type="button" onClick={closePrivateBox} aria-label="Cerrar Caja privada">×</button>
            </header>
            <p className="oanix-private-box__intro">No aparecen en la lista ni en la búsqueda normal. Para volver a entrar después tendrás que autenticarte otra vez.</p>

            <div className="oanix-private-box__list">
              {privateNotes.length === 0 ? (
                <div className="oanix-private-box__empty">
                  <span aria-hidden="true">🗄️</span>
                  <strong>La Caja privada está vacía</strong>
                  <p>Desde el menú ⋮ de cualquier nota entra a Privacidad y elige “Mover a Caja privada”.</p>
                </div>
              ) : privateNotes.map((note) => {
                const privacy = privacyById.get(note.id)
                return (
                  <article className="oanix-private-box__note" key={note.id}>
                    <div>
                      <strong>{privacy?.lock ? '🔒 ' : ''}{note.title}</strong>
                      <small>{noteDate(note)}</small>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setPrivateBoxOpen(false)
                          setVisiblePrivateNoteId(note.id)
                          if (privacy?.lock && !unlockedNoteIds.has(note.id)) {
                            openLockDialog('unlock', note.id, true)
                          } else {
                            window.setTimeout(() => void revealAndOpenNote(note.id), 50)
                          }
                        }}
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        disabled={privacyBusyNoteId === note.id}
                        onClick={() => void updatePrivateFlag(note.id, false)}
                      >
                        Sacar
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            <button className="oanix-private-box__close" type="button" onClick={closePrivateBox}>
              Cerrar y volver a proteger
            </button>
          </section>
        </div>
      )}
    </>
  )
}
