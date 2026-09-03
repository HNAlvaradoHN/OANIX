# OANIX #2 — checkpoint incremental 2026-09-03 07:00

Rama: `agent/oanix-notes-sheet-2026-09-02`  
PR: `#592` (draft, sin merge)

Este checkpoint es incremental y prevalece sobre las secciones desactualizadas de `docs/OANIX_2_ACTIVE_CHECKPOINT.md`. GitHub y el código real siguen siendo la fuente de verdad.

## Estado confirmado antes de editar

- Se revisaron `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATE.md`, `docs/OANIX_2_HANDOFF.md`, `main`, la rama activa y PR #592.
- PR #592 continúa apuntando a `agent/oanix-notes-sheet-2026-09-02`; no hay evidencia de reemplazo explícito.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02` ni se mezclaron cambios de esa rama.
- No se fusionó `main`.
- No se modificaron seguridad, vault, cifrado, persistencia base ni sync.
- El checkpoint anterior estaba retrasado respecto del código: la rama ya contenía trabajo posterior de controles/presentación de Imagen antes de esta ejecución.

## Pegado grande desde nota plain — transición compensada añadida

Se añadió `src/features/editor/oanixPlainLongTextInsertion.ts` con la transición segura para el **primer** paste pesado cuando la nota todavía usa cuerpo plain.

Garantías:

- un paste normal devuelve `not-large-text` y no crea attachment;
- un paste clasificado como pesado se almacena primero como `text/plain` mediante la frontera de attachments existente;
- el contenido pesado nunca se copia dentro del bloque: el bloque conserva `attachmentId`, preview limitada y metadata barata;
- el texto plain se divide exactamente en el cursor y los tramos circundantes se fragmentan según `MAX_TEXT_BLOCK_TEXT_LENGTH`;
- si ya existen bloques ocultos, la migración se rechaza y se intenta limpiar el attachment nuevo;
- el conjunto mixto se persiste **antes** de limpiar el cuerpo plain, de modo que el texto original sigue siendo autoridad mientras el staging no esté confirmado;
- si falla el guardado de bloques se compensa eliminando el attachment;
- si falla limpiar el cuerpo plain, primero se intenta retirar los bloques staged y solo se elimina el attachment cuando ese rollback quedó confirmado;
- si el rollback de bloques no puede confirmarse, el attachment se conserva porque todavía puede estar referenciado. Se prefiere duplicación recuperable a pérdida silenciosa.

`tests/oanixPlainLongTextInsertion.test.ts` cubre cursor, chunking, paste normal, orden `store → blocks → plain`, conflicto con bloques existentes, rollback y preservación del asset cuando el rollback falla.

**Aún no se intercepta el paste visible en `OanixNotesSheetSurface`.** La transición está aislada y probada; el siguiente cableado debe decidir plain/mixed, hacer flush cuando corresponda y actualizar UI únicamente después de `committed`.

## Regresión real encontrada y corregida

El primer CI del nuevo bloque (`da80298ea0c232d43bbceea02173f6323893a5f4`, OANIX CI #2513) pasó las 525 pruebas pero falló en TypeScript durante build.

Causa real: los commits recientes de presentación de Imagen hicieron obligatorios `widthPercent` y `sizeLocked` en `OanixImageElement`, mientras `oanixMixedDocumentPlan.ts` y `oanixMixedImageInsertion.ts` todavía construían imágenes con el contrato anterior `{id, kind, attachmentId}`.

Corrección:

- ambos planificadores usan ahora `OANIX_IMAGE_ELEMENT_KIND`;
- ambos inicializan `widthPercent` con `DEFAULT_OANIX_IMAGE_WIDTH_PERCENT`;
- ambos inicializan `sizeLocked: false`;
- no se hardcodeó un ancho alternativo ni se relajó el tipo para ocultar el error.

Head de código corregido: `3f29a2713ec669c09c37f581a2e73102a0a4e129`.

Validación observada en ese head al registrar este checkpoint:

- OANIX CI #2517: **success** (tests + build + auditoría offline).
- Qwen Independent PR Review #847: **success**.
- OANIX Android #1881: **in progress**; no se declara verde hasta que termine.

## Próximo bloque seguro

1. cerrar Android #1881 y corregir cualquier fallo real si aparece;
2. conectar paste grande en `OanixNotesSheetSurface` sin tocar el comportamiento normal del textarea: normal queda nativo; pesado usa la transición plain o mixed según el documento;
3. en mixed mode, mantener `flush → loadBlocks confirmado → insertOanixLongTextIntoMixedDocument → actualizar React solo tras committed`;
4. en plain mode, usar `insertOanixLongTextIntoPlainDocument` y activar mixed renderer solo tras committed;
5. añadir eliminación segura del elemento Texto largo (referencia primero, asset después) y continuar luego con Archivo/Código/Checklist/Contacto/Separador.

No promover ni fusionar PR #592 a `main` sin la revisión visual/funcional correspondiente y los gates aplicables confirmados.
