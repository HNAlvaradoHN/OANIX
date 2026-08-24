import { useEffect, useLayoutEffect, useRef } from 'react'
import { loadFolders } from '../folders/folderService'
import { loadTags } from '../tags/tagService'
import './workspaceBoot.css'

const BOOT_TIMEOUT_MS = 4500

function notesStillLoading(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('.notes-list .notes-empty strong'))
    .some((node) => node.textContent?.trim() === 'Cargando notas…')
}

function finishBoot() {
  document.documentElement.classList.remove('oanix-workspace-booting')
  document.body.classList.remove('oanix-workspace-booting')
}

function beginBoot() {
  document.documentElement.classList.add('oanix-workspace-booting')
  document.body.classList.add('oanix-workspace-booting')
}

export function WorkspaceBootRuntime() {
  const bootTokenRef = useRef(0)
  const lastShellRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (document.querySelector('.notes-shell')) beginBoot()
  }, [])

  useEffect(() => {
    let disposed = false
    let frame = 0
    let timeout = 0

    const cancelPending = () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }

    const bootShell = async (shell: HTMLElement) => {
      const token = ++bootTokenRef.current
      lastShellRef.current = shell
      beginBoot()
      cancelPending()

      let expectedFolders = 0
      let expectedTags = 0
      try {
        const [folders, tags] = await Promise.all([loadFolders(), loadTags()])
        if (disposed || token !== bootTokenRef.current) return
        expectedFolders = folders.length
        expectedTags = tags.length
      } catch {
        // The underlying workspace owns storage errors. The boot gate must never trap the user.
      }

      const startedAt = performance.now()
      const check = () => {
        if (disposed || token !== bootTokenRef.current) return
        if (!document.body.contains(shell)) {
          finishBoot()
          return
        }

        const allFolder = document.querySelector('.oanix-folder-rail__item--all')
        const folderCount = document.querySelectorAll('.oanix-folder-rail__item[data-oanix-folder-id]').length
        const tagRow = document.querySelector('.oanix-organic-tags')
        const tagCount = document.querySelectorAll('[data-oanix-organic-tag-id]').length
        const background = document.querySelector('.oanix-organic-background')
        const complete = Boolean(
          allFolder
          && folderCount >= expectedFolders
          && tagRow
          && tagCount >= expectedTags
          && background
          && !notesStillLoading()
        )

        if (complete) {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            if (token === bootTokenRef.current) finishBoot()
          }))
          return
        }

        if (performance.now() - startedAt >= BOOT_TIMEOUT_MS) {
          finishBoot()
          return
        }
        frame = window.requestAnimationFrame(check)
      }

      frame = window.requestAnimationFrame(check)
      timeout = window.setTimeout(() => {
        if (token === bootTokenRef.current) finishBoot()
      }, BOOT_TIMEOUT_MS + 250)
    }

    const detectShell = () => {
      const shell = document.querySelector<HTMLElement>('.notes-shell')
      if (!shell) {
        lastShellRef.current = null
        finishBoot()
        return
      }
      if (shell !== lastShellRef.current) void bootShell(shell)
    }

    detectShell()
    const observer = new MutationObserver(detectShell)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      disposed = true
      observer.disconnect()
      cancelPending()
      finishBoot()
    }
  }, [])

  return null
}
