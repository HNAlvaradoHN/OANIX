# OANIX #4 — checkpoint activo

Fecha: 2026-09-05

## Registro de continuidad

- Chat activo: `OANIX #4`.
- Próximo chat esperado: `OANIX #5`.
- Usuario: `Inge`.
- Frase universal de continuidad: `SIGUE EL CHAT AQUÍ`.
- GitHub es la fuente de verdad antes de cualquier cambio.

## Estado cerrado durante OANIX #4

### PR #629 — editor por renglones y elementos de texto administrados

PR #629 fue fusionado a `main`.

Quedó implementado y validado físicamente por el usuario:

- Párrafo activo desde una nota vacía nueva;
- H2/H3 con foco/caret natural;
- Enter según el comportamiento de referencia;
- Backspace continuo entre renglones normales sin detenerse;
- panel lateral cierra teclado cuando corresponde;
- correcciones móviles de Personalizar y espaciado;
- Cita, Lista y Numérica aisladas del borrado secuencial de texto;
- Lista y Numérica con ítems propios y botón `+`;
- renglón de escritura arriba y abajo de Cita/Lista/Numérica;
- eliminación completa de esos bloques mediante control propio.

Merge de #629 a `main`: `3a209839af2caed5c2873c44d258b4ac9df00387`.

Pages, CI y Android quedaron verdes tras ese merge y la PWA pública se desplegó.

## Trabajo actual — PR #630

PR activo: `#630` — `feat: orden y personalización de tarjetas de nota`.

Rama:

`feat/note-list-order-card-customization-2026-09-05`

Último HEAD verificado del PR:

`5e26295747aec8c20731ea5dd68b453b4df10a1f`

Estado verificado:

- PR abierto;
- draft;
- no fusionado;
- mergeable según GitHub;
- Qwen Independent PR Review: **success**;
- OANIX Android: **success**;
- OANIX CI: **failure**, específicamente en `Test OANIX`.

No marcar #630 como terminado ni fusionarlo hasta identificar la prueba `.test.ts` real que falla y dejar CI verde sobre un HEAD nuevo.

## Alcance funcional de #630

El objetivo solicitado por el usuario es:

1. Confirmación antes de eliminar Cita/Lista/Numérica.
2. Mover notas manualmente en la lista principal.
3. Personalizar la tarjeta visual de cada nota con color suave e icono propio, sin tapar el fondo y compatible con Día/Noche.

Decisión acordada para pruebas obsoletas:

- si el test que falla protege una implementación vieja que ya no aplica, se elimina;
- si protege un comportamiento que OANIX todavía necesita, se reemplaza por una prueba del contrato nuevo y se elimina la expectativa vieja;
- no modificar la arquitectura actual solo para satisfacer una prueba obsoleta.

También debe revisarse la confirmación de borrado para que pertenezca al bloque/flujo actual y no dependa de mecanismos globales innecesarios.

## Siguiente acción exacta

1. Reconsultar #630 y su HEAD en GitHub.
2. Obtener el job/log real de `OANIX CI` y localizar el `.test.ts`/assertion exacto que falla.
3. Clasificarlo como contrato vigente u obsoleto.
4. Eliminar o reemplazar la prueba vieja según el criterio acordado.
5. Revisar que confirmación de borrado, movimiento de notas y personalización usen la arquitectura actual.
6. Commit en la rama de #630.
7. Verificar OANIX CI + Android + revisión sobre el mismo HEAD.
8. No fusionar hasta dejar todos los gates verdes y, si el cambio visual lo requiere, preparar validación física del usuario.

## Nota de continuidad importante

El registro secuencial quedó corregido en `docs/OANIX_CHAT_PROTOCOL.md` durante OANIX #4. Antes de esta corrección todavía figuraba `OANIX #3`; eso era un error de mantenimiento de continuidad. El registro actual correcto es `OANIX #4` y el siguiente chat debe asumir `OANIX #5`.
