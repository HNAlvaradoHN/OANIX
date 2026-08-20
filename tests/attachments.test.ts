import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ATTACHMENT_BYTES,
  attachmentIcon,
  attachmentKind,
  attachmentTypeLabel,
  formatAttachmentSize,
  normalizeAttachmentName,
  validateAttachmentCandidate,
} from '../src/features/attachments/attachmentTypes.ts'

test('adjuntos Free aceptan formatos generales sin convertir el original', () => {
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

test('el límite inicial protege móviles de archivos completos excesivos en memoria', () => {
  assert.equal(MAX_ATTACHMENT_BYTES, 50 * 1024 * 1024)
  assert.doesNotThrow(() => validateAttachmentCandidate({
    name: 'limite.zip',
    type: 'application/zip',
    size: MAX_ATTACHMENT_BYTES,
  }))
  assert.throws(
    () => validateAttachmentCandidate({
      name: 'demasiado-grande.zip',
      type: 'application/zip',
      size: MAX_ATTACHMENT_BYTES + 1,
    }),
    /50 MB/,
  )
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
})

test('archivos vacíos se rechazan antes de cifrar', () => {
  assert.throws(
    () => validateAttachmentCandidate({ name: 'vacio.txt', type: 'text/plain', size: 0 }),
    /vacío|tamaño no válido/,
  )
})
