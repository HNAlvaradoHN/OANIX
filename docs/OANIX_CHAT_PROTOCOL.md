# OANIX — Protocolo universal de continuidad entre chats

Fecha de definición: 2026-09-03
Última revisión: 2026-09-05

Este protocolo existe para que el desarrollo de OANIX pueda continuar entre chats sin obligar al usuario a volver a explicar el trabajo anterior. GitHub es la fuente de verdad del estado del proyecto.

## Repositorio canónico obligatorio

- Repositorio de OANIX: `HNAlvaradoHN/OANIX`.
- Rama de autoridad: `main`.
- Toda búsqueda, lectura, PR, commit, issue, gate o modificación de OANIX debe comenzar acotada explícitamente a `HNAlvaradoHN/OANIX`.
- No usar búsquedas globales de GitHub para descubrir qué repositorio corresponde a OANIX cuando este protocolo esté disponible.
- Si una herramienta o un chat abre otro repositorio por defecto, ignorarlo y volver a `HNAlvaradoHN/OANIX` antes de inferir estado, número de chat o siguiente trabajo.
- Ningún repositorio distinto puede actuar como fuente de continuidad de OANIX salvo que el usuario cambie explícitamente esta regla.

## Registro rodante actual

- Chat OANIX activo: `OANIX #5`.
- Próximo chat: `OANIX #6`.
- Tratamiento del usuario: `Inge`.
- Checkpoint operativo único: `docs/OANIX_ACTIVE_CHECKPOINT.md`.

Este registro es **rodante, no histórico**. Cuando un chat nuevo asume el número siguiente, debe reemplazar los dos valores anteriores. Nunca agregar una lista acumulativa de chats ni ejemplos con números antiguos que puedan confundirse con el valor vigente.

Los números de chats anteriores pertenecen únicamente al historial de Git. No deben conservarse como autoridad activa en `PROJECT_MEMORY.md`, `CURRENT_STATE.md` ni otros documentos. Para saber qué OANIX es un chat, consultar únicamente este registro rodante y `docs/OANIX_ACTIVE_CHECKPOINT.md`.

No crear nuevos archivos `OANIX_N_ACTIVE_CHECKPOINT.md` para cada chat. El único checkpoint operativo que debe mantenerse y sobrescribirse es `docs/OANIX_ACTIVE_CHECKPOINT.md`.

## Encabezado obligatorio

Toda respuesta de trabajo dentro de OANIX debe comenzar exactamente con:

`Inge — OANIX #N`

`N` es el número activo ya verificado para ese chat. No debe adivinarse ni tomarse de un documento histórico.

## Frase universal de continuidad

La frase es:

`SIGUE EL CHAT AQUÍ`

También se aceptan diferencias normales de mayúsculas/minúsculas o puntuación.

## Arranque verificado obligatorio

Un chat nuevo **no puede afirmar su número OANIX ni declarar cuál es el siguiente trabajo** hasta completar este arranque contra GitHub.

1. Fijar primero el repositorio `HNAlvaradoHN/OANIX`; no descubrirlo mediante búsqueda global.
2. Consultar el `main` real y registrar su SHA actual.
3. Consultar el árbol recursivo actual del repositorio para conocer la estructura vigente completa y detectar archivos eliminados, reemplazados o nuevos.
4. Leer como autoridades mínimas: `AGENTS.md`, `docs/OANIX_CHAT_PROTOCOL.md`, `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATE.md` y `docs/OANIX_ACTIVE_CHECKPOINT.md`.
5. Si existe PR activo indicado por el checkpoint, consultar en vivo su número, rama, HEAD, estado, archivos cambiados y checks/gates actuales. No confiar en SHAs o estados escritos anteriormente.
6. Leer los archivos actuales directamente implicados por la siguiente acción pendiente. No asumir su contenido por memoria, resumen o conversación anterior.
7. Contrastar checkpoint, memoria y GitHub. Si se contradicen, **el `main` real de `HNAlvaradoHN/OANIX` manda**. Corregir el checkpoint operativo antes de continuar cuando esté desactualizado.
8. Solo después de completar lo anterior, asumir el número `Próximo chat`, reemplazar el registro rodante por `activo = próximo` y `próximo = activo + 1`, y sobrescribir el checkpoint activo con el estado verificado.
9. Reanudar la **siguiente acción exacta** del checkpoint verificado. No inventar una tarea nueva, no saltar a otro frente y no pedir al usuario que vuelva a explicar el trabajo.

