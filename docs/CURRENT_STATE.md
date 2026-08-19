# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-19

Este archivo es el checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Contrastar siempre con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs citados.

## Estado general

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente. #69 conflictos quedó cerrado y validado; #73 recuperación Email OTP sigue visible como deuda de campo.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- La APK debug interna usa firma estable y se validó actualización APK sobre APK sin desinstalar. La firma definitiva de Play Store será independiente.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor.

## Dirección visual aprobada

- Base graphite/blue-night con acento violeta contenido.
- Sistema de temas/personalización mediante variables semánticas.
- Diseño actual aprobado; no rediseñar la dirección principal sin una necesidad real.

## Privacidad — #68 CERRADO ✅

Privacidad por nota, relock manual, Caja privada y reautenticación quedaron implementadas y validadas físicamente en Android el 18 ago 2026.

- PR #133 añadió relock manual durante la sesión.
- PR #134 movió el candado a la tarjeta de la nota.
- `unlockedNoteIds: Set<string>` sigue siendo autorización temporal en memoria.
- Usuario confirmó sin fallos código incorrecto/correcto, desbloqueo, relock, quitar protección, Caja privada, ocultamiento y reautenticación.

## Conflictos multidispositivo — #69 CERRADO ✅

Validación física completada con PC + Android:
- detección de divergencia ✅;
- `Combinar ambas` ✅;
- versión remota ✅;
- versión local ✅;
- resolución obsoleta/refresco mientras el diálogo está abierto ✅;
- eliminación vs modificación ✅;
- ruta binaria de imágenes cubierta automáticamente.

## Avatar manual de nota — CERRADO Y VALIDADO FÍSICAMENTE ✅

- PR #135: avatar manual cifrado e independiente del contenido.
- PR #136: `Ver`, `Cambiar`, `Eliminar`.
- PR #137: corrige pantalla negra del menú.
- PR #138: corrige click-through al cerrar visor.
- Validación física final: elegir, ver, cambiar, eliminar, persistir, separación del contenido, sin pantalla negra y X sin abrir nota de fondo ✅.
- Base funcional actual: PR #138 merge `7bec28335ef5ef425a648b812ae4cebca6f30fb2`; Android `main` #183 ✅; firma estable ✅.

## RC Android — #124

### Validado físicamente

- instalación como actualización sobre firma estable ✅;
- cold starts ✅;
- huella/credencial fuerte ✅;
- timeout de sesión Android ✅;
- historial/restauración reversible ✅;
- privacidad por nota + Caja privada ✅;
- conflictos multidispositivo ✅;
- avatar manual completo ✅;
- crear, editar, fijar, mover y eliminar notas ✅;
- títulos largos, etiquetas y carpetas ✅;
- imagen dentro del contenido independiente del avatar ✅;
- Día, Noche y varios ambientes ✅;
- contraseña maestra: bloqueo manual, rechazo de contraseña incorrecta y apertura correcta con contraseña válida ✅;
- backup cifrado: exportación usando selector Android, guardado de archivo, selección del backup, verificación con contraseña maestra y restauración correcta de la bóveda ✅;
- sincronización Google + recuperación tras relanzar: nota de prueba sincronizada, cuenta Google conectada/E2EE al día, cierre completo de la APK, reapertura por bóveda sincronizada y recuperación correcta de la nota/contenido ✅;
- revisión de logs/artefactos CI ✅.

### Smoke test aún pendiente

1. Compartir nota / recepción de contenido Android si aplica.
2. Cámara/documentos y permisos relevantes.
3. Revisar #73 recuperación Email OTP antes de salida RC/publicación.

## Otros pendientes importantes

- **#73:** validación restante de recuperación por Email OTP.
- **#124:** checklist general de Release Candidate, prioridad actual.
- **#125:** preparación de publicación; no publicar ni crear firma release definitiva antes de cerrar RC.
- **#80 OANIX Pro/monetización:** diferido.

## Forma de trabajo acordada

- El agente hace directamente GitHub: ramas, archivos, PRs, CI, logs, merges, issues y artifacts cuando las herramientas lo permitan.
- No convertir al usuario en operador de GitHub.
- El usuario interviene principalmente en pruebas físicas inevitables del teléfono/cuenta.
- Si aparece un bug, cambio mínimo + tests + PR + CI/Android + merge + verificación.
- No prometer trabajo en segundo plano.

## Próximo paso exacto

1. Validar compartir una nota hacia otra app y recibir contenido en OANIX si aplica.
2. Validar cámara/documentos y permisos relevantes.
3. Revisar y cerrar/encuadrar #73 recuperación Email OTP antes de salida RC.
4. Si todo queda verde, cerrar #124, generar/nombrar APK RC y usarla varios días.
5. Solo después avanzar a #125: appId/version final, icono/splash, firma release, política/ficha y AAB de publicación.
