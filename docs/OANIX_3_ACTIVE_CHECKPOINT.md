# OANIX #3 — checkpoint activo

Fecha: 2026-09-04

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub sigue siendo la fuente de verdad.
- **Imágenes**: cerrado y validado físicamente.
- **Archivos**: cerrado técnicamente; validación física pendiente.
- **Código**: cerrado técnicamente; validación física pendiente.
- **Checklist**: cerrado técnicamente con corrección de contraste por tema; validación física pendiente.
- **Contacto**: cerrado técnicamente con los ajustes más recientes; validación física pendiente.
- **Separador**: cerrado técnicamente; validación física pendiente.
- **Entrada**: cerrado técnicamente con tarjeta reforzada, calendario, eliminación, preservación de tema y política de teclado; validación física pendiente.

## AJUSTE MÁS RECIENTE — TARJETA DE ENTRADA E INDICADOR LATERAL

Se cerró técnicamente el PR #621 después de la validación física donde **Entrada** todavía se percibía demasiado integrada con la hoja y la barrita del menú lateral podía perderse visualmente según el tema.

Quedó implementado:

- Entrada conserva `--color-surface`, `--color-text` y el `--accent` del tema activo, pero ahora usa una superficie ligeramente tintada por el acento del tema, borde más definido y una elevación visual más clara.
- Se añadió una pequeña guía superior con el mismo `--accent` para reforzar la percepción de tarjeta independiente sin convertirla en un elemento ajeno al tema.
- Título y contenido de Entrada se separan mejor del fondo de la tarjeta y mantienen contraste en temas claros y oscuros.
- La barrita ubicada junto a los tres puntos del indicador lateral conserva el color `--accent` de cada tema.
- Esa barrita ahora tiene un brillo sutil de dos niveles, tipo luz encendida, para localizarla más fácilmente sin volverla estridente.
- No se modificaron el arrastre, la posición, la apertura del menú ni la política de teclado.
- Se añadieron regresiones para exigir que Entrada siga derivando de las variables del tema y que el indicador lateral mantenga `--accent` con brillo sutil.

### PR, head, gates y merge

- PR **#621 — `ui: separa Entrada y realza el indicador lateral por tema`**.
- Head final: `044f7d33d6267bb087bf2c58676f6ade3e06f620`.
- OANIX CI #2649: **success**.
- OANIX Android #2001: **success**.
- Qwen Independent PR Review #919: **success**.
- Merge squash a `main`: `5084b1daaa0287d2d7393539c8772bcb636d37db`.

### Validación física pendiente — ajuste #621

Comprobar manualmente en Android:

- Entrada en Claro, Crema, Sepia, Oscuro, Medianoche, Bosque, Rosa y Lavanda;
- confirmar que Entrada se percibe como tarjeta independiente de la hoja, pero sigue armonizando con el tema;
- confirmar que los campos internos mantienen contraste correcto;
- revisar la barrita lateral junto a los tres puntos en cada tema y confirmar que el brillo ayuda a encontrarla sin ser excesivo;
- confirmar que el color de la barrita sigue cambiando con el `--accent` del tema.

No marcar esta validación física como completada hasta confirmación del usuario.

## AJUSTE — CONTRASTE DE CHECKLIST Y PRESERVACIÓN DE TEMA

Se cerró técnicamente el PR #620 después de detectar en validación física que **Checklist** conservaba una superficie clara dentro de temas oscuros y que el remount usado por **Entrada** podía devolver la hoja al tema claro.

Quedó implementado:

- Checklist dejó de depender de las variables antiguas `--oanix-text` y `--oanix-sheet`, cuyos fallbacks producían fondo claro y texto de bajo contraste en temas oscuros.
- Checklist ahora deriva superficie, texto, texto secundario y placeholder de `--color-surface`, `--color-text`, `--color-text-secondary` y `--color-placeholder` del tema activo.
- Encabezado, filas, controles, placeholder y pie de Checklist se adaptan al tema seleccionado.
- Entrada captura el modo visual y el tema exacto antes del remount requerido al insertar o eliminar una Entrada.
- Después del remount se restauran el modo y el tema seleccionados, evitando que una inserción o eliminación de Entrada cambie visualmente la hoja a Claro.
- La política común de no reabrir automáticamente el teclado al usar `Añadir contenido` se mantiene intacta.
- Se añadieron regresiones para impedir volver a usar las variables antiguas de Checklist y para exigir preservación del tema durante el remount de Entrada.

### PR, head, gates y merge

- PR **#620 — `fix: corrige contraste de Checklist y conserva tema al añadir Entrada`**.
- Head final: `fd83d421a019c1557f60c49dc68cc589456a4af7`.
- OANIX CI #2646: **success**.
- OANIX Android #1998: **success**.
- Qwen Independent PR Review #918: **success**.
- Merge squash a `main`: `2cfd3b8305b86c3fcebe9c9ce5d5011ae3e978c8`.

### Validación física pendiente — ajuste #620

Comprobar manualmente en Android:

- Checklist en Claro, Crema, Sepia, Oscuro, Medianoche, Bosque, Rosa y Lavanda, verificando que texto, fondo, botones y placeholder tengan contraste legible;
- seleccionar un tema distinto de Claro, insertar Entrada y confirmar que el tema no cambia;
- eliminar una Entrada y confirmar que el tema tampoco cambia;
- confirmar que el teclado continúa sin reaparecer automáticamente al añadir contenido.

No marcar esta validación física como completada hasta confirmación del usuario.

## ENTRADA — ELIMINACIÓN DURABLE

Se cerró técnicamente el PR #619 para completar la regla de producto: **si un elemento se puede añadir, también debe existir una vía segura y persistente para quitarlo**.

Quedó implementado:

