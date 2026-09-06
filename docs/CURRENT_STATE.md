# OANIX — Estado actual para continuidad

**Última actualización:** 2026-09-06

Este documento es el checkpoint general vigente. Antes de trabajar, verificar siempre `main`, PRs recientes y `docs/OANIX_ACTIVE_CHECKPOINT.md`; GitHub es la fuente de verdad.

## Dirección activa

La reconstrucción post-unlock ya superó los frentes de Home y editor. **No existe un trabajo activo para sustituir o reconstruir el editor.**

El frente más reciente implementado es la sincronización incremental v2 con Supabase + R2. La implementación está terminada y fusionada; su validación real extremo a extremo queda temporalmente bloqueada por una restricción operativa de Supabase comunicada por el usuario, prevista hasta aproximadamente el **2026-09-16**.

Se conservan como invariantes:
- bootstrap y bloqueo/desbloqueo;
- vault/session y cifrado AES-GCM/AAD;
- almacenamiento cifrado local v2;
- datos existentes y migración no destructiva;
- misma base React + TypeScript para PWA y Android/Capacitor;
- UI desacoplada de persistencia, cifrado y sync.

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

PR #629 consolidó el editor natural por renglones con `contentEditable`, `Selection`/`Range`, Párrafo/H2/H3, Enter/Backspace natural, pegado de texto plano, undo/redo y persistencia incremental mediante el host.

`EditorSurface` continúa como frontera arquitectónica entre Home y la implementación del editor. Eso **no significa que haya una plantilla nueva pendiente**.

Las referencias anteriores a `qwen.html`, `appquen.js`, réplica V16 o sustitución del editor quedan **SUPERSEDED como siguiente acción**.

## Persistencia incremental local — IMPLEMENTED

Las notas v2 usan metadata + manifiesto + unidades/chunks estables y cola cifrada `sync.v2.pending`.

Propiedades vigentes:
- no-op evita cifrado/escritura innecesarios;
- cambios localizados reescriben únicamente unidades afectadas;
- writes/deletes/tombstones se coordinan de forma atómica;
- datos legacy compatibles migran perezosamente cuando corresponde;
- carpetas y etiquetas también generan revisiones/pending para cambios relevantes.

## Sincronización incremental v2 + R2 — IMPLEMENTED

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

## Validación real — VALIDATION_DEBT / BLOCKED_EXTERNAL

El usuario informó el 2026-09-06 que Supabase mantiene una restricción que impide ejecutar por ahora la prueba real completa, con final previsto alrededor del **2026-09-16**.

Por tanto:
- la implementación de R2/Supabase/sync v2 **no se considera incompleta** por esta limitación externa;
- todavía no se puede declarar validado en campo el recorrido dispositivo A → nube → dispositivo B;
- no rehacer la arquitectura ni reactivar el runtime legacy por este bloqueo;
- cuando Supabase vuelva a estar disponible, la primera prueba pendiente es validar notas, carpetas, etiquetas, offline/reconexión y aplicación remota sin reload completo.

## Estado de `main`

PR #641 fue fusionado el 2026-09-06. Después del merge se realizaron únicamente ajustes documentales de continuidad y limpieza de trabajo viejo. Consultar el SHA vivo de `main` antes de cualquier nueva modificación.

## Próximo paso exacto

Mientras continúe la restricción de Supabase, avanzar únicamente en trabajo que no dependa de esa validación remota. **No abrir de nuevo el editor ni rehacer R2/Supabase.**

Cuando Supabase vuelva a estar disponible, retomar inmediatamente la validación extremo a extremo de sync v2 + R2 y cerrar esa deuda solo con evidencia real.

## Continuidad

El punto operativo exacto vive en `docs/OANIX_ACTIVE_CHECKPOINT.md`. Las decisiones duraderas continúan en `docs/PROJECT_MEMORY.md`. Los PRs y el código de `main` prevalecen cuando cualquier documento antiguo contradiga el estado implementado.
