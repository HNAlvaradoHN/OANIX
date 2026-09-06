# OANIX — checkpoint operativo activo

Última actualización: 2026-09-06

## Continuidad

- Repositorio canónico: `HNAlvaradoHN/OANIX`.
- Rama de autoridad: `main`.
- Chat activo: `OANIX #6`.
- Próximo chat: `OANIX #7`.
- Usuario: `Inge`.
- Frase: `SIGUE EL CHAT AQUÍ`.
- El número y este checkpoint son rodantes: el siguiente chat debe sobrescribirlos.

## Estado GitHub verificado

- PR #641 — `feat: activa sync v2 incremental con R2`: fusionado el 2026-09-06.
- Merge de #641: `36af8cc9f85da3da2a57c570803f28738942cd39`.
- HEAD final de #641 antes del merge: `13adb16ae72c02f187684abefd7324afc207fe71`.
- Gates del HEAD final de #641: OANIX CI #2873 success, OANIX Android #2225 success, Qwen Independent PR Review #1111 success.
- No hay un PR funcional nuevo abierto para continuar después de #641.
- Los drafts experimentales de editor #589, #590 y #591 fueron cerrados como trabajo superado; sus ramas/historial se conservan únicamente para trazabilidad.
- Verificar el SHA vivo de `main` antes de cualquier modificación nueva.

## Estado funcional vigente

- Editor: **IMPLEMENTED / no es frente activo**. PR #629 consolidó el editor natural por renglones.
- Home/lista/reorder: **IMPLEMENTED** en la evolución reciente #630–#638.
- Persistencia local v2: **IMPLEMENTED** con metadata/manifiesto/chunks estables y `sync.v2.pending`.
- Sync incremental v2 + R2: **IMPLEMENTED**.
- Validación real extremo a extremo de sync v2 + R2: **VALIDATION_DEBT / BLOCKED_EXTERNAL** hasta que termine la restricción operativa de Supabase indicada por el usuario, prevista para el 2026-09-16.
- `V2AutoSyncRuntime` se monta post-unlock y usa `runV2IncrementalSync`.
- `RebuildApp` se refresca mediante `key={workspaceRevision}` después de aplicar remoto; no usar `location.reload()`.
- Supabase conserva metadata/cursor; R2 conserva payload cifrado mediante gateway privado.
- Carpetas y etiquetas generan revisiones/pending para crear, editar, reordenar y eliminar.
- `AutoSyncRuntime` legacy y el escaneo completo de ciphertext permanecen fuera de la dirección activa.

## Bloqueo externo vigente

El usuario informó el 2026-09-06 que Supabase mantiene una restricción de su cuenta/proyecto hasta aproximadamente el **2026-09-16**. Mientras esa restricción siga activa, no declarar fallida ni incompleta la implementación v2 solo porque no pueda ejecutarse todavía la validación real A → nube → B.

Hasta que Supabase vuelva a permitir la prueba real:
- no rehacer R2, Supabase ni el coordinador v2 por este motivo;
- no reabrir el editor ni runtimes legacy;
- no afirmar que la validación real fue completada;
- se puede avanzar únicamente en trabajo independiente de esa restricción o en validaciones locales/automáticas que no requieran egress operativo de Supabase.

## Limpieza documental completada en OANIX #6

Se corrigió la documentación que todavía arrastraba trabajo viejo:
- `docs/CURRENT_STATE.md`: editor marcado como implementado y sync v2/R2 como frente vigente.
- `docs/ROADMAP.md`: reconstrucción post-unlock cerrada; archivos grandes preservados pero no frente inmediato; sync v2 pasa a fase actual de validación.
- `docs/PROJECT_MEMORY.md`: depurada para conservar decisiones duraderas vigentes y retirar planes obsoletos como pendientes activos.
- `AGENTS.md`: eliminada la prioridad vieja de reconstruir Home/editor y reemplazada por el estado vigente.
- `docs/OANIX_CHAT_PROTOCOL.md`: continuidad activa OANIX #6 → #7.

Las referencias a `qwen.html`, `appquen.js`, réplica V16 o sustitución del editor quedan **SUPERSEDED como trabajo activo**.

## Restricciones vigentes

- GitHub `main` manda sobre cualquier documento, memoria o chat anterior.
- No modificar/reconstruir el editor salvo nueva solicitud o defecto concreto demostrado.
- No reactivar runtimes legacy para resolver problemas del sync v2.
- No retirar `key={workspaceRevision}` ni degradar comportamiento correcto para satisfacer tests antiguos.
- Ante fallos: causa raíz verificada → cambio mínimo correcto → gates → repetir hasta verde.
- No afirmar validación física que no haya realizado el usuario.
- No borrar historial útil de Git/PRs solo por limpieza documental.

## Siguiente acción exacta

Mientras siga la restricción de Supabase, **la validación extremo a extremo de sync v2 + R2 queda pausada como deuda de validación externa hasta alrededor del 2026-09-16**.

El próximo trabajo debe ser un bloque útil que no dependa de esa validación remota. Cuando Supabase vuelva a estar disponible, retomar primero la prueba real de sync v2 antes de declarar ese bloque completamente validado en campo.

## Último trabajo realmente completado

Se cerró #641 en verde y se fusionó el runtime incremental v2 con R2. Después se auditó y limpió la continuidad del repositorio, se cerraron drafts viejos #589–#591 y se registró el nuevo bloqueo externo: la implementación de sync v2 + R2 está terminada, pero su validación real entre dispositivos queda pendiente hasta que termine la restricción de Supabase comunicada por el usuario.