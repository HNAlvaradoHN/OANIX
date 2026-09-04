# OANIX #3 — checkpoint activo

Fecha: 2026-09-03

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.
- Último `main` conocido al iniciar este bloque: `659dfab49647f3e8ac8627d98c7570676643418f`.

## ÚLTIMO TRABAJO REALIZADO

El usuario validó físicamente el resultado del PR #603 y confirmó que, al salir de una nota y volver a entrar sin bloquear la bóveda, la imagen reaparece rápido pero todavía alcanza a mostrar brevemente `Descifrando imagen…`.

### Causa confirmada

En `OanixMixedImage`, el renderer ejecutaba `setLoading(true)` inmediatamente antes de llamar a `loadAttachmentFile()`. Aunque `loadAttachmentFile()` devolviera el `File` desde la caché de sesión creada por PR #603, React podía pintar el estado de carga antes de recibir el resultado, produciendo un destello visual falso de descifrado.

### Corrección implementada

- Rama: `fix/image-cache-loading-flicker-2026-09-03`.
- PR: `#604` — `fix: evitar destello de descifrado en imágenes cacheadas`.
- Head actual del PR: `f6e512e9e931bb55ba97dbb11cad3b65f49425dd`.
- Commit de código: `dc27d1c81471cd3897e661b4ac60cc6ec0b779ea`.
- Commit de prueba: `f6e512e9e931bb55ba97dbb11cad3b65f49425dd`.

El renderer mantiene `loading=true` desde el inicio para conservar el bloqueo de reintentos, pero retrasa 120 ms únicamente la etiqueta `Descifrando imagen…`. Si la caché responde antes, la etiqueta no aparece; si una carga real tarda más, el mensaje sí se muestra. Se limpia el temporizador al resolver o desmontar.

Se añadió `tests/oanixImageCachedLoadingLabel.test.ts` para fijar esta conducta.

### Alcance preservado

No se modificaron carga lazy, IntersectionObserver, caché LRU de 48 MiB, cifrado, IndexedDB, formato de adjuntos ni limpieza de caché al bloquear la bóveda.

## Validación pendiente

Al momento de escribir este checkpoint:

- OANIX CI #2585: `in_progress`.
- OANIX Android #1937: `in_progress`.
- Qwen Independent PR Review #893: `in_progress`.
- Vercel: `pending`.

No fusionar PR #604 hasta confirmar los gates relevantes. Después de integrarlo, repetir prueba física: abrir nota con imagen ya cargada, salir, volver a entrar sin bloquear OANIX y comprobar que no aparezca el texto `Descifrando imagen…` en la reapertura cacheada.

## Siguiente acción exacta

1. Confirmar resultados de CI/Android/review del PR #604.
2. Si están correctos, fusionar #604 a `main`.
3. Registrar SHA final de merge y validaciones en este checkpoint.
4. Pedir prueba física al usuario sobre la reapertura cacheada.
