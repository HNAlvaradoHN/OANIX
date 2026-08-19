# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-18

Este archivo es el checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Contrastar siempre con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs citados.

## Estado general

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente. La deuda de conflictos #69 quedó cerrada y validada; sigue visible #73 para recuperación Email OTP.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- La APK debug interna usa **firma estable** y se validó actualización APK sobre APK sin desinstalar. La firma definitiva de Play Store será independiente.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor; no duplicar lógica.

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

Validación física completada con PC + Android usando la misma bóveda/cuenta:

- Detección de divergencia ✅.
- `Combinar ambas` ✅.
- Versión remota ✅.
- Versión local ✅.
- Resolución obsoleta/refresco mientras el diálogo está abierto ✅.
- Eliminación vs modificación ✅.
- Ruta binaria de imágenes cubierta automáticamente; la UI normal no permite fabricar el mismo `imageId` divergente sin manipulación interna.

## Avatar manual de nota — CERRADO Y VALIDADO FÍSICAMENTE ✅

Requisito final: el círculo es un avatar manual independiente de las imágenes del contenido.

### Implementación
- PR #135: avatar manual cifrado independiente mediante metadata `note-avatar` + imagen cifrada. Sin avatar, tocar el círculo abre galería. No inserta la foto en el editor ni abre accidentalmente la nota.
- PR #136: con avatar existente, tocar círculo muestra `Ver`, `Cambiar`, `Eliminar`.
- PR #137: corrige pantalla negra al abrir el menú; captura la posición del elemento antes del updater de React.
- PR #138: corrige click-through al cerrar el visor; overlay y X consumen pointer/click antes de desmontarse.

### Validación automática
- PR #135: OANIX CI #610 ✅ / Android #171 ✅ / `main` #172 ✅.
- PR #136: OANIX CI #614 ✅ / Android #175 ✅ / `main` #176 ✅.
- PR #137: OANIX CI #618 ✅ / Android #179 ✅ / `main` #180 ✅.
- PR #138: OANIX CI #621 ✅ / Android #182 ✅ / merge `7bec28335ef5ef425a648b812ae4cebca6f30fb2` / `main` Android #183 ✅ / firma estable ✅.

### Validación física final — 18 ago 2026
- elegir foto ✅;
- avatar independiente del contenido ✅;
- menú `Ver / Cambiar / Eliminar` ✅;
- `Ver` ✅;
- `Cambiar` ✅;
- `Eliminar` ✅;
- persistencia ✅;
- sin pantalla negra ✅;
- X cierra el visor sin abrir una nota de fondo ✅.

El avatar queda **cerrado** durante el RC salvo una regresión nueva.

## RC Android — #124

**Estado actual:** bloqueadores principales cerrados (#105, #70, #68, #69) y avatar manual ya validado. Toca completar el smoke test general.

Ya validados:
- instalación como actualización con firma estable ✅;
- cold starts ✅;
- huella/credencial fuerte ✅;
- timeout de sesión Android ✅;
- historial/restauración reversible ✅;
- privacidad por nota + Caja privada ✅;
- conflictos multidispositivo ✅;
- avatar manual completo ✅;
- revisión de logs/artefactos CI ✅.

### Smoke test aún pendiente

- Crear, editar, fijar, mover y eliminar notas como flujo normal completo.
- Títulos largos, etiquetas y carpetas.
- Añadir una imagen **dentro del contenido** y confirmar independencia del avatar.
- Cambiar entre Día, Noche y varios ambientes.
- Bloquear/desbloquear con contraseña maestra.
- Backup cifrado exportar/restaurar.
- Sincronización de cuenta y recuperación tras relanzar.
- Compartir nota / recepción de contenido Android si aplica.
- Cámara/documentos y permisos relevantes.

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
- No prometer trabajo en segundo plano: completar/pollear dentro del turno cuando sea posible.

## Próximo paso exacto

1. Continuar smoke test RC con flujo normal de notas.
2. En una sola ronda validar crear/editar/fijar/mover/eliminar, título largo, etiqueta, carpeta, imagen dentro del contenido y varios temas.
3. Después validar contraseña maestra, backup cifrado, sincronización tras relanzar, compartir/recibir y permisos.
4. Si todo queda verde, generar/nombrar la APK RC y usarla varios días.
5. Solo después avanzar a #125: appId/version final, icono/splash, firma release, política/ficha y AAB de publicación.
