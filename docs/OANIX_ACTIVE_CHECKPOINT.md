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

- `main` vigente antes de este checkpoint: `74aa2e2be43ae249ffac313c97d0cd8294d380d7`.
- PR #630 — `feat: orden y personalización de tarjetas de nota`: fusionado.
- Ajuste funcional posterior: `5417265bc6b7b1e59618af9dd04f5a69319cbe31` — conserva el color personalizado de nota al cambiar entre `Todas` y carpetas.
- PR activo: #632 — `fix: restablece scroll táctil real en la lista de notas`.
- Rama: `fix/note-list-mobile-scroll-2026-09-05`.
- HEAD funcional verificado de #632: `7355103ad27896141b6a262acf8f0f4874eb928d`.
- El diff funcional de #632 queda limitado a dos cambios de viewport (`height: 100dvh` en `.rebuild-shell` y `.rebuild-main`) y una prueba de contrato nueva.

## Diagnóstico actual

La prueba física del usuario demostró que el parche anterior basado solo en `touch-action: pan-y` no resolvió el problema: el gesto vertical no inicia desde el centro de las tarjetas, aunque sí desde zonas periféricas.

La causa corregida en #632 es geométrica: `.rebuild-shell` y `.rebuild-main` tenían únicamente `min-height: 100dvh`, por lo que el árbol podía crecer con la lista y `.rebuild-notes` dejaba de actuar como viewport vertical real pese a tener `overflow-y: auto`. Al fijar también `height: 100dvh`, la lista flexible (`flex: 1; min-height: 0; overflow-y: auto`) vuelve a poseer el scroll vertical.

No se añadieron handlers táctiles nuevos y no se modificaron drag, orden, personalización, persistencia ni cifrado.

## Gates de #632

Para HEAD `7355103ad27896141b6a262acf8f0f4874eb928d` al registrar este checkpoint:

- OANIX CI #2817: queued.
- OANIX Android #2169: queued.
- Qwen Independent PR Review #1060: queued.
- Vercel correspondiente al HEAD anterior se había iniciado; reconsultar el HEAD actual antes de usar su estado como gate.

No declarar el arreglo cerrado hasta tener gates aplicables verdes y validación física del gesto desde el centro de una tarjeta en móvil/Android.

## Restricciones vigentes

- Toda operación OANIX debe dirigirse primero y explícitamente a `HNAlvaradoHN/OANIX`.
- Para el número de chat solo mandan `docs/OANIX_CHAT_PROTOCOL.md` y este checkpoint rodante.
- GitHub actual manda sobre cualquier resumen anterior.
- No conservar pruebas o implementaciones obsoletas solo para compatibilidad artificial.
- No fusionar con gates aplicables en rojo.
- No afirmar validación física que el usuario no haya confirmado.
- No volver a tratar Vercel como causa del fallo de scroll salvo evidencia nueva; el síntoma está en la interacción/viewport de la lista.

## Siguiente acción exacta

Reconsultar los gates de PR #632 sobre HEAD `7355103ad27896141b6a262acf8f0f4874eb928d`. Si quedan verdes, validar físicamente en móvil/Android que el scroll puede iniciarse arrastrando directamente desde el centro de cualquier tarjeta de nota y que el drag mediante la agarradera sigue funcionando. Solo después decidir el merge.

## Último trabajo realmente completado

Se identificó la causa probable real del fallo de scroll táctil de la lista, se abrió PR #632 con un ajuste mínimo de geometría del viewport y una prueba de regresión, y se verificó que su diff no contiene cambios funcionales ajenos al scroll. La validación automática y física sigue pendiente.
