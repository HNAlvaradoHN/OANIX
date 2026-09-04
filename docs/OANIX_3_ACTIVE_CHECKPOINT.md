# OANIX #3 — checkpoint activo

Fecha: 2026-09-03

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.

## ÚLTIMO TRABAJO REALIZADO

El usuario confirmó que, incluso después del PR #604, al salir de una nota y volver a entrar sin bloquear la bóveda todavía podía verse un estado visual transitorio antes de que apareciera la imagen cacheada. La imagen reaparecía rápido; el problema restante era que el componente se desmontaba al salir de la nota y perdía su `objectURL`, aunque el `File` descifrado sí seguía en la caché de sesión.

### Causa confirmada

PR #603 ya conservaba el `File` descifrado en una caché LRU de sesión, pero `OanixMixedImage` seguía creando el `objectURL` dentro del componente. Al desmontarse la nota, esa URL se revocaba. Al volver a entrar, React montaba primero sin `src`, recuperaba luego el `File` cacheado y recién después creaba otra URL, dejando un breve placeholder aunque no hubiera un descifrado real.

### Corrección terminada y fusionada

- Rama: `fix/image-cache-object-url-2026-09-03`.
- PR: `#605` — `perf: evitar placeholder al reabrir imágenes cacheadas`.
- Head final validado: `3ac6cf0913a4bc8f8a6ff5725576af0a7ee875e5`.
- Commit final de ajuste de pruebas: `3ac6cf0913a4bc8f8a6ff5725576af0a7ee875e5`.
- Merge a `main`: `447f9965d39afa01f5c027fd97c2906cb979c123`.

La caché de sesión ahora conserva también un `objectURL` temporal por archivo cacheado. `OanixMixedImage` consulta esa URL de forma síncrona al inicializar su estado, de modo que una imagen previamente cargada puede tener `src` desde el primer render al reabrir la nota.

Las URLs cacheadas son propiedad de la caché, no del componente. Se revocan cuando el archivo es reemplazado, expulsado por el LRU, eliminado o cuando se limpia la sesión al bloquear la bóveda. Si un archivo no entra en la caché, el componente sigue creando su propia URL de fallback y la revoca al desmontarse.

### Incidente de CI y resolución

La primera corrida del PR #605, OANIX CI #2591, falló únicamente porque una prueba antigua esperaba literalmente `URL.revokeObjectURL(url)` dentro del renderer. Esa aserción dejó de representar la arquitectura correcta, porque ahora la caché es la dueña de las URLs cacheadas.

Se actualizó la prueba para validar la propiedad real: lazy loading intacto, uso de `getCachedAttachmentObjectUrl`, creación de fallback cuando corresponde y revocación únicamente de URLs que el componente posee. No se cambió la lógica del producto para hacer pasar la prueba.

### Validaciones confirmadas antes del merge

- OANIX CI #2592: **success** — `Test OANIX`, build y auditoría offline completados.
- OANIX Android #1944: **success** — bundle web, sync Capacitor, build APK/AAB y subida de artefactos.
- Qwen Independent PR Review #896: **success**.
- PR #605 fusionado únicamente después de esos tres gates.

### Alcance preservado

No se modificaron cifrado, IndexedDB, formato de adjuntos, límite LRU de 48 MiB, política lazy ni `IntersectionObserver`. La URL temporal sigue existiendo solo en memoria de sesión y se elimina junto con la entrada cacheada o al bloquear la bóveda.

## Validación física pendiente

Siguiente prueba del usuario:

1. abrir una nota con una imagen y dejar que cargue;
2. salir a la lista de notas;
3. volver a entrar en esa misma nota **sin bloquear la bóveda**;
4. confirmar que la imagen ya aparece directamente, sin `Descifrando imagen…` ni placeholder perceptible.

Después de esa prueba, si queda limpio, el siguiente paso será bloquear/desbloquear OANIX y confirmar que la primera carga vuelve a comportarse como carga real.

## Siguiente acción exacta

Esperar el resultado físico del PR #605 en Android. Si todavía aparece un placeholder al reabrir sin bloquear, investigar el montaje del editor y la disponibilidad síncrona de `getCachedAttachmentObjectUrl()` antes de aplicar otro cambio visual.
