import {
  CalendarDays,
  ChevronDown,
  Copy,
  Download,
  File,
  FileCode,
  FileText,
  Film,
  GripVertical,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Music,
  Package,
  Paperclip,
  PencilLine,
  Plus,
  SlidersHorizontal,
  Smile,
  SquareCheck,
  Trash2,
  X,
} from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { formatAttachmentSize, type AttachmentMetadata } from '../../../attachments/attachmentTypes'
import {
  type ChecklistBlock,
  type CodeBlock,
  type ContactBlock,
  type DailyEntryBlock,
  type FileBlock,
  type ImageBlock,
  type ParagraphBlock,
} from '../../noteTypes'
import { runsToHtml, textBlockToHtml, type NativeTextBlock } from './auroraNativeModel'

export type NativeBlockKind = 'p' | 'h2' | 'h3' | 'quote' | 'ul' | 'ol' | 'entry' | 'image' | 'code' | 'check' | 'contact' | 'sep' | 'file'

interface BlockChromeProps {
  blockId: string
  kind: NativeBlockKind
  index: number
  selected: boolean
  onSelect: (blockId: string, element: HTMLElement) => void
  onInsertAfter: (blockId: string, anchor: DOMRect) => void
  onDelete: (blockId: string) => void
  children: ReactNode
}

export function blockKindForText(block: NativeTextBlock): NativeBlockKind {
  if (block.type === 'heading') return block.level === 3 ? 'h3' : 'h2'
  if (block.type === 'quote') return 'quote'
  if (block.type === 'bulletList') return 'ul'
  if (block.type === 'orderedList') return 'ol'
  return 'p'
}

export function BlockChrome({
  blockId,
  kind,
  index,
  selected,
  onSelect,
  onInsertAfter,
  onDelete,
  children,
}: BlockChromeProps) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`block b-${kind}${selected ? ' selected' : ''}`}
      data-kind={kind}
      data-block-id={blockId}
      style={{ '--i': Math.min(index, 24) } as CSSProperties}
      onPointerDown={(event) => {
        const element = ref.current
        if (element) onSelect(blockId, element)
        if ((event.target as Element).closest('button,input,select,textarea,a,[contenteditable="true"]')) return
        event.stopPropagation()
      }}
    >
      <div className="gutter">
        <button
          className="g-add"
          type="button"
          title="Añadir después"
          onClick={(event) => {
            event.stopPropagation()
            onInsertAfter(blockId, event.currentTarget.getBoundingClientRect())
          }}
        >
          <Plus />
        </button>
        <button
          className="g-del"
          type="button"
          title="Eliminar bloque"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(blockId)
          }}
        >
          <Trash2 />
        </button>
        <span className="g-drag"><GripVertical /></span>
      </div>
      <div className="block-shell">{children}</div>
    </div>
  )
}

interface EditableProps {
  identity: string
  resetToken: number
  className: string
  html?: string
  text?: string
  placeholder?: string
  spellCheck?: boolean
  editable?: boolean
  as?: 'div' | 'code'
  maxLines?: number
  onOverflowChange?: (overflow: boolean) => void
  onInput: (element: HTMLElement) => void
  onFocus?: (element: HTMLElement) => void
  onBlur?: (element: HTMLElement) => void
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>, element: HTMLElement) => void
}

export function UncontrolledEditable({
  identity,
  resetToken,
  className,
  html,
  text,
  placeholder,
  spellCheck = false,
  editable = true,
  as = 'div',
  maxLines,
  onOverflowChange,
  onInput,
  onFocus,
  onBlur,
  onKeyDown,
}: EditableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const overflowFrameRef = useRef<number | null>(null)
  const focusedRef = useRef(false)
  const lastOverflowRef = useRef<boolean | null>(null)

  function measureOverflow() {
    const element = ref.current
    if (!element || !maxLines || focusedRef.current) return

    element.classList.remove('clamped')
    const computed = getComputedStyle(element)
    const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.6
    const overflow = element.scrollHeight > lineHeight * maxLines + 2
    element.classList.toggle('clamped', overflow)

    if (lastOverflowRef.current !== overflow) {
      lastOverflowRef.current = overflow
      onOverflowChange?.(overflow)
    }
  }

  function scheduleOverflowMeasure() {
    if (!maxLines || overflowFrameRef.current !== null) return
    overflowFrameRef.current = window.requestAnimationFrame(() => {
      overflowFrameRef.current = null
      measureOverflow()
    })
  }

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (html !== undefined) element.innerHTML = html
    else element.textContent = text ?? ''
    focusedRef.current = false
    lastOverflowRef.current = null
    measureOverflow()
  }, [identity, resetToken])

  useEffect(() => {
    if (!maxLines) return

    const resize = () => scheduleOverflowMeasure()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      if (overflowFrameRef.current !== null) {
        window.cancelAnimationFrame(overflowFrameRef.current)
        overflowFrameRef.current = null
      }
    }
  }, [identity, maxLines])

  const Tag = as
  return (
    <Tag
      ref={ref}
      className={className}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={spellCheck}
      data-ph={placeholder}
      onInput={() => {
        if (ref.current) onInput(ref.current)
      }}
      onFocus={() => {
        focusedRef.current = true
        if (maxLines) ref.current?.classList.remove('clamped')
        if (ref.current) onFocus?.(ref.current)
      }}
      onBlur={() => {
        focusedRef.current = false
        if (ref.current) onBlur?.(ref.current)
        scheduleOverflowMeasure()
      }}
      onKeyDown={(event) => {
        if (ref.current) onKeyDown?.(event, ref.current)
      }}
    />
  )
}

