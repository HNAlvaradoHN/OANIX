# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La mecánica móvil validada continúa basada en un `textarea` continuo; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama. Los commits de `main` que la rama no contenía al iniciar este bloque eran documentación, no cambios de runtime.
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

## Hallazgo arquitectónico que bloquea habilitar Imagen visible

La hoja aprobada contiene el cuerpo en un único `textarea`. Un `textarea` no permite renderizar una tarjeta React entre caracteres. Simularlo con overlays, offsets en píxeles o marcadores dentro del texto pondría en riesgo la escritura móvil, el cursor y el rendimiento ya aprobados.

La integración visible de Imagen debe hacerse mediante una transición explícita y segura a tramos de texto estables alrededor de bloques atómicos, reutilizando `EditorBlockSession` / persistencia incremental existente. No usar offsets absolutos persistidos: cualquier edición anterior al elemento los volvería obsoletos.

Antes de habilitar `attachments: true`, la operación de inserción debe garantizar:

1. capturar `selectionStart` del textarea;
2. almacenar primero el asset real mediante el adapter de OANIX;
3. preparar texto anterior + bloque Imagen + texto posterior sin pérdida;
4. persistir el cambio de documento de forma recuperable si una parte falla;
5. solo entonces cambiar la UI al flujo mixto;
6. en fallo, conservar el texto original y limpiar el asset nuevo cuando sea seguro.

## Validación de este bloque

- Se detectó y corrigió un CI rojo causado por guards estructurales antiguos que no reconocían `OanixNotesSheetMobileGuard` ni `publicBase` dinámico para Vercel.
- Se corrigió un test nuevo que arrastraba módulos Vite/TS innecesariamente y otro guard demasiado amplio.
- Un head intermedio (`c78eaee64557aa551e466dea0a8058f3e5fd5179`) pasó OANIX CI y revisión independiente; Android continuaba ejecutándose cuando se añadieron los siguientes commits.
- Los gates deben verificarse de nuevo sobre el head final de cada lote; no heredar el verde de un commit anterior.

## Próximo bloque seguro

1. diseñar la transacción de conversión de texto continuo a `text-segment + elemento + text-segment` reutilizando `EditorBlockSession`, sin migración automática al abrir;
2. cubrir rollback/no-pérdida con pruebas antes de tocar la UI aprobada;
3. conectar selección de Imagen y `paste` nativo solamente después de esa frontera;
4. mantener carga de preview lazy y `objectURL` temporal/revocable;
5. después abordar pegado de texto grande con umbral por bytes + líneas y representación optimizada.
