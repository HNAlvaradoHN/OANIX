# OANIX #3 — checkpoint activo

Fecha: 2026-09-03

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.
- Bloque **Imágenes**: cerrado y validado físicamente.
- Bloque **Archivos**: implementación fusionada; validación física del usuario pendiente.

## ÚLTIMO TRABAJO REALIZADO

Se cerró técnicamente el bloque **Archivos** mediante el PR #608. El CI rojo del head anterior no provenía de la lógica de cifrado ni de las tarjetas: el fallo literal estaba en `tests/qwenChecklistIntegration.test.ts`, cuyo test arquitectónico todavía exigía `OanixMixedDocumentBody` directamente desde `OanixNotesSheetSurface`. La implementación nueva usa correctamente la composición `OanixNotesSheetSurface -> OanixMixedDocumentWithFiles -> OanixMixedDocumentBody` para mantener aislado el renderer ya validado de imágenes.

La prueba se actualizó para verificar la cadena de composición real sin relajar el aislamiento frente a Qwen. Después de esa corrección, los tres controles relevantes terminaron verdes sobre el mismo head y el PR fue fusionado.

### Bloque Archivos — CIERRE TÉCNICO

Quedó implementado:

- Menú `Añadir contenido -> Archivos` con selección múltiple.
- Una selección crea una tarjeta agrupadora independiente en la posición del cursor.
- Cada tarjeta admite hasta 50 archivos.
- Máximo 2 almacenamientos cifrados concurrentes; este paralelismo es interno y no afecta la disposición visual.
- La tarjeta ocupa el ancho útil del documento.
- Los archivos se muestran como filas horizontales completas, apiladas verticalmente.
- Variantes visuales de color estables para dar diferenciación sin cambiar aleatoriamente en cada render.
- Nombre, tipo y tamaño visibles por archivo.
- Añadir más archivos a una tarjeta existente sin crear otra tarjeta.
- Crear nuevas tarjetas independientes desde el menú.
- Abrir/previsualizar formatos compatibles o descargar/guardar cuando corresponda.
- Quitar un archivo individual.
- Eliminar la tarjeta completa.
- Mantener tarjeta vacía con CTA para añadir archivos si se quita el último.
- Menú flotante que decide si abrir arriba o abajo según el espacio disponible.
- Limpieza transaccional de adjuntos recién almacenados si falla el commit del documento.
- Al eliminar, primero se retira la referencia del documento y después se intenta limpiar el asset cifrado.
- No se modificó el renderer validado `OanixMixedDocumentBody`; se incorporó `OanixMixedDocumentWithFiles` como wrapper de composición.

### PR, head y merge

- PR: **#608 — `feat: tarjetas agrupadoras para archivos`**.
- Head final validado: `4c1c3edc79d1a7c9efbfc535bff99749e08e74d3`.
- Commit que corrigió el test arquitectónico: `4c1c3edc79d1a7c9efbfc535bff99749e08e74d3`.
- Merge a `main`: `930c2526c614c1b2dcc9703b43db330c6a996131`.

### Validaciones del head final

- OANIX CI #2607: **success**.
- OANIX Android #1959: **success**.
- Qwen Independent PR Review #904: **success**.

### Validación física pendiente

La implementación de Archivos todavía debe ser validada físicamente por el usuario. La revisión manual debe comprobar al menos:

- crear una tarjeta con uno y varios archivos;
- comprobar ancho completo y filas verticales con variantes visuales de color;
- añadir archivos a la misma tarjeta;
- crear una segunda tarjeta independiente;
- cerrar y reabrir la nota confirmando persistencia;
- abrir/guardar archivos compatibles;
- quitar un archivo individual;
- quitar el último archivo y comprobar la tarjeta vacía;
- eliminar la tarjeta completa;
- comprobar el menú flotante arriba/abajo cerca de los bordes de la pantalla.

No marcar este bloque como validado físicamente hasta que el usuario lo confirme.

## Bloques cerrados anteriormente

### Imágenes — CERRADO Y VALIDADO FÍSICAMENTE

El usuario validó físicamente el resultado del PR #607 y confirmó que los tres puntos negros `•••` ya no aparecen sobre las imágenes. El flujo de añadir imágenes se considera correcto.

- PR #606 merge a `main`: `27f1ec72be19988ffe899a3ecbff7cfc0386b17b`.
- PR #607 head validado: `19bfc9cfdb3ac8f1a2cc8852669de96fddab83d6`.
- PR #607 merge a `main`: `153948cd77f14ad5f42c08e48717d158bbb97c8a`.
- OANIX CI #2598: **success**.
- OANIX Android #1950: **success**.
- Qwen Independent PR Review #898: **success**.

No volver a modificar Imágenes ni Archivos cerrados salvo que aparezca una regresión funcional real.

## Siguiente bloque

Continuar con **Código** dentro de `Añadir contenido`.

Antes de modificar código:

1. Auditar la infraestructura existente en `main`, incluyendo codecs, catálogo de lenguajes, pruebas y cualquier UI preservada de Qwen.
2. Reutilizar solo componentes genéricos compatibles con la superficie OANIX actual.
3. Mantener la persistencia detrás de los callbacks genéricos del editor; no introducir acceso directo a almacenamiento desde la UI.
4. Implementar el bloque completo en un PR independiente.
5. Exigir persistencia/reapertura correcta, manejo de errores, pruebas y OANIX CI + Android + Qwen verdes antes de fusionar.
6. No iniciar Checklist hasta que Código esté técnicamente cerrado.

## Siguiente acción exacta

Auditar en `main` la infraestructura existente de **Código** (`codeBlockCodec`, catálogo de lenguajes, pruebas y UI previa), definir la mínima integración con `OanixNotesSheetSurface` y `OanixMixedDocumentWithFiles`, y crear un PR separado solo cuando la implementación pueda cerrarse de extremo a extremo.
