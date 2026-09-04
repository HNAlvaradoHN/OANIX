# OANIX #3 — checkpoint activo

Fecha: 2026-09-04

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.
- **Imágenes**: cerrado y validado físicamente.
- **Archivos**: cerrado técnicamente; validación física pendiente.
- **Código**: cerrado técnicamente; validación física pendiente.
- **Checklist**: cerrado técnicamente; validación física pendiente.

## ÚLTIMO TRABAJO REALIZADO

Se cerró técnicamente **Checklist** mediante el PR #610, reutilizando `checklistBlockCodec` y manteniendo toda persistencia detrás de los callbacks genéricos del editor.

### Checklist — CIERRE TÉCNICO

Quedó implementado:

- `Añadir contenido -> Checklist` inserta en la posición del cursor desde notas plain y mixed.
- Transición plain -> mixed transaccional con rollback si falla el snapshot plain.
- Inserción mixed guarda primero contenido pendiente y trabaja sobre bloques confirmados.
- Cada checklist inicia con una tarea editable.
- Marcar/desmarcar tareas.
- Editar texto de cada tarea.
- Añadir tareas con botón o con `Enter`.
- Quitar tareas individuales.
- Checklist vacía reutilizable con CTA para volver a añadir.
- Límite existente respetado: 200 tareas y 2,000 caracteres por tarea.
- Progreso completadas/total en el encabezado.
- Eliminación confirmada y durable de la checklist completa.
- Cambios integrados al autosave genérico de bloques.
- Reapertura mediante reconocimiento de `checklist` como nodo renderizable del documento mixed.
- Estado `checklistBusy` integrado al bloqueo visual durante operaciones estructurales.
- No se modificó la lógica interna cerrada de Imágenes, Archivos ni Código.

### PR, head y merge

- PR: **#610 — `feat: checklist interactiva en OANIX Notes`**.
- Head final validado: `6828f093884c606110ae5f87330cadc586a2bb94`.
- Merge a `main`: `e7560ba48a3ca53e93f776fadfa4f71a6afca56c`.

### Validaciones del head final

- OANIX CI #2613: **success**.
- OANIX Android #1965: **success**.
- Qwen Independent PR Review #906: **success**.
- Validación adicional previa al PR: `npm test` **success** y `npm run build` **success**.

### Validación física pendiente — Checklist

Comprobar manualmente:

- insertar checklist en nota plain y mixed;
- escribir varias tareas;
- añadir con botón y con Enter;
- marcar/desmarcar;
- quitar tareas individuales;
- dejarla vacía y volver a añadir;
- cerrar y reabrir confirmando texto y estados checked;
- editar una checklist existente, esperar autosave y reabrir;
- eliminar la checklist completa y confirmar que no reaparece;
- revisar visualmente móvil y desktop.

No marcar Checklist como validado físicamente hasta confirmación del usuario.

## Cierres técnicos anteriores

### Código

- PR #609.
- Head `76a1a454bd6cb7f813036ef9017ee13da226df62`.
- Merge `51d3e012f84ad28842989f8f9b80a2b4553d5892`.
- CI #2610 ✅ · Android #1962 ✅ · Qwen #905 ✅.
- Validación física pendiente: inserción plain/mixed, edición, lenguaje, copiar, reapertura, autosave, eliminación y responsive.

### Archivos

- PR #608.
- Head `4c1c3edc79d1a7c9efbfc535bff99749e08e74d3`.
- Merge `930c2526c614c1b2dcc9703b43db330c6a996131`.
- CI #2607 ✅ · Android #1959 ✅ · Qwen #904 ✅.
- Validación física pendiente: tarjetas, múltiples archivos, colores, reapertura, abrir/guardar, quitar y menú flotante.

### Imágenes — CERRADO Y VALIDADO FÍSICAMENTE

- PR #606 merge `27f1ec72be19988ffe899a3ecbff7cfc0386b17b`.
- PR #607 head `19bfc9cfdb3ac8f1a2cc8852669de96fddab83d6`.
- PR #607 merge `153948cd77f14ad5f42c08e48717d158bbb97c8a`.
- CI #2598 ✅ · Android #1950 ✅ · Qwen #898 ✅.

No volver a modificar Imágenes, Archivos, Código ni Checklist cerrados salvo regresión funcional real.

## Siguiente bloque

Continuar con **Contacto** dentro de `Añadir contenido`.

Antes de modificar código:

1. Auditar codecs, modelos, pruebas y UI existente de contactos en `main`.
2. Reutilizar infraestructura válida y mantener persistencia detrás del contrato genérico del editor.
3. Definir un bloque autocontenido que pueda crearse, editarse, eliminarse y reabrirse sin depender de permisos del teléfono para su persistencia básica.
4. Si existe integración opcional con contactos del dispositivo, aislarla de la representación persistida y manejar ausencia de permisos sin romper el bloque.
5. PR independiente y CI + Android + Qwen verdes antes de merge.
6. No iniciar Separador hasta cerrar Contacto técnicamente.

## Siguiente acción exacta

Auditar en `main` toda la infraestructura existente de **Contacto** y determinar la mínima integración completa con la superficie OANIX actual antes de escribir el nuevo bloque.
