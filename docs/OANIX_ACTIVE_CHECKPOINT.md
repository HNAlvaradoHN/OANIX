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

- PR #641 — `feat: activa sync v2 incremental con R2`: fusionado el 2026-09-06.
- Merge de #641: `36af8cc9f85da3da2a57c570803f28738942cd39`.
- HEAD final fusionado de #641: `13adb16ae72c02f187684abefd7324afc207fe71`.
- Gates del HEAD final antes del merge: OANIX CI #2873 success, OANIX Android #2225 success, Qwen Independent PR Review #1111 success.
- Después del merge solo se han realizado ajustes documentales de continuidad; verificar el SHA vivo de `main` antes de cualquier nueva modificación.

## Estado funcional alcanzado

- El editor vigente quedó consolidado en PR #629 con edición natural por renglones `contentEditable`, Selection/Range, Párrafo/H2/H3, Enter/Backspace natural, undo/redo y persistencia incremental mediante el host. **No existe un frente activo de sustitución de editor.**
- PRs #630–#638 completaron y corrigieron personalización, orden, scroll y drag/reorder del Home/lista de notas.
- PR #639 preparó la sincronización v2 incremental con índice pequeño en Supabase y objetos cifrados en R2.
- PR #640 conectó GitHub Pages con el gateway R2.
- PR #641 montó `V2AutoSyncRuntime` post-unlock y activó `runV2IncrementalSync` sobre `sync.v2.pending`.
- `RebuildApp` se refresca mediante `key={workspaceRevision}` solo después de aplicar cambios remotos.
- Carpetas y etiquetas generan revisiones/pending para crear, editar, reordenar y eliminar.
- No se reactivó `AutoSyncRuntime` legacy ni el escaneo completo de ciphertext.

## Corrección de continuidad realizada en OANIX #6

La documentación anterior todavía trataba una futura plantilla basada en `qwen.html`/`appquen.js` como siguiente frente. Eso estaba desfasado frente al código y a los PRs recientes. Esa dirección queda **SUPERSEDED como siguiente acción**. No buscar ni integrar esos archivos salvo nueva instrucción explícita del usuario.

`docs/CURRENT_STATE.md` fue reescrito el 2026-09-06 para reflejar el estado implementado real: editor terminado, Home/lista avanzados y sync v2/R2 como frente más reciente.

## Restricciones vigentes

- GitHub y el `main` real mandan sobre cualquier resumen anterior.
- No modificar el editor salvo solicitud nueva o defecto concreto demostrado.
- No retirar `key={workspaceRevision}` ni degradar el runtime v2 para satisfacer expectativas de tests antiguas.
- No reactivar `AutoSyncRuntime` legacy ni escaneos completos de ciphertext.
- Ante un fallo de CI: localizar el primer error concreto, contrastarlo con el HEAD que falló, determinar causa raíz y aplicar el cambio mínimo correcto. Si la causa ya está suficientemente verificada y el cambio es pequeño/reversible, actuar de inmediato y repetir los gates hasta verde; no estancarse repitiendo diagnóstico.
- No afirmar validación física que no haya realizado el usuario.

## Siguiente acción exacta

Validar de extremo a extremo la sincronización v2 recién activada, sin tocar el editor: comprobar intercambio real entre dos dispositivos/sesiones de la misma cuenta y bóveda, refresco remoto sin reload completo, bloqueo de aplicación remota mientras una nota esté abierta, recuperación tras offline y propagación incremental de notas/carpetas/etiquetas. Si aparece un fallo, investigar el flujo v2 actual y corregir su causa raíz.

## Último trabajo realmente completado

Se llevó #641 a verde, se fusionó en `main` y quedó activa la sincronización incremental v2 con R2. En este chat también se detectó y corrigió un error de continuidad: `CURRENT_STATE.md` y este checkpoint seguían apuntando a un trabajo viejo del editor pese a que PR #629 ya lo había consolidado días antes. El próximo trabajo ya no es el editor; es validar en uso real la sincronización v2 recién activada.
