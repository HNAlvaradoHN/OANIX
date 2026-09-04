import type { EditorSurfaceAttachment, EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import { decodeChecklistBlock, type EditorChecklistBlock } from '../checklistBlockCodec.ts'
import { decodeCodeBlock, type EditorCodeBlock } from '../codeBlockCodec.ts'
import { decodeContactBlock, type EditorContactBlock } from '../contactBlockCodec.ts'
import { decodeDailyEntryBlock, type EditorDailyEntryBlock } from '../dailyEntryBlockCodec.ts'
import { decodeOanixFileGroupElement, type OanixFileGroupElement } from '../oanixFileGroupElementCodec.ts'
import { decodeSeparatorBlock, type EditorSeparatorBlock } from '../separatorBlockCodec.ts'
import { decodeTextBlock } from '../textBlockCodec.ts'
import { OanixChecklistBlockCard } from './OanixChecklistBlockCard.tsx'
import { OanixCodeBlockCard } from './OanixCodeBlockCard.tsx'
import { OanixContactBlockCard } from './OanixContactBlockCard.tsx'
import { OanixDailyEntryBlockCard } from './OanixDailyEntryBlockCard.tsx'
import { OanixFileGroupCard } from './OanixFileGroupCard.tsx'
import { OanixMixedDocumentBody } from './OanixMixedDocumentBody.tsx'
import { OanixSeparatorBlockCard } from './OanixSeparatorBlockCard.tsx'
import { OanixTextLineEditor } from './OanixTextLineEditor.tsx'

interface OanixMixedDocumentWithFilesProps {
  blocks: readonly EditorSurfaceBlock[]
  attachments: readonly EditorSurfaceAttachment[]
  disabled: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onTextBlockChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onTextCursorChange?: (blockId: string, cursorOffset: number) => void
  onPasteImage?: (file: File, blockId: string, cursorOffset: number) => void | Promise<void>
  onRemoveImage: (blockId: string, attachmentId: string) => void | Promise<void>
  onAddFileGroupFiles: (blockId: string) => void
  onRemoveFileGroupFile: (blockId: string, attachmentId: string) => void | Promise<void>
  onRemoveFileGroup: (blockId: string, attachmentIds: readonly string[]) => void | Promise<void>
  onRemoveCodeBlock?: (blockId: string) => void | Promise<void>
  onRemoveChecklistBlock?: (blockId: string) => void | Promise<void>
  onRemoveContactBlock?: (blockId: string) => void | Promise<void>
  onRemoveDailyEntryBlock?: (blockId: string) => void | Promise<void>
  onRemoveSeparatorBlock?: (blockId: string) => void | Promise<void>
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onError?: (message: string) => void
}

type Segment =
  | { type: 'text-lines'; key: string; blocks: EditorSurfaceBlock[] }
  | { type: 'mixed'; key: string; blocks: EditorSurfaceBlock[] }
  | { type: 'file-group'; key: string; block: OanixFileGroupElement }
  | { type: 'code'; key: string; block: EditorCodeBlock }
  | { type: 'checklist'; key: string; block: EditorChecklistBlock }
  | { type: 'contact'; key: string; block: EditorContactBlock }
  | { type: 'daily-entry'; key: string; block: EditorDailyEntryBlock }
  | { type: 'separator'; key: string; block: EditorSeparatorBlock }

function segmentDocument(blocks: readonly EditorSurfaceBlock[]): Segment[] {
  const segments: Segment[] = []
  let pendingText: EditorSurfaceBlock[] = []
  let pendingMixed: EditorSurfaceBlock[] = []
  let runIndex = 0

  const flushText = () => {
    if (pendingText.length === 0) return
    segments.push({ type: 'text-lines', key: `text-${runIndex++}-${pendingText[0].id}`, blocks: pendingText })
    pendingText = []
  }

  const flushMixed = () => {
    if (pendingMixed.length === 0) return
    segments.push({ type: 'mixed', key: `mixed-${runIndex++}-${pendingMixed[0].id}`, blocks: pendingMixed })
    pendingMixed = []
  }

  const flushPending = () => {
    flushText()
    flushMixed()
  }

  for (const block of blocks) {
    const fileGroup = decodeOanixFileGroupElement(block)
    if (fileGroup) {
      flushPending()
      segments.push({ type: 'file-group', key: fileGroup.id, block: fileGroup })
      continue
    }
    const code = decodeCodeBlock(block)
    if (code) {
      flushPending()
      segments.push({ type: 'code', key: code.id, block: code })
      continue
    }
    const checklist = decodeChecklistBlock(block)
    if (checklist) {
      flushPending()
      segments.push({ type: 'checklist', key: checklist.id, block: checklist })
      continue
    }
    const contact = decodeContactBlock(block)
    if (contact) {
      flushPending()
      segments.push({ type: 'contact', key: contact.id, block: contact })
      continue
    }
    const dailyEntry = decodeDailyEntryBlock(block)
    if (dailyEntry) {
      flushPending()
      segments.push({ type: 'daily-entry', key: dailyEntry.id, block: dailyEntry })
      continue
    }
    const separator = decodeSeparatorBlock(block)
    if (separator) {
      flushPending()
      segments.push({ type: 'separator', key: separator.id, block: separator })
      continue
    }

    if (decodeTextBlock(block)) {
      flushMixed()
      pendingText.push(block)
      continue
    }

    flushText()
    pendingMixed.push(block)
  }
  flushPending()
  return segments
}

/**
 * Composition wrapper that keeps atomic OANIX cards isolated while text uses the
 * stable line editor. Images and unsupported mixed elements remain on the existing
 * renderer so their attachment/decryption behavior is unchanged.
 */
export function OanixMixedDocumentWithFiles({
  blocks,
  attachments,
  disabled,
  loadAttachmentFile,
  onTextBlockChange,
  onTextCursorChange,
  onPasteImage,
  onRemoveImage,
  onAddFileGroupFiles,
  onRemoveFileGroupFile,
  onRemoveFileGroup,
  onRemoveCodeBlock,
  onRemoveChecklistBlock,
  onRemoveContactBlock,
  onRemoveDailyEntryBlock,
  onRemoveSeparatorBlock,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
  onError,
}: OanixMixedDocumentWithFilesProps) {
  const segments = segmentDocument(blocks)

  return <div className="oanix-mixed-document-with-files">
    {segments.map((segment) => {
      if (segment.type === 'file-group') {
        return <OanixFileGroupCard
          key={segment.key}
          block={segment.block}
          attachments={attachments}
          disabled={disabled}
          loadAttachmentFile={loadAttachmentFile}
          onAddFiles={() => onAddFileGroupFiles(segment.block.id)}
          onRemoveFile={(attachmentId) => onRemoveFileGroupFile(segment.block.id, attachmentId)}
          onRemoveGroup={() => onRemoveFileGroup(segment.block.id, segment.block.attachmentIds)}
          onError={onError}
        />
      }

      if (segment.type === 'code') {
        return <OanixCodeBlockCard
          key={segment.key}
          block={segment.block}
          disabled={disabled}
          onChange={onTextBlockChange}
          onRemove={onRemoveCodeBlock ? () => onRemoveCodeBlock(segment.block.id) : undefined}
          onActivity={onActivity}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onError={onError}
        />
      }

      if (segment.type === 'checklist') {
        return <OanixChecklistBlockCard
          key={segment.key}
          block={segment.block}
          disabled={disabled}
          onChange={onTextBlockChange}
          onRemove={onRemoveChecklistBlock ? () => onRemoveChecklistBlock(segment.block.id) : undefined}
          onActivity={onActivity}
          onError={onError}
        />
      }

      if (segment.type === 'contact') {
        return <OanixContactBlockCard
          key={segment.key}
          block={segment.block}
          disabled={disabled}
          onChange={onTextBlockChange}
          onRemove={onRemoveContactBlock ? () => onRemoveContactBlock(segment.block.id) : undefined}
          onActivity={onActivity}
          onError={onError}
        />
      }

      if (segment.type === 'daily-entry') {
        return <OanixDailyEntryBlockCard
          key={segment.key}
          block={segment.block}
          disabled={disabled}
          onChange={onTextBlockChange}
          onRemove={onRemoveDailyEntryBlock ? () => onRemoveDailyEntryBlock(segment.block.id) : undefined}
          onActivity={onActivity}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onError={onError}
        />
      }

      if (segment.type === 'separator') {
        return <OanixSeparatorBlockCard
          key={segment.key}
          block={segment.block}
          disabled={disabled}
          onRemove={onRemoveSeparatorBlock ? () => onRemoveSeparatorBlock(segment.block.id) : undefined}
          onError={onError}
        />
      }

      if (segment.type === 'text-lines') {
        return <OanixTextLineEditor
          key={segment.key}
          blocks={segment.blocks}
          disabled={disabled}
          onTextCursorChange={onTextCursorChange}
          onPasteImage={onPasteImage}
          onActivity={onActivity}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onError={onError}
        />
      }

      return <OanixMixedDocumentBody
        key={segment.key}
        blocks={segment.blocks}
        attachments={attachments}
        disabled={disabled}
        loadAttachmentFile={loadAttachmentFile}
        onTextBlockChange={onTextBlockChange}
        onTextCursorChange={onTextCursorChange}
        onPasteImage={onPasteImage}
        onRemoveImage={onRemoveImage}
        onActivity={onActivity}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onError={onError}
      />
    })}
  </div>
}
