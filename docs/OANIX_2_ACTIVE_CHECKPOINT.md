# OANIX #2 — checkpoint activo

Fecha: 2026-09-03
Rama: `agent/oanix-notes-sheet-2026-09-02`
PR: `#592` (draft, sin merge)

GitHub y el código real prevalecen si este documento queda desactualizado.

## Autoridad actual

- La hoja OANIX Notes ya está integrada dentro del proyecto como superficie activa detrás de `EditorSurface`.
- `editorSurfaceRegistry.ts` selecciona `oanix-notes-sheet-v1` y carga `OanixNotesSheetMobileGuard`.
- La superficie activa declara `plainText: true`, `richBlocks: true` y `attachments: true`.
- No existe una segunda hoja paralela ni una maqueta con persistencia propia.
- La hoja usa los contratos reales de OANIX para guardado, cifrado, adjuntos y cierre; no usa `localStorage` como persistencia de la nota.
- Esta rama y el PR #592 siguen siendo el único lugar de trabajo para esta integración. No fusionar a `main` hasta validación explícita del usuario.

## Exclusividad de edición

- `OANIX-NOCHE #2` está desactivada.
- Las automatizaciones antiguas de desarrollo de OANIX permanecen desactivadas.
- La automatización temporal `Preview Vercel OANIX` también fue desactivada el 2026-09-03.
- No debe quedar ningún trabajo automático modificando OANIX en paralelo con este chat.
- Antes de cualquier cambio importante se debe verificar nuevamente el head real del PR #592.

## Preview externo

- Vercel queda descartado como flujo de auditoría por decisión del usuario.
- StackBlitz también queda descartado porque WebContainers no funciona de forma confiable en el Brave móvil del usuario.
- `.stackblitzrc` fue eliminado de esta rama para no dejar configuración muerta.
- El preview externo no es requisito para seguir construyendo la hoja dentro de OANIX.

## Escritura y arquitectura preservadas

- La escritura normal permanece basada en `textarea` uncontrolled.
- Una tecla no copia el documento entero a estado React ni cifra/escribe en IndexedDB en el evento de input.
- El autosave sigue ocurriendo en fronteras seguras de inactividad/cierre.
- La hoja continúa aislada detrás de `EditorSurface`; Home, navegación, vault, cifrado, persistencia y sync no conocen la implementación visual concreta.
- No se trabajó sobre `agent/clean-sheet-v1-2026-09-02`.

## Imagen — estado actual

Imagen ya está conectada al almacenamiento real de OANIX y puede insertarse repetidamente dentro del flujo continuo.

Presentación aprobada e implementada en la rama:

- imagen inline limpia, sin tarjeta genérica, badge `IMAGEN`, nombre ni tamaño visibles en la vista normal;
- botón discreto `•••` sobre la imagen;
- menú contextual anclado y adaptativo arriba/abajo;
- `Redimensionar` muestra control de tamaño sobre la propia imagen;
- `Bloquear tamaño` / `Desbloquear tamaño` persiste el estado;
- `Pantalla completa` abre visor con zoom y desplazamiento;
- `Eliminar` exige confirmación;
- `widthPercent` y `sizeLocked` se guardan en el bloque de imagen con decode retrocompatible;
- bytes de imagen se cargan de forma lazy y se presentan mediante `objectURL` revocable, no base64/data URL.

### Problema observado físicamente

En una prueba Android anterior una imagen podía quedar temporalmente en `Descifrando imagen…`; al salir a la lista y volver a abrir la nota aparecía correctamente. La evidencia apunta al ciclo de vida/reintento del renderer y no a corrupción del asset cifrado.

La rama ya eliminó el guard one-shot que podía impedir una segunda carga después de un cleanup/remount y añadió reintento seguro. Esto aún necesita validación física en Android antes de considerarlo cerrado.

### Pendientes de Imagen antes de darla por cerrada

- validar físicamente que una imagen nueva aparezca sin tener que salir y reabrir la nota;
- validar que arrastre/pan del visor funcione al tocar directamente la imagen, además del pinch zoom;
- comprobar el cierre correcto del visor con navegación Atrás de Android y no solo con `Escape`/botón cerrar;
- comprobar que el menú contextual nunca quede recortado por el viewport/teclado en móvil;
- mantener escritura antes y después de la imagen sin saltos de cursor.

## Texto grande

La base attachment-backed para pegado de texto grande está implementada: codec, política de umbral, inserción transaccional y renderer lazy de `Texto largo`.

Todavía falta conectar completamente el paste visible en mixed mode y la transición equivalente desde modo plain. No presentar esta ruta como terminada hasta cerrar ese cableado y sus pruebas.

## Siguiente trabajo

1. cerrar Imagen y su validación móvil sin alterar la arquitectura de guardado;
2. conectar paste grande visible de extremo a extremo;
3. continuar con Archivo, Código, Checklist, Contacto, Entrada y Separador, cada uno como elemento real dentro de la misma hoja continua;
4. mantener cada elemento reemplazable y detrás de los contratos existentes de `EditorSurface`;
5. ejecutar OANIX CI + Android y validación física antes de promover el PR.

No fusionar `main` hasta que el usuario valide visual y funcionalmente esta hoja.