No es necesario abrir y leer el contenido de absolutamente todos los archivos fuente en cada chat: eso sería costoso y no mejora la certeza. La garantía exigida es consultar el **árbol completo**, las autoridades del proyecto, el PR/gates vivos y los archivos del frente activo antes de continuar.

## Prueba visible de que la continuidad fue verificada

La primera respuesta de continuidad de un chat nuevo debe incluir, además del encabezado, una línea breve con esta información real obtenida de GitHub:

`Continuidad verificada — repo HNAlvaradoHN/OANIX · main <SHA corto> · PR #<N o ninguno> <HEAD corto/estado> · continúa: <siguiente acción exacta>`

Si hay gates relevantes en curso o fallando, deben mencionarse también de forma compacta.

Esta línea es la prueba visible para el usuario de que el chat no se limitó a leer un número. Si no puede obtener alguno de esos datos, el asistente **no debe afirmar que la continuidad está verificada ni avanzar el contador**.

## Consulta directa del número

Si el usuario pregunta `¿qué número de OANIX eres?` en un chat nuevo o tras una continuidad, no basta con responder el número. Primero debe cumplirse el arranque verificado. La respuesta debe incluir el número y la línea `Continuidad verificada` con repositorio, `main`, PR/HEAD y siguiente acción reales.

Dentro de un chat ya activo y previamente verificado, se conserva el mismo número durante toda la conversación y no se incrementa de nuevo.

## Fronteras de seguridad

- Una acción destructiva o una decisión que requiera aprobación explícita sigue requiriéndola aunque exista continuidad.
- Nunca adaptar código actual únicamente para satisfacer una expectativa obsoleta; primero comprobar el contrato vigente.
- No declarar un trabajo terminado con gates aplicables en rojo.
- No afirmar validación física en Android/PWA si el usuario no la confirmó.

## Diferencia con `OANIX-NOCHE`

`SIGUE EL CHAT AQUÍ` reanuda cualquier trabajo normal mediante este protocolo. `OANIX-NOCHE` conserva su significado especial para una sesión larga/nocturna previamente preparada, pero debe ejecutar el mismo arranque verificado antes de tocar código.

## Mantenimiento del checkpoint único

`docs/OANIX_ACTIVE_CHECKPOINT.md` debe contener únicamente el estado necesario para reanudar sin reconstruir la historia completa:

- repositorio canónico;
- chat activo y próximo;
- `main` SHA verificado;
- PR/rama/HEAD activos o `ninguno`;
- último trabajo realmente completado;
- estado de gates relevantes;
- decisiones/restricciones vigentes del frente actual;
- validaciones físicas pendientes;
- **una siguiente acción exacta**.

Debe sobrescribirse cuando cambie materialmente el estado. No acumular una cronología infinita dentro del archivo.

## Regla de cierre

Antes de abandonar deliberadamente un chat largo, actualizar el checkpoint único con el estado real y la siguiente acción exacta. Las decisiones duraderas de arquitectura siguen perteneciendo a `docs/PROJECT_MEMORY.md`; `docs/CURRENT_STATE.md` conserva el estado general del producto.

Todo cierre de trabajo debe incluir una sección `ÚLTIMO TRABAJO REALIZADO` que diga qué se completó realmente, qué gates quedaron verificados y qué sigue pendiente. El checkpoint activo debe reflejar el mismo punto operativo sin duplicar una lista histórica de chats.
