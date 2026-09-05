# OANIX — checkpoint operativo activo

Última actualización: 2026-09-05

## Continuidad

- Repositorio canónico: `HNAlvaradoHN/OANIX`.
- Rama de autoridad: `main`.
- Chat activo: `OANIX #5`.
- Próximo chat: `OANIX #6`.
- Usuario: `Inge`.
- Frase: `SIGUE EL CHAT AQUÍ`.
- El número y este checkpoint son rodantes: el siguiente chat debe sobrescribirlos, no crear otro archivo numerado ni conservar números anteriores como autoridad activa.

## Estado GitHub verificado

- `main` antes de actualizar este checkpoint: `c68bad3ce55749ee40df4e07d3aec81072125f17`.
- PR #630 — `feat: orden y personalización de tarjetas de nota`: **fusionado**.
- Merge de #630: `1a0621da1babbefbb0978f3bd891272c10c27371`.
- Ajuste posterior en `main`: `5417265bc6b7b1e59618af9dd04f5a69319cbe31` — conserva el color personalizado de nota al cambiar entre `Todas` y carpetas.
- Cambio de continuidad de este chat: `c68bad3ce55749ee40df4e07d3aec81072125f17` — fija `HNAlvaradoHN/OANIX` como repositorio canónico y registra el contador rodante `#5 → #6`.
- PR activo del frente anterior: ninguno.

## Último trabajo funcional completado

1. Confirmación antes de eliminar Cita/Lista/Numérica.
2. Orden manual de notas independiente entre `Todas` y cada carpeta.
3. Arrastre protegido con auto-scroll.
4. Personalización persistente de icono y color por nota dentro de la metadata cifrada v2.
5. Corrección para que el tinte personalizado de la nota permanezca visible al alternar entre `Todas` y carpetas.

## Restricciones vigentes

- Toda operación OANIX debe dirigirse primero y explícitamente a `HNAlvaradoHN/OANIX`; no descubrir el repo mediante búsquedas globales.
- Para el número de chat solo mandan `docs/OANIX_CHAT_PROTOCOL.md` y este checkpoint rodante.
- Números históricos de chats no deben usarse para identificar el chat actual.
- GitHub actual manda sobre cualquier resumen anterior.
- No conservar pruebas o implementaciones obsoletas solo para compatibilidad artificial.
- Si un comportamiento sigue siendo necesario, la prueba debe validar el contrato nuevo.
- No fusionar con gates aplicables en rojo.
- No afirmar validación física que el usuario no haya confirmado.

## Siguiente acción exacta

Antes de iniciar un nuevo frente funcional, actualizar o limpiar cualquier documento de continuidad que todavía exponga números históricos de chat como si fueran autoridad activa. Después, reconsultar `main` y el estado general vigente para continuar desde el último trabajo funcional realmente completado, sin asumir tareas desde checkpoints antiguos.

## Último trabajo realmente completado

Se corrigió la continuidad entre chats para que OANIX quede anclado a `HNAlvaradoHN/OANIX`, se registró este chat como `OANIX #5` y el próximo como `OANIX #6`, y se eliminó del protocolo la dependencia de ejemplos numerados históricos como fuente de identidad.
