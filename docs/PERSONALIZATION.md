# OANIX — Personalización visual

La personalización es una preferencia visual local. No forma parte del contenido privado, no entra en sincronización E2EE y no modifica cifrado, notas ni backups.

## Selector

OANIX muestra un control dedicado `Personalizar` en la interfaz. En escritorio se ubica arriba, separado de las acciones funcionales; en pantallas estrechas se vuelve un control compacto/flotante para no saturar la cabecera.

La selección se conserva únicamente en `localStorage` bajo la clave `oanix.theme`. Si el almacenamiento de preferencias no está disponible, OANIX continúa normalmente con `Midnight Violet`.

## Presets iniciales

1. Midnight Violet — oscuro, grafito + violeta + cian.
2. Cyber Blue — oscuro, azul noche + cian eléctrico.
3. Graphite Neon — oscuro, grafito + verde turquesa.
4. Obsidian Gold — oscuro, negro + dorado.
5. Crimson Core — oscuro, carbón + rojo profundo.
6. Aurora Rose — oscuro, ciruela + rosa.
7. Pearl Violet — claro, blanco perla + violeta.
8. Blush Glass — claro, rosa cristal + ciruela.
9. Lavender Mist — claro, lavanda + violeta.
10. Ocean Pearl — claro, blanco perla + azul/turquesa.

Los nombres describen el estilo, no el género de quien los use.

## Reglas visuales

- La legibilidad tiene prioridad sobre glow, degradados y color de acento.
- Fondos, superficies, bordes, texto, glow y acentos usan tokens semánticos compartidos.
- Las tarjetas, menús, editor y dock cambian juntos; no se aplican colores aislados por pantalla.
- Los títulos de notas y carpetas deben quedar contenidos y usar elipsis cuando no haya espacio.
- El título principal de la nota usa escala responsive para evitar desbordes.
- El selector respeta temas claros y oscuros mediante `color-scheme`.
