# OANIX — Estado actual para continuidad

**Última actualización:** 2026-09-06

Este documento es el checkpoint general vigente. Antes de trabajar, verificar siempre `main`, PRs recientes y `docs/OANIX_ACTIVE_CHECKPOINT.md`; GitHub es la fuente de verdad.

## Dirección activa

La reconstrucción post-unlock ya superó los frentes de Home y editor. **No existe un trabajo activo para sustituir o reconstruir el editor.**

El frente más reciente implementado es la sincronización incremental v2 con Supabase + R2. El trabajo inmediato debe partir de esa realidad y no de planes anteriores de plantilla/editor.

Se conservan como invariantes:
- bootstrap y bloqueo/desbloqueo;
- vault/session y cifrado AES-GCM/AAD;
- almacenamiento cifrado local v2;
- datos existentes y migración no destructiva;
- misma base React + TypeScript para PWA y Android/Capacitor;
- UI desacoplada de persistencia, cifrado y sync.

## Regla operativa de cierre

Un trabajo de OANIX no se da por terminado con gates aplicables en rojo.

- localizar el primer fallo real contra el HEAD que falló;
- confirmar causa raíz antes de parchear;
- si la causa está suficientemente verificada y el cambio es pequeño/reversible, corregir inmediatamente;
- ejecutar de nuevo los gates y repetir hasta verde;
- no modificar comportamiento correcto solo para satisfacer una expectativa de test obsoleta.

## Home y lista de notas — IMPLEMENTED

El Home reconstruido es la autoridad post-unlock mediante `RebuildApp`.

Estado reciente integrado:
- carpetas, etiquetas y notas sobre persistencia v2;
- personalización de tarjetas de nota con icono/color;
- orden independiente en `Todas` y por carpeta;
- drag/reorder móvil con propietario de pointer estable, hit-test vertical, autoscroll y animación FLIP;
- scroll táctil real de la lista;
- reordenamiento/personalización sin crear persistencias paralelas.

PRs de referencia recientes: #630–#638.

## Editor — IMPLEMENTED / NO ES FRENTE ACTIVO

El editor actual quedó integrado y no debe reabrirse como proyecto de sustitución salvo nueva solicitud del usuario o un defecto concreto demostrado.

PR #629 (`refactor: adapta editor natural de renglones al prototipo original`) estableció el núcleo vigente:
- cada renglón de texto usa `div contentEditable`;
- selección/cursor mediante `Selection`/`Range`;
- Párrafo/H2/H3 con comportamiento natural por renglones;
- Enter divide y continúa en Párrafo;
- Backspace al inicio fusiona con el renglón anterior;
- pegado como texto plano;
- undo/redo y atajos dentro del editor;
- conservación local de selección al usar paneles;
- el host queda como adaptador de persistencia mediante `loadBlocks`, `saveBlockChanges` y flush al cerrar;
- escritura agrupada por ~3 s de inactividad;
- no se reactivó el bridge/remount anterior.

Los PR #622–#628 contienen la evolución previa de formatos y comportamiento de H2/H3; #629 es la consolidación posterior que manda sobre ellos.

`EditorSurface` continúa como frontera arquitectónica entre Home y la implementación del editor. Eso **no significa que haya una plantilla nueva pendiente**.

Cualquier referencia anterior a obtener `qwen.html`, `appquen.js` o sustituir el editor queda **SUPERSEDED como siguiente acción** por el estado realmente integrado en GitHub.

## Persistencia incremental local — IMPLEMENTED

Las notas v2 usan metadata + manifiesto + unidades/chunks estables y cola cifrada `sync.v2.pending`.

Propiedades vigentes:
- no-op evita cifrado/escritura innecesarios;
- cambios localizados reescriben únicamente unidades afectadas;
- writes/deletes/tombstones se coordinan de forma atómica;
- datos legacy compatibles migran perezosamente cuando corresponde;
- carpetas y etiquetas también generan revisiones/pending para cambios relevantes.

## Sincronización incremental v2 + R2 — IMPLEMENTED, VALIDACIÓN REAL SIGUIENTE

PR #639 preparó el protocolo remoto incremental:
- `sync_v2_records` como índice remoto pequeño con cursor monotónico;
- bindings opacos, ACKs y control de conflictos;
- gateway privado R2 sin credenciales R2 en PWA/APK;
- `runV2IncrementalSync` consume `sync.v2.pending` y mueve únicamente unidades cambiadas;
- Supabase conserva metadata operativa y R2 payload cifrado.

PR #640 conectó el build oficial de GitHub Pages con el gateway R2 de producción sin exponer credenciales.

PR #641 activó el runtime automático v2:
- `V2AutoSyncRuntime` se monta solo con la bóveda desbloqueada;
- intenta sync tras ~3 s de inactividad;
- consulta cambios remotos incrementalmente cada 60 s;
- cancela/posterga ante nueva actividad, offline u ocultamiento;
- no aplica cambios remotos mientras una nota esté abierta;
- tras aplicar cambios remotos incrementa `workspaceRevision` para refrescar `RebuildApp` sin recargar la página;
- no reactiva `AutoSyncRuntime` legacy ni escanea todo el ciphertext.

En el HEAD final de #641 pasaron OANIX CI, OANIX Android y Qwen antes del merge.

## Estado de `main`

PR #641 fue fusionado el 2026-09-06. Después del merge se realizaron únicamente actualizaciones documentales de continuidad.

Consultar el SHA vivo de `main` antes de cualquier nueva modificación; no congelar aquí un SHA como autoridad permanente.

## Próximo paso exacto

**Validar de extremo a extremo la sincronización v2 recién activada en condiciones reales antes de abrir otro frente funcional.**

La validación debe comprobar, sin modificar el editor:
1. dispositivo A crea/edita una nota y el cambio local queda sincronizado después del idle;
2. dispositivo B, con la misma cuenta/bóveda, recibe el cambio remoto sin recarga completa;
3. no se aplica contenido remoto mientras una nota está abierta en edición;
4. offline conserva cambios locales y los sincroniza al recuperar conexión;
5. crear/editar/reordenar/eliminar carpetas y etiquetas viaja mediante la cola incremental;
6. una bóveda sin cambios no provoca descargas de payload remoto innecesarias;
7. ante fallo de red/auth/egress, contenido local y pendientes permanecen intactos.

Si aparece un fallo, investigar la causa en el flujo v2 actual; **no volver al editor ni al runtime legacy como atajo**.

## Continuidad

El punto operativo exacto vive en `docs/OANIX_ACTIVE_CHECKPOINT.md`. Las decisiones duraderas continúan en `docs/PROJECT_MEMORY.md`. Los PRs y el código de `main` prevalecen cuando cualquier documento antiguo contradiga el estado implementado.
