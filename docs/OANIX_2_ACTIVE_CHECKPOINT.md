# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La escritura normal continúa basada en `textarea` uncontrolled; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama. Al revisar esta ejecución, `main` estaba 3 commits por delante de la base histórica del PR y esos 3 commits solo modificaban documentación de continuidad; no se mezclaron.
- No se modificaron vault, cifrado, almacenamiento cifrado, seguridad ni sincronización.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02` ni se mezclaron cambios provenientes de esa rama.

## Imagen — primer flujo real activado

La superficie `oanix-notes-sheet-v1` declara `richBlocks: true` y `attachments: true`. Esas capacidades siguen atravesando exclusivamente el contrato genérico de `EditorSurface`; la hoja no importa storage, cifrado, vault ni `attachmentService`.

Implementado de extremo a extremo para la primera Imagen:

- `EditorSurfaceAttachment` mantiene una frontera opaca de metadata de adjuntos.
- `editorAttachmentAdapter.ts` reutiliza `attachmentService` detrás de esa frontera.
- Al abrir una nota, `OanixNotesSheetSurface` carga bloques + metadata de adjuntos sin solicitar bytes de imágenes.
- `decideOanixMixedDocumentLoad` conserva el editor plain cuando no hay bloques, activa mixed mode solo con bloques soportados y cuerpo plain vacío, y conserva el texto visible ante conflicto recuperable o tipos desconocidos.
- Selector Imagen captura el `selectionStart` del cuerpo antes de abrir el picker.
- Paste nativo detecta una imagen desde `clipboardData.items/files` y usa la misma ruta que el selector.
- Selector y paste llaman `insertOanixImageAtCursor`: asset real OANIX → transición compensada → activación visual únicamente si el resultado es `committed`.
- La transición produce `texto anterior → Imagen → texto posterior` respetando el offset UTF-16 exacto y fragmentando texto grande dentro de límites válidos.
- Los bloques se confirman mientras el texto plain original todavía existe; solo después se limpia el cuerpo plain.
- Fallos parciales intentan rollback/cleanup y priorizan datos recuperables sobre pérdida silenciosa.

## Renderer mixto y rendimiento de escritura

- `OanixMixedDocumentBody.tsx` renderiza segmentos de texto + Imagen atómica dentro del flujo normal del documento, sin overlays ni offsets absolutos.
- Los segmentos de texto son `textarea` uncontrolled; una tecla no copia el documento entero a estado React.
- Los cambios no cifran/escriben por tecla. `OanixNotesSheetSurface` mantiene un `Map` de upserts pendientes y los entrega por `onRequestBlockSave` en la frontera de autosave por ~3 s de inactividad.
- El cierre en mixed mode fuerza el flush de bloques pendientes antes de delegar el cierre.
- Imagen solicita bytes únicamente al acercarse al viewport mediante `IntersectionObserver`.
- Preview usa `objectURL` temporal y lo revoca al desmontar; no se introdujeron base64 ni data URLs.
- Eliminación de Imagen guarda primero texto pendiente, retira la referencia del documento y después intenta borrar el asset.

## Segunda Imagen — transición incremental preparada, todavía no activada en UI

Se añadió `oanixMixedImageInsertion.ts` como frontera pura/transaccional para insertar otra Imagen dentro de un documento que ya está en mixed mode.

Garantías implementadas y cubiertas por pruebas:

- solo divide el `text-segment` que contiene el cursor; bloques e imágenes vecinas conservan orden e identidad;
- usa el offset UTF-16 de `textarea.selectionStart`, incluyendo emoji;
- reemplaza el segmento dividido por dos `text-segment` con IDs nuevos + Imagen en un único change-set (`upserts + delete + order`);
- los IDs nuevos son deliberados: al ser `textarea` uncontrolled, fuerzan remount con los valores ya divididos y evitan conservar un DOM visualmente obsoleto;
- el asset nuevo se almacena antes de crear la referencia y, si el commit de bloques falla, se intenta limpiar inmediatamente;
- si la limpieza falla, el resultado expone la deuda en vez de declarar un rollback inexistente;
- una segunda inserción consecutiva está cubierta por prueba y no reescribe la Imagen anterior ni texto no relacionado.

`OanixMixedDocumentBody` ya puede exponer de forma opcional `{blockId, cursorOffset}` y paste de Imagen por segmento, pero esos hooks permanecen host-gated. **La segunda Imagen todavía no está habilitada desde `OanixNotesSheetSurface`**: falta conectar el host para hacer `flush pendiente → loadBlocks confirmado → transición incremental → actualizar renderer`. No se activó a medias porque el estado React de `mixedBlocks` puede estar detrás del valor uncontrolled mientras hay edición pendiente.

## Pegado de texto grande — política de clasificación preparada

Se añadió `oanixLargePastePolicy.ts` como primera capa segura para evitar congelar el editor al decidir si un paste debe seguir inline o convertirse en elemento de texto largo.

- Umbral inicial: 128.000 unidades UTF-16, 256.000 bytes UTF-8 estimados o 1.200 líneas.
- Si el tamaño UTF-16 ya supera el límite, la decisión sale en O(1) sin recorrer todo el clipboard.
- Para candidatos pequeños se hace un único recorrido con salida temprana por líneas/bytes.
- No usa `TextEncoder` para clasificar, por lo que no crea un segundo buffer binario del texto pegado.
- La estimación cubre ASCII, multibyte, pares surrogate/emoji y surrogate inválido.
- Esta política todavía no intercepta el paste de texto del editor ni persiste un elemento pesado; falta el codec/flujo de inserción correspondiente antes de activarla.

## Guardia móvil

`OanixNotesSheetMobileGuard` usa delegación de eventos sobre `.oanix-notes`, por lo que también protege textareas `.oanix-mixed-document__text` creados dinámicamente al insertar Imagen.

- El seguimiento de caret/visual viewport se aplica tanto al cuerpo plain como a segmentos mixtos.
- El congelado de altura mínima de 280 px se mantiene exclusivamente para el cuerpo plain aprobado; los segmentos mixtos conservan su autosize compacto.
- Esto es cobertura automatizada/estructural; la validación física del teclado Android con documento mixto sigue pendiente.

## Elementos insertables preservados

`OanixInsertableElementFrame` mantiene identidad visual y estructura común para Entrada, Imagen, Archivo, Código, Checklist, Contacto y Separador, con menú contextual adaptativo, preview limitada y expansión/cierre universal. En esta fase solo la primera Imagen está conectada de extremo a extremo al almacenamiento real; los demás controles siguen como armazón hasta implementar sus codecs/acciones sin degradar la escritura continua.

## Validación

Checkpoint previo completamente validado: `254d135be500a6684fcdee95d5f27e0f7f74a43d` — OANIX CI #2444 verde, OANIX Android #1844 verde y Qwen Review #810 verde.

En esta ejecución:

- el primer checkpoint de la transición incremental (`41b3299efdcc187b39448dbcf08732a8fb440202`) pasó OANIX CI #2450 y Qwen Review #813; Android #1847 todavía estaba ejecutándose al continuar los cambios;
- el head actual de código al escribir este documento es `9b7d3d10fe090bd1dc1d0b3246533c49afa3dd9f`;
- OANIX CI #2463 estaba ejecutando las pruebas al registrar este checkpoint; por tanto **este head todavía no se declara completamente validado**.

## Próximo bloque seguro

1. conectar `OanixNotesSheetSurface` a los hooks de cursor/paste mixto con `flush → loadBlocks confirmado → insertOanixImageIntoMixedDocument` y actualizar `mixedBlocks` únicamente tras commit;
2. validar selector + paste de segunda Imagen, cierre/Atrás y teclado/scroll con mixed mode;
3. diseñar codec/elemento de texto largo y conectar `oanixLargePastePolicy` sin bloquear el evento de escritura normal;
4. completar menú/acciones de Imagen sobre el renderer activo según el prototipo aprobado;
5. continuar Entrada, Archivo, Código, Checklist, Contacto y Separador reutilizando orden/identidad de bloques y el armazón visual existente.

No promover ni fusionar este PR a `main` antes de la revisión visual/funcional correspondiente y de mantener los gates reales aplicables en verde.
