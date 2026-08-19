# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-18

Este archivo es el checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Siempre contrastarlo con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs mencionados.

## Estado de versiones

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente; permanecen deudas de validación visibles, principalmente #69 y #73.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- La APK debug interna tiene **firma estable** y se validó físicamente una actualización APK sobre APK sin desinstalar. La firma definitiva de Play Store sigue siendo independiente.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor; no crear lógica paralela.

## Dirección visual aprobada

- Base graphite/blue-night con acento violeta contenido; evitar volver a una interfaz excesivamente morada u oscura.
- Sistema de personalización/temas ya existe y debe respetarse mediante variables semánticas.
- Tarjetas de notas, ellipsis de títulos largos, menús y editor ya tienen pulidos post-V3; no rediseñar la dirección principal sin necesidad.
- Priorizar legibilidad y consistencia antes que agregar controles decorativos.

## Privacidad — #68 CERRADO ✅

Privacidad por nota, relock manual, Caja privada y reautenticación quedaron **implementadas y validadas físicamente en Android** el 18 ago 2026.

### Invariantes
- El código de nota es una barrera adicional dentro de la bóveda ya cifrada.
- No se guarda el código en plaintext.
- La autorización temporal vive únicamente en `unlockedNoteIds: Set<string>` dentro de `NotePrivacyRuntime`.
- Un relock manual solo elimina el ID de ese Set; no modifica PBKDF2, el verificador, `note.privacy`, sync, Caja privada ni cifrado.

### PR #133 / PR #134
- PR #133 añadió relock manual durante la sesión.
- PR #134 movió el candado de sesión a la **tarjeta de la nota** y eliminó la ubicación redundante junto al título grande.
- Nota sin protección: sin candado.
- Protegida bloqueada: candado cerrado.
- Protegida desbloqueada temporalmente: candado abierto.
- Tocar el candado abierto vuelve a bloquear y oculta el contenido inmediatamente.
- El control usa SVG `currentColor`, respeta los temas, mantiene el ellipsis de títulos largos y no abre accidentalmente la tarjeta.
- En ancho crítico, la fecha puede ceder antes que candado/menú.

### Validación
- PR #134: OANIX CI #602 ✅ / Android #163 ✅.
- `main` posterior a PR #134: Android #164 ✅.
- `oanix/stable-debug-signing = success` ✅.
- APK probada físicamente: commit `135a0b09d3cb045271cfd059a363f0b53cdbeb0e`.
- Usuario confirmó **sin fallos**: proteger/desbloquear/quitar protección, código incorrecto/correcto, relock manual, ocultamiento en Caja privada, reautenticación y nueva autenticación después de cerrar Caja privada.
- Issue #68 cerrado como `completed`.

## RC Android — #124

Estado actual: preparación activa.

Ya validados físicamente:
- #105 huella/cold start ✅ cerrado.
- #70 historial cifrado/restauración reversible ✅ cerrado.
- #68 privacidad por nota/Caja privada ✅ cerrado.
- timeout de sesión Android ✅.
- continuidad de firma APK estable ✅.

Bloqueador técnico prioritario restante:
- **#69 — resolución de conflictos multidispositivo.** La detección real ya fue observada; falta cerrar casos de resolución local/remota/combinar, resolución obsoleta, imágenes y eliminación vs modificación.

También queda completar el resto del smoke test RC: operaciones normales de notas, títulos/etiquetas/carpetas, imágenes, temas, contraseña maestra, backup/restauración, sync Google, compartir, cámara/documentos.

## Otros pendientes importantes

- **#69:** siguiente bloque técnico prioritario.
- **#73:** validación restante de recuperación por Email OTP.
- **#124:** checklist general de Release Candidate.
- **#125:** preparación de publicación; no comenzar Play Store/firma release definitiva antes de cerrar RC.
- **#80 OANIX Pro/monetización:** diferido.

## Forma de trabajo acordada con el usuario

- El agente debe hacer directamente las operaciones de GitHub que tenga disponibles: ramas, archivos, PRs, CI, logs, reintentos, merges, issues y artifacts.
- No convertir al usuario en operador de GitHub si la herramienta puede realizar la acción.
- Para cambios pequeños/locales y seguros, avanzar, probar, integrar y documentar sin detenerse por confirmaciones innecesarias.
- Para seguridad/datos/alcance importante, detenerse únicamente cuando exista una decisión real que deba tomar el usuario.
- Si un cambio Android necesita prueba física, llegar hasta artifact/APK y entregarla directamente cuando las herramientas lo permitan.

## Próximo paso recomendado

1. Abrir/revisar #69 y preparar una matriz exacta de escenarios de conflicto pendientes.
2. Ejecutar primero los casos que puedan validarse con dos clientes/dispositivos reales sin cambiar código.
3. Si aparece un bug, corregirlo con cambio mínimo + tests + PR + CI/Android.
4. Cerrar #69 cuando todas las resoluciones necesarias queden validadas.
5. Continuar el smoke test de #124.
6. Solo después generar/nombrar la APK RC y pasar a #125 publicación.