interface TextBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: NativeTextBlock
  resetToken: number
  onTextInput: (blockId: string, element: HTMLElement) => void
  onTextFocus: (blockId: string, element: HTMLElement) => void
  onTextKeyDown: (blockId: string, event: KeyboardEvent<HTMLDivElement>, element: HTMLElement) => void
}

export function TextBlockView({
  block,
  resetToken,
  onTextInput,
  onTextFocus,
  onTextKeyDown,
  ...chrome
}: TextBlockViewProps) {
  const kind = blockKindForText(block)
  return (
    <BlockChrome {...chrome} blockId={block.id} kind={kind}>
      <UncontrolledEditable
        identity={block.id}
        resetToken={resetToken}
        className="block-body"
        html={textBlockToHtml(block)}
        onInput={(element) => onTextInput(block.id, element)}
        onFocus={(element) => onTextFocus(block.id, element)}
        onKeyDown={(event, element) => onTextKeyDown(block.id, event, element)}
      />
    </BlockChrome>
  )
}

interface ImageBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: ImageBlock
  onLoadImage: (block: ImageBlock) => Promise<Blob | null>
  onImageSelect: (blockId: string, figure: HTMLElement) => void
}

export function ImageBlockView({
  block,
  onLoadImage,
  onImageSelect,
  ...chrome
}: ImageBlockViewProps) {
  const [url, setUrl] = useState('')
  const figureRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let alive = true
    let objectUrl = ''
    void onLoadImage(block).then((blob) => {
      if (!alive || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => undefined)
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [block.imageId, block.mimeType, onLoadImage])

  const alignment = block.alignment ?? 'center'
  const locked = block.locked !== false
  const named = block.showName !== false
  return (
    <BlockChrome {...chrome} blockId={block.id} kind="image">
      <figure
        ref={figureRef}
        className={`img-figure align-${alignment}${locked ? '' : ' unlocked'}`}
        style={{ width: `${block.widthPercent ?? 92}%` }}
        data-locked={String(locked)}
        data-named={String(named)}
        onClick={(event) => {
          event.stopPropagation()
          const figure = figureRef.current
          if (figure) onImageSelect(block.id, figure)
        }}
      >
        <div className="img-frame">
          {url ? <img src={url} alt={block.alt ?? ''} draggable={false} /> : <div className="native-image-loading">Descifrando imagen…</div>}
        </div>
        <figcaption className="img-name" hidden={!named}>{block.name}</figcaption>
        <p className="img-desc">{block.alt ?? ''}</p>
      </figure>
    </BlockChrome>
  )
}

export const NATIVE_CODE_LANGUAGES: Array<[CodeBlock['language'], string]> = [
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['css', 'CSS'],
  ['html', 'HTML'],
  ['python', 'Python'],
  ['bash', 'Bash'],
  ['json', 'JSON'],
  ['sql', 'SQL'],
  ['plaintext', 'Texto plano'],
]

interface CodeBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: CodeBlock
  resetToken: number
  onCodeChange: (blockId: string, patch: Partial<CodeBlock>, rerender?: boolean) => void
  onOpenReader: (title: string, text: string, code: boolean) => void
  onOpenOptions: (blockId: string, anchor: DOMRect) => void
  onToast: (message: string) => void
}

