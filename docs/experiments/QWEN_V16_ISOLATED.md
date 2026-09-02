# Qwen V16 — integración aislada

Estado: IN_PROGRESS
Fecha: 2026-09-01
Rama: `exp/qwen-v16-isolated`

Objetivo: integrar la hoja de notas aprobada por el usuario como superficie experimental separada, de forma que pueda activarse desde OANIX y retirarse/reemplazarse sin tocar seguridad, vault, persistencia cifrada, Home ni sincronización.

Reglas:
- No reemplazar ni borrar el editor activo de `main` mientras se valida esta variante.
- Reutilizar `EditorSurface` y el contrato existente; no crear persistencia paralela.
- Mantener el diseño aprobado de la hoja y sus bloques.
- PC + móvil + Día + Noche.
- Los controles flotantes `+` y herramientas se moverán a la esquina superior derecha para dejar de depender del teclado/`visualViewport`.
- No reabrir en este experimento el problema de conversión automática de 50 líneas hasta estabilizar la superficie.
- Imagen/archivo deben terminar usando assets/servicios de OANIX, no blobs demo como almacenamiento permanente.

Plan inmediato:
1. Añadir una entrada de menú experimental desacoplada del editor estable.
2. Encapsular la variante como implementación reemplazable de `EditorSurface`.
3. Conectar primero título + texto + cierre/guardado seguro.
4. Migrar progresivamente los bloques especiales al contrato `richBlocks` existente.
5. Validar pruebas y CI antes de proponer merge.
