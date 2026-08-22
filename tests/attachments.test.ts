import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_LOCAL_ATTACHMENT_BYTES,
  attachmentIcon,
  attachmentKind,
  attachmentTypeLabel,
  formatAttachmentSize,
  isAttachmentMetadata,
  normalizeAttachmentName,
  validateAttachmentCandidate,
} from '../src/features/attachments/attachmentTypes.ts'

test('adjuntos aceptan formatos generales sin convertir el original', () => {
  const samples = [
    { name: 'Contrato.pdf', type: 'application/pdf', size: 2_400_000, kind: 'pdf' },
    { name: 'Documento.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 420_000, kind: 'document' },
    { name: 'Datos.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 750_000, kind: 'spreadsheet' },
    { name: 'Proyecto.zip', type: 'application/zip', size: 3_000_000, kind: 'archive' },
    { name: 'Aplicacion.apk', type: 'application/vnd.android.package-archive', size: 12_000_000, kind: 'apk' },
    { name: 'Video.mp4', type: 'video/mp4', size: 8_000_000, kind: 'video' },
  ] as const

  for (const sample of samples) {
    const validated = validateAttachmentCandidate(sample)
    assert.equal(validated.name, sample.name)
    assert.equal(validated.byteLength, sample.size)
    assert.equal(attachmentKind(validated), sample.kind)
  }
})

test('adjuntos locales conservan 50 MiB y el modelo admite archivos grandes sin cargarlos completos', () => {
  assert.equal(MAX_LOCAL_ATTACHMENT_BYTES, 50 * 1024 * 1024)
  assert.ok(MAX_ATTACHMENT_BYTES > MAX_LOCAL_ATTACHMENT_BYTES)
  assert.doesNotThrow(() => validateAttachmentCandidate({
    name: 'grande.zip',
    type: 'application/zip',
    size: 1024 * 1024 * 1024,
  }))
  assert.throws(
    () => validateAttachmentCandidate({
      name: 'fuera-del-protocolo.zip',
      type: 'application/zip',
      size: MAX_ATTACHMENT_BYTES + 1,
    }),
    /límite de seguridad/,
  )
})

test('metadatos remotos grandes extienden el índice v1 sin invalidar adjuntos locales antiguos', () => {
  assert.equal(isAttachmentMetadata({
    attachmentId: 'local-1',
    name: 'local.pdf',
    mimeType: 'application/pdf',
    byteLength: 10 * 1024 * 1024,
    createdAt: '2026-08-21T00:00:00.000Z',
  }), true)

  assert.equal(isAttachmentMetadata({
    attachmentId: 'remote-1',
    name: 'video.mp4',
    mimeType: 'video/mp4',
    byteLength: 120 * 1024 * 1024,
    createdAt: '2026-08-21T00:00:00.000Z',
    storage: {
      mode: 'remote-large-v1',
      providerId: 'google-drive-appdata',
      objectId: 'note-file-12345678',
      objectRef: 'drive-file-id',
      ciphertextByteLength: 120 * 1024 * 1024 + 16,
      chunkBytes: 8 * 1024 * 1024 - 16,
      chunks: [{
        index: 0,
        plaintextOffset: 0,
        plaintextLength: 120 * 1024 * 1024,
        ciphertextByteLength: 120 * 1024 * 1024 + 16,
        iv: 'abcdefghijklmnop',
        sha256: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN_1234',
      }],
    },
  }), true)
})

test('nombres de archivo se normalizan sin permitir rutas embebidas', () => {
  assert.equal(normalizeAttachmentName('  carpeta\\sub/cosa.pdf  '), 'carpeta_sub_cosa.pdf')
  assert.equal(normalizeAttachmentName('   '), 'Archivo')
})

test('clasificación y metadatos visibles son ligeros', () => {
  const apk = { name: 'base.apk', mimeType: 'application/octet-stream' }
  assert.equal(attachmentKind(apk), 'apk')
  assert.equal(attachmentIcon(apk), '📱')
  assert.equal(attachmentTypeLabel(apk), 'APK')
  assert.equal(formatAttachmentSize(2048), '2 KB')
  assert.equal(formatAttachmentSize(2 * 1024 * 1024), '2.0 MB')
  assert.equal(formatAttachmentSize(2 * 1024 * 1024 * 1024), '2.00 GB')
})

test('archivos vacíos se rechazan antes de cifrar', () => {
  assert.throws(
    () => validateAttachmentCandidate({ name: 'vacio.txt', type: 'text/plain', size: 0 }),
    /vacío|tamaño no válido/,
  )
})
