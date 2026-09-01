# OANIX — Estado actual para continuidad

**Última actualización:** 2026-09-01

Checkpoint operativo corto. Antes de trabajar, verificar siempre el `main` real y PR recientes; GitHub es la fuente de verdad del código.

## Dirección activa

OANIX está en una **reconstrucción limpia de la experiencia posterior al desbloqueo**. La prioridad actual es rendimiento, mantenibilidad y superficies visuales reemplazables sin tocar seguridad/datos.

Se conserva:
- bootstrap y flujo de bloqueo/desbloqueo;
- vault/session;
- cifrado AES-GCM/AAD de `contentCrypto.ts`;
- infraestructura de sync E2EE y binarios/archivos como base a reutilizar selectivamente;
- datos existentes, sin borrado destructivo.

La reconstrucción del Home ya alcanzó su base funcional vigente. El frente activo pasa al editor nuevo y, después, a la coordinación de sincronización alrededor de ese editor.

La dirección infográfica anterior queda **SUPERSEDED como dirección activa**. No arrastrar plantillas visuales anteriores dentro de la nueva hoja: el historial de Git sirve como referencia técnica, no como dependencia visual o de runtime.

PR #532 aisló la nueva superficie post-unlock de la UI/runtime legacy. PR #534 eliminó físicamente del árbol activo los gates, runtimes, editor visual, presentación de imágenes y CSS legacy ya sustituidos. Los servicios/tipos reutilizables y la seguridad permanecen.

## Regla operativa de cierre

Un trabajo de OANIX no se da por terminado con gates reales en rojo.

- Si OANIX CI, OANIX Android o GitHub Pages fallan, corregir la causa y volver a validar hasta verde.
- Si un check sigue ejecutándose, continuar consultándolo dentro del mismo flujo cuando sea posible; no cerrar solo por estar esperando.
- No crear timers/recordatorios para sustituir esa espera activa.
- Qwen automático no es gate técnico cuando falla por API/cuota; no debe bloquear un merge que ya tenga los gates reales verdes.

## Home — base completada

La base nueva del Inicio quedó integrada y validada en `main`.

Estado vigente:
- submenú izquierdo modular para carpetas y etiquetas;
- creación de carpeta/etiqueta desde el propio submenú;
- personalización persistente de carpeta;
- color/degradado contextual de carpeta;
- portada/fondo de carpeta almacenado como asset cifrado separado y cargado solo para la carpeta activa;
- orden manual persistente de carpetas y etiquetas;
- un reorder que termina sin cambios no vuelve a cifrar ni escribir el mismo orden;
- logo/identidad real de OANIX en el Home;
- Home consume controladores/servicios y no debe convertirse en autoridad de almacenamiento o cifrado.

PR #554 conectó la personalización al workspace activo. PR #556 eliminó writes de reordenamiento cuando el orden no cambió.

Toda evolución futura del Home debe conservar esta frontera: la presentación puede reemplazarse sin crear CRUD, stores de apariencia o persistencia paralelos.

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
- cada carpeta usa identidad visual coherente en submenú/lista/workspace;
- al entrar a una carpeta, su fondo puede ocupar todo el espacio detrás de la lista de notas;
- fondo por defecto = degradado estable; imagen personalizada = opcional;
- las portadas deben mantener alta calidad, cargar solo la activa y mantener contraste en Día/Noche;
- evitar blur grande en tiempo real y base64 dentro del registro de carpeta;
- base visual global = neutral: Noche carbón/grafito con acento frío sobrio; Día blanco/gris claro con acento neutro;
- carpeta activa = acento contextual opcional mediante su degradado/color; `Todas` vuelve al acento neutral global.

## Editor — transición activa

La persistencia y el cierre seguro del editor de texto actual están implementados y sirven como garantía funcional durante la transición, **no como plantilla visual que deba heredarse**.

Fundación relevante:
- PR #538: base de editor/persistencia v2;
- PR #543: autoguardado incremental por idle;
- PR #545: cierre inmediato guarda el snapshot DOM más reciente aunque todavía no haya vencido el idle;
- PR #549: Atrás Android cierra la capa activa correcta; el flujo fue validado físicamente;
- PR #555: contrato de superficie de editor reemplazable;
- PR #557: Home ya entra al editor mediante `EditorSurface`, no mediante una importación directa de `NoteEditor`.

`EditorSurface` es el punto de composición autorizado para seleccionar/adaptar la implementación visual del editor. Home, cifrado, persistencia, navegación, vault y sync no deben importar ni conocer detalles de una plantilla concreta.

El editor actual sigue temporalmente detrás de `EditorSurface` para conservar las garantías ya demostradas mientras la nueva hoja se integra. No usar `ruledSheet.css`, Aurora, Qwen ni cualquier hoja/plantilla anterior como dependencia de la nueva implementación. Cuando la nueva hoja demuestre guardado, reapertura, cierre, Atrás Android y rendimiento bajo carga, la implementación visual transitoria puede retirarse sin cambiar Home ni la capa de datos.

### Nueva plantilla seleccionada

La plantilla externa nueva seleccionada por el usuario es la autoridad visual/funcional objetivo de la futura hoja, pero debe tratarse como **fuente fresca**, no como continuación de prototipos anteriores.

Antes de integrarla:
- usar exactamente sus archivos fuente actuales; no reconstruirla de memoria;
- sanear el prototipo fuera del camino de persistencia: eliminar JS duplicado, reconciliar IDs/controles y corregir inserción contextual de bloques;
- preservar diseño/experiencia, pero separar DOM/editor de almacenamiento, cifrado, sync y navegación de OANIX;
- no copiar persistencia demo, datos demo, blob URLs como almacenamiento permanente ni dependencias CDN innecesarias;
- bloques pesados deben referenciar assets de OANIX, no materializar archivos grandes completos en DOM/RAM.

