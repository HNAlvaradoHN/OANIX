import '@fontsource/fraunces/400-italic.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CalendarDays,
  Check,
  ChevronLeft,
  Contact,
  Ellipsis,
  Expand,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderInput,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link,
  List,
  ListOrdered,
  Lock,
  LockOpen,
  Maximize,
  Minus,
  Palette,
  Paperclip,
  PencilLine,
  Pilcrow,
  Pin,
  Plus,
  Quote,
  Redo2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  SquareCheck,
  Tags,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { AttachmentMetadata } from '../../../attachments/attachmentTypes'
import type { NoteSheetThemeProps } from '../../noteSheetThemeContract'
import {
  type CodeBlock,
  type ContactBlock,
  type DailyEntryBlock,
  type FileBlock,
  type ImageBlock,
  type NoteSheetAccent,
  type NoteSheetAppearance,
  type NoteSheetDesign,
  type NoteSheetFont,
  type NoteSheetTheme,
  type ParagraphBlock,
  type StoredNoteBlock,
} from '../../noteTypes'
import {
  appearanceForNote,
  attachUnreferencedFiles,
  createNativeBlockId,
  ensureNativeBlockFlow,
  isNativeContentBlock,
  isNativeTextBlock,
  normalizeNativeSheetBlocks,
  noteCharacterCount,
  noteReadingMinutes,
  noteWordCount,
  runsFromDom,
  textBlockFromDom,
  type NativeTextBlock,
} from './auroraNativeModel'
import {
  ChecklistBlockView,
  CodeBlockView,
  ContactBlockView,
  DailyEntryBlockView,
  DividerBlockView,
  FileBlockView,
  ImageBlockView,
  TextBlockView,
  type NativeBlockKind,
} from './AuroraNativeBlocks'
import auroraCss from './auroraNativeNoteSheet.css?inline'

const THEMES: Record<NoteSheetTheme, {
  paper: string
  paper2: string
  card: string
  ink: string
  inkSoft: string
  inkFaint: string
  line: string
  line2: string
  codeBg: string
  codeHead: string
  codeInk: string
  grain: number
}> = {
  claro: {
    paper: '#F6F3EC', paper2: '#EFEAE0', card: '#FFFDF7',
    ink: '#221E19', inkSoft: '#6B6357', inkFaint: '#A79C8B',
    line: '#E3DCCC', line2: '#D6CDB8',
    codeBg: '#20242E', codeHead: '#272C38', codeInk: '#D7D9E0', grain: .05,
  },
  sepia: {
    paper: '#F3EADA', paper2: '#EBDFC8', card: '#FBF5E8',
    ink: '#3A2E1E', inkSoft: '#7A6A50', inkFaint: '#AE9C7E',
    line: '#E2D3B4', line2: '#C9B48D',
    codeBg: '#2C2418', codeHead: '#382E1F', codeInk: '#E5D9BF', grain: .07,
  },
  noche: {
    paper: '#181A20', paper2: '#20232B', card: '#232630',
    ink: '#EDEAE2', inkSoft: '#A9A598', inkFaint: '#8B877C',
    line: '#30343F', line2: '#4A5060',
    codeBg: '#101218', codeHead: '#171A22', codeInk: '#D7D9E0', grain: .04,
  },
}

const ACCENTS: Record<NoteSheetAccent, string> = {
  vermellon: '#D9542B',
  oceano: '#2E7FB0',
  bosque: '#3E7C4F',
  lavanda: '#7B5EA7',
  dorado: '#B07D2B',
}

const DESIGN_LABELS: Record<NoteSheetDesign, string> = {
  liso: 'Liso',
  renglones: 'Renglones',
  puntos: 'Puntos',
  cuadricula: 'Cuadrícula',
}

const FONT_LABELS: Record<NoteSheetFont, string> = {
  serif: 'Serif',
  sans: 'Sans',
  mono: 'Mono',
}

const FONT_VALUES: Record<NoteSheetFont, string> = {
  serif: "'Fraunces',Georgia,serif",
  sans: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',ui-monospace,monospace",
}

const EMOJI_CP = [
  0x1F600,0x1F601,0x1F602,0x1F609,0x1F60A,0x1F60D,0x1F618,0x1F60E,
  0x1F914,0x1F641,0x1F622,0x1F62D,0x1F621,0x1F44D,0x1F44E,0x1F44F,
  0x1F64C,0x1F44C,0x1F4AA,0x1F64F,0x2764,0x1F49B,0x1F499,0x1F49C,
  0x1F5A4,0x1F4A5,0x2728,0x2B50,0x1F31F,0x26A1,0x1F525,0x1F308,
  0x1F319,0x2615,0x1F355,0x1F389,0x1F3AF,0x1F4A1,0x1F4CC,0x1F4DD,
  0x1F4BC,0x1F4BB,
]
const VS = new Set([0x2764,0x26A1,0x2615,0x2B50])
const EMOJIS = EMOJI_CP.map((cp) => String.fromCodePoint(cp) + (VS.has(cp) ? '\uFE0F' : ''))

const INSERT_ITEMS: Array<
  | { group: string }
  | { kind: NativeBlockKind; icon: typeof Plus; label: string; detail?: string }
> = [
  { group: 'Contenido' },
  { kind: 'entry', icon: CalendarDays, label: 'Entrada diaria' },
  { kind: 'image', icon: ImageIcon, label: 'Imagen', detail: 'Galería o portapapeles' },
  { kind: 'file', icon: Paperclip, label: 'Archivos', detail: 'Docs, videos, .apk…' },
  { kind: 'code', icon: FileText, label: 'Código' },
  { kind: 'check', icon: SquareCheck, label: 'Checklist' },
  { kind: 'contact', icon: Contact, label: 'Contacto' },
  { kind: 'sep', icon: Minus, label: 'Separador' },
  { group: 'Texto' },
  { kind: 'p', icon: Pilcrow, label: 'Párrafo' },
  { kind: 'h2', icon: Heading2, label: 'H2' },
  { kind: 'h3', icon: Heading3, label: 'H3' },
  { kind: 'quote', icon: Quote, label: 'Cita' },
  { kind: 'ul', icon: List, label: 'Lista' },
  { kind: 'ol', icon: ListOrdered, label: 'Lista num.' },
]

interface FixedPosition {
  top: number
  left: number
}

type InsertMode = 'after' | 'replace' | 'caret'

interface InsertState extends FixedPosition {
  targetId: string | null
  mode: InsertMode
}

interface PendingInsertContext {
  kind: 'image' | 'file'
  targetId: string | null
  mode: InsertMode
}

interface ReaderState {
  title: string
  text: string
  code: boolean
}

interface LightboxState {
  src: string
  name: string
}

interface ImageSelection {
  blockId: string
  figure: HTMLElement
}

interface ToastState {
  message: string
  action?: { label: string; run: () => void }
}

function cloneBlocks(blocks: StoredNoteBlock[]): StoredNoteBlock[] {
  return structuredClone(blocks)
}

function elementFromNode(node: Node | null): Element | null {
  return node instanceof Element ? node : node?.parentElement ?? null
}

function selectionForRoot(root: HTMLElement): Selection | null {
  const rootNode = root.getRootNode()
  if (rootNode instanceof ShadowRoot) {
    const shadowSelection = (rootNode as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.()
    if (shadowSelection) return shadowSelection
  }
  return document.getSelection()
}

function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  const channels = [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ].map((channel) => Math.max(0, Math.round(channel * (1 - amount))))
  return `rgb(${channels.join(',')})`
}

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}

function fixedNear(rect: DOMRect, width: number, height: number): FixedPosition {
  let top = rect.bottom + 8
  if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8)
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  return { top: Math.round(top), left: Math.round(left) }
}

function noteDateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function contentLabel(block: StoredNoteBlock): string {
  if (block.type === 'dailyEntry') return 'Entrada'
  if (block.type === 'image') return 'Imagen'
  if (block.type === 'code') return 'Código'
  if (block.type === 'checklist') return 'Checklist'
  if (block.type === 'contact') return 'Contacto'
  if (block.type === 'divider') return 'Separador'
  if (block.type === 'file') return 'Archivos'
  return 'Bloque'
}

function newTextBlock(kind: NativeBlockKind): NativeTextBlock {
  const id = createNativeBlockId()
  if (kind === 'h2') return { id, type: 'heading', level: 2, runs: [] }
  if (kind === 'h3') return { id, type: 'heading', level: 3, runs: [] }
  if (kind === 'quote') return { id, type: 'quote', runs: [] }
  if (kind === 'ul') return { id, type: 'bulletList', items: [[]] }
  if (kind === 'ol') return { id, type: 'orderedList', items: [[]] }
  return { id, type: 'paragraph', runs: [] }
}

function emptyDailyEntry(): [DailyEntryBlock, ParagraphBlock] {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [
    { id: createNativeBlockId(), type: 'dailyEntry', date: `${year}-${month}-${day}`, title: '', showDate: true },
    { id: createNativeBlockId(), type: 'paragraph', runs: [] },
  ]
}

function initialContact(): ContactBlock {
  return {
    id: createNativeBlockId(),
    type: 'contact',
    name: '',
    phone: '',
    email: '',
    organization: '',
    notes: '',
  }
}

function selectedTextBlock(root: HTMLElement): { blockId: string; body: HTMLElement } | null {
  const selection = selectionForRoot(root)
  if (!selection || selection.rangeCount === 0) return null
  const element = elementFromNode(selection.anchorNode)
  const body = element?.closest<HTMLElement>('.block-body')
  if (!body || !root.contains(body)) return null
  const block = body.closest<HTMLElement>('.block[data-block-id]')
  const blockId = block?.dataset.blockId
  return blockId ? { blockId, body } : null
}

