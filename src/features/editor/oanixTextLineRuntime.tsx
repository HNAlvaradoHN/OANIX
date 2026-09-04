import { createContext, useContext } from 'react'
import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet } from './editorSurfaceContract.ts'

export interface OanixTextLineRuntimeValue {
  noteId: string
  loadBlocks?: () => Promise<EditorSurfaceBlock[]>
  saveBlockChanges?: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
}

const OanixTextLineRuntimeContext = createContext<OanixTextLineRuntimeValue | null>(null)

export const OanixTextLineRuntimeProvider = OanixTextLineRuntimeContext.Provider

export function useOanixTextLineRuntime() {
  return useContext(OanixTextLineRuntimeContext)
}

type FlushTextLines = () => Promise<boolean>

const flushersByNote = new Map<string, Set<FlushTextLines>>()

export function registerOanixTextLineFlusher(noteId: string, flush: FlushTextLines) {
  const existing = flushersByNote.get(noteId)
  const bucket = existing ?? new Set<FlushTextLines>()
  bucket.add(flush)
  if (!existing) flushersByNote.set(noteId, bucket)

  return () => {
    const current = flushersByNote.get(noteId)
    if (!current) return
    current.delete(flush)
    if (current.size === 0) flushersByNote.delete(noteId)
  }
}

export async function flushOanixTextLineEditors(noteId: string) {
  const bucket = flushersByNote.get(noteId)
  if (!bucket || bucket.size === 0) return true
  const results = await Promise.all([...bucket].map(async (flush) => {
    try {
      return await flush()
    } catch {
      return false
    }
  }))
  return results.every(Boolean)
}

export interface OanixTextLineSelection {
  noteId: string
  blockId: string
  selectionStart: number
  selectionEnd: number
}

let lastTextLineSelection: OanixTextLineSelection | null = null

export function rememberOanixTextLineSelection(selection: OanixTextLineSelection) {
  lastTextLineSelection = selection
}

export function readOanixTextLineSelection(noteId: string) {
  return lastTextLineSelection?.noteId === noteId ? lastTextLineSelection : null
}

export function clearOanixTextLineSelection(noteId: string, blockId?: string) {
  if (!lastTextLineSelection || lastTextLineSelection.noteId !== noteId) return
  if (blockId && lastTextLineSelection.blockId !== blockId) return
  lastTextLineSelection = null
}
