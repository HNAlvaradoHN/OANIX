import type { EditorSurfaceAttachment, EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import { decodeChecklistBlock, type EditorChecklistBlock } from '../checklistBlockCodec.ts'
import { decodeCodeBlock, type EditorCodeBlock } from '../codeBlockCodec.ts'
import { decodeContactBlock, type EditorContactBlock } from '../contactBlockCodec.ts'
import { decodeDailyEntryBlock, type EditorDailyEntryBlock } from '../dailyEntryBlockCodec.ts'
import { decodeOanixFileGroupElement, type OanixFileGroupElement } from '../oanixFileGroupElementCodec.ts'
import { decodeSeparatorBlock, type EditorSeparatorBlock } from '../separatorBlockCodec.ts'
import { OanixChecklistBlockCard } from './OanixChecklistBlockCard.tsx'
import { OanixCodeBlockCard } from './OanixCodeBlockCard.tsx'
import { OanixContactBlockCard } from './OanixContactBlockCard.tsx'
import { OanixDailyEntryBlockCard } from './OanixDailyEntryBlockCard.tsx'
import { OanixFileGroupCard } from './OanixFileGroupCard.tsx'
import { OanixMixedDocumentBody } from './OanixMixedDocumentBody.tsx'
import { OanixSeparatorBlockCard } from './OanixSeparatorBlockCard.tsx'

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
  | { type: 'mixed'; key: string; blocks: EditorSurfaceBlock[] }
  | { type: 'file-group'; key: string; block: OanixFileGroupElement }
  | { type: 'code'; key: string; block: EditorCodeBlock }
  | { type: 'checklist'; key: string; block: EditorChecklistBlock }
  | { type: 'contact'; key: string; block: EditorContactBlock }
  | { type: 'daily-entry'; key: string; block: EditorDailyEntryBlock }
  | { type: 'separator'; key: string; block: EditorSeparatorBlock }

function segmentDocument(blocks: readonly EditorSurfaceBlock[]): Segment[] {
  const segments: Segment[] = []
  let pending: EditorSurfaceBlock[] = []
  let runIndex = 0

  const flush = () => {
    if (pending.length === 0) return
    segments.push({ type: 'mixed', key: `mixed-${runIndex++}-${pending[0].id}`, blocks: pending })
    pending = []
  }

  for (const block of blocks) {
    const fileGroup = decodeOanixFileGroupElement(block)
    if (fileGroup) {
      flush()
      segments.push({ type: 'file-group', key: fileGroup.id, block: fileGroup })
      continue
    }
    const code = decodeCodeBlock(block)
    if (code) {
      flush()
      segments.push({ type: 'code', key: code.id, block: code })
      continue
    }
    const checklist = decodeChecklistBlock(block)
    if (checklist) {
      flush()
      segments.push({ type: 'checklist', key: checklist.id, block: checklist })
      continue
    }
    const contact = decodeContactBlock(block)
    if (contact) {
      flush()
      segments.push({ type: 'contact', key: contact.id, block: contact })
      continue
    }
    const dailyEntry = decodeDailyEntryBlock(block)
    if (dailyEntry) {
      flush()
      segments.push({ type: 'daily-entry', key: dailyEntry.id, block: dailyEntry })
      continue
    }
    const separator = decodeSeparatorBlock(block)
    if (separator) {
      flush()
      segments.push({ type: 'separator', key: separator.id, block: separator })
      continue
    }
    pending.push(block)
  }
  flush()
  return segments
}

/**
 * Composition wrapper that keeps the validated image/text renderer untouched while
 * inserting OANIX file-group, code, checklist, contact, daily-entry and separator elements at their ordered positions.
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