export function CodeBlockView({
  block,
  resetToken,
  onCodeChange,
  onOpenReader,
  onOpenOptions,
  onToast,
  ...chrome
}: CodeBlockViewProps) {
  const lineCount = Math.max(1, block.text.replace(/\n$/, '').split('\n').length)
  const uiLanguage = NATIVE_CODE_LANGUAGES.some(([id]) => id === block.language)
    ? block.language
    : 'plaintext'
  const label = NATIVE_CODE_LANGUAGES.find(([id]) => id === uiLanguage)?.[1] ?? 'Texto plano'
  const showNums = block.showLineNumbers === true
  const wrapChecked = block.wrapLines !== false

  async function copy() {
    try {
      await navigator.clipboard.writeText(block.text)
    } catch {
      const area = document.createElement('textarea')
      area.value = block.text
      document.body.append(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    onToast('Código copiado')
  }

  return (
    <BlockChrome {...chrome} blockId={block.id} kind="code">
      <div className={`code-card${wrapChecked ? '' : ' nowrap'}`}>
        <div className="code-head">
          <div className="lang-wrap">
            <select
              className="lang-sel"
              value={uiLanguage}
              onChange={(event) => onCodeChange(block.id, { language: event.target.value as CodeBlock['language'] }, true)}
              aria-label="Lenguaje del código"
            >
              {NATIVE_CODE_LANGUAGES.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
            </select>
            <ChevronDown className="lang-chev" />
          </div>
          <div className="code-tools">
            <button className="code-btn c-expand" type="button" title="Ver completo" onClick={() => onOpenReader(`Código · ${label}`, block.text, true)}>
              <Maximize2 />
            </button>
            <button className="code-btn c-copy" type="button" onClick={() => void copy()}>
              <Copy /><span>Copiar</span>
            </button>
            <button
              className="code-btn c-opts"
              type="button"
              title="Opciones"
              onClick={(event) => {
                event.stopPropagation()
                onOpenOptions(block.id, event.currentTarget.getBoundingClientRect())
              }}
            >
              <SlidersHorizontal />
            </button>
          </div>
        </div>
        <div className="code-body">
          <div className="line-nums" hidden={!showNums}>
            {Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}<br /></span>)}
          </div>
          <pre>
            <UncontrolledEditable
              identity={`${block.id}:code`}
              resetToken={resetToken}
              className="native-code-editable"
              as="code"
              text={block.text}
              spellCheck={false}
              onInput={(element) => onCodeChange(block.id, { text: element.innerText }, true)}
            />
          </pre>
          <div className="code-fade" />
        </div>
      </div>
    </BlockChrome>
  )
}

interface ChecklistBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: ChecklistBlock
  resetToken: number
  onChecklistChange: (blockId: string, items: ChecklistBlock['items']) => void
  onOpenReader: (title: string, text: string, code: boolean) => void
}

export function ChecklistBlockView({
  block,
  resetToken,
  onChecklistChange,
  onOpenReader,
  ...chrome
}: ChecklistBlockViewProps) {
  const done = block.items.filter((item) => item.checked).length
  const [overflowByIndex, setOverflowByIndex] = useState<Record<number, boolean>>({})

  function update(index: number, patch: Partial<ChecklistBlock['items'][number]>) {
    const items = block.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    onChecklistChange(block.id, items)
  }

  return (
    <BlockChrome {...chrome} blockId={block.id} kind="check">
      <div className="check-card">
        <div className="check-head"><SquareCheck /><span>Checklist</span><span className="check-count">{done}/{block.items.length}</span></div>
        <div className="check-items">
          {block.items.map((item, index) => (
            <div className={`ck-item${item.checked ? ' done' : ''}`} key={index}>
              <button className="ck-box" type="button" onClick={() => update(index, { checked: !item.checked })}>
                <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
              </button>
              <UncontrolledEditable
                identity={`${block.id}:check:${index}`}
                resetToken={resetToken}
                className="ck-text"
                text={item.text}
                placeholder="Nuevo elemento"
                maxLines={2}
                onOverflowChange={(overflow) => setOverflowByIndex((current) =>
                  current[index] === overflow ? current : { ...current, [index]: overflow },
                )}
                onInput={(element) => update(index, { text: element.innerText })}
                onKeyDown={(event, element) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const items = [...block.items]
                    items.splice(index + 1, 0, { text: '', checked: false })
                    onChecklistChange(block.id, items)
                    return
                  }
                  if (event.key === 'Backspace' && element.innerText === '' && block.items.length > 1) {
                    event.preventDefault()
                    onChecklistChange(block.id, block.items.filter((_, itemIndex) => itemIndex !== index))
                  }
                }}
              />
              <button
                className="ck-more"
                type="button"
                hidden={!overflowByIndex[index]}
                title="Ver completo"
                onClick={() => onOpenReader('Elemento de checklist', item.text, false)}
              >+</button>
            </div>
          ))}
        </div>
        <button
          className="check-add"
          type="button"
          onClick={() => onChecklistChange(block.id, [...block.items, { text: '', checked: false }])}
        >
          <Plus />Añadir elemento
        </button>
      </div>
    </BlockChrome>
  )
}

