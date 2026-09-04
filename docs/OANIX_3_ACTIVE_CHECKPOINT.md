# OANIX #3 — checkpoint activo

Fecha: 2026-09-04

## Estado actual

- Chat activo: `OANIX #3`.
- Usuario: `Inge`.
- GitHub es la fuente de verdad.
- **PR #625 cerrado y fusionado a `main`.**
- Imágenes: cerradas y validadas físicamente.
- Archivos, Código, Checklist, Contacto, Separador y Entrada: cerrados técnicamente; mantener pendientes únicamente las validaciones físicas que todavía no haya confirmado el usuario.

## PR #625 — formatos de texto y limpieza del editor

Cierre técnico completo.

Quedó implementado:

- la nota conserva su posición vertical al aplicar formatos que refrescan la superficie;
- Párrafo mantiene renglón de 30 px sin recuadro de foco;
- H2 usa renglón propio de 42 px y H3 de 36 px, con la misma cadencia entre `line-height` y patrón para evitar deriva;
- Enter normal en H2/H3 termina el encabezado y crea un Párrafo inmediatamente debajo;
- si Enter se pulsa en medio del encabezado, el texto restante pasa al nuevo Párrafo;
- la persistencia continúa detrás de los contratos existentes, sin almacenamiento paralelo;
- la compatibilidad necesaria para abrir datos históricos se conserva.

### Limpieza realizada

Se retiró código visual sustituido que ya no era autoridad activa: `NoteEditor`, su CSS/renglón antiguo, el adaptador plain-text transitorio, la superficie Qwen duplicada, sus rich blocks/CSS y pruebas acopladas exclusivamente a esas implementaciones.

Se conservó únicamente lo necesario para compatibilidad de datos, persistencia cifrada, políticas de carga/transición y revisión independiente de PR.

### Gates y merge

- Head final: `ef8c124148ccec104cce04dd8a2c16cfae0ddeeb`.
- OANIX CI #2692: **success**.
- OANIX Android #2044: **success**.
- Qwen Independent PR Review #954: **success**.
- Merge squash a `main`: `5e685329261cc24db7149a5a9fa553d1fd9af58c`.

## Validación física pendiente de #625

En Android, confirmar:

- aplicar Párrafo/H2/H3 en una nota larga sin salto al inicio;
- alineación visual de los renglones de H2 y H3;
- Enter en H2/H3 → Párrafo debajo;
- en caso de Enter en medio del encabezado, el texto restante pasa correctamente al Párrafo;
- Día/Noche y temas existentes sin recuadro de foco ni cambio inesperado de tema.

No marcar esta validación física como completada hasta confirmación del usuario.

## Cierres técnicos recientes relevantes

- #607 Imágenes — merge `153948cd77f14ad5f42c08e48717d158bbb97c8a` — validado físicamente.
- #608 Archivos — merge `930c2526c614c1b2dcc9703b43db330c6a996131`.
- #609 Código — merge `51d3e012f84ad28842989f8f9b80a2b4553d5892`.
- #610 Checklist — merge `e7560ba48a3ca53e93f776fadfa4f71a6afca56c`.
- #611 Contacto — merge `20cb50dddc5f74a82a8db20abebe76b1814b5b2c`.
- #612 Separador — merge `fefce0b8f6209692ba607ff812b876330dbfcb50`.
- #613 correcciones físicas — merge `f3b5e1d96374f4637124c970c21c02cdcb0ca5ef`.
- #614 pantalla completa Código/Contacto — merge `f86ea972bc20a0300416362c265fe734ab8e1cc3`.
- #615/#616 ajustes Contacto — merges `2246a1f2142d874c67f090620e9c443915b50c42` y `73775614e7103cf27ec054790811dc851687cb11`.
- #617 Entrada base — merge `7aecaf0357a2cc9af12eee96244849b0549f3f47`.
- #618 Entrada/tema/teclado — merge `694737417ef82966dc3e5b943bb9486dd884f661`.
- #619 eliminación durable de Entrada — merge `e0a4d8227e6375b62e510dd61ce73b141071bdc0`.
- #620 contraste Checklist + preservación de tema — merge `2cfd3b8305b86c3fcebe9c9ce5d5011ae3e978c8`.
- #621 tarjeta Entrada + indicador lateral — merge `5084b1daaa0287d2d7393539c8772bcb636d37db`.
- #622 formatos de texto — merge `1d4f1815f6aeef471b73d4e1d2247fe6810d8c15`.
- #623 prueba de renglón Párrafo — merge `550582306bcd473fbed7da913b33198982aabd7b`.
- #625 corrección de flujo + limpieza de editor — merge `5e685329261cc24db7149a5a9fa553d1fd9af58c`.

## Siguiente acción exacta

Validar físicamente #625 en Android. Si queda correcto, continuar con la siguiente mejora de personalización de hoja sin reintroducir código visual sustituido.