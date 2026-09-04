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
- **Contacto**: cerrado técnicamente; validación física pendiente.

## ÚLTIMO TRABAJO REALIZADO

Se cerró técnicamente **Contacto** mediante el PR #611, con una tarjeta privada autocontenida que no depende de permisos de la agenda del dispositivo para persistir ni reabrirse.

### Contacto — CIERRE TÉCNICO

Quedó implementado:

- `Añadir contenido -> Contacto` inserta en la posición del cursor desde notas plain y mixed.
- Transición plain -> mixed transaccional con rollback si falla el snapshot plain.
- Inserción mixed guarda primero contenido pendiente y trabaja sobre bloques confirmados.
- Campos persistidos: nombre, teléfono, correo, organización y notas.
- Edición integrada al autosave genérico de bloques.
- Acciones opcionales `Llamar` (`tel:`) y `Correo` (`mailto:`) cuando existen esos datos.
- Eliminación confirmada y durable de la tarjeta completa.
- Reapertura mediante reconocimiento de `contact` como nodo renderizable del documento mixed.
- Estado `contactBusy` integrado al bloqueo visual durante operaciones estructurales.
- Persistencia básica independiente de permisos nativos/contactos del teléfono.
- Se preserva compatibilidad de lectura: valores persistidos existentes no se rechazan por superar el límite de edición del UI.
- No se modificó la lógica interna cerrada de Imágenes, Archivos, Código ni Checklist.

### PR, head y merge

- PR: **#611 — `feat: tarjeta de contacto en OANIX Notes`**.
- Head final validado: `290429be66345047a134fec458ddd685e745b97f`.
- Merge a `main`: `20cb50dddc5f74a82a8db20abebe76b1814b5b2c`.

### Validaciones del head final

- OANIX CI #2616: **success**.
- OANIX Android #1968: **success**.
- Qwen Independent PR Review #907: **success**.

### Validación física pendiente — Contacto

Comprobar manualmente:

- insertar contacto en nota plain y mixed;
- editar nombre, teléfono, correo, organización y notas;
- esperar autosave, cerrar y reabrir confirmando todos los campos;
- probar `Llamar` con teléfono válido;
- probar `Correo` con correo válido;
- dejar teléfono/correo vacíos y confirmar que las acciones opcionales desaparecen;
- eliminar la tarjeta completa y confirmar que no reaparece;
- revisar visualmente móvil y desktop.

No marcar Contacto como validado físicamente hasta confirmación del usuario.

## Cierres técnicos anteriores

### Checklist

- PR #610.
- Head `6828f093884c606110ae5f87330cadc586a2bb94`.
- Merge `e7560ba48a3ca53e93f776fadfa4f71a6afca56c`.
- CI #2613 ✅ · Android #1965 ✅ · Qwen #906 ✅.
- Validación física pendiente: inserción plain/mixed, tareas, Enter, checks, reapertura, autosave, eliminación y responsive.

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

No volver a modificar Imágenes, Archivos, Código, Checklist ni Contacto cerrados salvo regresión funcional real.

## Siguiente bloque

Continuar con **Separador** dentro de `Añadir contenido`.

Antes de modificar código:

1. Auditar codecs, modelos, pruebas y UI existente de separadores en `main`.
2. Mantenerlo como bloque estructural mínimo, reabrible y eliminable, sin introducir almacenamiento adicional innecesario.
3. Inserción plain/mixed con las mismas garantías transaccionales de los bloques cerrados.
4. Render visual responsive y compatible con los temas actuales.
5. PR independiente y CI + Android + Qwen verdes antes de merge.
6. No tocar bloques cerrados salvo el wiring/composición mínimo necesario para reconocer Separador.

## Siguiente acción exacta

Auditar en `main` toda la infraestructura existente de **Separador** y, si no existe un codec reusable, implementar el bloque mínimo completo con inserción, reapertura, eliminación durable y pruebas.
