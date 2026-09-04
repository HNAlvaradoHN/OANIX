# OANIX #3 — checkpoint activo

Fecha: 2026-09-04

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.
- **Imágenes**: cerrado y validado físicamente.
- **Archivos**: cerrado técnicamente; validación física pendiente.
- **Código**: cerrado técnicamente; validación física pendiente.
- **Checklist**: cerrado técnicamente; validación física pendiente.
- **Contacto**: cerrado técnicamente con los ajustes más recientes; validación física pendiente.
- **Separador**: cerrado técnicamente; validación física pendiente.
- **Entrada**: cerrado técnicamente; validación física pendiente.

## AJUSTE MÁS RECIENTE — ENTRADA

Se cerró técnicamente la opción **Entrada** del menú de OANIX Notes mediante el PR #617.

Quedó implementado:

- `Añadir contenido -> Entrada` inserta el bloque en la posición guardada del cursor, tanto desde nota plain como mixed.
- La entrada usa fecha local automática del dispositivo en formato persistido `YYYY-MM-DD`, sin conversión UTC.
- El icono de calendario y la fecha visible son tocables y abren el selector de fecha.
- Se puede cambiar la fecha de una entrada a una fecha pasada o futura; el cambio afecta únicamente ese bloque y queda persistido.
- Cada Entrada dispone de título opcional y contenido editable dentro de una isla atómica independiente.
- El bloque se reconoce y reconstruye al cerrar y reabrir la nota.
- La inserción espera el estado guardado real del editor cuando existen cambios pendientes para evitar perder texto al reconstruir la superficie.
- Se añadieron pruebas de codec, inserción plain/mixed, rollback transaccional, calendario, atomicidad, renderer y proyección.
- Durante el primer pase de CI se detectó una aserción estática antigua demasiado amplia en el guard móvil; se corrigió la prueba para validar la regla real sin bloquear la localización legítima del textarea plain requerida por Entrada.

### PR, head, gates y merge

- PR **#617 — `feat: agrega Entrada con calendario editable`**.
- Head final: `7f82d949be53377082a553feefb4399e38052d20`.
- OANIX CI #2637: **success**.
- OANIX Android #1989: **success**.
- Qwen Independent PR Review #915: **success**.
- Merge squash a `main`: `7aecaf0357a2cc9af12eee96244849b0549f3f47`.

### Validación física pendiente — Entrada

Comprobar manualmente en Android:

- colocar el cursor en medio de texto y tocar Entrada;
- confirmar que aparece exactamente allí y toma la fecha local del día;
- tocar el icono o la fecha y cambiarla a una fecha pasada y luego futura;
- confirmar que la fecha elegida persiste solo en esa entrada;
- escribir título opcional y contenido, cerrar/reabrir y verificar persistencia;
- repetir la inserción dentro de una nota mixed con otros bloques.

No marcar Entrada como validada físicamente hasta confirmación del usuario.

## CONTACTO — AJUSTES TÉCNICOS CERRADOS, VALIDACIÓN FÍSICA PENDIENTE

- Los contactos nuevos nacen con nombre vacío; no se precarga `Nuevo contacto`.
- Las tarjetas antiguas cuyo valor legado sea exactamente `Nuevo contacto` se presentan con el nombre vacío para poder escribir directamente.
- El teléfono acepta y persiste solo dígitos, sin prefijo fijo `+504`.
- El correo inválido se descarta silenciosamente al salir del campo; no se muestra mensaje rojo ni aviso visual intrusivo.
- El botón `⛶` de Contacto pertenece únicamente a **Notas** y respeta el candado.
- PR #615 merge `2246a1f2142d874c67f090620e9c443915b50c42` — CI #2631 ✅ · Android #1983 ✅ · Qwen #912 ✅.
- PR #616 merge `73775614e7103cf27ec054790811dc851687cb11` — CI #2633 ✅ · Android #1985 ✅ · Qwen #913 ✅.

## Cierres técnicos anteriores

- **Archivos** — PR #608, merge `930c2526c614c1b2dcc9703b43db330c6a996131`, CI #2607 ✅ · Android #1959 ✅ · Qwen #904 ✅.
- **Código** — PR #609, merge `51d3e012f84ad28842989f8f9b80a2b4553d5892`, CI #2610 ✅ · Android #1962 ✅ · Qwen #905 ✅.
- **Checklist** — PR #610, merge `e7560ba48a3ca53e93f776fadfa4f71a6afca56c`, CI #2613 ✅ · Android #1965 ✅ · Qwen #906 ✅.
- **Contacto** — PR #611, merge `20cb50dddc5f74a82a8db20abebe76b1814b5b2c`, CI #2616 ✅ · Android #1968 ✅ · Qwen #907 ✅.
- **Separador** — PR #612, merge `fefce0b8f6209692ba607ff812b876330dbfcb50`, CI #2619 ✅ · Android #1971 ✅ · Qwen #908 ✅.
- **Correcciones de revisión física** — PR #613, merge `f3b5e1d96374f4637124c970c21c02cdcb0ca5ef`, CI #2624 ✅ · Android #1976 ✅ · Qwen #910 ✅.
- **Pantalla completa Código/Contacto** — PR #614, merge `f86ea972bc20a0300416362c265fe734ab8e1cc3`, CI #2626 ✅ · Android #1978 ✅ · Qwen #911 ✅. La parte de Contacto quedó supersedida por #615/#616: actualmente `⛶` abre únicamente Notas.
- **Imágenes** — cerrado y validado físicamente; PR #607 merge `153948cd77f14ad5f42c08e48717d158bbb97c8a`, CI #2598 ✅ · Android #1950 ✅ · Qwen #898 ✅.

## Validación física pendiente — orden recomendado

Validar primero el ajuste recién cerrado de **Entrada** y los ajustes recientes de **Contacto**. Después continuar con Archivos, Código, Checklist y Separador, y finalmente una nota combinada con texto + imagen + archivos + código + checklist + contacto + separador + entrada; cerrar, reabrir, editar y volver a cerrar.

## Siguiente acción exacta

Validar físicamente **Entrada** en Android: posición del cursor, fecha local automática, cambio de fecha desde el calendario, título/contenido y persistencia tras reapertura. No marcarla como validada físicamente hasta confirmación del usuario. Después continuar con los ajustes físicos pendientes de Contacto y los demás bloques.
