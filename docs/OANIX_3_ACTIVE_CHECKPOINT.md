# OANIX #3 — Active checkpoint

Este archivo conserva el punto operativo de continuidad de OANIX #3. La realidad de `main`, los PR y los gates prevalece sobre cualquier texto desactualizado.

## 2026-09-04 — Flujo de formatos de texto y limpieza del editor

PR #625 (`fix/text-format-flow-clean-2026-09-04`) corrige el flujo actual de formatos de texto de OANIX Notes:

- conserva la posición vertical de la nota al aplicar formatos que refrescan la superficie;
- Párrafo mantiene renglón de 30 px sin recuadro de foco;
- H2 usa renglón propio de 42 px y H3 de 36 px, con la misma cadencia entre `line-height` y patrón para evitar deriva;
- Enter normal en H2/H3 termina el encabezado y crea inmediatamente un Párrafo; si el cursor está en medio, el texto restante pasa al nuevo Párrafo;
- el cambio mantiene los límites de persistencia existentes y no crea un almacenamiento paralelo.

### Limpieza realizada

Se retiró la implementación visual sustituida que ya no formaba parte del registro activo: `NoteEditor`, su CSS/renglón antiguo, el adaptador plain-text transitorio, la superficie Qwen duplicada, sus rich blocks/CSS y las pruebas acopladas exclusivamente a esas implementaciones. También se actualizaron las pruebas de contratos vigentes para apuntar al editor OANIX activo en lugar de exigir JSX o archivos obsoletos.

No se eliminó compatibilidad de datos históricos: codecs, políticas de carga/transición, persistencia cifrada, bloques y fallbacks necesarios para abrir notas existentes permanecen protegidos. Tampoco se elimina la integración Qwen de revisión independiente de PR, porque no pertenece al editor visual antiguo.

### Validación

La validación automatizada definitiva corresponde al último SHA del PR #625 y debe quedar con OANIX CI, OANIX Android y la revisión independiente en verde antes del merge. La validación física en Android sigue siendo obligatoria para confirmar visualmente: nota larga sin salto al inicio, alineación H2/H3 y Enter → Párrafo.
