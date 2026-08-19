# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-19

Este archivo es el checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Contrastar siempre con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs citados.

## Estado general

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente. #69 conflictos y #73 recuperación Email OTP están cerrados; #73 conserva deuda multidispositivo adicional explícitamente no bloqueante.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- **RC Android — #124:** CERRADO COMO COMPLETADO ✅ el 19 ago 2026 tras smoke test físico completo.
- La APK debug interna usa firma estable y se validó actualización APK sobre APK sin desinstalar. La firma definitiva de Play Store será independiente.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor.

## Dirección visual aprobada

- Base graphite/blue-night con acento violeta contenido.
- Sistema de temas/personalización mediante variables semánticas.
- Diseño actual aprobado; no rediseñar la dirección principal sin una necesidad real.

## Bloqueadores cerrados

- #105 biometría/cold start ✅.
- #70 historial/restauración reversible ✅.
- #68 privacidad por nota + Caja privada ✅.
- #69 conflictos multidispositivo ✅.
- #73 recuperación principal por Email OTP ✅.

## Avatar manual de nota — CERRADO ✅

- PR #135: avatar manual cifrado e independiente del contenido.
- PR #136: `Ver`, `Cambiar`, `Eliminar`.
- PR #137: corrige pantalla negra del menú.
- PR #138: corrige click-through al cerrar visor.
- Validación física final completa ✅.

## OANIX Android RC1 — BASE CONGELADA PARA SOAK

Base funcional validada:
- PR #138 merge `7bec28335ef5ef425a648b812ae4cebca6f30fb2`.
- Android `main` #183 ✅.
- `oanix/stable-debug-signing = success` ✅.

Smoke test físico completado:
- instalación sobre firma estable + cold starts ✅;
- notas: crear, editar, fijar, mover, eliminar ✅;
- títulos largos, etiquetas y carpetas ✅;
- avatar manual completo ✅;
- imagen dentro del contenido independiente del avatar ✅;
- Día/Noche/ambientes ✅;
- contraseña maestra correcta/incorrecta + bloqueo manual ✅;
- huella/credencial fuerte + timeout Android ✅;
- privacidad por nota + Caja privada ✅;
- backup cifrado exportar/restaurar ✅;
- sincronización Google + cierre completo/reapertura/recuperación de nota ✅;
- compartir nota / recibir contenido Android ✅;
- cámara/documentos y permisos relevantes ✅;
- logs/artefactos CI ✅.

**Regla actual:** no introducir cambios funcionales ni visuales durante el soak salvo una regresión real. La APK funcional validada se denomina **OANIX Android RC1**.

## Recuperación #73

El flujo principal de Email OTP está cerrado y validado en uso real. Persisten como cobertura adicional no bloqueante:
- confirmar contraseña nueva desde un segundo dispositivo;
- confirmar que un OTP usado no se reutiliza;
- probar reconciliación de un dispositivo que estuvo offline durante rotación.

Estas pruebas no bloquean RC ni publicación, pero deben conservarse documentadas.

## Publicación — #125

**Estado:** preparación solamente; todavía no publicar.

Después del periodo de soak sin regresiones:
1. confirmar `appId` y versión final;
2. aprobar icono/splash finales;
3. crear y custodiar firma release definitiva separada de la firma debug estable;
4. generar y verificar AAB release;
5. preparar política de privacidad pública, ficha, textos y capturas;
6. solo entonces avanzar al envío a Play Store.

## Forma de trabajo acordada

- El agente hace directamente GitHub: ramas, archivos, PRs, CI, logs, merges, issues y artifacts cuando las herramientas lo permitan.
- No convertir al usuario en operador de GitHub.
- El usuario interviene principalmente en pruebas físicas inevitables del teléfono/cuenta.
- Si aparece un bug durante soak: cambio mínimo + tests + PR + CI/Android + merge + nueva validación física puntual.
- No prometer trabajo en segundo plano.

## Próximo paso exacto

Usar **OANIX Android RC1** varios días como soak sin cambios funcionales. Si no aparecen regresiones, avanzar a #125: identidad final, firma release, política/ficha y AAB de publicación.