**Bloqueo actual de integración visual:** en las ejecuciones automatizadas de 2026-09-01 no estuvieron accesibles los archivos exactos `qwen.html` y `appquen.js` mediante la biblioteca disponible. No sustituirlos por archivos antiguos o parecidos. Continuar únicamente con trabajo seguro que no requiera inventar su contenido y volver a buscar la fuente exacta en ejecuciones posteriores.

## Garantías de edición que la nueva hoja debe conservar

El cuerpo actual usa un editor uncontrolled: una tecla no copia el documento entero a estado React ni vuelve a renderizar Home.

- snapshot completo solo en fronteras seguras de guardado;
- autoguardado local después de ~3 s sin actividad;
- no cifrar ni escribir IndexedDB dentro de `onInput`;
- guardados serializados y baseline solo después de commit local correcto;
- si el usuario escribe durante un guardado, la generación nueva queda dirty y se guarda después;
- cerrar espera cualquier save en curso y persiste el snapshot pendiente más reciente;
- el cierre rápido antes del idle no puede perder texto;
- Atrás Android debe seguir la capa activa y conservar el mismo cierre seguro.

El camino crítico de una tecla no debe:
- serializar todo el DOM;
- cifrar;
- escribir IndexedDB;
- recorrer la bóveda;
- disparar sync pesado.

La antigua hoja rayada y su contrato histórico pueden servir para entender problemas pasados, pero **no son autoridad visual ni base técnica de la nueva plantilla**.

## Persistencia incremental y sincronización futura

**Persistencia incremental local implementada:** las notas nuevas usan metadata + manifiesto + chunks de texto estables y una cola cifrada `sync.v2.pending`.

Propiedades actuales:
- chunks de texto con objetivo ~16 Ki caracteres y límites normales 8–24 Ki;
- una edición localizada reescribe únicamente las unidades afectadas y el manifiesto pequeño;
- cambios separados intentan resincronizarse con chunks intactos para no reescribir el tramo intermedio;
- no-op de título/texto evita cifrado/escritura innecesarios;
- writes/deletes + tombstones pendientes se confirman atómicamente;
- notas `plain-text-v1` anteriores siguen legibles y migran perezosamente al editarse, sin borrar todavía el registro legacy;
- reabrir lee solo los chunks referenciados por esa nota;
- PR #543 añadió autoguardado local por idle sobre esta misma persistencia incremental.

**Aún pendiente:** el coordinador remoto no consume todavía `sync.v2.pending`.

DECIDED para el coordinador, todavía no conectado:
- actividad de edición bloquea el trabajo pesado de sincronización;
- cada modificación renueva la actividad;
- después de ~3 s sin cambios se puede intentar sync;
- si el usuario vuelve a editar, el intento pendiente se cancela/posterga y el trabajo en curso se pausa cooperativamente después de la operación atómica segura;
- no aplicar cambios remotos sobre la nota activa mientras se edita;
- no habrá botón manual de sincronizar;
- al salir, si hay sync pendiente y conexión, usar pantalla completa de **Sincronizando…** antes de volver a la lista;
- offline: guardar cifrado local y permitir salir.

El `AutoSyncRuntime` anterior no se reutiliza tal cual como coordinador del nuevo editor.

## Feedback de operaciones largas

Si una operación tarda aproximadamente más de 500–800 ms, OANIX debe indicar que sigue trabajando.

- porcentaje solo si es medible de verdad;
- si no, progreso indeterminado;
- mostrar fases reales: Guardando / Cifrando / Sincronizando / Verificando / Listo;
- usar pantalla completa cuando la acción bloquee navegación o sea crítica;
- aplicar en móvil/PC y Día/Noche.

## Arquitectura

Requisito permanente:
`UI → estado/servicios → dominio → almacenamiento cifrado → vault/crypto`.

Un rediseño futuro debe poder reemplazar componentes visuales sin reescribir seguridad, almacenamiento, sync o reglas de negocio.

La misma regla aplica al Home y al editor: una plantilla es una superficie reemplazable, no una nueva arquitectura de datos.

## Archivos grandes

El motor de archivos grandes y Google Drive ya implementados **no se borran**. Se preservan durante la reconstrucción y se retomarán después de estabilizar la nueva base.

No cargar archivos gigantes completos en RAM; mantener procesamiento por fragmentos y reanudación/checkpoints existentes.

## Próximo paso exacto

1. Volver a obtener los archivos fuente exactos de la nueva plantilla (`qwen.html` y `appquen.js`) sin usar copias antiguas o aproximadas.
2. Sanear esa plantilla de forma aislada: una sola autoridad JS, IDs coherentes, inserción de bloques en contexto y controles funcionales.
3. Adaptarla detrás de `EditorSurface` sin que importe persistencia, cifrado, vault, sync, Home ni hojas anteriores.
4. Conectar primero título + texto al contrato existente y demostrar guardar/reabrir/cerrar/Atrás Android sin pérdida.
5. Incorporar bloques especiales progresivamente con identidad por bloque y assets referenciados.
6. Someterla a estrés con documentos grandes, muchos bloques, escritura rápida, scroll largo, imágenes/archivos, móvil/PC y Día/Noche.
7. Solo entonces retirar la implementación visual transitoria y avanzar al coordinador remoto de `sync.v2.pending`.

## Continuidad

Las decisiones duraderas completas están en `docs/PROJECT_MEMORY.md`. No pedir al usuario que vuelva a explicar decisiones registradas allí; verificar siempre el código real antes de implementar.
