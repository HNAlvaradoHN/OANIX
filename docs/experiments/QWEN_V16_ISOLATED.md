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
- Imagen/archivo deben terminar usando assets/servicios de OANIX, no blobs demo como almacenamiento permanente.

## Implementado en esta rama

- `editorSurfaceRegistry` conserva `qwen-sanitized-v1` como superficie por defecto y registra `replica-v16` como implementación experimental lazy-load.
- `EditorSurface` puede resolver una superficie por ID sin importar implementaciones concretas y continúa filtrando callbacks richBlocks según capacidades.
- `ReplicaV16SheetSurface` existe como superficie completamente separada y usa el mismo contrato de título/texto, autosave por ~3 s de inactividad, flush de bloques y cierre seguro.
- La réplica ya recupera la estructura principal de la página: topbar Bitácora, metadatos, título grande, zona de etiquetas, “HOJA DE EDICIÓN”, papel claro/oscuro, diseños Liso/Renglones/Puntos/Cuadrícula y cola de escritura.
- Los controles `+` y herramientas son `position: fixed` bajo la barra superior, fuera del flujo de la hoja y sin cálculos de teclado.
- El botón global `+` puede insertar al final Texto/Checklist/Código mediante una extensión opcional de `QwenRichBlocks`; los puntos contextuales existentes siguen insertando entre bloques.
- `QwenRichBlocks` ya incorpora **Entrada**, **Contacto** y **Separador** con codecs propios y datos pequeños serializables; continúan pasando por `EditorBlockSession` y la persistencia incremental existente.
- Entrada conserva fecha de creación, título y texto; Contacto conserva nombre + dato de referencia; Separador es un bloque sin payload pesado y muestra línea completa.
- Estos tres tipos no importan storage, crypto, Home, sync ni servicios de reconstrucción. Se añadió una prueba de frontera específica para vigilar esa separación.
- El editor estable no fue eliminado ni reemplazado. No se modificó seguridad, vault, crypto, storage ni sync.

## Validación registrada

- El primer lote del PR draft #589 pasó OANIX CI.
- El build web + Capacitor sync del primer lote finalizó correctamente.
- La validación física Android sigue pendiente; un build automatizado no equivale a prueba física.
- Los cambios nuevos de Entrada/Contacto/Separador requieren volver a pasar CI antes de considerarse validados.

## Pendiente inmediato

1. Conectar una entrada visible y removible en Ajustes/Home para seleccionar `replica-v16`; el registro/host ya soportan la selección, pero Home todavía no la expone.
2. Confirmar CI/build del lote nuevo de Entrada/Contacto/Separador y corregir cualquier gate real que falle.
3. Añadir Entrada/Contacto/Separador también al menú global `+` de la réplica; hoy ya están disponibles en los puntos de inserción contextuales.
4. Diseñar Imagen/Archivo contra referencias de assets OANIX antes de exponer picker; no persistir blobs/URLs efímeras.
5. Reproducir menús de imagen aprobados, popup de código y formato de texto sin convertir el camino crítico de escritura en estado React por tecla.
6. Someter la superficie a pruebas de notas largas, scroll, composición IME/teclado móvil, PC/móvil y Día/Noche.

No promover esta rama a `main` antes de la revisión visual del usuario y de tener los gates reales verdes.
