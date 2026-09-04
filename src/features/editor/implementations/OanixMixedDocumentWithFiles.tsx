import type { EditorSurfaceAttachment, EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import { decodeOanixFileGroupElement, type OanixFileGroupElement } from '../oanixFileGroupElementCodec.ts'
import { OanixFileGroupCard } from './OanixFileGroupCard.tsx'
import { OanixMixedDocumentBody } from './OanixMixedDocumentBody.tsx'

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
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onError?: (message: string) => void
}

type Segment =
  | { type: 'mixed'; key: string; blocks: EditorSurfaceBlock[] }
  | { type: 'file-group'; key: string; block: OanixFileGroupElement }

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
    if (!fileGroup) {
      pending.push(block)
      continue
    }
    flush()
    segments.push({ type: 'file-group', key: fileGroup.id, block: fileGroup })
  }
  flush()
  return segments
}

/**
 * Composition wrapper that keeps the validated image/text renderer untouched while
 * inserting OANIX file-group cards at their ordered block positions.
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
