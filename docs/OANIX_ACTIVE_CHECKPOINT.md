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

- `main` verificado inmediatamente antes de este cierre documental: `77125e8d507a9208e39885338c85c55452e05a81`.
- PR #630 — `feat: orden y personalización de tarjetas de nota`: **fusionado**.
- Merge de #630: `1a0621da1babbefbb0978f3bd891272c10c27371`.
- Ajuste funcional posterior: `5417265bc6b7b1e59618af9dd04f5a69319cbe31` — conserva el color personalizado de nota al cambiar entre `Todas` y carpetas.
- PR activo: ninguno verificado para el frente anterior.

## Continuidad corregida en OANIX #5

- `docs/OANIX_CHAT_PROTOCOL.md` fija `HNAlvaradoHN/OANIX` como repositorio canónico y prohíbe descubrir OANIX mediante búsquedas globales cuando la continuidad está disponible.
- `AGENTS.md` obliga a fijar ese repositorio antes de consultar estado y declara que el número de chat solo pertenece al protocolo/checkpoint rodante.
- `docs/PROJECT_MEMORY.md` ya no contiene un número histórico de chat como autoridad; conserva únicamente el tratamiento `Inge` y remite al protocolo/checkpoint para el número vigente.
- Este chat es `OANIX #5`; el próximo es `OANIX #6`.

## Último trabajo funcional completado

1. Confirmación antes de eliminar Cita/Lista/Numérica.
2. Orden manual de notas independiente entre `Todas` y cada carpeta.
3. Arrastre protegido con auto-scroll.
4. Personalización persistente de icono y color por nota dentro de la metadata cifrada v2.
5. Corrección para que el tinte personalizado de la nota permanezca visible al alternar entre `Todas` y carpetas.

## Restricciones vigentes

- Toda operación OANIX debe dirigirse primero y explícitamente a `HNAlvaradoHN/OANIX`.
- Para el número de chat solo mandan `docs/OANIX_CHAT_PROTOCOL.md` y este checkpoint rodante.
- Números históricos de chats no deben usarse para identificar el chat actual.
- GitHub actual manda sobre cualquier resumen anterior.
- No conservar pruebas o implementaciones obsoletas solo para compatibilidad artificial.
- No fusionar con gates aplicables en rojo.
- No afirmar validación física que el usuario no haya confirmado.

## Siguiente acción exacta

Al retomar desarrollo funcional, verificar el `main` vivo de `HNAlvaradoHN/OANIX`, leer el estado general vigente y los últimos commits posteriores a #630, y determinar desde esa evidencia el siguiente frente pendiente sin volver a usar checkpoints numéricos históricos.

## Último trabajo realmente completado

Se corrigió el sistema de continuidad para que todos los chats de OANIX apunten explícitamente a `HNAlvaradoHN/OANIX`, se eliminó de la memoria operativa el número histórico que causaba confusión y quedó registrado el contador rodante `OANIX #5 → #6`.
