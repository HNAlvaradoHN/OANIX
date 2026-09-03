# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La mecánica móvil validada continúa basada en un `textarea` continuo; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama. Los commits que `main` lleva por delante son documentación/protocolo de continuidad, no cambios de runtime de la hoja.
- No se modificaron vault, cifrado, almacenamiento cifrado, seguridad ni sincronización.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02` ni se mezclaron cambios provenientes de esa rama.

## Base de Imagen ya implementada

- `EditorSurfaceAttachment`: frontera mínima y opaca para metadata de adjuntos.
- `editorAttachmentProjection.ts`: proyección pura que oculta proveedor, rutas, chunks y detalles de storage.
- `editorAttachmentAdapter.ts`: reutiliza `attachmentService` para listar/guardar/cargar/eliminar adjuntos; no crea persistencia paralela.
- `EditorSurface` puede cargar el adapter dinámicamente solo si la superficie declara `attachments: true`.
- La hoja aprobada mantiene `attachments: false`, por lo que todavía no enumera ni descifra adjuntos al abrir una nota.
- `OanixInsertableElementFrame`: armazón visual común para Entrada, Imagen, Archivo, Código, Checklist, Contacto y Separador.
- Menú contextual adaptativo: abre arriba/abajo según viewport, en móvil usa hoja inferior; cierra fuera, con scroll y Escape.
- Preview limitada y visor expandido con cierre por botón, Escape y backdrop web.
- `planOanixCursorInsertion`: divide el texto exactamente en el offset UTF-16 de `textarea.selectionStart`, sin perder ni duplicar caracteres.
- `oanixImageElementCodec.ts`: referencia ligera de Imagen que persiste solo `attachmentId` dentro del orden de bloques.
- `oanixMixedDocumentPlan.ts`: construye de forma pura `text-segment + Imagen + text-segment`, conserva exactamente el texto antes/después del cursor y fragmenta texto muy grande sin superar `MAX_TEXT_BLOCK_TEXT_LENGTH`.
- `oanixMixedDocumentTransition.ts`: transición compensada plain-text → documento mixto. Guarda bloques mientras el texto original sigue intacto y solo después limpia el cuerpo plain-text.
- Si falla guardar bloques, el texto no se toca y se intenta limpiar el asset recién creado.
- Si falla limpiar el cuerpo plain-text, se intenta retirar el lote de bloques y solo se elimina el asset si ese rollback confirmó éxito.
- Si falla el rollback de bloques, se conserva el asset porque todavía puede existir una referencia. Se prioriza duplicación recuperable sobre pérdida silenciosa.
- La transición rechaza por ahora notas con bloques ricos preexistentes para no mezclar contenido oculto sin una política explícita.

## Renderer mixto implementado en esta ejecución

- `oanixMixedDocumentProjection.ts`: proyección explícita y ordenada de bloques persistidos a nodos `text`, `image` o `unsupported`. Un tipo futuro/desconocido nunca se descarta silenciosamente.
- `OanixMixedDocumentBody.tsx`: primer renderer mixto mínimo y aislado. Renderiza segmentos de texto y tarjetas Imagen dentro del flujo normal del documento, sin overlays ni offsets absolutos.
- Los segmentos de texto son `textarea` uncontrolled por bloque. Una tecla no replica el documento completo a estado React.
- Cada segmento ajusta su altura localmente y conserva hooks de composición IME.
- Imagen usa `OanixInsertableElementFrame` y permanece como bloque atómico entre tramos de escritura.
- Los bytes de Imagen se piden únicamente cuando la tarjeta se acerca al viewport mediante `IntersectionObserver`.
- Se crea un `objectURL` temporal para preview y se revoca al desmontar.
- No se introdujeron base64, data URLs ni materialización preventiva de imágenes al abrir la nota.
- Si un bloque persistido aún no tiene renderer, se presenta como elemento no disponible y su referencia permanece intacta.

## Coordinación de inserción y activación segura

- `oanixImageInsertionCoordinator.ts`: comando único de aplicación para selector y futuro `paste` nativo. Guarda primero el asset real mediante la frontera de OANIX y después ejecuta la transición compensada.
- Si el almacenamiento del asset falla, no toca bloques ni texto.
- Si la transición falla, devuelve el resultado real de rollback/cleanup en vez de ocultar un estado parcial.
- `oanixMixedDocumentLoadPolicy.ts`: política explícita para decidir qué renderer puede abrir una nota.
- Sin bloques persistidos → permanece el editor plain aprobado.
- Bloques soportados + cuerpo plain vacío → puede activarse el renderer mixto.
- Cuerpo plain y bloques simultáneos → `recoverable-conflict`; no se elige silenciosamente una fuente.
- Bloques de tipo todavía desconocido → se bloquea la activación mixta y se conservan intactos.
- No existe migración automática al abrir una nota.

## Portapapeles preparado

- `oanixClipboardImage.ts` extrae una Imagen del payload nativo de `paste` (`clipboardData.items` o `clipboardData.files`).
- No solicita permiso de Clipboard API ni depende de un botón de pegado programático.
- Ignora archivos no-imagen y devuelve el mismo `File` que puede consumir `oanixImageInsertionCoordinator.ts`.
- Selector y paste compartirán por tanto una sola ruta real de persistencia/rollback.

## Estado de activación

El renderer mixto, la política de carga, el coordinador y la frontera de paste existen y están validados como módulos, pero **todavía no se activan desde `OanixNotesSheetSurface`**. La hoja aprobada continúa con `attachments: false` y su `textarea` continuo como autoridad visible.

La siguiente modificación visible debe cargar metadata de bloques/adjuntos sin bytes, aplicar `decideOanixMixedDocumentLoad`, ejecutar inserción solo con `insertOanixImageAtCursor` y cambiar a renderer mixto únicamente después de resultado `committed`.

## Validación

- `tests/oanixMixedDocumentProjection.test.ts`: orden text/Imagen, preservación de desconocidos y segmentos vacíos.
- `tests/oanixMixedDocumentRenderer.test.ts`: texto uncontrolled, carga lazy, ciclo de vida de `objectURL`, ausencia de base64/data URLs y ausencia de overlays.
- `tests/oanixImageInsertionCoordinator.test.ts`: store → bloques → plain snapshot, fallo de store sin mutar la nota y cleanup explícito ante fallo de transición.
- `tests/oanixMixedDocumentLoadPolicy.test.ts`: plain, mixed, conflicto recuperable y tipos desconocidos.
- `tests/oanixClipboardImage.test.ts`: extracción desde DataTransfer items, fallback a files e ignorado de no-imágenes.
- Head de código `70fbd7ccb29e4efa0925cad9a72f8d5040d8e5c7`: **OANIX CI #2422 verde · OANIX Android #1833 verde · Qwen Independent PR Review #799 verde**.
- Un workflow Android automatizado no equivale a prueba física en dispositivo.

## Próximo bloque seguro

1. conectar carga inicial de `loadBlocks` + metadata de adjuntos a `OanixNotesSheetSurface` sin cargar bytes;
2. aplicar `decideOanixMixedDocumentLoad` y mantener fallback plain-text/conflicto recuperable;
3. conectar selector Imagen a `insertOanixImageAtCursor`, capturando `selectionStart` antes de abrir el picker;
4. cambiar al renderer mixto solo después de transición `committed` y conservar foco/scroll cerca del punto de inserción;
5. conectar después `paste` nativo de imágenes al mismo coordinador;
6. verificar cierre/autosave/Atrás Android con documento mixto;
7. después abordar pegado de texto grande con umbral por bytes + líneas y representación optimizada.
