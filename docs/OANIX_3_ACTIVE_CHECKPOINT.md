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
- **Contacto**: cerrado técnicamente con los ajustes más recientes; validación física pendiente.
- **Separador**: cerrado técnicamente; validación física pendiente.

## AJUSTE MÁS RECIENTE — CONTACTO

Se cerró técnicamente la corrección solicitada durante la validación física de **Contacto**.

Quedó implementado:

- Los contactos nuevos nacen con el nombre vacío; no se precarga `Nuevo contacto`.
- Las tarjetas antiguas que conserven exactamente el valor legado `Nuevo contacto` se muestran con el nombre vacío para poder escribir directamente sin borrar texto previo.
- El teléfono acepta y persiste solo dígitos, sin prefijo fijo `+504`, para no asumir país.
- El correo solo se persiste cuando tiene formato válido; si es inválido al salir del campo, se descarta silenciosamente.
- Se eliminó el mensaje rojo, `aria-invalid` y el aviso visual intrusivo del correo inválido.
- El botón `⛶` de Contacto pertenece únicamente a **Notas**.
- La pantalla completa de Notas respeta el candado: lectura cuando está bloqueado y edición cuando está desbloqueado.
- No se fuerza una migración destructiva de datos históricos; se conserva compatibilidad de lectura con contactos antiguos.

### PRs, heads y merges

- PR **#615 — `fix: valida campos y concentra pantalla completa en notas de contacto`**.
  - Head final: `aadcc40c4805f56cc18991eea9a7f0d05e1ba3ed`.
  - Merge squash: `2246a1f2142d874c67f090620e9c443915b50c42`.
  - OANIX CI #2631: **success**.
  - OANIX Android #1983: **success**.
  - Qwen Independent PR Review #912: **success**.
- PR **#616 — `fix: limpia nombre legado y alerta visual de correo en contacto`**.
  - Head final: `d07c6c2cd0f3e1fcf09b9de18ae10e501e3a6176`.
  - Merge squash: `73775614e7103cf27ec054790811dc851687cb11`.
  - OANIX CI #2633: **success**.
  - OANIX Android #1985: **success**.
  - Qwen Independent PR Review #913: **success**.

### Validación física pendiente — Contacto

Comprobar manualmente en Android:

- crear un contacto y confirmar que el nombre aparece vacío, sin `Nuevo contacto`;
- abrir una tarjeta antigua con `Nuevo contacto` y confirmar que se puede escribir el nombre directamente;
- escribir o pegar teléfono con letras/símbolos y confirmar que solo quedan dígitos;
- confirmar que no aparece `+504` por defecto;
- escribir un correo válido y comprobar que se conserva;
- escribir un correo inválido, salir del campo y confirmar que se descarta sin mensaje rojo ni aviso visual;
- confirmar que `⛶` aparece únicamente en Notas y que la pantalla completa respeta el estado del candado.

No marcar Contacto como validado físicamente hasta confirmación del usuario.

## CIERRE NOCTURNO FINAL