function initials(value: string): string {
  return value.trim().split(/\s+/).slice(0, 2).map((word) => word[0] ?? '').join('').toUpperCase() || '—'
}

interface ContactBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: ContactBlock
  resetToken: number
  onContactChange: (blockId: string, patch: Partial<ContactBlock>, rerender?: boolean) => void
  onOpenReader: (title: string, text: string) => void
  onOpenEmoji: (blockId: string, anchor: DOMRect) => void
}

export function ContactBlockView({
  block,
  resetToken,
  onContactChange,
  onOpenReader,
  onOpenEmoji,
  ...chrome
}: ContactBlockViewProps) {
  const [editing, setEditing] = useState(false)
  const editable = editing

  return (
    <BlockChrome {...chrome} blockId={block.id} kind="contact">
      <div className={`contact-card${editing ? ' editing' : ''}`}>
        <div className="contact-tools">
          <button
            className="contact-emoji"
            type="button"
            title="Emoji del avatar"
            onClick={(event) => {
              event.stopPropagation()
              onOpenEmoji(block.id, event.currentTarget.getBoundingClientRect())
            }}
          ><Smile /></button>
          <button className="contact-edit" type="button" title="Editar/bloquear" onClick={() => setEditing((value) => !value)}><PencilLine /></button>
        </div>
        <div className="avatar"><span>{block.avatarEmoji || initials(block.name)}</span></div>
        <div>
          <UncontrolledEditable
            identity={`${block.id}:name`}
            resetToken={resetToken}
            className="c-name"
            text={block.name}
            editable={editable}
            onInput={(element) => onContactChange(block.id, { name: element.innerText }, true)}
          />
          <UncontrolledEditable
            identity={`${block.id}:organization`}
            resetToken={resetToken}
            className="c-role"
            text={block.organization}
            editable={editable}
            onInput={(element) => onContactChange(block.id, { organization: element.innerText }, true)}
          />
        </div>
        <div className="c-fields">
          {[
            ['phone', 'Teléfono', block.phone],
            ['email', 'Email', block.email],
            ['notes', 'Notas', block.notes],
          ].map(([field, label, value]) => (
            <div className={`c-field${field === 'notes' ? ' c-field-notes' : ''}`} key={field}>
              <span className="c-label">{label}</span>
              <UncontrolledEditable
                identity={`${block.id}:${field}`}
                resetToken={resetToken}
                className={`c-value${field === 'notes' ? ' c-notes-value' : ''}`}
                text={value}
                editable={editable}
                onInput={(element) => onContactChange(block.id, { [field]: element.innerText } as Partial<ContactBlock>, true)}
              />
              {field === 'notes' && value.trim() && !editing && (
                <button className="c-notes-more" type="button" onClick={(event) => {
                  event.stopPropagation()
                  onOpenReader('Notas del contacto', value)
                }}>Ver todo</button>
              )}
            </div>
          ))}
        </div>
        <div className="contact-lock-hint">
          {editing ? <><PencilLine />Editando — tocá el lápiz para bloquear</> : <><Lock />Campos bloqueados — tocá el lápiz para editar</>}
        </div>
      </div>
    </BlockChrome>
  )
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function dailyDateParts(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return { day: '', weekday: '', monthYear: value }
  return {
    day: String(date.getDate()),
    weekday: WEEKDAYS[date.getDay()],
    monthYear: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  }
}

interface DailyEntryBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: DailyEntryBlock
  body: ParagraphBlock
  resetToken: number
  onEntryChange: (blockId: string, patch: Partial<DailyEntryBlock>, rerender?: boolean) => void
  onEntryBodyChange: (bodyId: string, element: HTMLElement) => void
  onOpenDate: (blockId: string, anchor: DOMRect) => void
  onOpenReader: (title: string, text: string, code: boolean) => void
}

