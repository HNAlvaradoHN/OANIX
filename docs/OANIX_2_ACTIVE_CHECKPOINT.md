# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La escritura normal continúa basada en `textarea` uncontrolled; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama. Al revisar esta ejecución, `main` estaba en `c1687958b5db8595cb6bb1556e4c5dfe76b2f3d2`; el avance respecto de la base histórica del PR seguía siendo documentación de continuidad y no se mezcló.
- No se modificaron vault, cifrado, almacenamiento cifrado, seguridad ni sincronización.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02` ni se mezclaron cambios provenientes de esa rama.

## Imagen — flujo real y repetible activado

La superficie `oanix-notes-sheet-v1` declara `richBlocks: true` y `attachments: true`. Esas capacidades siguen atravesando exclusivamente el contrato genérico de `EditorSurface`; la hoja no importa storage, cifrado, vault ni `attachmentService`.

Implementado de extremo a extremo:

- `EditorSurfaceAttachment` mantiene una frontera opaca de metadata de adjuntos.
- `editorAttachmentAdapter.ts` reutiliza `attachmentService` detrás de esa frontera.
- Al abrir una nota, `OanixNotesSheetSurface` carga bloques + metadata de adjuntos sin solicitar bytes de imágenes.
- `decideOanixMixedDocumentLoad` conserva el editor plain cuando no hay bloques, activa mixed mode solo con bloques soportados y cuerpo plain vacío, y conserva el texto visible ante conflicto recuperable o tipos desconocidos.
- Selector Imagen captura `selectionStart`; paste nativo detecta imágenes desde `clipboardData.items/files`.
- La primera Imagen usa `insertOanixImageAtCursor`: asset real OANIX → transición compensada → activación visual únicamente si el resultado es `committed`.
- La transición inicial produce `texto anterior → Imagen → texto posterior` respetando el offset UTF-16 exacto y fragmentando texto grande dentro de límites válidos.
- Los bloques se confirman mientras el texto plain original todavía existe; solo después se limpia el cuerpo plain.
- Fallos parciales intentan rollback/cleanup y priorizan datos recuperables sobre pérdida silenciosa.

### Segunda y siguientes Imágenes

`OanixNotesSheetSurface` ya conecta `oanixMixedImageInsertion.ts` al renderer mixto.

Garantías activas:

- `OanixMixedDocumentBody` reporta `{blockId, cursorOffset}` del textarea activo y entrega paste de Imagen al host con ese cursor exacto;
- antes de insertar otra Imagen, el host espera cualquier save en curso y fuerza `saveCurrentSnapshot()` si existe texto/título pendiente;
- después del flush recarga `loadBlocks()` y usa esos bloques confirmados, no `mixedBlocks` potencialmente retrasado respecto del DOM uncontrolled;
- `insertOanixImageIntoMixedDocument` divide únicamente el `text-segment` objetivo y confirma `upserts + delete + order` como un único change-set;
- los dos segmentos resultantes reciben IDs nuevos para forzar remount seguro de los textareas uncontrolled;
- si falla el commit de bloques, se intenta limpiar el asset recién creado; si la limpieza falla, la deuda se reporta explícitamente;
- solo después de `committed` se actualizan `mixedBlocks` y metadata de adjuntos en React;
- el foco vuelve al segmento posterior a la Imagen y se conserva el punto de continuidad de escritura;
- el selector desde el panel conserva el último cursor mixto antes de cerrar el teclado; si no existe un cursor previo, usa el último segmento de texto como fallback en vez de inventar un offset global;
- paste y selector usan la misma frontera transaccional de almacenamiento real.

`tests/oanixNotesSheetRepeatedImageHost.test.ts` protege el cableado del host además de las pruebas puras/transaccionales ya existentes en `tests/oanixMixedImageInsertion.test.ts`.

## Renderer mixto y rendimiento de escritura

- `OanixMixedDocumentBody.tsx` renderiza segmentos de texto + Imagen atómica dentro del flujo normal del documento, sin overlays ni offsets absolutos.
- Los segmentos de texto son `textarea` uncontrolled; una tecla no copia el documento entero a estado React.
- Los cambios no cifran/escriben por tecla. `OanixNotesSheetSurface` mantiene un `Map` de upserts pendientes y los entrega por `onRequestBlockSave` en la frontera de autosave por ~3 s de inactividad.
- El cierre en mixed mode fuerza el flush de bloques pendientes antes de delegar el cierre.
- Imagen solicita bytes únicamente al acercarse al viewport mediante `IntersectionObserver`.
- Preview usa `objectURL` temporal y lo revoca al desmontar; no se introdujeron base64 ni data URLs.
- Eliminación de Imagen guarda primero texto pendiente, retira la referencia del documento y después intenta borrar el asset.

## Pegado de texto grande — backing por asset + renderer lazy

`oanixLargePastePolicy.ts` mantiene la clasificación segura para evitar congelar el editor al decidir si un paste debe seguir inline o convertirse en elemento de texto largo.

- Umbral inicial: 128.000 unidades UTF-16, 256.000 bytes UTF-8 estimados o 1.200 líneas.
- Si el tamaño UTF-16 ya supera el límite, la decisión sale en O(1) sin recorrer todo el clipboard.
- Para candidatos pequeños se hace un único recorrido con salida temprana por líneas/bytes.
- No usa `TextEncoder` para clasificar, por lo que no crea un segundo buffer binario del texto pegado.

Base implementada:

- `oanixLongTextElementCodec.ts` define `oanix-long-text-element-v1`.
- El bloque **no persiste el texto grande**: guarda únicamente `attachmentId`, preview acotada, longitud UTF-16 y conteo de líneas cuando ya está disponible sin recorrido adicional.
- Para el guard O(1) por longitud, `lines` puede quedar `null`; no se escanea un clipboard enorme solo para metadata visual.
- `oanixMixedLongTextInsertion.ts` convierte un paste grande en un `File` `text/plain` y lo entrega exclusivamente por `onRequestAttachmentStore`, reutilizando el almacenamiento real de OANIX detrás del contrato de `EditorSurface`.
- Tras almacenar el asset, divide únicamente el `text-segment` objetivo en `texto anterior → Texto largo → texto posterior` y confirma `upserts + delete + order` como un único change-set.
- Si el commit falla, intenta compensar eliminando el asset recién creado; ningún bloque vecino se reescribe.
- `oanixMixedDocumentProjection.ts` reconoce el nodo `long-text`.

Renderer añadido en el head actual:

- `OanixMixedDocumentBody` ya presenta `Texto largo` como elemento atómico con preview limitada; no materializa el payload completo dentro del DOM de la hoja.
- La expansión reutiliza el visor universal de `OanixInsertableElementFrame`.
- `loadAttachmentFile(attachmentId)` vive dentro de `OanixLongTextExpanded`, componente que solo se monta al abrir `Ver completo`; abrir la nota o hacer scroll sobre la tarjeta no solicita el asset pesado.
- El archivo descifrado se expone al visor mediante `objectURL` temporal en un `iframe` sandboxed, evitando convertir todo el archivo a un string React y duplicarlo en estado/DOM.
- El `objectURL` se revoca al desmontar la expansión.
- CSS limita estrictamente la preview y adapta el visor a PC/móvil.
- `tests/oanixMixedDocumentRenderer.test.ts` protege que la carga del asset permanezca dentro del componente expandido y que no aparezca `.text()` en la tarjeta.

**Frontera deliberada:** el paste visible de texto grande todavía no se intercepta desde `OanixNotesSheetSurface` / `OanixMixedDocumentBody`. El renderer ya existe; falta conectar el host transaccional en mixed mode y después la transición equivalente desde modo plain. Hasta entonces no se habilita una ruta parcialmente conectada.

## Guardia móvil

`OanixNotesSheetMobileGuard` usa delegación de eventos sobre `.oanix-notes`, por lo que también protege textareas `.oanix-mixed-document__text` creados dinámicamente al insertar Imagen.

- El seguimiento de caret/visual viewport se aplica tanto al cuerpo plain como a segmentos mixtos.
- El congelado de altura mínima de 280 px se mantiene exclusivamente para el cuerpo plain aprobado; los segmentos mixtos conservan su autosize compacto.
- Esto es cobertura automatizada/estructural; la validación física del teclado Android con documento mixto sigue pendiente.

## Elementos insertables preservados

`OanixInsertableElementFrame` mantiene identidad visual y estructura común para Entrada, Imagen, Archivo, Código, Checklist, Contacto y Separador, con menú contextual adaptativo, preview limitada y expansión/cierre universal. `Texto largo` se añadió como representación técnica específica para paste pesado, sin reemplazar los siete elementos acordados. Imagen es el primer elemento conectado de extremo a extremo al almacenamiento real; los demás controles siguen como armazón hasta implementar sus codecs/acciones sin degradar la escritura continua.

## Validación

Checkpoint anterior `e2403667d99ee13273696c3ee73ad989cc57d393` quedó completamente verde: OANIX CI #2492, OANIX Android #1868 y Qwen Review #834.

Head de código del renderer lazy: `8b20ade5c902af3c06e605290db23f2f2bed31af`.

Al escribir este checkpoint, OANIX CI #2498, OANIX Android #1871 y Qwen Review #837 estaban en ejecución. Por tanto el renderer de Texto largo sigue **IN_PROGRESS** hasta que esos gates terminen; no se afirma aún que el head esté completamente validado.

## Próximo bloque seguro

1. cerrar la validación del renderer lazy y corregir cualquier regresión real;
2. conectar paste grande en mixed mode con `flush → loadBlocks confirmado → transición → actualización UI`, igual que la inserción repetida de Imagen;
3. resolver después el primer paste grande desde modo plain mediante una transición compensada equivalente;
4. completar eliminación/acciones de Texto largo y menú/acciones de Imagen;
5. continuar Entrada, Archivo, Código, Checklist, Contacto y Separador;
6. ejecutar estrés con notas largas y múltiples elementos antes de considerar la hoja lista para promover.

No promover ni fusionar este PR a `main` antes de la revisión visual/funcional correspondiente y de mantener los gates reales aplicables en verde.
