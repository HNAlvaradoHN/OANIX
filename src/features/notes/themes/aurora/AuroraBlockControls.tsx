import { useEffect, useRef, useState } from 'react'
import { OanixIcon } from '../../../../shared/OanixIcon'

type AtomicKind = 'image' | 'code' | 'check' | 'contact' | 'entry' | 'sep'

interface SelectedBlock {
  blockId: string
  kind: AtomicKind
  element: HTMLElement
}

interface AuroraBlockControlsProps {
  noteId: string
}

function sendCommand(
  noteId: string,
  command: string,
  blockId?: string,
  value?: string | number | boolean,
) {
  window.dispatchEvent(new CustomEvent('oanix:note-sheet-command', {
    detail: { noteId, command, blockId, value },
  }))
}

function blockKind(element: HTMLElement): AtomicKind | null {
  if (element.dataset.imageBlock === 'true') return 'image'
  if (element.dataset.codeBlock === 'true') return 'code'
  if (element.dataset.checklistBlock === 'true') return 'check'
  if (element.dataset.contactBlock === 'true') return 'contact'
  if (element.dataset.dailyEntryBlock === 'true') return 'entry'
  if (element.tagName.toLowerCase() === 'hr') return 'sep'
  return null
}

function directAtomicFromTarget(root: HTMLElement, target: Element): HTMLElement | null {
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  if (!editor) return null

  const candidate = target.closest<HTMLElement>(
    '[data-image-block="true"], [data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-daily-entry-block="true"], hr[data-block-id]',
  )
  return candidate?.parentElement === editor ? candidate : null
}

function directBlockId(element: HTMLElement): string {
  return element.dataset.blockId ?? ''
}

function labelFor(kind: AtomicKind): string {
  if (kind === 'entry') return 'Entrada'
  if (kind === 'check') return 'Checklist'
  if (kind === 'contact') return 'Contacto'
  if (kind === 'sep') return 'Separador'
  if (kind === 'code') return 'Código'
  return 'Imagen'
}

function formatDailyDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const day = new Intl.DateTimeFormat('es-HN', { day: 'numeric' }).format(date)
  const weekday = new Intl.DateTimeFormat('es-HN', { weekday: 'short' }).format(date).replace('.', '')
  const monthYear = new Intl.DateTimeFormat('es-HN', { month: 'short', year: 'numeric' }).format(date)
  return `${weekday} · ${day} · ${monthYear}`
}

function removeDivider(block: HTMLElement) {
  const editor = block.closest<HTMLElement>('.editor-surface')
  if (!editor) return
  if (!window.confirm('¿Eliminar este separador?')) return
  block.remove()
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}

function requestAtomicDelete(noteId: string, selected: SelectedBlock) {
  const block = selected.element
  if (!block.isConnected) return

  if (selected.kind === 'image') {
    sendCommand(noteId, 'image-delete', selected.blockId)
    return
  }
  if (selected.kind === 'code') {
    block.querySelector<HTMLButtonElement>('[data-code-delete="true"]')?.click()
    return
  }
  if (selected.kind === 'check' || selected.kind === 'entry') {
    block.querySelector<HTMLButtonElement>('[data-atomic-block-remove]')?.click()
    return
  }
  if (selected.kind === 'contact') {
    block.querySelector<HTMLButtonElement>('[data-contact-remove="true"]')?.click()
    return
  }
  removeDivider(block)
}

function updateCodeLineNumbers(codeBlock: HTMLElement) {
  const content = codeBlock.querySelector<HTMLElement>('[data-code-content="true"]')
  const numbers = codeBlock.querySelector<HTMLElement>('[data-aurora-code-line-numbers="true"]')
  if (!content || !numbers) return
  const count = Math.max(1, content.innerText.replace(/\n$/, '').split('\n').length)
  numbers.innerHTML = Array.from({ length: count }, (_, index) => String(index + 1)).join('<br>')
}

