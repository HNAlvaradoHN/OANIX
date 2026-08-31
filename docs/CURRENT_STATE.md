# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-31

Checkpoint operativo corto. Antes de trabajar, verificar siempre el `main` real y PR recientes; GitHub es la fuente de verdad del código.

## Dirección activa

OANIX está en una **reconstrucción limpia de la experiencia posterior al desbloqueo**. La prioridad actual es rendimiento, mantenibilidad y una UI reemplazable sin tocar seguridad/datos.

Se conserva:
- bootstrap y flujo de bloqueo/desbloqueo;
- vault/session;
- cifrado AES-GCM/AAD de `contentCrypto.ts`;
- infraestructura de sync E2EE y binarios/archivos como base a reutilizar selectivamente;
- datos existentes, sin borrado destructivo.

Se reconstruye:
- Home;
- navegación;
- carpetas/etiquetas;
- lista de notas;
- editor;
- capa de notas/almacenamiento v2;
- coordinación de guardado y sincronización alrededor del nuevo editor.

La dirección infográfica anterior queda **SUPERSEDED como dirección activa**, aunque su historial/código sigue disponible hasta reemplazarlo de forma segura.

PR #532 aisló la nueva superficie post-unlock de la UI/runtime legacy: los runtimes visuales antiguos ya no se montan en el arranque nuevo, el rebuild dejó de reutilizar clases `.notes-shell`, y Android Back dejó de depender de navegación histórica de carpetas. El código viejo puede conservarse como referencia o infraestructura no conectada, pero no debe interferir con la aplicación nueva.

## Regla operativa de cierre

Un trabajo de OANIX no se da por terminado con gates reales en rojo.

- Si OANIX CI, OANIX Android o GitHub Pages fallan, corregir la causa y volver a validar hasta verde.
- Si un check sigue ejecutándose, continuar consultándolo dentro del mismo flujo cuando sea posible; no cerrar solo por estar esperando.
- No crear timers/recordatorios para sustituir esa espera activa.
- Qwen automático no es gate técnico cuando falla por API/cuota; no debe bloquear un merge que ya tenga los gates reales verdes.

## Primer hito funcional

Meta inmediata:
**unlock → Home nuevo → crear nota de texto → escribir → guardar cifrado local → cerrar → reabrir → texto idéntico**.

No conectar todavía la sincronización completa al camino crítico del nuevo editor. Primero demostrar guardado local cifrado rápido y estable.

## Reglas visuales obligatorias

Toda UI nueva debe considerarse simultáneamente en:
**PC + móvil + Día + Noche**.

Preview visual:
- archivo: `public/preview/index.html`;
- URL: `https://hnalvaradohn.github.io/OANIX/preview/`;
- se usa como laboratorio de diseño, no como almacenamiento/seguridad de producción.

Decisiones visuales vigentes:
- navegación inferior: **Inicio · Buscar · + · Recientes · Ajustes**;
- `+` ofrece Nota / Carpeta / Etiqueta;
- cada carpeta usa degradado suave en toda su tarjeta/fila, con color coherente en icono/pestaña/lista;
- al entrar a una carpeta, el fondo puede ocupar todo el espacio detrás de la lista de notas;
- fondo por defecto = degradado estable; imagen personalizada = opcional;
- las portadas deben mantener alta calidad, cargar solo la activa y usar overlays distintos para Día/Noche;
- evitar blur grande en tiempo real y base64 dentro del registro de carpeta.

## Editor nuevo

No usar como referencia visual el editor reconstruido que perdió la alineación de renglones.

Antes de implementar el nuevo editor:
1. localizar en el historial la versión aprobada donde renglones y texto quedaban perfectamente alineados;
2. comparar las modificaciones posteriores útiles;
3. conservar esa apariencia/comportamiento sobre una arquitectura interna nueva.

El camino crítico de una tecla no debe:
- serializar todo el DOM;
- cifrar;
- escribir IndexedDB;
- recorrer la bóveda;
- disparar sync pesado.

## Sincronización futura del editor

DECIDED, todavía no conectada:

- actividad de edición bloquea el trabajo pesado de sincronización;
- cada modificación renueva la actividad;
- después de ~3 s sin cambios se puede intentar sync;
- si el usuario vuelve a editar, el intento pendiente se cancela/posterga y el trabajo en curso se pausa cooperativamente después de la operación atómica segura;
- no aplicar cambios remotos sobre la nota activa mientras se edita;
- no habrá botón manual de sincronizar;
- al salir, si hay sync pendiente y conexión, usar pantalla completa de **Sincronizando…** antes de volver a la lista;
- offline: guardar cifrado local y permitir salir.

El `AutoSyncRuntime` actual no se reutiliza tal cual como coordinador del nuevo editor.

## Feedback de operaciones largas

Si una operación tarda aproximadamente más de 500–800 ms, OANIX debe indicar que sigue trabajando.

- porcentaje solo si es medible de verdad;
- si no, progreso indeterminado;
- mostrar fases reales: Guardando / Cifrando / Sincronizando / Verificando / Listo;
- usar pantalla completa cuando la acción bloquee navegación o sea crítica.

Aplicar en móvil/PC y Día/Noche.

## Arquitectura

Requisito permanente:
`UI → estado/servicios → dominio → almacenamiento cifrado → vault/crypto`.

Un rediseño futuro debe poder reemplazar componentes visuales sin reescribir seguridad, almacenamiento, sync o reglas de negocio.

## Archivos grandes

El motor de archivos grandes y Google Drive ya implementados **no se borran**. Se preservan durante la reconstrucción y se retomarán después de estabilizar la nueva base.

No cargar archivos gigantes completos en RAM; mantener procesamiento por fragmentos y reanudación/checkpoints existentes.

## Próximo paso exacto

1. Localizar en el historial la versión del editor aprobada donde renglones y texto quedaban perfectamente alineados.
2. Identificar qué mejoras posteriores de ese editor sí conviene conservar.
3. Construir el editor nuevo sobre la arquitectura v2, manteniendo el camino crítico de escritura solo en memoria/local state.
4. Validar crear → escribir → salir/guardar cifrado → reabrir con texto idéntico en PWA y Android.
5. Después completar personalización/portada de carpetas sobre la nueva base.
6. Solo entonces conectar el nuevo coordinador de sincronización consciente de actividad.

## Continuidad

Las decisiones duraderas completas están en `docs/PROJECT_MEMORY.md`. No pedir al usuario que vuelva a explicar decisiones registradas allí; verificar siempre el código real antes de implementar.
