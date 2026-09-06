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

- `main` tras merge de #641: `36af8cc9f85da3da2a57c570803f28738942cd39`.
- PR #641 — `feat: activa sync v2 incremental con R2`: fusionado.
- HEAD final fusionado de #641: `13adb16ae72c02f187684abefd7324afc207fe71`.
- Gates del HEAD final antes del merge: OANIX CI #2873 success, OANIX Android #2225 success, Qwen Independent PR Review #1111 success.
- `V2AutoSyncRuntime` queda montado post-unlock y `RebuildApp` se refresca mediante `key={workspaceRevision}` únicamente después de aplicar cambios remotos.
- Se corrigieron expectativas de tests obsoletas sin retirar comportamiento correcto de la implementación.
- `AGENTS.md` contiene ya la regla permanente: causa raíz suficientemente verificada → cambio mínimo seguro → ejecutar gates → repetir hasta verde; no quedarse en diagnóstico circular.

## Estado funcional alcanzado

- La sincronización incremental v2 ya consume la cola cifrada `sync.v2.pending` mediante `runV2IncrementalSync`.
- Supabase conserva metadata/cursor y R2 recibe payload cifrado; no se reactivó `AutoSyncRuntime` legacy ni el escaneo completo de ciphertext.
- El runtime sincroniza tras inactividad, consulta cambios remotos incrementalmente, posterga/cancela ante actividad/offline/ocultamiento y no aplica cambios remotos mientras exista un editor de nota abierto.
- Carpetas y etiquetas ya generan revisiones/pending para crear, editar, reordenar y eliminar.

## Restricciones vigentes

- GitHub y el `main` real mandan sobre cualquier resumen anterior.
- No retirar `key={workspaceRevision}` ni degradar el runtime v2 para satisfacer expectativas de tests antiguas.
- No reactivar `AutoSyncRuntime` legacy ni escaneos completos de ciphertext.
- Ante un fallo de CI: localizar el primer error concreto, contrastarlo con el HEAD que falló, determinar causa raíz y aplicar el cambio mínimo correcto. Si la causa ya está suficientemente verificada y el cambio es pequeño/reversible, actuar de inmediato y repetir los gates hasta verde; no estancarse repitiendo diagnóstico.
- No afirmar validación física que no haya realizado el usuario.
- La nueva plantilla de editor solo puede integrarse desde sus archivos fuente exactos; no reconstruir `qwen.html` ni `appquen.js` de memoria ni sustituirlos por versiones antiguas o aproximadas.

## Siguiente acción exacta

Retomar el frente de la nueva plantilla del editor. Verificar/obtener los archivos fuente exactos `qwen.html` y `appquen.js`; actualmente no existen en el árbol de `main`. Cuando estén disponibles, sanearlos de forma aislada y adaptarlos detrás de `EditorSurface`, preservando las garantías actuales de guardado/reapertura/cierre/Atrás Android y sin mezclar la plantilla con persistencia, cifrado, vault, sync o Home.

## Último trabajo realmente completado

Se corrigió la causa real del CI rojo de #641, se llevaron todos los gates del HEAD final a verde y se fusionó #641 en `main` como `36af8cc9f85da3da2a57c570803f28738942cd39`. Con ello quedó activa la sincronización incremental v2 con R2 sin reactivar el runtime legacy. También se actualizó la regla permanente de resolución de fallos y la continuidad OANIX #6 → #7. El siguiente frente vuelve a la integración de la nueva plantilla exacta del editor; sus archivos `qwen.html` y `appquen.js` aún no están disponibles en el repositorio.
