# Qwen V16 — integración aislada

Estado: IN_PROGRESS
Fecha: 2026-09-02
Rama: `exp/qwen-v16-isolated`
PR de validación: `#589` (draft, no merge)

Objetivo: integrar la hoja de notas aprobada por el usuario como superficie experimental separada, de forma que pueda activarse desde OANIX y retirarse/reemplazarse sin tocar seguridad, vault, persistencia cifrada, Home ni sincronización.

## Fuente exacta recuperada

En esta ejecución ya estuvieron disponibles los archivos exactos del prototipo V16 aprobado (`qwen.html` + `app.js`). El bloqueo histórico de `docs/CURRENT_STATE.md` que decía que la fuente no estaba accesible queda resuelto para esta rama. La fuente se usa como especificación visual/funcional, no como runtime de producción: no se copian CDN, blob URLs demo ni persistencia del prototipo.

## Reglas

- No reemplazar ni borrar el editor activo de `main` mientras se valida esta variante.
- Reutilizar `EditorSurface` y el contrato existente; no crear persistencia paralela.
- Mantener el diseño aprobado de la hoja y sus bloques.
- PC + móvil + Día + Noche.
- Los controles flotantes `+` y herramientas viven a nivel de viewport en la esquina superior derecha; no dependen del teclado ni de `visualViewport`.
- No reabrir en este experimento el problema de conversión automática de 50 líneas hasta estabilizar la superficie.
- Imagen/archivo deben usar assets/servicios de OANIX, no blobs demo como almacenamiento permanente.
- Los archivos grandes remotos no deben reconstruirse completos en RAM solo para abrirse desde el editor; su recuperación debe conservar el motor por chunks existente.

## Implementado en esta rama

- `editorSurfaceRegistry` conserva en el catálogo `qwen-sanitized-v1` y registra `replica-v16` como implementación experimental lazy-load.
- Para que los artifacts de esta rama sirvan de revisión directa, **solo en `exp/qwen-v16-isolated`** el default apunta temporalmente a `replica-v16`. `main` no se modificó y el PR continúa draft/no-merge.
- `EditorSurface` resuelve una superficie por ID sin importar implementaciones concretas y filtra richBlocks/attachments por capacidades.
- `ReplicaV16SheetSurface` existe como superficie completamente separada y usa el mismo contrato de título/texto, autosave por ~3 s de inactividad, flush de bloques y cierre seguro.
- La réplica recupera la estructura principal de la página: topbar Bitácora, metadatos, título grande, zona de etiquetas, “HOJA DE EDICIÓN”, papel claro/oscuro, diseños Liso/Renglones/Puntos/Cuadrícula y cola de escritura.
- Los controles `+` y herramientas son `position: fixed` bajo la barra superior, fuera del flujo de la hoja y sin cálculos de teclado.
- El botón global `+` puede insertar Texto, Entrada, Imagen, Archivo, Checklist, Contacto, Separador y Código; los puntos contextuales existentes siguen insertando bloques de texto/rich content entre bloques.
- `QwenRichBlocks` incorpora **Entrada**, **Contacto** y **Separador** con codecs propios y datos pequeños serializables; continúan pasando por `EditorBlockSession` y la persistencia incremental existente.
- Se añadió un contrato genérico `EditorSurfaceAttachment`: la hoja solo ve ID opaco, nombre, MIME, tamaño, fecha y si es remoto. No ve metadata de proveedor, registros cifrados ni rutas de storage.
- `editorAttachmentAdapter.ts` reutiliza `attachmentService` existente para listar, guardar, leer y eliminar adjuntos. El binario se solicita solo por ID y de forma explícita.
- `EditorSurface` carga ese adapter dinámicamente únicamente cuando la superficie declara `attachments: true` y memoiza los callbacks por `noteId`; escribir en la nota no vuelve a listar/descifrar metadata de adjuntos por cada render.
- `ReplicaV16Attachments` conecta ya la UI real de **Imagen** y **Archivo** a esos callbacks, sin persistencia paralela ni blobs/data URLs dentro del contenido de la nota.
- Las imágenes locales cargan el binario solo cuando su tarjeta se acerca al viewport mediante `IntersectionObserver`; el `objectURL` temporal se crea para presentación y se revoca al desmontar.
- El menú de imagen vive en el botón discreto `⋯` de la esquina; la imagen no abre el menú. En esta fase ya ofrece Abrir, Reemplazar, Información y Eliminar, y cierra al tocar fuera o con Escape.
- Reemplazar conserva primero la imagen nueva y solo después intenta quitar la anterior; ante un fallo de borrado se prioriza conservar datos y se informa el estado en lugar de perder ambas referencias.
- Los archivos locales muestran metadata sin leer bytes y solo se materializan al pulsar Abrir/descargar.
- Los adjuntos grandes remotos se muestran como metadata, pero su acción Abrir permanece deshabilitada hasta exponer una frontera genérica de recuperación por streaming. `loadAttachmentFile` no se fuerza a construir un `File` gigante en RAM.
- Se añadió `replicaAttachmentPresentationCodec.ts`: cada imagen podrá tener un bloque pequeño e independiente con `attachmentId`, ancho, alineación, bloqueo, visibilidad del nombre y descripción. El blob no cambia al redimensionar/alinear/editar caption y el codec limita/sanea valores persistidos. Esta capa ya tiene tests propios; la conexión visual al menú queda para el siguiente paso para no introducir un bloque desconocido visible en el flujo actual.
- El editor estable no fue eliminado. No se modificó seguridad, vault, crypto, storage ni sync; solo se reutilizaron contratos/servicios existentes desde un adapter de aplicación.

