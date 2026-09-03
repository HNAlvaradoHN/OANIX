# OANIX #2 — checkpoint activo de la hoja

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

Este checkpoint complementa `docs/OANIX_2_HANDOFF.md`. GitHub y el código real prevalecen si este documento queda desactualizado.

## Preservado

- La hoja OANIX Notes aprobada sigue siendo la superficie activa detrás de `EditorSurface`.
- La escritura normal continúa basada en `textarea` uncontrolled; no se sustituyó por overlays ni por un editor de bloques genérico.
- `main` no se fusionó en esta rama.
- No se modificaron vault, cifrado, almacenamiento cifrado, seguridad ni sincronización.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02` ni se mezclaron cambios provenientes de esa rama.

## Imagen — flujo real activado

La superficie `oanix-notes-sheet-v1` declara ahora `richBlocks: true` y `attachments: true`. Esas capacidades siguen atravesando exclusivamente el contrato genérico de `EditorSurface`; la hoja no importa storage, cifrado, vault ni `attachmentService`.

Implementado de extremo a extremo:

- `EditorSurfaceAttachment` mantiene una frontera opaca de metadata de adjuntos.
- `editorAttachmentAdapter.ts` reutiliza `attachmentService` detrás de esa frontera.
- Al abrir una nota, `OanixNotesSheetSurface` carga bloques + metadata de adjuntos sin solicitar bytes de imágenes.
- `decideOanixMixedDocumentLoad` conserva el editor plain cuando no hay bloques, activa mixed mode solo con bloques soportados y cuerpo plain vacío, y conserva el texto visible ante conflicto recuperable o tipos desconocidos.
- No existe migración automática destructiva al abrir una nota.
- Selector Imagen captura el `selectionStart` del cuerpo antes de abrir el picker.
- Paste nativo detecta una imagen desde `clipboardData.items/files` y usa la misma ruta que el selector.
- Selector y paste llaman `insertOanixImageAtCursor`: asset real OANIX → transición compensada → activación visual únicamente si el resultado es `committed`.
- La transición produce `texto anterior → Imagen → texto posterior` respetando el offset UTF-16 exacto y fragmentando texto grande dentro de límites válidos.
- Los bloques se confirman mientras el texto plain original todavía existe; solo después se limpia el cuerpo plain.
- Fallos parciales intentan rollback/cleanup y priorizan datos recuperables sobre pérdida silenciosa.
- Tras commit confirmado, la hoja cambia a `OanixMixedDocumentBody`, desplaza la Imagen cerca del viewport y enfoca el segmento posterior cuando existe.

## Renderer mixto y rendimiento de escritura

- `OanixMixedDocumentBody.tsx` renderiza segmentos de texto + Imagen atómica dentro del flujo normal del documento, sin overlays ni offsets absolutos.
- Los segmentos de texto son `textarea` uncontrolled; una tecla no copia el documento entero a estado React.
- Los cambios de cada segmento no cifran/escriben por tecla. `OanixNotesSheetSurface` mantiene un `Map` de upserts pendientes y los entrega por `onRequestBlockSave` en la misma frontera de autosave por ~3 s de inactividad.
- El buffer conserva la versión más reciente si el usuario vuelve a escribir mientras existe un save en curso.
- El cierre en mixed mode fuerza el flush de bloques pendientes antes de delegar el cierre.
- Imagen solicita bytes únicamente al acercarse al viewport mediante `IntersectionObserver`.
- Preview usa `objectURL` temporal y lo revoca al desmontar; no se introdujeron base64 ni data URLs.
- Eliminación de Imagen guarda primero cualquier texto pendiente, retira la referencia del documento y luego intenta borrar el asset. Si la limpieza del asset falla, la referencia ya no reaparece en la nota y se reporta el asset huérfano en vez de arriesgar contenido.

## Guardia móvil

`OanixNotesSheetMobileGuard` ya no depende de localizar una única `.oanix-notes__body` al montar.

- Usa delegación de eventos sobre `.oanix-notes`, por lo que también protege textareas `.oanix-mixed-document__text` creados dinámicamente al insertar Imagen.
- El seguimiento de caret/visual viewport se aplica tanto al cuerpo plain como a segmentos mixtos.
- El congelado de altura mínima de 280 px se mantiene exclusivamente para el cuerpo plain aprobado; los segmentos mixtos conservan su autosize compacto y no heredan ese mínimo.
- Esto es cobertura automatizada/estructural; la validación física del teclado Android con documento mixto sigue pendiente.

## Elementos insertables preservados

`OanixInsertableElementFrame` mantiene identidad visual y estructura común para Entrada, Imagen, Archivo, Código, Checklist, Contacto y Separador, con menú contextual adaptativo, preview limitada y expansión/cierre universal. En esta fase solo Imagen está conectada de extremo a extremo al almacenamiento real; los demás controles siguen como armazón hasta implementar sus codecs/acciones sin degradar la escritura continua.

## Validación de esta activación

Head de código: `254d135be500a6684fcdee95d5f27e0f7f74a43d`.

- **OANIX CI #2444: verde** — 495 pruebas, build TypeScript/Vite y auditoría offline completados correctamente.
- **Qwen Independent PR Review #810: verde**.
- **OANIX Android #1844:** build web + Capacitor completados; compilación APK/AAB seguía en curso al registrar este checkpoint.
- Los cuatro fallos iniciales de CI #2432 provenían de guards estructurales que todavía exigían `richBlocks: false`; se actualizaron para exigir la nueva capacidad sin retirar las garantías de aislamiento/serialización.
- `tests/oanixMixedDocumentRenderer.test.ts` cubre además que el guard móvil siga textareas mixtos dinámicos sin imponerles el mínimo del cuerpo plain.
- Un workflow Android automatizado no equivale a prueba física en dispositivo.

## Deuda visible / próximo bloque seguro

1. comprobar cierre/Atrás Android y teclado físico/IME con una nota que ya esté en mixed mode;
2. permitir inserciones adicionales de Imagen dentro de un documento mixto existente mediante una transición incremental, sin reutilizar la transición plain→mixed que deliberadamente rechaza bloques previos;
3. completar menú/acciones de Imagen sobre el renderer activo (reemplazo/presentación si corresponde al prototipo aprobado) sin reescribir el blob;
4. implementar estrategia de pegado de texto grande con umbral por bytes + líneas y procesamiento que no congele el editor;
5. continuar Entrada, Archivo, Código, Checklist, Contacto y Separador reutilizando el mismo orden/identidad de bloques y el armazón visual ya existente.

No promover ni fusionar este PR a `main` antes de la revisión visual/funcional correspondiente y de mantener los gates reales aplicables en verde.