- `main` auditado al cierre: `bccd4e08c4e3676df343f38f817c841b05958328` antes de esta actualización documental.
- La secuencia técnica nocturna quedó completa: **Archivos -> Código -> Checklist -> Contacto -> Separador**.
- PRs cerrados y fusionados: **#608, #609, #610, #611 y #612**.
- Todos los heads finales de esos cinco PRs tienen **OANIX CI + OANIX Android + Qwen Independent PR Review en success**.
- No se inició ningún bloque nuevo después de Separador.
- Los únicos PRs abiertos detectados al cierre son experimentos draft antiguos (#589, #590 y #591); no forman parte del trabajo nocturno y no deben fusionarse durante esta revisión.
- **Punto exacto para comenzar la revisión:** partir del `main` actual y validar físicamente **Archivos** primero. No revisar ramas de feature nocturnas como fuente principal.

## ÚLTIMO TRABAJO REALIZADO ANTES DE LOS AJUSTES DE CONTACTO

### Lectura en pantalla completa de Código y Contacto — CIERRE TÉCNICO

Se cerró técnicamente el ajuste solicitado durante la revisión física para poder leer con comodidad el contenido de **Código** y **Contacto** en pantalla completa.

> Nota de continuidad: la descripción original de Contacto de esta sección quedó **supersedida** por los PR #615 y #616. Actualmente el `⛶` de Contacto abre únicamente **Notas**, y las notas respetan el estado del candado.

Quedó implementado originalmente:

- **Código**: botón `⛶` en la cabecera para abrir un lector de pantalla completa.
- El lector de Código conserva tema oscuro legible, muestra el lenguaje, permite scroll independiente, copiar y cerrar por botón, fondo o `Escape`.
- Ambos lectores bloquean temporalmente el scroll del fondo y usan `100dvh` en móvil con consideración de safe areas.
- Se ampliaron las pruebas estáticas de revisión física para cubrir la existencia de ambos lectores sin cambiar la persistencia existente.

### PR, head y merge

- PR: **#614 — `feat: lectura en pantalla completa para código y contacto`**.
- Head final validado: `cbf29ac54c0582827a4806c302ceede587f3ac3d`.
- Merge squash a `main`: `f86ea972bc20a0300416362c265fe734ab8e1cc3`.

### Validaciones del head final

- OANIX CI #2626: **success**.
- OANIX Android #1978: **success**.
- Qwen Independent PR Review #911: **success**.

## Trabajo técnico anterior

Se cerró técnicamente **Separador** mediante el PR #612. Con este merge quedó completada la secuencia técnica solicitada de bloques `Archivos -> Código -> Checklist -> Contacto -> Separador` sin dejar ningún bloque de esa secuencia a medias.

### Separador — CIERRE TÉCNICO

Quedó implementado:

- `Añadir contenido -> Separador` inserta en la posición del cursor desde notas plain y mixed.
- Codec mínimo `separatorBlockCodec`: el bloque persiste solo `id`, `kind = separator` y `data: {}`; no guarda contenido de usuario ni assets.
- Transición plain -> mixed transaccional con rollback si falla el snapshot plain.
- Inserción mixed guarda primero contenido pendiente y trabaja sobre bloques confirmados.
- Render visual a ancho completo, responsive y compatible con los temas actuales.
- Botón de eliminación con confirmación.
- Eliminación durable: actualiza `deletes` y el orden persistido del documento antes de actualizar la UI.
- Reapertura mediante reconocimiento de `separator` como nodo renderizable del documento mixed.
- Estado `separatorBusy` integrado al cierre, bloqueo visual y estado de guardado.
- No se modificó la lógica interna cerrada de Imágenes, Archivos, Código, Checklist ni Contacto; solo wiring/composición mínimo.
- La transformación puntual de `OanixNotesSheetSurface.tsx` se aplicó con verificaciones exactas y los artefactos temporales usados para esa transformación fueron eliminados antes del PR; no aparecen en el diff final.

### PR, head y merge

- PR: **#612 — `feat: separador estructural en OANIX Notes`**.
- Head final validado: `69ff6892bb0819a8731a349cc02b0339f971b76d`.
- Merge a `main`: `fefce0b8f6209692ba607ff812b876330dbfcb50`.

### Validaciones del head final

- OANIX CI #2619: **success**.
  - `Test OANIX`: success.
  - `Build OANIX`: success.
  - `Audit offline production bundle`: success.
- OANIX Android #1971: **success**.
  - build web Android: success.
  - Capacitor sync: success.
  - debug APK + release AAB: success.
  - artifacts Android: success.
- Qwen Independent PR Review #908: **success**.

### Validación física pendiente — Separador

Comprobar manualmente:

- insertar separador en nota plain exactamente en la posición del cursor;
- insertar uno o varios separadores en nota mixed entre texto y otros bloques;
- cerrar y reabrir confirmando posición y persistencia;
- eliminar un separador y confirmar que no reaparece;
- comprobar que el separador no altera Imágenes, Archivos, Código, Checklist ni Contacto cercanos;
- revisar visualmente móvil y desktop en temas claros y oscuros.

No marcar Separador como validado físicamente hasta confirmación del usuario.

## Cierres técnicos anteriores

### Contacto

- PR #611.
- Head `290429be66345047a134fec458ddd685e745b97f`.
- Merge `20cb50dddc5f74a82a8db20abebe76b1814b5b2c`.
- CI #2616 ✅ · Android #1968 ✅ · Qwen #907 ✅.
- Validación física pendiente: inserción plain/mixed, campos, autosave/reapertura, llamar/correo, eliminación y responsive.

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

No volver a modificar Imágenes, Archivos, Código, Checklist, Contacto ni Separador cerrados salvo regresión funcional real.

## Validación física pendiente — orden recomendado

Al comenzar la revisión manual, validar en este orden para detectar regresiones estructurales con el menor número de notas de prueba:

1. Archivos.
2. Código.
3. Checklist.
4. Contacto.
5. Separador.
6. Una nota combinada con texto + imagen + archivos + código + checklist + contacto + separador; cerrar, reabrir, editar y volver a cerrar.

## Siguiente acción exacta

Validar físicamente en Android los ajustes de **Contacto** de los PR #615 y #616: nombre vacío sin `Nuevo contacto`, teléfono solo numérico y sin prefijo fijo, correo inválido descartado sin mensaje rojo y `⛶` únicamente en Notas respetando el candado. Después continuar con los bloques pendientes del orden recomendado. No marcar ninguna validación física como completada hasta confirmación del usuario.