## Validación registrada

- El lote previo a la UI de adjuntos pasó **OANIX CI**, **OANIX Android** y **Qwen Independent PR Review**.
- Para la UI Imagen/Archivo se añadieron guards específicos que comprueban la frontera genérica, carga lazy, ciclo de vida de `objectURL`, ausencia de data URLs/base64 y que el menú se active desde el control `⋯`, no desde la imagen.
- El head de código de esta fase pasó **OANIX CI** completo (tests, build y auditoría offline) y **Qwen Independent PR Review**. La validación Android del mismo head estaba todavía ejecutándose al actualizar este checkpoint; no debe marcarse verde hasta que termine.
- El nuevo codec de presentación durable tiene cobertura de defaults, clamp de ancho, alineación segura, límites de descripción y rechazo de bloques malformados. Los gates del head que contiene este cambio deben verificarse antes de marcarlo validado.
- La validación física en un dispositivo Android sigue pendiente; un build automatizado no equivale a prueba física.

## Pendiente inmediato

1. Conectar el bloque `replica-attachment-presentation-v1` al render de Imagen sin mostrarlo como bloque desconocido: bloqueo, tamaño, alineación, mostrar/ocultar nombre y descripción deberán actualizar solo esa metadata pequeña y pasar por `EditorBlockSession`.
2. Integrar Imagen/Archivo dentro del orden contextual de bloques. La primera conexión segura actual los presenta después del flujo rich; todavía no tienen posición intercalada entre Entrada/Texto/Checklist/etc.
3. Diseñar una callback genérica de recuperación/exportación por streaming para adjuntos grandes remotos, reutilizando `recoverLargeAttachmentFromDrive` sin materializar el archivo completo en memoria.
4. Después de estabilizar la revisión branch-local, decidir si el selector visible vive en Ajustes/Home o si la réplica reemplaza la superficie vigente; no acoplar esa decisión a los datos de las notas.
5. Reproducir popup de código y formato de texto sin convertir el camino crítico de escritura en estado React por tecla.
6. Someter la superficie a pruebas de notas largas, scroll, composición IME/teclado móvil, muchas imágenes/archivos, PC/móvil y Día/Noche.

No promover esta rama a `main` antes de la revisión visual del usuario y de tener los gates reales verdes.
