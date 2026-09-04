# OANIX #3 — checkpoint activo

Fecha: 2026-09-04

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.
- Bloque **Imágenes**: cerrado y validado físicamente.
- Bloque **Archivos**: cerrado técnicamente; validación física del usuario pendiente.
- Bloque **Código**: cerrado técnicamente y fusionado; validación física del usuario pendiente.

## ÚLTIMO TRABAJO REALIZADO

Se cerró técnicamente el bloque **Código** mediante el PR #609. La implementación reutiliza el `codeBlockCodec` existente y se integra a la superficie OANIX sin acceso directo a almacenamiento.

### Bloque Código — CIERRE TÉCNICO

Quedó implementado:

- Menú `Añadir contenido -> Código` conectado realmente a la inserción.
- Inserción en la posición actual del cursor desde notas plain y mixed.
- Transición plain -> mixed transaccional con rollback si falla el guardado del snapshot plain.
- En mixed se guarda contenido pendiente antes de alterar la estructura y el orden de bloques.
- Tarjeta visual de código a ancho completo con editor monoespaciado.
- Selector de 15 lenguajes: texto plano, JavaScript, TypeScript, Python, HTML, CSS, JSON, Bash, SQL, Java, C++, C#, Kotlin, Swift y PHP.
- Botón para copiar el contenido al portapapeles.
- Edición de texto y lenguaje integrada al autosave de bloques.
- El textarea de código no depende de un valor React controlado por tecla; mantiene referencias vivas para evitar restaurar texto anterior al cambiar de lenguaje.
- Eliminación confirmada y durable del bloque, preservando el orden restante.
- Reapertura segura mediante reconocimiento del bloque en la proyección mixed.
- Estado `codeBusy` integrado al bloqueo y estado visual del editor durante operaciones estructurales.
- No se modificó la lógica interna validada de Imágenes ni Archivos; Código se compone como un segmento adicional en `OanixMixedDocumentWithFiles`.

### PR, head y merge

- PR: **#609 — `feat: bloque de código en OANIX Notes`**.
- Head final validado: `76a1a454bd6cb7f813036ef9017ee13da226df62`.
- Merge a `main`: `51d3e012f84ad28842989f8f9b80a2b4553d5892`.

### Validaciones del head final

- OANIX CI #2610: **success**.
- OANIX Android #1962: **success**.
- Qwen Independent PR Review #905: **success**.
- Validación adicional previa al PR: `npm test` **success** y `npm run build` **success**.

### Validación física pendiente — Código

La revisión manual debe comprobar al menos:

- insertar Código en una nota plain en medio del texto;
- insertar otro bloque de Código dentro de una nota mixed;
- escribir y pegar código largo;
- cambiar varias veces el lenguaje sin perder texto;
- copiar al portapapeles;
- cerrar y reabrir la nota confirmando texto y lenguaje;
- editar un bloque existente, esperar autosave y reabrir;
- eliminar un bloque y confirmar que no reaparece;
- comprobar visualmente desktop y móvil, incluido scroll horizontal para líneas largas.

No marcar Código como validado físicamente hasta que el usuario lo confirme.

## Bloque Archivos — CIERRE TÉCNICO

- PR: **#608 — `feat: tarjetas agrupadoras para archivos`**.
- Head final validado: `4c1c3edc79d1a7c9efbfc535bff99749e08e74d3`.
- Merge a `main`: `930c2526c614c1b2dcc9703b43db330c6a996131`.
- OANIX CI #2607: **success**.
- OANIX Android #1959: **success**.
- Qwen Independent PR Review #904: **success**.

La validación física de Archivos sigue pendiente. Debe incluir creación con uno y varios archivos, filas a ancho completo con variantes de color, añadir a una tarjeta, segunda tarjeta independiente, reapertura, abrir/guardar, quitar individual, tarjeta vacía, eliminar tarjeta y menú flotante arriba/abajo.

## Bloques cerrados anteriormente

### Imágenes — CERRADO Y VALIDADO FÍSICAMENTE

El usuario validó físicamente el resultado del PR #607 y confirmó que los tres puntos negros `•••` ya no aparecen sobre las imágenes. El flujo de añadir imágenes se considera correcto.

- PR #606 merge a `main`: `27f1ec72be19988ffe899a3ecbff7cfc0386b17b`.
- PR #607 head validado: `19bfc9cfdb3ac8f1a2cc8852669de96fddab83d6`.
- PR #607 merge a `main`: `153948cd77f14ad5f42c08e48717d158bbb97c8a`.
- OANIX CI #2598: **success**.
- OANIX Android #1950: **success**.
- Qwen Independent PR Review #898: **success**.

No volver a modificar Imágenes, Archivos ni Código cerrados salvo que aparezca una regresión funcional real.

## Siguiente bloque

Continuar con **Checklist** dentro de `Añadir contenido`.

Antes de modificar código:

1. Auditar la infraestructura existente en `main`, especialmente `checklistBlockCodec`, pruebas y cualquier UI previa preservada.
2. Reutilizar solo componentes genéricos compatibles con la superficie OANIX actual.
3. Mantener la persistencia detrás de callbacks genéricos del editor.
4. Implementar creación, edición, marcado/desmarcado, añadir/quitar ítems, persistencia y reapertura.
5. Mantener un PR independiente y exigir OANIX CI + Android + Qwen verdes antes de fusionar.
6. No iniciar Contacto hasta que Checklist esté técnicamente cerrado.

## Siguiente acción exacta

Auditar en `main` la infraestructura existente de **Checklist**, definir la mínima integración con `OanixNotesSheetSurface` y `OanixMixedDocumentWithFiles`, e implementar el bloque completo sin modificar la lógica cerrada de Imágenes, Archivos ni Código.
