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

- `main` verificado inmediatamente antes de este checkpoint: `fd48139d6809ec130978b7f0f7019f5ed62f10c4`.
- PR #641 — `feat: activa sync v2 incremental con R2`: fusionado el 2026-09-06.
- Merge de #641: `36af8cc9f85da3da2a57c570803f28738942cd39`.
- HEAD final de #641 antes del merge: `13adb16ae72c02f187684abefd7324afc207fe71`.
- Gates del HEAD final de #641: OANIX CI #2873 success, OANIX Android #2225 success, Qwen Independent PR Review #1111 success.
- No hay un PR funcional nuevo abierto para continuar después de #641.
- Los drafts experimentales de editor #589, #590 y #591 fueron cerrados como trabajo superado; sus ramas/historial se conservan únicamente para trazabilidad.

## Estado funcional vigente

- Editor: **IMPLEMENTED / no es frente activo**. PR #629 consolidó el editor natural por renglones.
- Home/lista/reorder: **IMPLEMENTED** en la evolución reciente #630–#638.
- Persistencia local v2: **IMPLEMENTED** con metadata/manifiesto/chunks estables y `sync.v2.pending`.
- Sync incremental v2 + R2: **IMPLEMENTED**, pendiente de validación real extremo a extremo.
- `V2AutoSyncRuntime` se monta post-unlock y usa `runV2IncrementalSync`.
- `RebuildApp` se refresca mediante `key={workspaceRevision}` después de aplicar remoto; no usar `location.reload()`.
- Supabase conserva metadata/cursor; R2 conserva payload cifrado mediante gateway privado.
- Carpetas y etiquetas generan revisiones/pending para crear, editar, reordenar y eliminar.
- `AutoSyncRuntime` legacy y el escaneo completo de ciphertext permanecen fuera de la dirección activa.

## Limpieza documental completada en OANIX #6

Se corrigió la documentación que todavía arrastraba trabajo viejo:

- `docs/CURRENT_STATE.md`: editor marcado como implementado y sync v2/R2 como frente vigente.
- `docs/ROADMAP.md`: reconstrucción post-unlock cerrada; archivos grandes preservados pero no frente inmediato; sync v2 pasa a fase actual de validación.
- `docs/PROJECT_MEMORY.md`: depurada para conservar solo decisiones duraderas vigentes y retirar planes obsoletos como pendientes activos.
- `AGENTS.md`: eliminada la prioridad vieja de reconstruir Home/editor y reemplazada por validación real de sync v2.
- `docs/OANIX_CHAT_PROTOCOL.md`: continuidad activa OANIX #6 → #7 ya actualizada.

Las referencias a `qwen.html`, `appquen.js`, réplica V16 o sustitución del editor quedan **SUPERSEDED como trabajo activo**. Solo pueden retomarse por una nueva decisión explícita o evidencia técnica nueva.

## Restricciones vigentes

- GitHub `main` manda sobre cualquier documento, memoria o chat anterior.
- No modificar/reconstruir el editor salvo nueva solicitud o defecto concreto demostrado.
- No reactivar runtimes legacy para resolver problemas del sync v2.
- No retirar `key={workspaceRevision}` ni degradar comportamiento correcto para satisfacer tests antiguos.
- Ante fallos: causa raíz verificada → cambio mínimo correcto → gates → repetir hasta verde.
- No afirmar validación física que no haya realizado el usuario.
- No borrar historial útil de Git/PRs solo por limpieza documental; cerrar/superseder es preferible cuando aporta trazabilidad.

## Siguiente acción exacta

**Validar de extremo a extremo la sincronización v2 + R2 recién activada antes de abrir otro frente funcional.**

Comprobar en condiciones reales:
1. dispositivo/sesión A crea o edita una nota y sincroniza tras idle;
2. dispositivo/sesión B recibe el cambio sin recarga completa;
3. no se aplica remoto mientras una nota está abierta;
4. offline conserva cambios locales y sincroniza al reconectar;
5. crear/editar/reordenar/eliminar carpetas y etiquetas se propaga incrementalmente;
6. una bóveda sin cambios no descarga payload remoto innecesario;
7. fallos de red/auth/egress preservan contenido local y pendientes.

Si aparece un fallo, corregir el flujo v2 actual y volver a validar hasta verde. No volver al editor ni al runtime legacy como atajo.

## Último trabajo realmente completado

Se cerró #641 en verde y se fusionó el runtime incremental v2 con R2. Después se auditó la continuidad del repositorio, se detectó documentación activa desfasada y tres drafts viejos del editor todavía abiertos. Se depuraron `AGENTS.md`, `CURRENT_STATE.md`, `ROADMAP.md` y `PROJECT_MEMORY.md`, se cerraron #589–#591 sin borrar historial y se dejó un único siguiente frente vigente: validación real extremo a extremo de sync v2 + R2.