function decorateCodeBlock(block: HTMLElement) {
  const toolbar = block.querySelector<HTMLElement>('.editor-code-block__toolbar')
  if (!toolbar) return

  if (!toolbar.querySelector('[data-aurora-code-options="true"]')) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'aurora-code-options'
    button.dataset.auroraCodeOptions = 'true'
    button.title = 'Opciones de código'
    button.setAttribute('aria-label', 'Opciones de código')
    button.textContent = '☷'
    toolbar.append(button)
  }

  if (!block.querySelector('[data-aurora-code-line-numbers="true"]')) {
    const numbers = document.createElement('div')
    numbers.className = 'aurora-code-line-numbers'
    numbers.dataset.auroraCodeLineNumbers = 'true'
    numbers.hidden = true
    const content = block.querySelector<HTMLElement>('[data-code-content="true"]')
    content?.before(numbers)
    updateCodeLineNumbers(block)
  }
}

function decorateChecklist(block: HTMLElement) {
  if (block.querySelector('[data-aurora-check-add="true"]')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'aurora-check-add'
  button.dataset.auroraCheckAdd = 'true'
  button.textContent = '＋ Añadir elemento'
  block.append(button)
}

function decorateContact(block: HTMLElement) {
  if (block.querySelector('[data-aurora-contact-tools="true"]')) return

  const tools = document.createElement('div')
  tools.className = 'aurora-contact-tools'
  tools.dataset.auroraContactTools = 'true'

  const emoji = document.createElement('button')
  emoji.type = 'button'
  emoji.dataset.auroraContactEmoji = 'true'
  emoji.title = 'Emoji del avatar'
  emoji.textContent = '☺'

  const edit = document.createElement('button')
  edit.type = 'button'
  edit.dataset.auroraContactEdit = 'true'
  edit.title = 'Editar/bloquear'
  edit.textContent = '✎'

  tools.append(emoji, edit)
  block.append(tools)

  block.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]')
    .forEach((field) => { field.readOnly = true })
  block.dataset.auroraContactEditing = 'false'
}

function decorateDailyEntry(block: HTMLElement) {
  const dateRow = block.querySelector<HTMLElement>('.editor-daily-entry__date-row')
  if (!dateRow) return
  dateRow.dataset.auroraEntryDate = 'true'
  dateRow.setAttribute('role', 'button')
  dateRow.setAttribute('tabindex', '0')
  dateRow.title = 'Cambiar fecha'
}

function decorateEditor(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-code-block="true"]').forEach(decorateCodeBlock)
  root.querySelectorAll<HTMLElement>('[data-checklist-block="true"]').forEach(decorateChecklist)
  root.querySelectorAll<HTMLElement>('[data-contact-block="true"]').forEach(decorateContact)
  root.querySelectorAll<HTMLElement>('[data-daily-entry-block="true"]').forEach(decorateDailyEntry)
}

const EMOJIS = ['😀','😊','😎','❤️','✨','⭐','⚡','🔥','🌈','☕','🎯','💡','📌','📝','💼','💻']