- Entrada muestra `Eliminar entrada`.
- Pide confirmación antes de borrar.
- Espera a que no existan cambios pendientes sin guardar.
- Elimina el bloque `dailyEntry` persistido y actualiza el orden del documento.
- Después de borrar remonta la superficie para que desaparezca inmediatamente y no reaparezca al cerrar/reabrir.

### PR, head, gates y merge

- PR **#619 — `fix: permite eliminar Entrada de forma durable`**.
- Head final: `34a90a381f43969d203ca985775710f4f8eea98a`.
- OANIX CI #2643: **success**.
- OANIX Android #1995: **success**.
- Qwen Independent PR Review #917: **success**.
- Merge squash a `main`: `e0a4d8227e6375b62e510dd61ce73b141071bdc0`.

## ENTRADA, TEMAS Y TECLADO — PR #618

Se cerró técnicamente la corrección solicitada durante la revisión física de **Entrada** mediante el PR #618.

Quedó implementado:

- Entrada se presenta como tarjeta/marco independiente de la hoja, con borde, radio, fondo y sombra propios.
- Sus colores se derivan de `--color-surface` y `--color-text`.
- Se estableció como regla común para `Añadir contenido` que insertar **Entrada, Imagen, Archivos, Código, Checklist, Contacto o Separador** no reactive automáticamente el teclado.
- Tras una inserción, el foco editable se suprime hasta que el usuario toca explícitamente un campo donde quiera escribir.
- Entrada conserva el desplazamiento para mostrar el bloque recién insertado, pero ya no enfoca automáticamente el título.

### PR, head, gates y merge

- PR **#618 — `fix: enmarca Entrada y evita reabrir teclado al añadir contenido`**.
- Head final: `40df4f819c0985bdd0b29017db895d2f8c77ba5e`.
- OANIX CI #2640: **success**.
- OANIX Android #1992: **success**.
- Qwen Independent PR Review #916: **success**.
- Merge squash a `main`: `694737417ef82966dc3e5b943bb9486dd884f661`.

## ENTRADA — IMPLEMENTACIÓN BASE CERRADA

Se cerró técnicamente la opción **Entrada** del menú de OANIX Notes mediante el PR #617.

Quedó implementado:

- `Añadir contenido -> Entrada` inserta el bloque en la posición guardada del cursor, tanto desde nota plain como mixed.
- La entrada usa fecha local automática del dispositivo en formato persistido `YYYY-MM-DD`, sin conversión UTC.
- El icono de calendario y la fecha visible son tocables y abren el selector de fecha.
- Se puede cambiar la fecha a una fecha pasada o futura y el cambio queda persistido solo en ese bloque.
- Cada Entrada dispone de título opcional y contenido editable dentro de una isla atómica independiente.
- El bloque se reconoce y reconstruye al cerrar y reabrir la nota.

### PR, head, gates y merge

- PR **#617 — `feat: agrega Entrada con calendario editable`**.
- Head final: `7f82d949be53377082a553feefb4399e38052d20`.
- OANIX CI #2637: **success**.
- OANIX Android #1989: **success**.
- Qwen Independent PR Review #915: **success**.
- Merge squash a `main`: `7aecaf0357a2cc9af12eee96244849b0549f3f47`.

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

Validar primero el ajuste recién cerrado del PR #621: separación visual de Entrada y brillo temático del indicador lateral. En la misma pasada volver a confirmar Checklist y preservación de tema del PR #620, eliminación durable de Entrada (#619) y la política de teclado (#618). Después continuar con Contacto, Archivos, Código, Checklist y Separador, y finalmente una nota combinada con texto + imagen + archivos + código + checklist + contacto + separador + entrada; cerrar, reabrir, editar y volver a cerrar.

## Siguiente acción exacta

Validar físicamente en Android el PR #621. No marcarlo como validado físicamente hasta confirmación del usuario. Después continuar con los demás bloques pendientes.

---

## PR #625 — FLUJO DE FORMATOS Y LIMPIEZA DEL EDITOR

En curso sobre `fix/text-format-flow-clean-2026-09-04` hasta que el último SHA pase todos los gates y sea fusionado a `main`.

Quedó implementado:

- se conserva la posición vertical de la nota al aplicar formatos que refrescan la superficie;
- Párrafo mantiene renglón de 30 px sin recuadro de foco;
- H2 usa renglón propio de 42 px y H3 de 36 px, con `line-height` y patrón en la misma cadencia para evitar deriva;
- Enter normal en H2/H3 termina el encabezado y crea inmediatamente un Párrafo; si el cursor está en medio, el texto restante pasa al nuevo Párrafo;
- la persistencia continúa detrás de los contratos existentes, sin almacenamiento paralelo.

### Limpieza realizada en #625

Se retiró la implementación visual sustituida que ya no formaba parte del registro activo: `NoteEditor`, su CSS/renglón antiguo, el adaptador plain-text transitorio, la superficie Qwen duplicada, sus rich blocks/CSS y las pruebas acopladas exclusivamente a esas implementaciones. Las pruebas de persistencia y host ahora validan el editor OANIX activo y sus contratos vigentes en lugar de archivos o JSX obsoletos.

Se conserva deliberadamente la compatibilidad necesaria para datos históricos: codecs, políticas de carga/transición, persistencia cifrada, bloques y fallbacks para abrir notas existentes. También se conserva Qwen como revisor independiente de PR porque esa integración no pertenece al editor visual sustituido.

### Validación pendiente de #625

El último SHA del PR debe terminar con OANIX CI, OANIX Android y Qwen en verde antes del merge. Después del merge sigue pendiente validación física en Android para confirmar: nota larga sin salto al inicio, alineación visual de H2/H3 y Enter → Párrafo.