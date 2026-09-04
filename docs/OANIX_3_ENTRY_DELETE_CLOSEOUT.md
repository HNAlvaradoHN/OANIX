# OANIX #3 — cierre de eliminación durable de Entrada

Fecha: 2026-09-04

## Estado

La corrección de eliminación de **Entrada** quedó cerrada técnicamente mediante el PR #619.

## Comportamiento cerrado

- Todo bloque Entrada muestra una vía explícita para eliminarlo.
- La eliminación solicita confirmación antes de ejecutar el borrado.
- Antes de borrar se espera que no existan cambios pendientes sin guardar.
- El bloque `dailyEntry` se elimina de persistencia y se actualiza el orden del documento en la misma operación durable.
- Tras confirmar el borrado, la superficie se reconstruye para que la Entrada desaparezca inmediatamente.
- Al cerrar y reabrir la nota, la Entrada eliminada no debe reaparecer.
- Si el guardado falla o el bloque ya no existe, no se fuerza una eliminación visual engañosa y se informa el error.

## Regla de producto reafirmada

Si OANIX permite **añadir** un elemento, ese elemento debe disponer también de una vía **segura y persistente para quitarlo**. Esta regla aplica a los elementos de `Añadir contenido` presentes y futuros.

## PR, head, gates y merge

- PR #619 — `fix: permite eliminar Entrada de forma durable`.
- Head final: `34a90a381f43969d203ca985775710f4f8eea98a`.
- OANIX CI #2643: **success**.
- OANIX Android #1995: **success**.
- Qwen Independent PR Review #917: **success**.
- Merge squash a `main`: `e0a4d8227e6375b62e510dd61ce73b141071bdc0`.

## Validación física pendiente

No marcar la validación física como completada hasta confirmación del Inge. Comprobar en Android: crear una Entrada, cancelar una eliminación y confirmar que se conserva; después confirmar una eliminación, cerrar/reabrir la nota y verificar que no reaparece; repetir con la Entrada entre otros bloques y confirmar que el orden restante se conserva.

## Regla operativa para PRs de este trabajo

Cuando los gates obligatorios estén corriendo, no esperar una nueva instrucción del Inge para continuar. En cuanto los gates requeridos estén en verde, fusionar el PR automáticamente si sigue siendo seguro y el head no cambió, actualizar la documentación de continuidad y reportar el cierre. No fusionar con gates rojos ni afirmar validación física sin confirmación real.