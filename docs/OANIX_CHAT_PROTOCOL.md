# OANIX — Protocolo universal de continuidad entre chats

Fecha de definición: 2026-09-03

Este protocolo existe para que el desarrollo de OANIX pueda continuar entre chats sin obligar al usuario a volver a explicar el trabajo anterior. GitHub es la fuente de verdad del estado del proyecto.

## Frase clave universal

La frase clave es exactamente:

`SIGUE EL CHAT AQUÍ`

Se acepta también con diferencias normales de mayúsculas/minúsculas o puntuación, por ejemplo: `Sigue el chat aquí.`

## Comportamiento obligatorio al recibirla en un chat nuevo del proyecto OANIX

1. No preguntar al usuario qué estaba haciendo ni pedirle que repita contexto.
2. Consultar GitHub antes de comenzar trabajo técnico.
3. Leer `AGENTS.md`, `docs/PROJECT_MEMORY.md` y `docs/CURRENT_STATE.md` cuando existan.
4. Buscar y leer el handoff/checkpoint de continuidad más reciente que haya dejado el chat anterior. Si existe un handoff específico para el siguiente chat, ese documento tiene prioridad para el punto exacto de reanudación, siempre contrastándolo con el estado actual del repositorio.
5. Verificar rama, PR y código actuales antes de modificar archivos. No asumir que siguen iguales únicamente por el handoff.
6. Determinar el número del último chat OANIX registrado y asignar automáticamente al chat nuevo el siguiente número secuencial. Ejemplo: si el último chat activo registrado es `OANIX #15`, el nuevo chat pasa a ser `OANIX #16`.
7. La primera respuesta debe comenzar con `Inge — OANIX #N`, usando el número nuevo calculado.
8. Actualizar la memoria/checkpoint del repositorio para registrar el nuevo chat activo antes o junto con el primer cambio relevante, evitando que dos chats posteriores reclamen el mismo número.
9. Reanudar automáticamente desde el último punto pendiente real. No responder simplemente “tengo el contexto” ni terminar preguntando qué desea revisar.
10. Si el último chat dejó una acción que requería una decisión explícita del usuario o una operación destructiva todavía no autorizada, conservar esa frontera de seguridad; continuidad no significa inventar aprobación.
11. Si el estado actual de GitHub contradice el handoff, GitHub manda. Explicar brevemente la diferencia y continuar desde el estado real cuando sea seguro.

## Diferencia con `OANIX-NOCHE`

- `SIGUE EL CHAT AQUÍ` es la frase universal para continuar cualquier trabajo normal de OANIX en un chat nuevo.
- `OANIX-NOCHE` conserva su significado especial para una sesión larga/nocturna previamente preparada: además de recuperar continuidad, debe cargar el handoff nocturno pendiente y comenzar el plan acordado sin pedir al usuario que lo repita.

## Regla de cierre de cada chat

Durante el trabajo, las decisiones duraderas se registran en `docs/PROJECT_MEMORY.md` y el estado ejecutable inmediato en `docs/CURRENT_STATE.md`. Antes de abandonar deliberadamente un chat largo o preparar el siguiente, dejar un handoff/checkpoint suficientemente concreto para que `SIGUE EL CHAT AQUÍ` pueda reanudar sin depender del historial interno de ChatGPT.

El handoff debe indicar, cuando aplique: número del chat que termina y siguiente esperado, rama/PR, último checkpoint, estado validado, trabajo en curso, siguiente acción concreta, restricciones acordadas y cualquier validación pendiente.