export function DailyEntryBlockView({
  block,
  body,
  resetToken,
  onEntryChange,
  onEntryBodyChange,
  onOpenDate,
  onOpenReader,
  ...chrome
}: DailyEntryBlockViewProps) {
  const parts = dailyDateParts(block.date)
  const showDate = block.showDate !== false
  const [titleOverflow, setTitleOverflow] = useState(false)
  const [bodyOverflow, setBodyOverflow] = useState(false)
  return (
    <BlockChrome {...chrome} blockId={block.id} kind="entry">
      <div className={`entry-card${showDate ? '' : ' no-date'}`}>
        <div className="entry-side">
          <button
            className="entry-date"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenDate(block.id, event.currentTarget.getBoundingClientRect())
            }}
          >
            <span className="ed-day">{parts.day}</span>
            <span className="ed-sub"><b className="ed-wd">{parts.weekday}</b><i className="ed-my">{parts.monthYear}</i></span>
          </button>
          <button
            className="ed-toggle"
            type="button"
            title="Mostrar/ocultar fecha"
            onClick={() => onEntryChange(block.id, { showDate: !showDate }, true)}
          ><CalendarDays /></button>
        </div>
        <div className="entry-main">
          <div className="entry-toprow">
            <UncontrolledEditable
              identity={`${block.id}:title`}
              resetToken={resetToken}
              className="entry-title"
              text={block.title}
              placeholder="Título opcional…"
              maxLines={2}
              onOverflowChange={setTitleOverflow}
              onInput={(element) => onEntryChange(block.id, { title: element.innerText.slice(0, 120) }, false)}
            />
            <button
              className="mini-toggle entry-title-toggle"
              type="button"
              hidden={!titleOverflow}
              title="Ver completo"
              onClick={() => onOpenReader('Título de la entrada', block.title, false)}
            ><Maximize2 /></button>
          </div>
          <UncontrolledEditable
            identity={`${body.id}:entry-body`}
            resetToken={resetToken}
            className="entry-body"
            html={runsToHtml(body.runs)}
            placeholder="Escribí la entrada del día…"
            maxLines={3}
            onOverflowChange={setBodyOverflow}
            onInput={(element) => onEntryBodyChange(body.id, element)}
          />
          <button
            className="mini-toggle entry-body-toggle"
            type="button"
            hidden={!bodyOverflow}
            title="Ver completo"
            onClick={() => onOpenReader('Entrada del día', body.runs.map((run) => run.text).join(''), false)}
          ><Maximize2 /></button>
        </div>
      </div>
    </BlockChrome>
  )
}

function fileIcon(name: string): ReactNode {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extension)) return <Film />
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) return <Music />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) return <ImageIcon />
  if (['zip', 'rar', '7z', 'tar', 'gz', 'apk', 'exe', 'msi', 'dmg', 'deb'].includes(extension)) return <Package />
  if (['js', 'ts', 'css', 'html', 'json', 'py', 'sh'].includes(extension)) return <FileCode />
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'csv'].includes(extension)) return <FileText />
  return <File />
}

interface FileBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {
  block: FileBlock
  attachments: AttachmentMetadata[]
  busy: boolean
  onAddFiles: (blockId: string) => void
  onDownloadFile: (attachment: AttachmentMetadata) => void
  onRemoveFile: (blockId: string, attachment: AttachmentMetadata) => void
}

export function FileBlockView({
  block,
  attachments,
  busy,
  onAddFiles,
  onDownloadFile,
  onRemoveFile,
  ...chrome
}: FileBlockViewProps) {
  const byId = new Map(attachments.map((item) => [item.attachmentId, item]))
  const items = block.attachmentIds.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
  return (
    <BlockChrome {...chrome} blockId={block.id} kind="file">
      <div className={`file-card${busy ? ' native-file-busy' : ''}`}>
        <div className="file-head">
          <Paperclip /><span>Archivos adjuntos</span><span className="file-count">{items.length}</span>
          <button className="file-add" type="button" onClick={() => onAddFiles(block.id)}><Plus />Añadir</button>
        </div>
        <div className="file-list">
          {items.map((item) => (
            <div className="file-item" key={item.attachmentId}>
              <span className="file-ico">{fileIcon(item.name)}</span>
              <div className="file-meta"><b>{item.name}</b><small>{formatAttachmentSize(item.byteLength)}</small></div>
              <button className="file-dl" type="button" title="Descargar" onClick={() => onDownloadFile(item)}><Download /></button>
              <button className="file-rm" type="button" title="Quitar" onClick={() => onRemoveFile(block.id, item)}><X /></button>
            </div>
          ))}
        </div>
      </div>
    </BlockChrome>
  )
}

interface DividerBlockViewProps extends Omit<BlockChromeProps, 'kind' | 'children'> {}

export function DividerBlockView(chrome: DividerBlockViewProps) {
  return (
    <BlockChrome {...chrome} kind="sep">
      <div className="sep"><span className="sep-line" /><span className="sep-glyph">✦</span><span className="sep-line" /></div>
    </BlockChrome>
  )
}

