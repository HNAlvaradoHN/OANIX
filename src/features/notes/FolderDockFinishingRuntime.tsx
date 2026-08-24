import { useEffect } from 'react'
import './folderDockFinishing.css'

function folderNameFromItem(item: HTMLElement): string {
  if (item.classList.contains('oanix-folder-rail__item--all')) return 'Todas'

  const title = item.title.trim()
  if (title && title !== 'Arrastra para cambiar de lugar') return title

  const ariaLabel = item.getAttribute('aria-label')?.trim() ?? ''
  const prefixes = ['Seleccionar carpeta ', 'Mover carpeta ']
  for (const prefix of prefixes) {
    if (ariaLabel.startsWith(prefix)) return ariaLabel.slice(prefix.length).trim()
  }

  return ''
}

export function FolderDockFinishingRuntime() {
  useEffect(() => {
    let frame: number | null = null

    const decorate = () => {
      frame = null
      document
        .querySelectorAll<HTMLElement>('.oanix-folder-rail__item:not(.oanix-folder-rail__item--add)')
        .forEach((item) => {
          const name = folderNameFromItem(item)
          if (!name) return

          if (item.dataset.oanixOrganicFolderName !== name) {
            item.dataset.oanixOrganicFolderName = name
          }

          let label = item.querySelector<HTMLElement>(':scope > .oanix-folder-card__name')
          if (!label) {
            label = document.createElement('span')
            label.className = 'oanix-folder-card__name'
            label.setAttribute('aria-hidden', 'true')
            item.appendChild(label)
          }

          if (label.textContent !== name) label.textContent = name
        })
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(decorate)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label'],
    })

    schedule()

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
