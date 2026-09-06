# OANIX — checkpoint operativo activo

Última actualización: 2026-09-06

## Continuidad

- Repositorio canónico: `HNAlvaradoHN/OANIX`.
- Rama de autoridad: `main`.
- Chat activo: `OANIX #6`.
- Próximo chat: `OANIX #7`.
- Usuario: `Inge`.
- Frase: `SIGUE EL CHAT AQUÍ`.
- El número y este checkpoint son rodantes: el siguiente chat debe sobrescribirlos, no crear otro archivo numerado ni conservar números anteriores como autoridad activa.

## Estado GitHub verificado

- `main`: `d400700788ece2fedb7a1fd23303fdf72b06549b`.
- PR activo: #641 — `feat: activa sync v2 incremental con R2`.
- Rama: `feat/activate-r2-incremental-sync-2026-09-05`.
- HEAD funcional previo a este checkpoint: `bc2e60c5613f44797d6675d9176d581bebc89de3`.
- El PR mantiene `V2AutoSyncRuntime` post-unlock y refresca `RebuildApp` mediante `key={workspaceRevision}` después de aplicar cambios remotos.
- Se corrigieron expectativas de tests obsoletas que exigían la forma antigua exacta de `<RebuildApp onLock={lockVault} />`; no se retiró el comportamiento correcto de la implementación para satisfacer esos tests.
- Se añadió a `AGENTS.md` la regla permanente de resolución activa de fallos: causa raíz suficientemente verificada → cambio mínimo seguro → ejecutar gates → repetir hasta verde, evitando diagnóstico circular.

## Gates del PR #641

Para HEAD `bc2e60c5613f44797d6675d9176d581bebc89de3` al registrar este checkpoint:

- OANIX CI #2871: success.
- Qwen Independent PR Review #1109: success.
- OANIX Android #2223: in progress.
- Reconsultar los gates sobre el HEAD actual antes de decidir merge, porque este propio checkpoint crea un commit posterior.

## Restricciones vigentes

- GitHub y el `main` real mandan sobre cualquier resumen anterior.
- No retirar `key={workspaceRevision}` ni degradar el runtime v2 para satisfacer expectativas de tests antiguas.
- No reactivar `AutoSyncRuntime` legacy ni escaneos completos de ciphertext.
- No declarar trabajo cerrado ni fusionar mientras un gate aplicable esté rojo o pendiente.
- Ante un fallo de CI: localizar el primer error concreto, contrastarlo con el HEAD que falló, determinar causa raíz y aplicar el cambio mínimo correcto. Si la causa ya está suficientemente verificada y el cambio es pequeño/reversible, actuar de inmediato y repetir los gates hasta verde; no estancarse repitiendo diagnóstico.
- No afirmar validación física que no haya realizado el usuario.

## Siguiente acción exacta

Reconsultar los gates del PR #641 sobre el HEAD más reciente generado por este checkpoint. Si CI, Android y Qwen quedan verdes, revisar el PR final y decidir/iniciar el merge de #641 según el flujo normal del proyecto. Después del merge, verificar `main` y actualizar la continuidad para el siguiente bloque del roadmap.

## Último trabajo realmente completado

Se diagnosticó el CI rojo de #641 como expectativas de tests obsoletas frente al montaje intencional de `RebuildApp` con `workspaceRevision`; se corrigieron todas las expectativas encontradas hasta obtener OANIX CI y Qwen verdes. Android estaba aún ejecutándose en el último HEAD funcional consultado. También se registró en `AGENTS.md` la regla permanente para que futuros agentes no se queden en diagnóstico circular cuando una corrección pequeña y segura ya está suficientemente determinada.
