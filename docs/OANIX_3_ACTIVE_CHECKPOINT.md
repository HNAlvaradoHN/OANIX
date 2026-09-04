# OANIX #3 — checkpoint activo

Fecha: 2026-09-03

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.

## ÚLTIMO TRABAJO REALIZADO

El usuario validó físicamente el resultado del PR #607 y confirmó que los tres puntos negros `•••` ya no aparecen sobre las imágenes. También indicó que el flujo de añadir imágenes ya puede considerarse correcto.

### Bloque de imágenes — CERRADO

Queda aceptado como terminado el flujo de imágenes del editor OANIX:

- inserción de imágenes en la nota;
- almacenamiento cifrado;
- carga lazy mediante `IntersectionObserver`;
- caché de sesión del `File` descifrado con LRU de 48 MiB;
- retraso visual de 120 ms para evitar mostrar falsamente `Descifrando imagen…` en cargas muy rápidas;
- menú contextual de imagen;
- bloqueo/desbloqueo de tamaño;
- redimensionado;
- pantalla completa;
- zoom y pan;
- eliminación;
- corrección visual del botón táctil para que `•••` no se vea sobre la foto.

### Implementación final relevante

- PR #606 recicló por completo la caché de `objectURL` de PR #605 y restauró el comportamiento de carga de PR #604.
- PR #606 merge a `main`: `27f1ec72be19988ffe899a3ecbff7cfc0386b17b`.
- PR #607 corrigió exclusivamente la visibilidad de `•••` sin tocar la ruta de carga.
- PR #607 head validado: `19bfc9cfdb3ac8f1a2cc8852669de96fddab83d6`.
- PR #607 merge a `main`: `153948cd77f14ad5f42c08e48717d158bbb97c8a`.

### Validaciones del último cambio

- OANIX CI #2598: **success**.
- OANIX Android #1950: **success**.
- Qwen Independent PR Review #898: **success**.

## Decisión de continuidad

No seguir optimizando ni alargando la ruta de carga de imágenes mientras no aparezca un fallo funcional nuevo. La solución actual queda aceptada y estable para continuar el editor.

## Siguiente bloque recomendado

Continuar con **Archivos** dentro de `Añadir contenido`.

Objetivo del siguiente bloque:

- seleccionar uno o varios archivos compatibles;
- almacenarlos cifrados como adjuntos de la nota;
- insertar una representación limpia dentro del documento;
- mostrar nombre, tipo y tamaño de forma compacta;
- permitir abrir/visualizar cuando el formato sea compatible;
- permitir guardar/exportar el archivo de forma explícita cuando corresponda;
- permitir eliminarlo de la nota y limpiar su adjunto asociado;
- mantener funcionamiento offline y no introducir persistencia de contenido descifrado.

No implementar todavía otros botones del menú ni formato de texto hasta cerrar este bloque, salvo que el usuario cambie el orden.

## Siguiente acción exacta

Revisar en `main` qué infraestructura de adjuntos/elementos insertables ya existe para `Archivos`, identificar qué puede reutilizarse del trabajo de imágenes y diseñar la mínima implementación necesaria antes de modificar código.
