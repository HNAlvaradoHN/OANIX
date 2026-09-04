# OANIX #3 — checkpoint activo

Fecha: 2026-09-03

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.

## ÚLTIMO TRABAJO REALIZADO

El usuario confirmó que, tras PR #606, los tres puntos negros `•••` seguían visibles en el centro de las imágenes en Android.

### Causa verificada

El botón táctil que cubre la imagen todavía contiene literalmente `•••` en el JSX. El CSS local ya intentaba ocultar ese contenido con `color: transparent` y `font-size: 0`, pero en la validación física de Android esos caracteres seguían llegando a pintarse.

### Corrección terminada y fusionada

- Rama: `fix/hide-image-menu-dots-2026-09-03`.
- PR: `#607` — `fix: ocultar puntos visibles sobre imágenes`.
- Head validado: `19bfc9cfdb3ac8f1a2cc8852669de96fddab83d6`.
- Merge a `main`: `153948cd77f14ad5f42c08e48717d158bbb97c8a`.

El cambio es exclusivamente visual y refuerza el ocultamiento del contenido del botón transparente de imagen mediante `color: transparent !important`, `font-size: 0 !important`, `line-height: 0 !important`, `text-indent` y `overflow: hidden`.

Se conserva intacta toda el área de la imagen como objetivo táctil para abrir el menú. No se modificó la ruta de carga restaurada en PR #606 ni caché, cifrado, lazy loading, resize, pantalla completa, zoom o pan.

### Validaciones del PR #607

- OANIX CI #2598: **success**.
- OANIX Android #1950: **success**.
- Qwen Independent PR Review #898: **success**.
- PR #607 fusionado únicamente después de esos tres gates.

### Estado de carga de imágenes

PR #606 continúa vigente: PR #605 fue reciclado y OANIX usa nuevamente la implementación de #604 para carga y caché de imágenes.

## Validación física pendiente

1. Abrir una nota con imágenes.
2. Confirmar que ya no se ven los `•••` negros sobre las fotografías.
3. Tocar una imagen y confirmar que el menú flotante sigue abriendo normalmente.
4. Confirmar que la velocidad de carga sigue igual que después de PR #606.

## Siguiente acción exacta

Esperar la validación física del PR #607. Si los puntos todavía aparecen, eliminar el contenido `•••` directamente del JSX y conservar el botón vacío con `aria-label`, sin tocar la carga de imágenes.