function AuroraShadowHost(props: NoteSheetThemeProps) {
  const propsRef = useRef(props)
  propsRef.current = props
  const rootRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const [blocksVersion, setBlocksVersion] = useState(0)
  const [resetToken, setResetToken] = useState(0)
  const blocksRef = useRef<StoredNoteBlock[]>(normalizeNativeSheetBlocks(props.note.content.blocks))
  const structuralHistoryRef = useRef<StoredNoteBlock[][]>([])
  const structuralRedoRef = useRef<StoredNoteBlock[][]>([])
  const focusedBlockIdRef = useRef<string | null>(null)

  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([])
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedBlockElement, setSelectedBlockElement] = useState<HTMLElement | null>(null)
  const [imageSelection, setImageSelection] = useState<ImageSelection | null>(null)
  const [imageActionsOpen, setImageActionsOpen] = useState(false)
  const [imageBarPosition, setImageBarPosition] = useState<FixedPosition>({ top: 0, left: 0 })
  const [insertState, setInsertState] = useState<InsertState | null>(null)
  const pendingInsertRef = useRef<PendingInsertContext | null>(null)
  const [pendingReplaceImageId, setPendingReplaceImageId] = useState<string | null>(null)
  const [pendingFileBlockId, setPendingFileBlockId] = useState<string | null>(null)
  const [morePosition, setMorePosition] = useState<FixedPosition | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerFocus, setDrawerFocus] = useState<'tags' | 'folder' | 'info'>('tags')
  const [themeOpen, setThemeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState('')
  const [imageInfoOpen, setImageInfoOpen] = useState(false)
  const [reader, setReader] = useState<ReaderState | null>(null)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [codePop, setCodePop] = useState<(FixedPosition & { blockId: string }) | null>(null)
  const [entryPop, setEntryPop] = useState<(FixedPosition & { blockId: string }) | null>(null)
  const [emojiPop, setEmojiPop] = useState<(FixedPosition & { blockId: string }) | null>(null)
  const [blockBarPosition, setBlockBarPosition] = useState<FixedPosition>({ top: 0, left: 0 })
  const [bubblePosition, setBubblePosition] = useState<FixedPosition | null>(null)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, block: 'p' })
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const savedRangeRef = useRef<Range | null>(null)
  const [tagValue, setTagValue] = useState('')
  const [appearance, setAppearance] = useState<NoteSheetAppearance>(() => appearanceForNote(props.note.sheetAppearance))
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [infoTick, setInfoTick] = useState(0)

  const stableLoadImage = useMemo(
    () => (block: ImageBlock) => propsRef.current.onLoadImage(block),
    [],
  )

  useEffect(() => {
    blocksRef.current = normalizeNativeSheetBlocks(props.note.content.blocks)
    structuralHistoryRef.current = []
    structuralRedoRef.current = []
    setBlocksVersion((value) => value + 1)
    setResetToken((value) => value + 1)
    setSelectedBlockId(null)
    setSelectedBlockElement(null)
    setImageSelection(null)
    setAppearance(appearanceForNote(props.note.sheetAppearance))
    setAttachments([])

    let alive = true
    void propsRef.current.onLoadAttachments().then((items) => {
      if (!alive) return
      setAttachments(items)
      const migrated = attachUnreferencedFiles(blocksRef.current, items)
      if (migrated.added) {
        blocksRef.current = migrated.blocks
        propsRef.current.onBlocksChange(migrated.blocks)
        setBlocksVersion((value) => value + 1)
      }
    }).catch((error) => {
      if (alive) showToast(error instanceof Error ? error.message : 'No se pudieron cargar los archivos adjuntos.')
    })

    return () => { alive = false }
  }, [props.note.id])

  useLayoutEffect(() => {
    const title = titleRef.current
    if (!title) return
    const rootNode = title.getRootNode()
    const active = rootNode instanceof ShadowRoot ? rootNode.activeElement : document.activeElement
    if (active === title) return
    if (title.textContent !== props.draftTitle) title.textContent = props.draftTitle
  }, [props.draftTitle, props.note.id])

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
  }, [])

  function showToast(message: string, action?: ToastState['action']) {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ message, action })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, action ? 5200 : 2600)
  }

  function currentBlocks(): StoredNoteBlock[] {
    return blocksRef.current
  }

  async function syncNoteNow() {
    const saved = await propsRef.current.onFlush()
    if (saved) window.dispatchEvent(new Event('oanix:sync-now'))
  }

  function pushStructuralHistory() {
    structuralHistoryRef.current.push(cloneBlocks(blocksRef.current))
    if (structuralHistoryRef.current.length > 40) structuralHistoryRef.current.shift()
    structuralRedoRef.current = []
  }

  function imageIdsIn(blocks: StoredNoteBlock[]): Set<string> {
    return new Set(blocks.flatMap((block) => block.type === 'image' ? [block.imageId] : []))
  }

  function reconcileQueuedImageRemovals(from: StoredNoteBlock[], to: StoredNoteBlock[]) {
    const before = imageIdsIn(from)
    const after = imageIdsIn(to)

    before.forEach((imageId) => {
      if (!after.has(imageId)) propsRef.current.onQueueImageRemoval(imageId)
    })
    after.forEach((imageId) => {
      if (!before.has(imageId)) propsRef.current.onRestoreQueuedImage(imageId)
    })
  }

  function commitBlocks(next: StoredNoteBlock[], rerender = true, history = true): StoredNoteBlock[] {
    if (history) pushStructuralHistory()
    const normalized = normalizeNativeSheetBlocks(next)
    reconcileQueuedImageRemovals(blocksRef.current, normalized)
    blocksRef.current = normalized
    propsRef.current.onBlocksChange(normalized)
    if (rerender) setBlocksVersion((value) => value + 1)
    return normalized
  }

  function replaceBlock(blockId: string, nextBlock: StoredNoteBlock, rerender = true, history = true) {
    const next = currentBlocks().map((block) => block.id === blockId ? nextBlock : block)
    commitBlocks(next, rerender, history)
  }

  function patchBlock<T extends StoredNoteBlock>(
    blockId: string,
    patch: Partial<T>,
    rerender = true,
    history = true,
  ) {
    const current = currentBlocks().find((block) => block.id === blockId)
    if (!current) return
    replaceBlock(blockId, { ...current, ...patch } as StoredNoteBlock, rerender, history)
  }

  function commitTextBlock(blockId: string, element: HTMLElement) {
    const parsed = textBlockFromDom(blockId, element)
    const next = currentBlocks().map((block) => block.id === blockId ? parsed : block)
    blocksRef.current = next
    propsRef.current.onBlocksChange(next)
  }

  function entryBodyChange(bodyId: string, element: HTMLElement) {
    const holder = document.createElement('div')
    holder.innerHTML = element.innerHTML
    const runs = runsFromDom(holder)
    const paragraph: ParagraphBlock = { id: bodyId, type: 'paragraph', runs }
    const next = currentBlocks().map((block) => block.id === bodyId ? paragraph : block)
    blocksRef.current = next
    propsRef.current.onBlocksChange(next)
  }

  function selectBlock(blockId: string, element: HTMLElement) {
    setSelectedBlockId(blockId)
    setSelectedBlockElement(element)
    const block = currentBlocks().find((item) => item.id === blockId)
    if (block?.type === 'image') {
      const figure = element.querySelector<HTMLElement>('.img-figure')
      if (figure) {
        setImageSelection({ blockId, figure })
        setCodePop(null)
        setBlockBarPosition({ top: 0, left: 0 })
      }
    } else {
      setImageSelection(null)
      positionBlockBar(element)
    }
  }

  function positionBlockBar(element = selectedBlockElement) {
    if (!element) return
    const shell = element.querySelector<HTMLElement>('.block-shell')
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    const width = 118
    const height = 44
    let top = rect.top - height - 8
    if (top < 64) top = rect.bottom + 8
    setBlockBarPosition({
      top: Math.round(top),
      left: Math.round(Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)),
    })
  }

  function positionImageBar() {
    const current = imageSelection
    if (!current?.figure.isConnected) return
    const frame = current.figure.querySelector<HTMLElement>('.img-frame')
    if (!frame) return

    const rect = frame.getBoundingClientRect()
    const bar = rootRef.current?.querySelector<HTMLElement>('.imgbar')
    const width = bar?.offsetWidth || 44
    const height = bar?.offsetHeight || 44
    const viewport = window.visualViewport
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportWidth = viewport?.width ?? window.innerWidth
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportRight = viewportLeft + viewportWidth
    const viewportBottom = viewportTop + viewportHeight

    let top = rect.top - height - 12
    if (top < viewportTop + 8) top = rect.bottom + 12
    top = Math.min(Math.max(viewportTop + 8, top), Math.max(viewportTop + 8, viewportBottom - height - 8))

    const centeredLeft = rect.left + rect.width / 2 - width / 2
    const left = Math.min(
      Math.max(viewportLeft + 8, centeredLeft),
      Math.max(viewportLeft + 8, viewportRight - width - 8),
    )

    setImageBarPosition({
      top: Math.round(top),
      left: Math.round(left),
    })
  }

  useLayoutEffect(() => {
    positionImageBar()
  }, [imageSelection?.blockId, imageActionsOpen, blocksVersion])

  useEffect(() => {
    function reposition() {
      setBubblePosition(null)
      positionImageBar()
      positionBlockBar()
    }

    const viewport = window.visualViewport
    window.addEventListener('scroll', reposition, { passive: true })
    window.addEventListener('resize', reposition)
    viewport?.addEventListener('scroll', reposition)
    viewport?.addEventListener('resize', reposition)

    return () => {
      window.removeEventListener('scroll', reposition)
      window.removeEventListener('resize', reposition)
      viewport?.removeEventListener('scroll', reposition)
      viewport?.removeEventListener('resize', reposition)
    }
  }, [imageSelection, selectedBlockElement, imageActionsOpen])

  function syncBubble() {
    const root = rootRef.current
    const selection = root ? selectionForRoot(root) : null
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setBubblePosition(null)
      return
    }
    const range = selection.getRangeAt(0)
    const anchor = elementFromNode(selection.anchorNode)
    const focus = elementFromNode(selection.focusNode)
    const aBody = anchor?.closest<HTMLElement>('.block-body')
    const fBody = focus?.closest<HTMLElement>('.block-body')
    if (!aBody || aBody !== fBody || !root.contains(aBody)) {
      setBubblePosition(null)
      return
    }
    const rect = range.getBoundingClientRect()
    if (!rect.width && !rect.height) {
      setBubblePosition(null)
      return
    }

    let node = selection.anchorNode
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode
    const parent = node instanceof Element
      ? node.closest('p,h2,h3,blockquote,ul,ol')
      : null
    const tag = parent?.tagName.toLowerCase() ?? 'p'
    let bold = false
    let italic = false
    try {
      bold = document.queryCommandState('bold')
      italic = document.queryCommandState('italic')
    } catch {
      // Browser editing commands are best-effort state probes.
    }
    setActiveFormats({
      bold,
      italic,
      block: tag === 'blockquote' ? 'quote' : tag,
    })

    requestAnimationFrame(() => {
      const bubble = bubbleRef.current
      const width = bubble?.offsetWidth || 388
      const height = bubble?.offsetHeight || 44
      let top = rect.top - height - 12
      if (top < 66) top = rect.bottom + 12
      setBubblePosition({
        top: Math.round(top),
        left: Math.round(Math.min(
          Math.max(8, rect.left + rect.width / 2 - width / 2),
          window.innerWidth - width - 8,
        )),
      })
    })
  }

  useEffect(() => {
    document.addEventListener('selectionchange', syncBubble)
    return () => document.removeEventListener('selectionchange', syncBubble)
  }, [])

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      setInsertState(null)
      setMorePosition(null)
      setCodePop(null)
      setEntryPop(null)
      setEmojiPop(null)
      setLinkOpen(false)
      setBubblePosition(null)
      setDrawerOpen(false)
      setThemeOpen(false)
      setDescriptionOpen(false)
      setImageInfoOpen(false)
      setDeleteOpen(false)
      setReader(null)
      setLightbox(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  function executeTextCommand(command: string, value?: string) {
    const root = rootRef.current
    if (!root) return
    const selected = selectedTextBlock(root)
    if (!selected) return
    document.execCommand(command, false, value)
    commitTextBlock(selected.blockId, selected.body)
    requestAnimationFrame(syncBubble)
  }

  function executeBlockFormat(tag: 'p' | 'h2' | 'h3' | 'blockquote') {
    const root = rootRef.current
    if (!root) return
    const selection = selectionForRoot(root)
    const selected = selectedTextBlock(root)
    if (!selection || !selected) return

    let node = selection.anchorNode
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode
    const current = node instanceof Element
      ? node.closest('p,h2,h3,blockquote,ul,ol')?.tagName.toLowerCase() ?? ''
      : ''
    const target = current === tag && tag !== 'p' ? 'p' : tag
    document.execCommand('formatBlock', false, target)
    commitTextBlock(selected.blockId, selected.body)
    requestAnimationFrame(syncBubble)
  }

  function undo() {
    const root = rootRef.current
    const active = root?.getRootNode() instanceof ShadowRoot
      ? (root.getRootNode() as ShadowRoot).activeElement
      : document.activeElement
    if (active instanceof HTMLElement && active.isContentEditable) {
      document.execCommand('undo')
      window.setTimeout(() => {
        const selected = root ? selectedTextBlock(root) : null
        if (selected) commitTextBlock(selected.blockId, selected.body)
      }, 0)
      return
    }

    const previous = structuralHistoryRef.current.pop()
    if (!previous) return
    structuralRedoRef.current.push(cloneBlocks(blocksRef.current))
    reconcileQueuedImageRemovals(blocksRef.current, previous)
    blocksRef.current = previous
    propsRef.current.onBlocksChange(previous)
    setBlocksVersion((value) => value + 1)
    setResetToken((value) => value + 1)
  }

  function redo() {
    const root = rootRef.current
    const active = root?.getRootNode() instanceof ShadowRoot
      ? (root.getRootNode() as ShadowRoot).activeElement
      : document.activeElement
    if (active instanceof HTMLElement && active.isContentEditable) {
      document.execCommand('redo')
      window.setTimeout(() => {
        const selected = root ? selectedTextBlock(root) : null
        if (selected) commitTextBlock(selected.blockId, selected.body)
      }, 0)
      return
    }

    const next = structuralRedoRef.current.pop()
    if (!next) return
    structuralHistoryRef.current.push(cloneBlocks(blocksRef.current))
    reconcileQueuedImageRemovals(blocksRef.current, next)
    blocksRef.current = next
    propsRef.current.onBlocksChange(next)
    setBlocksVersion((value) => value + 1)
    setResetToken((value) => value + 1)
  }

  function activeTextContext(): { blockId: string; body: HTMLElement } | null {
    const root = rootRef.current
    if (!root) return null
    const rootNode = root.getRootNode()
    const active = rootNode instanceof ShadowRoot ? rootNode.activeElement : document.activeElement
    if (!(active instanceof HTMLElement)) return null
    const body = active.closest<HTMLElement>('.block-body')
    const block = body?.closest<HTMLElement>('.block[data-block-id]')
    const blockId = block?.dataset.blockId
    if (!body || !blockId || !root.contains(body)) return null
    return { blockId, body }
  }

  function focusNativeBlock(blockId: string, atStart = false) {
    requestAnimationFrame(() => {
      const root = rootRef.current
      if (!root) return
      const editable = root.querySelector<HTMLElement>(
        `.block[data-block-id="${CSS.escape(blockId)}"] [contenteditable="true"]`,
      )
      if (!editable) return
      editable.focus()
      const selection = selectionForRoot(root)
      if (!selection) return
      const range = document.createRange()
      range.selectNodeContents(editable)
      range.collapse(atStart)
      selection.removeAllRanges()
      selection.addRange(range)
    })
  }

  function caretAtStart(element: HTMLElement): boolean {
    const root = rootRef.current
    const selection = root ? selectionForRoot(root) : document.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    if (!range.collapsed || !element.contains(range.startContainer)) return false
    const prefix = range.cloneRange()
    prefix.selectNodeContents(element)
    try {
      prefix.setEnd(range.startContainer, range.startOffset)
    } catch {
      return false
    }
    return prefix.toString() === ''
  }

  function splitTextBlockAtCaret(blockId: string): {
    before: NativeTextBlock | null
    after: ParagraphBlock
  } | null {
    const context = activeTextContext()
    const root = rootRef.current
    const selection = root ? selectionForRoot(root) : document.getSelection()
    if (!context || context.blockId !== blockId || !selection || selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0)
    if (!range.collapsed || !context.body.contains(range.startContainer)) return null

    const beforeRange = document.createRange()
    const afterRange = document.createRange()
    try {
      beforeRange.selectNodeContents(context.body)
      beforeRange.setEnd(range.startContainer, range.startOffset)
      afterRange.selectNodeContents(context.body)
      afterRange.setStart(range.endContainer, range.endOffset)
    } catch {
      return null
    }

    const beforeHolder = document.createElement('div')
    beforeHolder.append(beforeRange.cloneContents())
    const afterHolder = document.createElement('div')
    afterHolder.append(afterRange.cloneContents())

    const before = (beforeHolder.textContent ?? '').trim()
      ? textBlockFromDom(blockId, beforeHolder)
      : null
    const after: ParagraphBlock = {
      id: createNativeBlockId(),
      type: 'paragraph',
      runs: runsFromDom(afterHolder),
    }
    return { before, after }
  }

  function openInsert(anchor: DOMRect, targetId: string | null, mode: InsertMode = 'after') {
    const pos = fixedNear(anchor, 280, 420)
    setInsertState({ ...pos, targetId, mode })
    setMorePosition(null)
    setCodePop(null)
    setEntryPop(null)
    setEmojiPop(null)
  }

  function insertIndexAfter(targetId: string | null): number {
    if (!targetId) return currentBlocks().length
    const index = currentBlocks().findIndex((block) => block.id === targetId)
    return index < 0 ? currentBlocks().length : index + 1
  }

  function insertReadyBlocks(
    newBlocks: StoredNoteBlock[],
    targetId: string | null,
    mode: InsertMode = 'after',
  ) {
    const source = [...currentBlocks()]
    const targetIndex = targetId ? source.findIndex((block) => block.id === targetId) : -1
    let next = source
    let focusId: string | null = newBlocks[0]?.id ?? null
    let focusAtStart = false

    if (mode === 'caret' && targetId && targetIndex >= 0 && isNativeTextBlock(source[targetIndex])) {
      const context = activeTextContext()
      if (context?.blockId === targetId && context.body.innerText.trim() === '') {
        next = [...source]
        next.splice(targetIndex, 1, ...newBlocks)
      } else {
        const split = splitTextBlockAtCaret(targetId)
        if (split) {
          next = [...source]
          const replacement = [
            ...(split.before ? [split.before] : []),
            ...newBlocks,
            split.after,
          ]
          next.splice(targetIndex, 1, ...replacement)
          if (newBlocks.some(isNativeContentBlock)) {
            focusId = split.after.id
            focusAtStart = true
          }
        } else {
          next = [...source]
          next.splice(targetIndex + 1, 0, ...newBlocks)
        }
      }
    } else if (mode === 'replace' && targetIndex >= 0) {
      next = [...source]
      next.splice(targetIndex, 1, ...newBlocks)
    } else {
      next = [...source]
      next.splice(insertIndexAfter(targetId), 0, ...newBlocks)
    }

    const normalized = commitBlocks(next)
    setInsertState(null)
    setSelectedBlockId(newBlocks[0]?.id ?? null)

    if (focusId && !newBlocks.some(isNativeContentBlock) && newBlocks[0]?.type !== 'divider') {
      focusNativeBlock(focusId)
      return
    }

    if (focusId && focusAtStart) {
      focusNativeBlock(focusId, true)
      return
    }

    if (newBlocks.some(isNativeContentBlock) || newBlocks[0]?.type === 'divider') {
      const lastInserted = newBlocks.at(-1)
      const insertedIndex = lastInserted ? normalized.findIndex((block) => block.id === lastInserted.id) : -1
      const following = insertedIndex >= 0
        ? normalized.slice(insertedIndex + 1).find(isNativeTextBlock)
        : null
      if (following) focusNativeBlock(following.id)
    }
  }

  function insertKind(kind: NativeBlockKind) {
    const targetId = insertState?.targetId ?? focusedBlockIdRef.current
    const mode = insertState?.mode ?? 'after'
    if (kind === 'image') {
      setPendingReplaceImageId(null)
      setPendingFileBlockId(null)
      pendingInsertRef.current = { kind: 'image', targetId, mode }
      setInsertState(null)
      imageInputRef.current?.click()
      return
    }
    if (kind === 'file') {
      setPendingReplaceImageId(null)
      setPendingFileBlockId(null)
      pendingInsertRef.current = { kind: 'file', targetId, mode }
      setInsertState(null)
      fileInputRef.current?.click()
      return
    }

    if (['p', 'h2', 'h3', 'quote', 'ul', 'ol'].includes(kind)) {
      insertReadyBlocks([newTextBlock(kind)], targetId, mode)
      return
    }
    if (kind === 'entry') {
      const [entry, body] = emptyDailyEntry()
      insertReadyBlocks([entry, body], targetId, mode)
      return
    }
    if (kind === 'code') {
      const block: CodeBlock = {
        id: createNativeBlockId(), type: 'code', language: 'plaintext', text: '',
        showLineNumbers: false, wrapLines: true,
      }
      insertReadyBlocks([block], targetId, mode)
      return
    }
    if (kind === 'check') {
      insertReadyBlocks([{ id: createNativeBlockId(), type: 'checklist', items: [{ text: '', checked: false }] }], targetId, mode)
      return
    }
    if (kind === 'contact') {
      insertReadyBlocks([initialContact()], targetId, mode)
      return
    }
    if (kind === 'sep') {
      insertReadyBlocks([{ id: createNativeBlockId(), type: 'divider' }], targetId, mode)
    }
  }

  async function handleImageFiles(files: File[]) {
    if (files.length === 0) return
    if (pendingReplaceImageId) {
      const block = currentBlocks().find((item): item is ImageBlock => item.id === pendingReplaceImageId && item.type === 'image')
      setPendingReplaceImageId(null)
      if (!block) return
      if (!window.confirm(`¿Reemplazar “${block.name}”?\n\nLa imagen anterior se eliminará de la nota después de guardar el cambio.`)) return
      try {
        const stored = await propsRef.current.onStoreImage(files[0])
        const next: ImageBlock = { ...block, ...stored, id: block.id, type: 'image' }
        replaceBlock(block.id, next)
        showToast('Imagen reemplazada')
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No se pudo reemplazar la imagen.')
      }
      return
    }

    const pending = pendingInsertRef.current
    if (!pending || pending.kind !== 'image') return
    pendingInsertRef.current = null
    try {
      const blocks: ImageBlock[] = []
      for (const file of files) {
        const stored = await propsRef.current.onStoreImage(file)
        blocks.push({
          id: createNativeBlockId(),
          type: 'image',
          ...stored,
          alt: '',
          widthPercent: 92,
          alignment: 'center',
          locked: true,
          showName: true,
        })
      }
      insertReadyBlocks(blocks, pending.targetId, pending.mode)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo guardar la imagen cifrada.')
    }
  }

  async function handleFileFiles(files: File[]) {
    if (files.length === 0) return
    setAttachmentBusy(true)
    try {
      const stored = await propsRef.current.onStoreAttachments(files)
      setAttachments((current) => [...current, ...stored])

      if (pendingFileBlockId) {
        const blockId = pendingFileBlockId
        setPendingFileBlockId(null)
        const block = currentBlocks().find((item): item is FileBlock => item.id === blockId && item.type === 'file')
        if (block) {
          patchBlock<FileBlock>(block.id, {
            attachmentIds: [...block.attachmentIds, ...stored.map((item) => item.attachmentId)],
          })
        }
      } else {
        const pending = pendingInsertRef.current
        if (pending?.kind === 'file') {
          pendingInsertRef.current = null
          const block: FileBlock = {
            id: createNativeBlockId(),
            type: 'file',
            attachmentIds: stored.map((item) => item.attachmentId),
          }
          insertReadyBlocks([block], pending.targetId, pending.mode)
        }
      }
      showToast(stored.length === 1 ? 'Archivo agregado' : `${stored.length} archivos agregados`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo guardar el archivo cifrado.')
    } finally {
      setAttachmentBusy(false)
    }
  }

  async function removeAttachmentFromBlock(blockId: string, attachment: AttachmentMetadata) {
    if (!window.confirm(`¿Quitar “${attachment.name}” de esta nota?`)) return
    setAttachmentBusy(true)
    try {
      await propsRef.current.onRemoveAttachment(attachment)
      setAttachments((current) => current.filter((item) => item.attachmentId !== attachment.attachmentId))
      const block = currentBlocks().find((item): item is FileBlock => item.id === blockId && item.type === 'file')
      if (block) {
        patchBlock<FileBlock>(block.id, {
          attachmentIds: block.attachmentIds.filter((id) => id !== attachment.attachmentId),
        })
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo quitar el archivo.')
    } finally {
      setAttachmentBusy(false)
    }
  }

  async function deleteBlock(blockId: string) {
    const blocks = currentBlocks()
    const index = blocks.findIndex((block) => block.id === blockId)
    if (index < 0) return
    const block = blocks[index]
    const label = contentLabel(block)
    if (!window.confirm(`¿Eliminar este ${label.toLocaleLowerCase()} de la nota?`)) return

    if (block.type === 'file') {
      const files = block.attachmentIds.flatMap((id) => {
        const item = attachments.find((attachment) => attachment.attachmentId === id)
        return item ? [item] : []
      })
      setAttachmentBusy(true)
      try {
        for (const item of files) await propsRef.current.onRemoveAttachment(item)
        setAttachments((current) => current.filter((item) => !block.attachmentIds.includes(item.attachmentId)))
      } catch (error) {
        setAttachmentBusy(false)
        showToast(error instanceof Error ? error.message : 'No se pudo eliminar este bloque de archivos.')
        return
      }
      setAttachmentBusy(false)
    }

    const removed: StoredNoteBlock[] = [block]
    let deleteCount = 1
    if (block.type === 'dailyEntry' && blocks[index + 1]?.type === 'paragraph') {
      removed.push(blocks[index + 1])
      deleteCount = 2
    }

    const next = blocks.filter((_, blockIndex) => blockIndex < index || blockIndex >= index + deleteCount)
    commitBlocks(next)
    setSelectedBlockId(null)
    setSelectedBlockElement(null)
    setImageSelection(null)
    showToast('Bloque eliminado', {
      label: 'Deshacer',
      run: () => {
        const restored = [...currentBlocks()]
        restored.splice(Math.min(index, restored.length), 0, ...removed)
        const normalized = ensureNativeBlockFlow(restored)
        reconcileQueuedImageRemovals(blocksRef.current, normalized)
        blocksRef.current = normalized
        propsRef.current.onBlocksChange(normalized)
        setBlocksVersion((value) => value + 1)
      },
    })
  }

  function textKeyDown(blockId: string, event: React.KeyboardEvent<HTMLDivElement>, element: HTMLElement) {
    const blocks = currentBlocks()
    const index = blocks.findIndex((block) => block.id === blockId)
    const block = blocks[index]
    const previous = blocks[index - 1]
    const previousIsContent = isNativeContentBlock(previous)

    if (event.key === 'Enter' && block?.type === 'quote') {
      event.preventDefault()
      if (element.innerText.trim() === '') {
        replaceBlock(block.id, { id: block.id, type: 'paragraph', runs: [] })
        focusNativeBlock(block.id)
      } else {
        const quote = newTextBlock('quote')
        const next = [...blocks]
        next.splice(index + 1, 0, quote)
        commitBlocks(next)
        focusNativeBlock(quote.id)
      }
      return
    }

    if (event.key === '/' && block?.type === 'paragraph') {
      event.preventDefault()
      openInsert(
        element.getBoundingClientRect(),
        blockId,
        element.innerText.trim() === '' ? 'replace' : 'caret',
      )
      return
    }

    if (event.key === 'Backspace') {
      if (element.innerText.trim() === '') {
        if (previousIsContent) {
          event.preventDefault()
          return
        }
        if (blocks.length > 1) {
          event.preventDefault()
          const next = blocks.filter((item) => item.id !== blockId)
          const normalized = commitBlocks(next)
          const target = previous && isNativeTextBlock(previous)
            ? previous
            : normalized.find(isNativeTextBlock)
          if (target) focusNativeBlock(target.id)
        }
        return
      }
      if (previousIsContent && caretAtStart(element)) event.preventDefault()
    }
  }

  async function handleNativePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const clipboard = event.clipboardData
    if (!clipboard) return

    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('.block[data-block-id]')
      : null
    const targetId = target?.dataset.blockId ?? currentBlocks().at(-1)?.id ?? null
    const body = target?.querySelector<HTMLElement>('.block-body')
    const emptyTextTarget = Boolean(body && body.innerText.trim() === '')

    const images = Array.from(clipboard.files).filter((file) => file.type.startsWith('image/'))
    if (images.length > 0) {
      event.preventDefault()
      try {
        const imageBlocks: ImageBlock[] = []
        for (const file of images) {
          const stored = await propsRef.current.onStoreImage(file)
          imageBlocks.push({
            id: createNativeBlockId(),
            type: 'image',
            ...stored,
            alt: '',
            widthPercent: 92,
            alignment: 'center',
            locked: true,
            showName: true,
          })
        }
        insertReadyBlocks(imageBlocks, targetId, emptyTextTarget ? 'replace' : 'after')
        showToast('Imagen pegada')
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No se pudo guardar la imagen pegada.')
      }
      return
    }

    const text = clipboard.getData('text/plain') || ''
    if (target && text.split('\n').length > 50) {
      event.preventDefault()
      const code: CodeBlock = {
        id: createNativeBlockId(),
        type: 'code',
        language: 'plaintext',
        text,
        showLineNumbers: false,
        wrapLines: true,
      }
      insertReadyBlocks([code], targetId, emptyTextTarget ? 'replace' : 'after')
      showToast('Texto largo → código (Texto plano)')
    }
  }

  function patchCode(blockId: string, patch: Partial<CodeBlock>, rerender = true) {
    const block = currentBlocks().find((item): item is CodeBlock => item.id === blockId && item.type === 'code')
    if (!block) return
    if (rerender) replaceBlock(blockId, { ...block, ...patch }, true)
    else {
      const next = currentBlocks().map((item) => item.id === blockId ? { ...block, ...patch } : item)
      blocksRef.current = next
      propsRef.current.onBlocksChange(next)
    }
  }

  function patchContact(blockId: string, patch: Partial<ContactBlock>, rerender = true) {
    const block = currentBlocks().find((item): item is ContactBlock => item.id === blockId && item.type === 'contact')
    if (!block) return
    if (rerender) replaceBlock(blockId, { ...block, ...patch }, true)
    else {
      const next = currentBlocks().map((item) => item.id === blockId ? { ...block, ...patch } : item)
      blocksRef.current = next
      propsRef.current.onBlocksChange(next)
    }
  }

  function patchEntry(blockId: string, patch: Partial<DailyEntryBlock>, rerender = true) {
    const block = currentBlocks().find((item): item is DailyEntryBlock => item.id === blockId && item.type === 'dailyEntry')
    if (!block) return
    if (rerender) replaceBlock(blockId, { ...block, ...patch }, true)
    else {
      const next = currentBlocks().map((item) => item.id === blockId ? { ...block, ...patch } : item)
      blocksRef.current = next
      propsRef.current.onBlocksChange(next)
    }
  }

  function patchChecklist(blockId: string, items: Extract<StoredNoteBlock, { type: 'checklist' }>['items']) {
    const block = currentBlocks().find((item): item is Extract<StoredNoteBlock, { type: 'checklist' }> => item.id === blockId && item.type === 'checklist')
    if (!block) return
    replaceBlock(blockId, { ...block, items }, true)
  }

  function openDrawer(section: 'tags' | 'folder' | 'info') {
    setDrawerFocus(section)
    setDrawerOpen(true)
    setMorePosition(null)
    setInfoTick((value) => value + 1)
  }

  function updateAppearance(patch: Partial<NoteSheetAppearance>) {
    const next = { ...appearance, ...patch }
    setAppearance(next)
    void propsRef.current.onSaveAppearance(next).catch((error) => {
      showToast(error instanceof Error ? error.message : 'No se pudo guardar la apariencia.')
    })
  }

  const theme = THEMES[appearance.theme]
  const accent = ACCENTS[appearance.accent]
  const rootStyle = {
    '--paper': theme.paper,
    '--paper2': theme.paper2,
    '--card': theme.card,
    '--ink': theme.ink,
    '--ink-soft': theme.inkSoft,
    '--ink-faint': theme.inkFaint,
    '--line': theme.line,
    '--line2': theme.line2,
    '--code-bg': theme.codeBg,
    '--code-head': theme.codeHead,
    '--code-ink': theme.codeInk,
    '--acc': accent,
    '--acc-deep': darken(accent, .3),
    '--acc-soft': rgba(accent, .16),
    '--f-body': FONT_VALUES[appearance.font],
  } as CSSProperties

  const noteTags = props.tags.filter((tag) => (props.note.tagIds ?? []).includes(tag.id))
  const folder = props.folders.find((item) => item.id === props.note.folderId) ?? null
  useEffect(() => {
    setImageActionsOpen(false)
  }, [selectedBlockId])

  const selectedImageBlock = imageSelection
    ? currentBlocks().find((block): block is ImageBlock => block.id === imageSelection.blockId && block.type === 'image') ?? null
    : null
  const selectedAtomic = selectedBlockId
    ? currentBlocks().find((block) => block.id === selectedBlockId) ?? null
    : null

  function renderBlocks() {
    const blocks = currentBlocks()
    const views: React.ReactNode[] = []

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index]
      const common = {
        index,
        selected: selectedBlockId === block.id,
        onSelect: selectBlock,
        onInsertAfter: (blockId: string, anchor: DOMRect) => openInsert(anchor, blockId, 'after'),
        onDelete: (blockId: string) => void deleteBlock(blockId),
      }

      if (isNativeTextBlock(block)) {
        views.push(
          <TextBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            resetToken={resetToken}
            onTextInput={commitTextBlock}
            onTextFocus={(blockId) => { focusedBlockIdRef.current = blockId }}
            onTextKeyDown={textKeyDown}
          />,
        )
        continue
      }

      if (block.type === 'dailyEntry') {
        let body = blocks[index + 1]
        if (body?.type !== 'paragraph') {
          body = { id: createNativeBlockId(), type: 'paragraph', runs: [] }
        } else {
          index += 1
        }
        views.push(
          <DailyEntryBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            body={body}
            resetToken={resetToken}
            onEntryChange={patchEntry}
            onEntryBodyChange={entryBodyChange}
            onOpenDate={(blockId, anchor) => setEntryPop({ ...fixedNear(anchor, 220, 90), blockId })}
            onOpenReader={(title, text, code) => setReader({ title, text, code })}
          />,
        )
        continue
      }

      if (block.type === 'image') {
        views.push(
          <ImageBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            onLoadImage={stableLoadImage}
            onImageSelect={(blockId, figure) => {
              setSelectedBlockId(blockId)
              setImageSelection({ blockId, figure })
              requestAnimationFrame(positionImageBar)
            }}
          />,
        )
        continue
      }

      if (block.type === 'code') {
        views.push(
          <CodeBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            resetToken={resetToken}
            onCodeChange={patchCode}
            onOpenReader={(title, text, code) => setReader({ title, text, code })}
            onOpenOptions={(blockId, anchor) => {
              setCodePop({
                top: Math.round(anchor.bottom + 8),
                left: Math.round(Math.min(anchor.right - 210, window.innerWidth - 218)),
                blockId,
              })
              setEntryPop(null)
              setEmojiPop(null)
            }}
            onToast={showToast}
          />,
        )
        continue
      }

      if (block.type === 'checklist') {
        views.push(
          <ChecklistBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            resetToken={resetToken}
            onChecklistChange={patchChecklist}
            onOpenReader={(title, text, code) => setReader({ title, text, code })}
          />,
        )
        continue
      }

      if (block.type === 'contact') {
        views.push(
          <ContactBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            resetToken={resetToken}
            onContactChange={patchContact}
            onOpenReader={(title, text) => setReader({ title, text, code: false })}
            onOpenEmoji={(blockId, anchor) => setEmojiPop({ ...fixedNear(anchor, 248, 260), blockId })}
          />,
        )
        continue
      }

      if (block.type === 'file') {
        views.push(
          <FileBlockView
            key={block.id}
            {...common}
            blockId={block.id}
            block={block}
            attachments={attachments}
            busy={attachmentBusy}
            onAddFiles={(blockId) => {
              setPendingFileBlockId(blockId)
              pendingInsertRef.current = null
              fileInputRef.current?.click()
            }}
            onDownloadFile={(attachment) => {
              setAttachmentBusy(true)
              void propsRef.current.onDownloadAttachment(attachment)
                .catch((error) => showToast(error instanceof Error ? error.message : 'No se pudo descargar el archivo.'))
                .finally(() => setAttachmentBusy(false))
            }}
            onRemoveFile={(blockId, attachment) => void removeAttachmentFromBlock(blockId, attachment)}
          />,
        )
        continue
      }

      if (block.type === 'divider') {
        views.push(<DividerBlockView key={block.id} {...common} blockId={block.id} />)
      }
    }
    return views
  }

  function closeLayers() {
    setDrawerOpen(false)
    setThemeOpen(false)
    setDeleteOpen(false)
    setDescriptionOpen(false)
    setImageInfoOpen(false)
    setReader(null)
    setLightbox(null)
  }

  function openImageLightbox() {
    const figure = imageSelection?.figure
    const img = figure?.querySelector<HTMLImageElement>('.img-frame img')
    if (!figure || !img?.src || !selectedImageBlock) return
    setLightbox({ src: img.src, name: selectedImageBlock.name })
  }

  const scrimVisible = drawerOpen || themeOpen || deleteOpen || descriptionOpen || imageInfoOpen
  void infoTick

  return (
    <div
      ref={rootRef}
      className="aurora-native-root"
      style={rootStyle}
      data-note-sheet-theme="aurora-native"
      data-note-id={props.note.id}
      onPaste={(event) => { void handleNativePaste(event) }}
      onPointerDown={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (!target.closest('.pop')) {
          setInsertState(null)
          setMorePosition(null)
          setCodePop(null)
          setEntryPop(null)
          setEmojiPop(null)
        }
        if (target.closest('.pop,.imgbar,.blockbar,.bubble,.modal,.drawer,.fab,.topbar')) return
        if (!target.closest('.block')) {
          setSelectedBlockId(null)
          setSelectedBlockElement(null)
          setImageSelection(null)
        }
      }}
    >
      <div className="grain" style={{ opacity: theme.grain }} />

      <header className="topbar">
        <button className="icon-btn" type="button" title="Volver a la lista de notas" onClick={props.onBack}><ChevronLeft /></button>
        <div className="brand"><b>✳</b><span>Bitácora</span></div>
        <div className="tb-right">
          <button className={`icon-btn${props.note.pinned ? ' on' : ''}`} type="button" title="Fijar nota" onClick={() => void props.onTogglePinned()}><Pin /></button>
          <span className="tb-sep" />
          <button className="icon-btn" type="button" title="Deshacer" onPointerDown={(event) => event.preventDefault()} onClick={undo}><Undo2 /></button>
          <button className="icon-btn" type="button" title="Rehacer" onPointerDown={(event) => event.preventDefault()} onClick={redo}><Redo2 /></button>
          <span className="tb-sep" />
          <button className="icon-btn" type="button" title="Personalizar hoja" onClick={() => setThemeOpen(true)}><Palette /></button>
          <button
            className="icon-btn"
            type="button"
            title="Acciones de la nota"
            onClick={(event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              setMorePosition({
                top: Math.round(rect.bottom + 8),
                left: Math.round(Math.min(rect.right - 230, window.innerWidth - 238)),
              })
            }}
          ><Ellipsis /></button>
        </div>
      </header>

      {morePosition && (
        <div className="pop more-menu" style={morePosition}>
          <button className="mm-item" type="button" onClick={() => { setMorePosition(null); void props.onTogglePinned() }}><Pin /><span>{props.note.pinned ? 'Desfijar nota' : 'Fijar nota'}</span></button>
          <button className="mm-item" type="button" onClick={() => openDrawer('tags')}><Tags /><span>Editar etiquetas</span></button>
          <button className="mm-item" type="button" onClick={() => openDrawer('folder')}><FolderInput /><span>Mover a carpeta</span></button>
          <button className="mm-item" type="button" onClick={() => openDrawer('info')}><Info /><span>Ver información</span></button>
          <div className="mm-sep" />
          <button className="mm-item danger" type="button" onClick={() => { setMorePosition(null); setDeleteOpen(true) }}><Trash2 /><span>Eliminar nota</span></button>
        </div>
      )}

      <main className={`page bg-${appearance.design}`}>
        <div className="canvas">
          <div className="note-meta">
            <button className="meta-chip" type="button" onClick={() => openDrawer('folder')}><Folder /><span>{folder?.name ?? 'Sin carpeta'}</span></button>
            <span className="meta-dot">·</span>
            <span>{noteDateLabel(props.note.createdAt)}</span>
            <span className="meta-dot">·</span>
            <span>{noteReadingMinutes(currentBlocks())} min</span>
            {props.note.pinned && <span className="meta-chip pin-badge"><Pin />Fijada</span>}
            <span
              className={`save native-save-status${props.error ? ' error' : ''}`}
              style={{ marginLeft: 'auto' }}
              role="status"
              aria-live="polite"
            >
              <i />{props.deleting ? 'Eliminando…' : props.saveLabel}
            </span>
          </div>

          <h1
            ref={titleRef}
            className="note-title"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-ph="Título de la nota…"
            onInput={(event) => {
              const element = event.currentTarget
              const raw = element.textContent ?? ''
              const next = raw.slice(0, 160)
              if (raw !== next) {
                element.textContent = next
                const selection = selectionForRoot(element)
                if (selection) {
                  const range = document.createRange()
                  range.selectNodeContents(element)
                  range.collapse(false)
                  selection.removeAllRanges()
                  selection.addRange(range)
                }
              }
              props.onDraftTitleChange(next)
            }}
            onBlur={() => void props.onCommitTitle()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
          />

          <div className="tagline">
            <span style={{ display: 'contents' }}>
              {noteTags.map((tag) => (
                <span className="tag" key={tag.id}>
                  <span className="tx">#{tag.name}</span>
                  <button type="button" onClick={() => void props.onRemoveTag(tag.id)}><X /></button>
                </span>
              ))}
            </span>
            <form
              className="tag-add"
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                const value = tagValue.trim().replace(/^#/, '')
                if (!value) return
                void props.onAddTag(value).then(() => setTagValue('')).catch((error) => showToast(error instanceof Error ? error.message : 'No se pudo añadir la etiqueta.'))
              }}
            >
              <input value={tagValue} onChange={(event) => setTagValue(event.target.value)} placeholder="+ añadir etiqueta" autoComplete="off" />
              <button className="icon-btn" type="submit" title="Añadir etiqueta"><Plus /></button>
            </form>
          </div>

          {props.error && (
            <div className="native-save-error" role="alert">
              <span>{props.error}</span>
              <button type="button" onClick={() => void props.onFlush()}>Reintentar</button>
            </div>
          )}

          <div className="note-body-divider" aria-hidden="true"><span>✳</span></div>
          <div id="blocks">{renderBlocks()}</div>
          <div
            className="canvas-tail"
            onClick={() => {
              const last = currentBlocks().at(-1)
              if (last && isNativeTextBlock(last)) {
                const element = rootRef.current?.querySelector<HTMLElement>(`.block[data-block-id="${CSS.escape(last.id)}"] .block-body`)
                element?.focus()
                return
              }
              const paragraph = newTextBlock('p')
              insertReadyBlocks([paragraph], currentBlocks().at(-1)?.id ?? null)
            }}
          />
        </div>
      </main>

      <div className="fab" role="group" aria-label="Acciones rápidas de la nota">
        <button
          className="fab-action fab-add"
          type="button"
          aria-label="Añadir bloque"
          title="Añadir bloque"
          onPointerDown={(event) => event.preventDefault()}
          onClick={(event) => {
            const active = activeTextContext()
            if (active) {
              openInsert(event.currentTarget.getBoundingClientRect(), active.blockId, 'caret')
              return
            }
            const last = currentBlocks().at(-1)
            openInsert(event.currentTarget.getBoundingClientRect(), last?.id ?? null, 'after')
          }}
        ><Plus /></button>
        <span className="fab-sep" aria-hidden="true" />
        <button
          className={`fab-action native-manual-sync${props.error ? ' error' : ''}`}
          type="button"
          disabled={props.deleting}
          aria-label="Sincronizar y guardar nota ahora"
          title="Sincronizar y guardar"
          onClick={() => void syncNoteNow()}
        ><RefreshCw /></button>
      </div>

      {insertState && (
        <div className="pop insert-menu" style={{ top: insertState.top, left: insertState.left }}>
          {INSERT_ITEMS.map((item) => {
            if ('group' in item) return <div className="im-group" key={`g:${item.group}`}>{item.group}</div>
            const Icon = item.icon
            return (
              <button className="im-item" type="button" key={item.kind} onClick={() => insertKind(item.kind)}>
                <span className="im-ico"><Icon /></span>
                <span><b>{item.label}</b>{item.detail && <small>{item.detail}</small>}</span>
              </button>
            )
          })}
        </div>
      )}

      {selectedAtomic && isNativeContentBlock(selectedAtomic) && selectedAtomic.type !== 'image' && (
        <div className="blockbar" style={blockBarPosition}>
          <span className="bb-label">{contentLabel(selectedAtomic)}</span>
          <button className="danger" type="button" title="Eliminar este bloque" onClick={() => void deleteBlock(selectedAtomic.id)}><Trash2 /></button>
        </div>
      )}

      {selectedImageBlock && imageSelection && (
        <div
          className={`imgbar${selectedImageBlock.locked === false ? ' unlocked' : ''}${imageActionsOpen ? ' open' : ' compact'}`}
          style={imageBarPosition}
        >
          <button
            type="button"
            title="Acciones de la imagen"
            aria-label="Abrir acciones de la imagen"
            aria-expanded={imageActionsOpen}
            onClick={() => setImageActionsOpen((value) => !value)}
          ><Ellipsis /></button>
          {imageActionsOpen && <>
          <button type="button" title="Abrir imagen" onClick={openImageLightbox}><Maximize /></button>
          <button type="button" title="Reemplazar desde galería" onClick={() => { setPendingReplaceImageId(selectedImageBlock.id); imageInputRef.current?.click() }}><Upload /></button>
          <span className="ib-sep" />
          <button
            type="button"
            className={selectedImageBlock.locked !== false ? 'on' : ''}
            title="Bloquear tamaño/posición"
            onClick={() => patchBlock<ImageBlock>(selectedImageBlock.id, { locked: selectedImageBlock.locked === false })}
          >
            {selectedImageBlock.locked === false ? <LockOpen /> : <Lock />}
          </button>
          <div className="ib-size">
            <Expand />
            <input
              type="range"
              min="34"
              max="100"
              value={selectedImageBlock.widthPercent ?? 92}
              onChange={(event) => patchBlock<ImageBlock>(selectedImageBlock.id, { widthPercent: Number(event.target.value) })}
            />
          </div>
          <span className="ib-sep" />
          {[
            ['left', AlignLeft],
            ['center', AlignCenter],
            ['right', AlignRight],
          ].map(([alignment, Icon]) => (
            <button
              key={String(alignment)}
              type="button"
              className={(selectedImageBlock.alignment ?? 'center') === alignment ? 'on' : ''}
              title={alignment === 'left' ? 'Izquierda' : alignment === 'right' ? 'Derecha' : 'Centro'}
              onClick={() => patchBlock<ImageBlock>(selectedImageBlock.id, { alignment: alignment as ImageBlock['alignment'] })}
            ><Icon /></button>
          ))}
          <span className="ib-sep" />
          <button
            type="button"
            title="Mostrar/ocultar nombre"
            onClick={() => patchBlock<ImageBlock>(selectedImageBlock.id, { showName: selectedImageBlock.showName === false })}
          >{selectedImageBlock.showName === false ? <EyeOff /> : <Eye />}</button>
          <button
            type="button"
            title="Editar descripción"
            onClick={() => { setDescriptionValue(selectedImageBlock.alt ?? ''); setDescriptionOpen(true) }}
          ><PencilLine /></button>
          <button type="button" title="Opciones" onClick={() => setImageInfoOpen(true)}><SlidersHorizontal /></button>
          <span className="ib-sep" />
          <button className="danger" type="button" title="Quitar imagen" onClick={() => void deleteBlock(selectedImageBlock.id)}><Trash2 /></button>

          </>}
        </div>
      )}

      <div
        ref={bubbleRef}
        className={`bubble${bubblePosition ? ' show' : ''}${linkOpen ? ' link-open' : ''}`}
        style={bubblePosition ?? undefined}
      >
        {[
          ['bold', Bold, 'Negrita'],
          ['italic', Italic, 'Cursiva'],
        ].map(([command, Icon, title]) => (
          <button
            key={String(command)}
            className={activeFormats[command as 'bold' | 'italic'] ? 'on' : ''}
            type="button"
            title={String(title)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => executeTextCommand(String(command))}
          ><Icon /></button>
        ))}
        <span className="b-sep" />
        <button className={activeFormats.block === 'p' ? 'on' : ''} type="button" title="Párrafo" onMouseDown={(event) => event.preventDefault()} onClick={() => executeBlockFormat('p')}><Pilcrow /></button>
        <button className={activeFormats.block === 'h2' ? 'on' : ''} type="button" title="H2" onMouseDown={(event) => event.preventDefault()} onClick={() => executeBlockFormat('h2')}><Heading2 /></button>
        <button className={activeFormats.block === 'h3' ? 'on' : ''} type="button" title="H3" onMouseDown={(event) => event.preventDefault()} onClick={() => executeBlockFormat('h3')}><Heading3 /></button>
        <button className={activeFormats.block === 'quote' ? 'on' : ''} type="button" title="Cita" onMouseDown={(event) => event.preventDefault()} onClick={() => executeBlockFormat('blockquote')}><Quote /></button>
        <span className="b-sep" />
        <button className={activeFormats.block === 'ul' ? 'on' : ''} type="button" title="Lista" onMouseDown={(event) => event.preventDefault()} onClick={() => executeTextCommand('insertUnorderedList')}><List /></button>
        <button className={activeFormats.block === 'ol' ? 'on' : ''} type="button" title="Lista num." onMouseDown={(event) => event.preventDefault()} onClick={() => executeTextCommand('insertOrderedList')}><ListOrdered /></button>
        <span className="b-sep" />
        <button
          type="button"
          title="Enlace"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!linkOpen) {
              const root = rootRef.current
              const selection = root ? selectionForRoot(root) : document.getSelection()
              savedRangeRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
            }
            setLinkOpen((value) => {
              const opening = !value
              if (opening) window.setTimeout(() => linkInputRef.current?.focus(), 30)
              return opening
            })
          }}
        ><Link /></button>
        <div className="b-link">
          <input ref={linkInputRef} value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://…" />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const value = linkValue.trim()
              if (!value || !savedRangeRef.current) return
              const root = rootRef.current
              const selection = root ? selectionForRoot(root) : document.getSelection()
              selection?.removeAllRanges()
              selection?.addRange(savedRangeRef.current)
              executeTextCommand('createLink', value)
              savedRangeRef.current = null
              setLinkOpen(false)
              setLinkValue('')
            }}
          >Añadir</button>
        </div>
      </div>

      {codePop && (() => {
        const block = currentBlocks().find((item): item is CodeBlock => item.id === codePop.blockId && item.type === 'code')
        if (!block) return null
        return (
          <div className="pop code-pop" style={{ top: codePop.top, left: codePop.left }}>
            <label className="cp-row"><input type="checkbox" checked={block.showLineNumbers === true} onChange={(event) => patchCode(block.id, { showLineNumbers: event.target.checked }, true)} /> Números de línea</label>
            <label className="cp-row"><input type="checkbox" checked={block.wrapLines !== false} onChange={(event) => patchCode(block.id, { wrapLines: event.target.checked }, true)} /> Ajustar líneas</label>
            <div className="mm-sep" />
            <button
              className="cp-danger"
              type="button"
              onClick={() => {
                if (!window.confirm('¿Vaciar todo el contenido de este bloque de código?')) return
                patchCode(block.id, { text: '' }, true)
                setResetToken((value) => value + 1)
                setCodePop(null)
              }}
            >Vaciar bloque</button>
            <button className="cp-danger" type="button" onClick={() => { setCodePop(null); void deleteBlock(block.id) }}>Eliminar bloque</button>
          </div>
        )
      })()}

      {entryPop && (() => {
        const block = currentBlocks().find((item): item is DailyEntryBlock => item.id === entryPop.blockId && item.type === 'dailyEntry')
        if (!block) return null
        return (
          <div className="pop entry-pop" style={{ top: entryPop.top, left: entryPop.left }}>
            <div className="ep-label">Fecha de la entrada</div>
            <input
              type="date"
              value={block.date}
              onChange={(event) => {
                patchEntry(block.id, { date: event.target.value }, true)
                setEntryPop(null)
              }}
            />
          </div>
        )
      })()}

      {emojiPop && (
        <div className="pop emoji-pop" style={{ top: emojiPop.top, left: emojiPop.left }}>
          <div className="emoji-grid">
            {EMOJIS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => {
                  patchContact(emojiPop.blockId, { avatarEmoji: emoji }, true)
                  setEmojiPop(null)
                  showToast('Emoji aplicado al avatar')
                }}
              >{emoji}</button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple={pendingReplaceImageId === null}
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (files.length === 0) {
            setPendingReplaceImageId(null)
            pendingInsertRef.current = null
            return
          }
          void handleImageFiles(files)
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (files.length === 0) {
            setPendingFileBlockId(null)
            pendingInsertRef.current = null
            return
          }
          void handleFileFiles(files)
        }}
      />

      <button
        className={`scrim${scrimVisible ? ' show' : ''}`}
        type="button"
        aria-label="Cerrar"
        onClick={closeLayers}
      />

      <aside className={`drawer${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="dr-head">
          <div><span className="dr-eyebrow">Detalles</span><h2>Esta nota</h2></div>
          <button className="icon-btn" type="button" onClick={() => setDrawerOpen(false)}><X /></button>
        </div>
        <div className="dr-scroll">
          <section className={drawerFocus === 'tags' ? 'flash' : ''}>
            <h4><Tags />Etiquetas</h4>
            {noteTags.map((tag) => (
              <div className="dr-tag-row" key={tag.id}>
                <input
                  defaultValue={tag.name}
                  onBlur={(event) => {
                    const value = event.currentTarget.value.trim()
                    if (value && value !== tag.name) void props.onRenameTag(tag.id, value)
                  }}
                />
                <button className="dr-tag-del" type="button" onClick={() => void props.onRemoveTag(tag.id)}><X /></button>
              </div>
            ))}
            <form
              className="dr-add"
              onSubmit={(event) => {
                event.preventDefault()
                const value = tagValue.trim().replace(/^#/, '')
                if (!value) return
                void props.onAddTag(value).then(() => setTagValue(''))
              }}
            >
              <input value={tagValue} onChange={(event) => setTagValue(event.target.value)} placeholder="Nueva etiqueta…" />
              <button type="submit"><Plus />Añadir</button>
            </form>
          </section>
          <section className={drawerFocus === 'folder' ? 'flash' : ''}>
            <h4><Folder />Carpeta</h4>
            <button className={`f-row${props.note.folderId === null ? ' active' : ''}`} type="button" onClick={() => void props.onMoveToFolder(null)}>
              <Folder /><span>Sin carpeta</span><Check className="f-check" />
            </button>
            {props.folders.map((item) => (
              <button
                className={`f-row${props.note.folderId === item.id ? ' active' : ''}`}
                type="button"
                key={item.id}
                onClick={() => void props.onMoveToFolder(item.id)}
              ><Folder /><span>{item.name}</span><Check className="f-check" /></button>
            ))}
          </section>
          <section className={drawerFocus === 'info' ? 'flash' : ''}>
            <h4><Info />Información</h4>
            <dl>
              <div className="info-row"><dt>Título</dt><dd>{props.draftTitle || 'Sin título'}</dd></div>
              <div className="info-row"><dt>Creada</dt><dd>{new Date(props.note.createdAt).toLocaleString('es-HN')}</dd></div>
              <div className="info-row"><dt>Modificada</dt><dd>{new Date(props.note.updatedAt).toLocaleString('es-HN')}</dd></div>
              <div className="info-row"><dt>Palabras</dt><dd className="mono">{noteWordCount(currentBlocks())}</dd></div>
              <div className="info-row"><dt>Caracteres</dt><dd className="mono">{noteCharacterCount(currentBlocks())}</dd></div>
              <div className="info-row"><dt>Bloques</dt><dd className="mono">{currentBlocks().length}</dd></div>
              <div className="info-row"><dt>Etiquetas</dt><dd>{noteTags.map((tag) => tag.name).join(', ') || 'Sin etiquetas'}</dd></div>
            </dl>
          </section>
        </div>
      </aside>

      {themeOpen && (
        <div className="modal open">
          <h3>Personalizar hoja</h3>
          <p className="m-sub">La apariencia se guarda con esta nota.</p>
          <div className="pt-section">
            <div className="pt-label">Tema</div>
            <div className="pt-row">
              {(Object.keys(THEMES) as NoteSheetTheme[]).map((key) => (
                <button className={`pt-opt${appearance.theme === key ? ' active' : ''}`} type="button" key={key} onClick={() => updateAppearance({ theme: key })}>
                  <span className="pt-swatch" style={{ background: THEMES[key].paper }} />
                  {key === 'claro' ? 'Claro' : key === 'sepia' ? 'Sepia' : 'Noche'}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-section">
            <div className="pt-label">Acento</div>
            <div className="pt-row">
              {(Object.keys(ACCENTS) as NoteSheetAccent[]).map((key) => (
                <button className={`pt-opt${appearance.accent === key ? ' active' : ''}`} type="button" key={key} onClick={() => updateAppearance({ accent: key })}>
                  <span className="pt-dot" style={{ background: ACCENTS[key] }} />
                </button>
              ))}
            </div>
          </div>
          <div className="pt-section">
            <div className="pt-label">Fondo</div>
            <div className="pt-row">
              {(Object.keys(DESIGN_LABELS) as NoteSheetDesign[]).map((key) => (
                <button className={`pt-opt${appearance.design === key ? ' active' : ''}`} type="button" key={key} onClick={() => updateAppearance({ design: key })}>{DESIGN_LABELS[key]}</button>
              ))}
            </div>
          </div>
          <div className="pt-section">
            <div className="pt-label">Tipografía</div>
            <div className="pt-row">
              {(Object.keys(FONT_LABELS) as NoteSheetFont[]).map((key) => (
                <button className={`pt-opt${appearance.font === key ? ' active' : ''}`} type="button" key={key} onClick={() => updateAppearance({ font: key })}>{FONT_LABELS[key]}</button>
              ))}
            </div>
          </div>
          <div className="m-actions"><button className="btn primary" type="button" onClick={() => setThemeOpen(false)}>Listo</button></div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal open">
          <h3>Eliminar nota</h3>
          <p>Se eliminará «<b>{props.draftTitle || props.note.title}</b>».</p>
          <div className="m-actions">
            <button className="btn ghost" type="button" onClick={() => setDeleteOpen(false)}>Cancelar</button>
            <button className="btn danger" type="button" onClick={() => { setDeleteOpen(false); void props.onDeleteNote() }}>Eliminar</button>
          </div>
        </div>
      )}

      {descriptionOpen && selectedImageBlock && (
        <div className="modal open">
          <h3>Descripción de la imagen</h3>
          <textarea rows={3} value={descriptionValue} onChange={(event) => setDescriptionValue(event.target.value)} />
          <div className="m-actions">
            <button className="btn ghost" type="button" onClick={() => setDescriptionOpen(false)}>Cancelar</button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                patchBlock<ImageBlock>(selectedImageBlock.id, { alt: descriptionValue.trim() })
                setDescriptionOpen(false)
              }}
            >Guardar</button>
          </div>
        </div>
      )}

      {imageInfoOpen && selectedImageBlock && (
        <div className="modal open">
          <h3>Opciones de la imagen</h3>
          <dl>
            <div className="info-row"><dt>Archivo</dt><dd>{selectedImageBlock.name}</dd></div>
            <div className="info-row"><dt>Alineación</dt><dd>{selectedImageBlock.alignment === 'left' ? 'Izquierda' : selectedImageBlock.alignment === 'right' ? 'Derecha' : 'Centro'}</dd></div>
            <div className="info-row"><dt>Bloqueo</dt><dd>{selectedImageBlock.locked === false ? 'No' : 'Sí'}</dd></div>
          </dl>
          <div className="m-actions">
            <button className="btn ghost" type="button" onClick={() => { setImageInfoOpen(false); openImageLightbox() }}>Abrir</button>
            <button className="btn ghost" type="button" onClick={() => setImageInfoOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {reader && (
        <div className="modal reader open">
          <div className="rd-head"><span className="rd-title">{reader.title}</span><button className="rd-close" type="button" onClick={() => setReader(null)}><X /></button></div>
          <div className="rd-body"><div className="rd-inner">{reader.code ? <pre className="rd-code">{reader.text}</pre> : <div className="rd-text">{reader.text}</div>}</div></div>
        </div>
      )}

      {lightbox && <NativeLightbox state={lightbox} onClose={() => setLightbox(null)} />}

      <div className={`toast${toast ? ' show' : ''}`}>
        <span className="toast-msg">{toast?.message}</span>
        {toast?.action && (
          <button
            className="toast-action"
            type="button"
            onClick={() => {
              toast.action?.run()
              setToast(null)
            }}
          >{toast.action.label}</button>
        )}
      </div>
    </div>
  )
}

function NativeLightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const pinchDistanceRef = useRef(0)
  const pinchScaleRef = useRef(1)
  const [scale, setScale] = useState(1)
  const [baseWidth, setBaseWidth] = useState<number | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  function clampScale(value: number) {
    return Math.min(5, Math.max(.4, value))
  }

  function reset() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function zoomAt(factor: number, clientX: number, clientY: number) {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const px = clientX - rect.left - rect.width / 2
    const py = clientY - rect.top - rect.height / 2
    const nextScale = clampScale(scale * factor)
    const ratio = nextScale / scale
    setOffset((current) => ({
      x: px - (px - current.x) * ratio,
      y: py - (py - current.y) * ratio,
    }))
    setScale(nextScale)
  }

  function zoomFromCenter(factor: number) {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 1) lastRef.current = { x: event.clientX, y: event.clientY }
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchDistanceRef.current = Math.hypot(a.x - b.x, a.y - b.y)
      pinchScaleRef.current = scale
      lastRef.current = null
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 1 && lastRef.current) {
      setOffset((current) => ({
        x: current.x + event.clientX - lastRef.current!.x,
        y: current.y + event.clientY - lastRef.current!.y,
      }))
      lastRef.current = { x: event.clientX, y: event.clientY }
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchDistanceRef.current) setScale(clampScale(pinchScaleRef.current * distance / pinchDistanceRef.current))
    }
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size === 1) lastRef.current = [...pointersRef.current.values()][0]
    else lastRef.current = null
  }

  return (
    <div className="modal lightbox open">
      <button className="lb-close" type="button" onClick={onClose}><X /></button>
      <div className="lb-tools">
        <button type="button" onClick={() => zoomFromCenter(.8)}><ZoomOut /></button>
        <span className="lb-pct">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomFromCenter(1.25)}><ZoomIn /></button>
        <button type="button" onClick={reset}><RotateCcw /></button>
      </div>
      <div
        ref={stageRef}
        className="lb-stage"
        onWheel={(event) => {
          event.preventDefault()
          zoomAt(event.deltaY < 0 ? 1.12 : .89, event.clientX, event.clientY)
        }}
        onDoubleClick={() => { if (scale > 1) reset(); else setScale(2) }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <img
          ref={imageRef}
          src={state.src}
          alt=""
          draggable={false}
          onLoad={() => {
            const width = imageRef.current?.getBoundingClientRect().width ?? 0
            if (width > 0) setBaseWidth(width)
          }}
          style={{
            width: baseWidth ? `${Math.round(baseWidth * scale)}px` : undefined,
            maxWidth: baseWidth ? 'none' : undefined,
            maxHeight: baseWidth ? 'none' : undefined,
            height: 'auto',
            transform: `translate(${offset.x}px,${offset.y}px)`,
          }}
        />
      </div>
      <div className="lb-cap">{state.name}</div>
    </div>
  )
}

export function AuroraNativeNoteSheet(props: NoteSheetThemeProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [shadow, setShadow] = useState<ShadowRoot | null>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    setShadow(host.shadowRoot ?? host.attachShadow({ mode: 'open' }))
  }, [])

  return (
    <div
      ref={hostRef}
      className="aurora-native-note-sheet-host"
      style={{ display: 'block', width: '100%', minWidth: 0, minHeight: '100dvh' }}
    >
      {shadow && createPortal(
        <>
          <style>{auroraCss}</style>
          <AuroraShadowHost {...props} />
        </>,
        shadow,
      )}
    </div>
  )
}
