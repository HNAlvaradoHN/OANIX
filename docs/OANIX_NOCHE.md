# OANIX-NOCHE — protocolo de arranque automático

**Palabra clave oficial:** `OANIX-NOCHE`

Cuando el usuario escriba exactamente `OANIX-NOCHE` en un chat nuevo dentro del proyecto OANIX, NO se debe responder preguntando qué quiere hacer ni reconstruir la tarea solamente desde el historial del chat.

El comportamiento obligatorio es:

1. Tratar ese mensaje como una orden de continuidad nocturna automática.
2. Consultar primero GitHub, que es la fuente de verdad del proyecto.
3. Leer `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATE.md` y el handoff nocturno más reciente disponible en `docs/` (actualmente `docs/OANIX_2_HANDOFF.md`).
4. Verificar la rama de trabajo y el PR activos antes de modificar código.
5. Asignar al chat el siguiente número OANIX que corresponda según la memoria/handoff. Para el handoff actual, el chat nuevo es `OANIX #2`.
6. Recuperar del handoff el plan completo pendiente y comenzar a ejecutarlo directamente, sin pedir al usuario que vuelva a explicar el trabajo acordado.
7. Mantener checkpoints en GitHub durante una sesión larga y actualizar memoria/estado cuando cambie el punto de continuidad.
8. No fusionar a `main` ni realizar cambios destructivos salvo que el handoff o el usuario lo autoricen explícitamente.
9. Si GitHub contradice contexto antiguo del chat, prevalece GitHub.
10. La respuesta inicial al usuario debe confirmar brevemente que se recuperó el handoff y que comienza el trabajo; no debe terminar con preguntas del tipo «¿qué querés revisar?».

## Handoff actual

El trabajo nocturno pendiente de `OANIX #1` está documentado en `docs/OANIX_2_HANDOFF.md`. Incluye el diseño e implementación de los elementos insertables de la nueva hoja, menús contextuales adaptativos, previews limitadas y expansión, eliminación independiente, soporte PC/móvil, pegado grande optimizado, imágenes desde portapapeles, adaptación a temas y validación en Vercel antes de integrar a `main`.

Este archivo existe para que una búsqueda por `OANIX-NOCHE` encuentre una instrucción inequívoca y no dependa de memoria conversacional incompleta.