export function AuroraBlockControls({ noteId }: AuroraBlockControlsProps) {
  const selectedRef = useRef<SelectedBlock | null>(null)
  const [selected, setSelected] = useState<SelectedBlock | null>(null)
  const [barPosition, setBarPosition] = useState({ top: 0, left: 0 })
  const [imageSize, setImageSize] = useState(92)
  const [entryBlock, setEntryBlock] = useState<HTMLElement | null>(null)
  const [entryDate, setEntryDate] = useState('')
  const [codeBlock, setCodeBlock] = useState<HTMLElement | null>(null)
  const [codeMenu, setCodeMenu] = useState(false)
  const [codeNums, setCodeNums] = useState(false)
  const [codeWrap, setCodeWrap] = useState(true)
  const [emojiContact, setEmojiContact] = useState<HTMLElement | null>(null)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [imageInfoOpen, setImageInfoOpen] = useState(false)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      `[data-note-sheet-theme="aurora"][data-note-id="${CSS.escape(noteId)}"]`,
    )
    if (!root) return

    decorateEditor(root)
    const observer = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length || record.removedNodes.length)) return
      decorateEditor(root)
    })
    observer.observe(root, { childList: true, subtree: true })

    function positionSelected() {
      const current = selectedRef.current
      if (!current?.element.isConnected) return
      const rect = current.element.getBoundingClientRect()
      const width = current.kind === 'image' ? Math.min(420, window.innerWidth - 16) : 130
      const topCandidate = rect.top - 54
      const top = topCandidate < 64 ? Math.min(window.innerHeight - 60, rect.bottom + 10) : topCandidate
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - 8,
      )
      setBarPosition({ top: Math.round(top), left: Math.round(left) })
    }

    function select(element: HTMLElement) {
      const kind = blockKind(element)
      if (!kind) return
      const next = { blockId: directBlockId(element), kind, element }
      setSelected(next)
      selectedRef.current = next

      if (kind === 'image') {
        const width = Number.parseInt(element.style.width, 10)
        setImageSize(Number.isFinite(width) ? width : 92)
      }
      positionSelected()
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element) || !root.contains(target)) return

      const dailyDate = target.closest<HTMLElement>('[data-aurora-entry-date="true"]')
      if (dailyDate) {
        const block = dailyDate.closest<HTMLElement>('[data-daily-entry-block="true"]')
        if (block) {
          event.preventDefault()
          setEntryBlock(block)
          setEntryDate(block.dataset.dailyEntryDate ?? new Date().toISOString().slice(0, 10))
        }
        return
      }

      const codeOptions = target.closest<HTMLElement>('[data-aurora-code-options="true"]')
      if (codeOptions) {
        const block = codeOptions.closest<HTMLElement>('[data-code-block="true"]')
        if (block) {
          event.preventDefault()
          event.stopPropagation()
          setCodeBlock(block)
          setCodeNums(block.dataset.auroraCodeNums === 'true')
          setCodeWrap(block.dataset.auroraCodeWrap !== 'false')
          setCodeMenu(true)
        }
        return
      }

      const checkAdd = target.closest<HTMLElement>('[data-aurora-check-add="true"]')
      if (checkAdd) {
        const block = checkAdd.closest<HTMLElement>('[data-checklist-block="true"]')
        const last = block?.querySelectorAll<HTMLElement>('[data-checklist-text="true"]')
        const text = last?.item(Math.max(0, last.length - 1)) ?? null
        if (text) {
          text.focus()
          text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        }
        return
      }

      const contactEdit = target.closest<HTMLElement>('[data-aurora-contact-edit="true"]')
      if (contactEdit) {
        const block = contactEdit.closest<HTMLElement>('[data-contact-block="true"]')
        if (!block) return
        const editing = block.dataset.auroraContactEditing !== 'true'
        block.dataset.auroraContactEditing = String(editing)
        block.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]')
          .forEach((field) => { field.readOnly = !editing })
        return
      }

      const contactEmoji = target.closest<HTMLElement>('[data-aurora-contact-emoji="true"]')
      if (contactEmoji) {
        const block = contactEmoji.closest<HTMLElement>('[data-contact-block="true"]')
        if (block) setEmojiContact(block)
        return
      }

      const block = directAtomicFromTarget(root, target)
      if (block) select(block)
      else if (!target.closest('.aurora-imgbar,.aurora-blockbar,.aurora-code-pop,.aurora-entry-pop,.aurora-emoji-pop')) {
        setSelected(null)
      }
    }

    function handleInput(event: Event) {
      const target = event.target
      if (!(target instanceof Element) || !root.contains(target)) return
      const code = target.closest<HTMLElement>('[data-code-content="true"]')
      if (code) {
        const block = code.closest<HTMLElement>('[data-code-block="true"]')
        if (block?.dataset.auroraCodeNums === 'true') updateCodeLineNumbers(block)
      }
    }

    root.addEventListener('click', handleClick, true)
    root.addEventListener('input', handleInput, true)
    window.addEventListener('scroll', positionSelected, { passive: true })
    window.addEventListener('resize', positionSelected)

    return () => {
      observer.disconnect()
      root.removeEventListener('click', handleClick, true)
      root.removeEventListener('input', handleInput, true)
      window.removeEventListener('scroll', positionSelected)
      window.removeEventListener('resize', positionSelected)
    }
  }, [noteId])

  function applyEntryDate(value: string) {
    if (!entryBlock || !value) return
    entryBlock.dataset.dailyEntryDate = value
    const label = entryBlock.querySelector<HTMLElement>('.editor-daily-entry__date')
    if (label) label.textContent = formatDailyDate(value)
    const editor = entryBlock.closest<HTMLElement>('.editor-surface')
    editor?.dispatchEvent(new Event('input', { bubbles: true }))
    setEntryBlock(null)
  }

  function toggleCodeNumbers(enabled: boolean) {
    if (!codeBlock) return
    setCodeNums(enabled)
    codeBlock.dataset.auroraCodeNums = String(enabled)
    const numbers = codeBlock.querySelector<HTMLElement>('[data-aurora-code-line-numbers="true"]')
    if (numbers) numbers.hidden = !enabled
    if (enabled) updateCodeLineNumbers(codeBlock)
  }

  function toggleCodeWrap(enabled: boolean) {
    if (!codeBlock) return
    setCodeWrap(enabled)
    codeBlock.dataset.auroraCodeWrap = String(enabled)
  }

  function clearCode() {
    if (!codeBlock || !window.confirm('¿Vaciar todo el contenido de este bloque de código?')) return
    const content = codeBlock.querySelector<HTMLElement>('[data-code-content="true"]')
    if (!content) return
    content.textContent = ''
    content.dispatchEvent(new Event('input', { bubbles: true }))
    setCodeMenu(false)
  }

  function deleteCode() {
    if (!codeBlock) return
    codeBlock.querySelector<HTMLButtonElement>('[data-code-delete="true"]')?.click()
    setCodeMenu(false)
  }

  const imageSelected = selected?.kind === 'image' ? selected : null
  const imageElement = imageSelected?.element
  const imageLocked = imageElement?.dataset.imageLocked === 'true'
  const imageNamed = imageElement?.dataset.imageShowName !== 'false'
  const imageName = imageElement?.querySelector<HTMLElement>('[data-image-name="true"]')?.textContent ?? 'Imagen'
  const imageDescription = imageElement?.querySelector<HTMLElement>('[data-image-alt="true"]')?.innerText ?? ''

  return (
    <>
      {selected && selected.kind !== 'image' && (
        <div className="aurora-blockbar" style={{ top: barPosition.top, left: barPosition.left }}>
          <span>{labelFor(selected.kind)}</span>
          <button type="button" title="Eliminar este bloque" onClick={() => requestAtomicDelete(noteId, selected)}>
            <OanixIcon name="trash" size={16} />
          </button>
        </div>
      )}

      {imageSelected && (
        <div className={`aurora-imgbar${imageLocked ? '' : ' unlocked'}`} style={{ top: barPosition.top, left: barPosition.left }}>
          <button type="button" title="Abrir imagen" onClick={() => sendCommand(noteId, 'image-open', imageSelected.blockId)}>⛶</button>
          <button type="button" title="Reemplazar desde galería" onClick={() => sendCommand(noteId, 'image-replace', imageSelected.blockId)}>⇧</button>
          <span />
          <button className={imageLocked ? 'on' : ''} type="button" title="Bloquear tamaño/posición" onClick={() => sendCommand(noteId, 'image-lock', imageSelected.blockId)}>
            {imageLocked ? '🔒' : '🔓'}
          </button>
          {!imageLocked && (
            <div className="aurora-ib-size">
              <input
                type="range"
                min="34"
                max="100"
                value={imageSize}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setImageSize(value)
                  sendCommand(noteId, 'image-size', imageSelected.blockId, value)
                }}
              />
            </div>
          )}
          <span />
          <button type="button" title="Izquierda" onClick={() => sendCommand(noteId, 'image-align', imageSelected.blockId, 'left')}>⇤</button>
          <button type="button" title="Centro" onClick={() => sendCommand(noteId, 'image-align', imageSelected.blockId, 'center')}>↔</button>
          <button type="button" title="Derecha" onClick={() => sendCommand(noteId, 'image-align', imageSelected.blockId, 'right')}>⇥</button>
          <span />
          <button type="button" title="Mostrar/ocultar nombre" onClick={() => sendCommand(noteId, 'image-name', imageSelected.blockId)}>
            {imageNamed ? '◉' : '○'}
          </button>
          <button
            type="button"
            title="Editar descripción"
            onClick={() => {
              setDescription(imageDescription)
              setDescriptionOpen(true)
            }}
          >✎</button>
          <button type="button" title="Opciones" onClick={() => setImageInfoOpen(true)}>☷</button>
          <span />
          <button className="danger" type="button" title="Quitar imagen" onClick={() => sendCommand(noteId, 'image-delete', imageSelected.blockId)}>
            <OanixIcon name="trash" size={16} />
          </button>
        </div>
      )}

      {entryBlock && (
        <div className="aurora-entry-pop">
          <label>Fecha de la entrada</label>
          <input type="date" value={entryDate} onChange={(event) => { setEntryDate(event.target.value); applyEntryDate(event.target.value) }} />
        </div>
      )}

      {codeMenu && codeBlock && (
        <div className="aurora-code-pop">
          <label><input type="checkbox" checked={codeNums} onChange={(event) => toggleCodeNumbers(event.target.checked)} /> Números de línea</label>
          <label><input type="checkbox" checked={codeWrap} onChange={(event) => toggleCodeWrap(event.target.checked)} /> Ajustar líneas</label>
          <div />
          <button type="button" onClick={clearCode}>Vaciar bloque</button>
          <button type="button" onClick={deleteCode}>Eliminar bloque</button>
        </div>
      )}

      {emojiContact && (
        <div className="aurora-emoji-pop">
          {EMOJIS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              onClick={() => {
                const avatar = emojiContact.querySelector<HTMLElement>('[data-contact-avatar="true"]')
                if (avatar) avatar.textContent = emoji
                setEmojiContact(null)
              }}
            >{emoji}</button>
          ))}
        </div>
      )}

      {descriptionOpen && imageSelected && (
        <>
          <button className="aurora-block-scrim" type="button" aria-label="Cerrar" onClick={() => setDescriptionOpen(false)} />
          <div className="aurora-block-modal">
            <h3>Descripción de la imagen</h3>
            <textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} />
            <div>
              <button type="button" onClick={() => setDescriptionOpen(false)}>Cancelar</button>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  sendCommand(noteId, 'image-description', imageSelected.blockId, description)
                  setDescriptionOpen(false)
                }}
              >Guardar</button>
            </div>
          </div>
        </>
      )}

      {imageInfoOpen && imageSelected && (
        <>
          <button className="aurora-block-scrim" type="button" aria-label="Cerrar" onClick={() => setImageInfoOpen(false)} />
          <div className="aurora-block-modal">
            <h3>Opciones de la imagen</h3>
            <dl>
              <div><dt>Archivo</dt><dd>{imageName}</dd></div>
              <div><dt>Alineación</dt><dd>{imageElement?.dataset.imageAlignment ?? 'center'}</dd></div>
              <div><dt>Bloqueo</dt><dd>{imageLocked ? 'Sí' : 'No'}</dd></div>
            </dl>
            <div>
              <button type="button" onClick={() => sendCommand(noteId, 'image-open', imageSelected.blockId)}>Abrir</button>
              <button type="button" onClick={() => setImageInfoOpen(false)}>Cerrar</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
