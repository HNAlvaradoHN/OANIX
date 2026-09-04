# OANIX #3 — checkpoint activo

Fecha: 2026-09-03

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.

## ÚLTIMO TRABAJO REALIZADO

El usuario comparó físicamente el resultado posterior al PR #605 y reportó que la versión anterior se sentía más rápida y que veía `•••` sobre las imágenes, afectando visualmente la nota. Se revisó el diff exacto entre #604 y #605 antes de tocar código.

### Hallazgos

- PR #605 no introdujo el botón `•••`; ese texto ya existía en el JSX de #604.
- PR #605 sí añadió una caché de `objectURL` y una consulta síncrona desde `OanixMixedImage` al montar.
- Esa solución añadió complejidad y trabajo síncrono al montaje para intentar evitar el placeholder, mientras que el usuario percibió peor experiencia.
- Se decidió reciclar #605 completo en vez de seguir ocultando síntomas con más capas.

### Reversión terminada y fusionada

- Rama: `fix/revert-object-url-cache-clean-image-menu-2026-09-03`.
- PR: `#606` — `revert: retirar caché de objectURL de sesión`.
- Head validado: `9dd126914069f78e27befe19c6b6914beccfff30`.
- Merge a `main`: `27f1ec72be19988ffe899a3ecbff7cfc0386b17b`.

PR #606 restaura exactamente la implementación de carga de imágenes de #604 en los archivos afectados por #605:

- `AttachmentSessionCache` vuelve a conservar solo el `File` descifrado dentro del LRU de 48 MiB.
- `OanixMixedImage` vuelve al flujo lazy con `IntersectionObserver` y crea/revoca su `objectURL` dentro del componente.
- Se eliminó `tests/oanixImageCachedObjectUrl.test.ts`.
- Se restauró `tests/oanixMixedDocumentRenderer.test.ts` a la aserción anterior.
- Se conserva la mejora de #604 que retrasa 120 ms únicamente el texto `Descifrando imagen…`.

### Validaciones del PR #606

- OANIX CI #2595: **success**.
- OANIX Android #1947: **success**.
- Qwen Independent PR Review #897: **success**.
- PR #606 fusionado únicamente después de esos tres gates.

### Alcance preservado

No se cambió cifrado, IndexedDB, formato de adjuntos, caché LRU de 48 MiB, limpieza al bloquear la bóveda, carga lazy ni `IntersectionObserver` respecto del estado validado de #604.

## Observación pendiente sobre `•••`

El texto `•••` ya existía antes de #605. El CSS actual intenta convertir ese botón en un área táctil transparente sobre la imagen (`color: transparent` y `font-size: 0`), por lo que el hecho de que el usuario lo haya visto puede corresponder a un estado visual/transitorio o a estilos que no se aplicaron como se esperaba en Android. No se mezcló una corrección de ese detalle dentro de la reversión para no confundir la causa del rendimiento.

## Validación física pendiente

1. Abrir una nota con varias imágenes y dejar que carguen.
2. Salir a la lista y volver a entrar sin bloquear OANIX.
3. Comparar la velocidad con la versión que tenía #605.
4. Confirmar si los `•••` siguen apareciendo sobre alguna imagen.

## Siguiente acción exacta

Esperar la prueba física de PR #606. Si los `•••` siguen visibles después de volver al comportamiento de #604, corregir el botón de imagen de forma aislada, preferiblemente eliminando el texto visual del DOM y conservando únicamente el área táctil y `aria-label`, sin tocar de nuevo la ruta de carga.
