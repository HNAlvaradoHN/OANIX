# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La mecánica móvil validada continúa basada en un `textarea` continuo; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama. Los tres commits actuales que `main` lleva por delante de la rama son documentación/protocolo de continuidad, no cambios de runtime de la hoja.
- No se modificaron vault, cifrado, almacenamiento cifrado, seguridad ni sincronización.

## Implementado en este bloque

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

## Hallazgo arquitectónico que bloquea habilitar Imagen visible

La hoja aprobada contiene el cuerpo en un único `textarea`. Un `textarea` no permite renderizar una tarjeta React entre caracteres. Simularlo con overlays, offsets en píxeles o marcadores dentro del texto pondría en riesgo la escritura móvil, el cursor y el rendimiento ya aprobados.

La integración visible de Imagen debe hacerse mediante una transición explícita y segura a tramos de texto estables alrededor de bloques atómicos. La primera frontera de planificación y compensación ya existe, pero todavía falta el renderer mixto de la hoja y su activación controlada. No usar offsets absolutos persistidos: cualquier edición anterior al elemento los volvería obsoletos.

Antes de habilitar `attachments: true`, la operación completa debe garantizar:

1. capturar `selectionStart` del textarea;
2. almacenar primero el asset real mediante el adapter de OANIX;
3. preparar texto anterior + bloque Imagen + texto posterior sin pérdida;
4. ejecutar la transición recuperable ya cubierta por pruebas;
5. solo después cambiar la UI al renderer mixto;
6. mantener una ruta de recuperación si existen bloques previos o si el rollback no puede confirmarse.

## Validación de este bloque

- Se detectó y corrigió un CI rojo previo causado por guards estructurales antiguos que no reconocían `OanixNotesSheetMobileGuard` ni `publicBase` dinámico para Vercel.
- Se corrigió un test nuevo que arrastraba módulos Vite/TS innecesariamente y otro guard demasiado amplio.
- `tests/oanixMixedDocumentPlan.test.ts` cubre cursor UTF-16/emoji, inserción en extremos, preservación exacta y chunking sobre el límite de bloque.
- `tests/oanixMixedDocumentTransition.test.ts` cubre orden de commit, fallo del primer save, compensación cuando falla el plain-text save, conservación del asset si falla rollback y bloqueo seguro ante rich blocks existentes.
- Head de código `de0959b11f62687a5875f09072956c93d10a82d9`: OANIX CI #2396 verde, OANIX Android #1820 verde y Qwen Independent PR Review #786 verde.
- Los gates deben verificarse de nuevo sobre cualquier head posterior; no heredar el verde de un commit anterior.

## Próximo bloque seguro

1. diseñar el renderer mixto mínimo de la hoja manteniendo la sensación de escritura continua y sin overlays;
2. activar la transición solo para notas sin rich blocks previos y mantener fallback plain-text ante cualquier fallo;
3. conectar selección de Imagen y luego `paste` nativo usando almacenamiento real de OANIX;
4. mantener carga de preview lazy y `objectURL` temporal/revocable;
5. después abordar pegado de texto grande con umbral por bytes + líneas y representación optimizada.
