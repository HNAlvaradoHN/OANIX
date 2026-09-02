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

## Implementado en esta rama

- `editorSurfaceRegistry` conserva en el catálogo `qwen-sanitized-v1` y registra `replica-v16` como implementación experimental lazy-load.
- Para que los artifacts de esta rama sirvan de revisión directa, **solo en `exp/qwen-v16-isolated`** el default apunta temporalmente a `replica-v16`. `main` no se modificó y el PR continúa draft/no-merge.
- `EditorSurface` resuelve una superficie por ID sin importar implementaciones concretas y filtra richBlocks/attachments por capacidades.
- `ReplicaV16SheetSurface` existe como superficie completamente separada y usa el mismo contrato de título/texto, autosave por ~3 s de inactividad, flush de bloques y cierre seguro.
- La réplica recupera la estructura principal de la página: topbar Bitácora, metadatos, título grande, zona de etiquetas, “HOJA DE EDICIÓN”, papel claro/oscuro, diseños Liso/Renglones/Puntos/Cuadrícula y cola de escritura.
- Los controles `+` y herramientas son `position: fixed` bajo la barra superior, fuera del flujo de la hoja y sin cálculos de teclado.
- El botón global `+` puede insertar Texto, Entrada, Checklist, Contacto, Separador y Código; los puntos contextuales existentes siguen insertando entre bloques.
- `QwenRichBlocks` incorpora **Entrada**, **Contacto** y **Separador** con codecs propios y datos pequeños serializables; continúan pasando por `EditorBlockSession` y la persistencia incremental existente.
- Se añadió un contrato genérico `EditorSurfaceAttachment`: la hoja solo ve ID opaco, nombre, MIME, tamaño, fecha y si es remoto. No ve metadata de proveedor, registros cifrados ni rutas de storage.
- `editorAttachmentAdapter.ts` reutiliza `attachmentService` existente para listar, guardar, leer y eliminar adjuntos. El binario se solicita solo por ID y de forma explícita.
- `EditorSurface` carga ese adapter dinámicamente y únicamente cuando la superficie declara `attachments: true`; el editor estable no entra al camino de adjuntos.
- La réplica ya declara capacidad de attachments, pero la UI Imagen/Archivo todavía no consume esos callbacks: la infraestructura está lista, el bloque visual sigue pendiente.
- El editor estable no fue eliminado. No se modificó seguridad, vault, crypto, storage ni sync; solo se reutilizaron contratos/servicios existentes desde un adapter de aplicación.

## Validación registrada

- El lote actual del PR draft #589 pasó **OANIX CI** completo después de corregir un guard de prueba demasiado amplio; pruebas, build y auditoría del bundle offline quedaron verdes.
- **OANIX Android** pasó para el mismo head: build web, Capacitor sync, generación de debug APK + release AAB y carga de ambos artifacts completaron correctamente.
- **Qwen Independent PR Review** terminó en success para el mismo head.
- La validación física en un dispositivo Android sigue pendiente; un build automatizado no equivale a prueba física.

## Pendiente inmediato

1. Implementar bloques visuales Imagen/Archivo sobre `EditorSurfaceAttachment`, almacenando en richBlocks solo el `attachmentId` + metadata de presentación necesaria; nunca Blob/data URL.
2. Para Imagen: cargar bytes únicamente cuando el bloque entra en uso, crear/revocar `objectURL` en el ciclo de vida visual y recuperar el menú aprobado (abrir, reemplazar, bloqueo, tamaño, alineación, nombre, descripción, info, eliminar).
3. Para Archivo: mostrar metadata sin leer bytes; descargar/abrir solo bajo acción explícita y respetar archivos grandes remotos.
4. Después de estabilizar la revisión branch-local, decidir si el selector visible vive en Ajustes/Home o si la réplica reemplaza la superficie vigente; no acoplar esa decisión a los datos de las notas.
5. Reproducir popup de código y formato de texto sin convertir el camino crítico de escritura en estado React por tecla.
6. Someter la superficie a pruebas de notas largas, scroll, composición IME/teclado móvil, PC/móvil y Día/Noche.

No promover esta rama a `main` antes de la revisión visual del usuario y de tener los gates reales verdes.
