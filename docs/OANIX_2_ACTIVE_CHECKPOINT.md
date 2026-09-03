# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La mecánica móvil validada continúa basada en un `textarea` continuo; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama. Los commits que `main` lleva por delante de la rama son documentación/protocolo de continuidad, no cambios de runtime de la hoja.
- No se modificaron vault, cifrado, almacenamiento cifrado, seguridad ni sincronización.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02` ni se mezclaron cambios provenientes de esa rama.

## Implementado antes de este bloque

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
- El plan conserva un segmento de texto editable a ambos lados incluso cuando la Imagen se inserta al principio o al final del documento.
- `oanixMixedDocumentTransition.ts`: coordinador recuperable de la primera transición plain-text → documento mixto. Guarda primero los bloques mientras el texto original sigue intacto y solo después limpia el cuerpo plain-text.
- Si falla guardar bloques, el texto no se toca y se intenta limpiar el asset recién creado.
- Si falla limpiar el cuerpo plain-text, se intenta retirar el lote de bloques y solo se elimina el asset si ese rollback confirmó éxito.
- Si falla el rollback de bloques, se conserva el asset porque todavía puede existir una referencia. Se prioriza duplicación recuperable sobre pérdida silenciosa.
- La transición rechaza por ahora notas con bloques ricos preexistentes: mezclar contenido oculto anterior requiere una política explícita antes de habilitar la UI mixta.

## Implementado en este bloque

- `oanixMixedDocumentProjection.ts`: proyección explícita y ordenada de bloques persistidos a nodos `text`, `image` o `unsupported`. Un tipo futuro/desconocido nunca se descarta silenciosamente.
- `OanixMixedDocumentBody.tsx`: primer renderer mixto mínimo y aislado. Renderiza segmentos de texto y tarjetas Imagen dentro del flujo normal del documento, sin overlays ni offsets absolutos.
- Los segmentos de texto del renderer mixto son `textarea` uncontrolled por bloque. Una tecla no replica el documento completo a estado React.
- Cada segmento ajusta su altura localmente y conserva hooks de composición IME; la hoja aprobada todavía no se cambia automáticamente a este renderer.
- Imagen usa `OanixInsertableElementFrame`, conserva menú/expansión común y permanece como bloque atómico entre tramos de escritura.
- Los bytes de Imagen se piden únicamente cuando la tarjeta se acerca al viewport mediante `IntersectionObserver`; se crea un `objectURL` temporal y se revoca al desmontar.
- No se introdujeron base64, data URLs ni materialización preventiva de imágenes al abrir la nota.
- Si un bloque persistido aún no tiene renderer, se presenta como elemento no disponible y su referencia permanece intacta.
- `oanixImageInsertionCoordinator.ts`: comando único de aplicación para selección de archivo y futuro `paste` nativo. Guarda primero el asset mediante la frontera real de OANIX y delega después a la transición compensada ya existente.
- Si el almacenamiento del asset falla, no toca bloques ni texto. Si la transición falla, expone el resultado real de compensación/cleanup en vez de ocultar un estado parcial.

## Estado de activación

El renderer mixto y el coordinador de Imagen existen y compilan, pero **todavía no se activan desde `OanixNotesSheetSurface`**. La hoja aprobada continúa con `attachments: false` y su `textarea` continuo como autoridad visible.

Esta pausa es deliberada: el siguiente cambio de UI debe conectar carga de bloques + metadata de adjuntos, ejecutar la transición solo en notas compatibles y cambiar a renderer mixto únicamente después de un commit confirmado. No se hará una migración automática al abrir una nota.

## Validación

- `tests/oanixMixedDocumentProjection.test.ts` cubre orden text/Imagen, preservación de bloques desconocidos y segmentos vacíos editables.
- `tests/oanixMixedDocumentRenderer.test.ts` protege los invariantes: texto uncontrolled, carga lazy, ciclo de vida de `objectURL`, ausencia de base64/data URLs y ausencia de overlays/offsets absolutos.
- `tests/oanixImageInsertionCoordinator.test.ts` cubre orden store → bloques → plain snapshot, fallo de almacenamiento sin tocar la nota y exposición del cleanup cuando falla la transición.
- Head de renderer `eeec137d0733f56b94901e1ed4eb2df50749ec0a`: OANIX CI #2408 verde y Qwen Independent PR Review #792 verde; Android #1826 seguía compilando al avanzar al siguiente commit.
- Head de código actual antes de este checkpoint: `b1a3ec29abb4d18f26f1343949eae68ce86b0bfc`. OANIX CI #2412 verde y Qwen Independent PR Review #794 verde. OANIX Android #1828 estaba compilando APK/AAB al actualizar este documento.
- No se considera validación física Android: los workflows automatizados no sustituyen una prueba en dispositivo real.

## Próximo bloque seguro

1. conectar carga inicial de `loadBlocks`/adjuntos a la hoja sin descifrar bytes y mantener fallback plain-text si no hay documento mixto;
2. conectar el selector Imagen al `insertOanixImageAtCursor`, capturando `selectionStart` y cambiando a renderer mixto solo tras resultado `committed`;
3. conectar después `paste` nativo de imágenes al mismo comando, sin crear una segunda ruta de persistencia;
4. garantizar foco/scroll posterior a la inserción y cierre/Atrás Android en el mismo punto de documento;
5. después abordar pegado de texto grande con umbral por bytes + líneas y representación optimizada.
