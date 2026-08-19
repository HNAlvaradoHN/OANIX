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
- El usuario aprobó el diseño actual y específicamente el candado pequeño dentro de la tarjeta/burbuja de nota.
- No rediseñar la dirección principal sin una necesidad real; priorizar legibilidad y consistencia.

## Privacidad — #68 CERRADO ✅

Privacidad por nota, relock manual, Caja privada y reautenticación quedaron implementadas y validadas físicamente en Android el 18 ago 2026.

- PR #133 añadió relock manual durante la sesión.
- PR #134 movió el candado a la tarjeta de la nota.
- `unlockedNoteIds: Set<string>` sigue siendo autorización temporal en memoria; relock solo elimina el ID y no modifica cifrado/PBKDF2/sync.
- Usuario confirmó sin fallos: código incorrecto/correcto, desbloqueo, relock, quitar protección, Caja privada, ocultamiento y reautenticación.
- PR #134: OANIX CI #602 ✅ / Android #163 ✅; `main` Android #164 ✅; firma estable ✅.

## Conflictos multidispositivo — #69 CERRADO ✅

Validación física completada con PC + Android usando la misma bóveda/cuenta:

- Detección de divergencia sin sobrescritura silenciosa ✅.
- `Combinar ambas` ✅: conserva ambos contenidos separados por fecha.
- `Primera en sincronizarse` / versión remota ✅: conserva y propaga la remota.
- `Este dispositivo` / versión local ✅: conserva y propaga la local.
- Resolución obsoleta ✅: cambios posteriores desde PC refrescan el conflicto abierto en Android antes de aplicar una decisión vieja.
- Eliminación vs modificación ✅:
  - conservar local hace sobrevivir y propagar la modificación;
  - aceptar estado remoto `Eliminada` elimina en ambos clientes.

### Imágenes en conflictos

- PR #67 implementó la ruta binaria.
- `tests/v2BinaryConflictResolution.test.ts` cubre elección local/remota, fingerprints/versionado esperado, fragmentos cifrados de 6 MiB, SHA-256 por fragmento, reemplazo seguro, limpieza y reset/regeneración de `image-preview`.
- La UI normal crea un `imageId` nuevo en cada inserción y no ofrece sobrescribir el original conservando el mismo ID; por eso no se exige al usuario manipular IndexedDB/Supabase para fabricar un conflicto binario artificial del mismo registro durante el RC.
- La sincronización normal de imágenes sí sigue dentro del smoke test #124.

## Avatar manual de nota — PR #135 + #136 + #137 MERGED ✅ / VALIDACIÓN FÍSICA FINAL PENDIENTE

Durante el smoke test RC el usuario aclaró el requisito correcto: el círculo de avatar **no debe usar automáticamente la primera imagen del contenido de la nota**. Debe ser una foto manual e independiente del editor.

### PR #135 — avatar manual independiente

- `NoteAvatar` dejó de inspeccionar `note.content.blocks`.
- Sin avatar, tocar el círculo abre el selector JPEG/PNG/WebP/GIF.
- La foto se guarda como imagen cifrada y metadata `note-avatar` ligada al `noteId` dentro de `encrypted_records` existente.
- No se añade localStorage/sessionStorage ni un store paralelo.
- El avatar no se inserta como bloque del contenido.
- Tocar el avatar dentro de una tarjeta detiene la propagación y no abre accidentalmente la nota.
- Reemplazo/eliminación de nota limpian el avatar anterior en best-effort; URLs de preview solo existen en memoria.

### PR #136 — acciones cuando ya existe avatar

UX acordada:
- **Sin foto:** tocar círculo → selector de galería.
- **Con foto:** tocar círculo → menú `Ver`, `Cambiar`, `Eliminar`.
- `Ver` descifra el original solo bajo demanda, lo muestra en un visor temporal y revoca la Blob URL al cerrar.
- `Cambiar` reutiliza el mismo selector cifrado y reemplaza el avatar.
- `Eliminar` pide confirmación, borra metadata + imagen cifrada y vuelve a la inicial de la nota.
- Menú y visor se renderizan por portal para no crear botones anidados dentro de la tarjeta.

### PR #137 — pantalla negra al abrir acciones

Durante la primera validación física del menú de PR #136, al tocar por segunda vez un avatar existente la PWA quedó completamente negra/blanca de contenido en vez de mostrar el menú. La captura del usuario confirmó un crash/render vacío, no el visor intencional.

Causa corregida:
- PR #136 evaluaba `event.currentTarget` dentro del updater funcional de `setMenuPosition`.
- React puede ejecutar ese updater cuando el handler ya terminó y `currentTarget` ya no es un elemento válido, haciendo fallar `getBoundingClientRect()`.
- PR #137 calcula `menuPositionFor(event.currentTarget)` **sincrónicamente dentro del handler** y pasa solo la posición ya calculada al updater.
- Test de regresión impide volver a usar `event.currentTarget` dentro de ese updater.
- No cambia cifrado, avatar persistido, visor, sync, editor ni contenido.

Validación automática:
- PR #135: OANIX CI #610 ✅ / Android #171 ✅.
- Merge PR #135: `76814291b1e0d5aea0393432836b67a0a610fca4`; Android `main` #172 ✅; firma estable ✅.
- PR #136: OANIX CI #614 ✅ / Android #175 ✅.
- Merge PR #136: `c8676395c9130ddeef60947117d0f7637decbb44`; Android `main` #176 ✅; firma estable ✅.
- PR #137: OANIX CI #618 ✅ / Android #179 ✅.
- Merge PR #137: `d6306ccf1b332607074e39d328b8078bd1c01199`.
- Android `main` del merge #137: workflow run `32208379718` ✅.
- `oanix/stable-debug-signing = success` ✅.
- APK de prueba actual: `OANIX-main-PR137.apk`, SHA-256 `f0c3b4191111e9386a64e818e3afac2fe9801715166e6638a2c8f7d3b13f8286`.

Pendiente físico final: instalar la APK de PR #137 encima de la existente y confirmar que el segundo toque ya muestra `Ver`, `Cambiar`, `Eliminar` sin pantalla negra; después probar las tres acciones, persistencia y separación del contenido. Si pasa, el avatar se considera cerrado y no se vuelve a tocar durante el RC salvo regresión.

## RC Android — #124

**Estado actual:** bloqueadores funcionales principales cerrados. #105, #70, #68 y #69 están completados. Ahora toca completar el smoke test RC sin regresiones; el avatar manual está implementado en PR #135/#136 y la regresión de pantalla negra quedó corregida en PR #137, pendiente solo de revalidación física.

Ya validados:
- instalación como actualización con firma estable ✅;
- cold starts ✅;
- huella/credencial fuerte ✅;
- timeout de sesión Android ✅;
- historial/restauración reversible ✅;
- privacidad por nota + Caja privada ✅;
- conflictos multidispositivo ✅;
- revisión de logs/artefactos CI ✅.

### Smoke test aún pendiente

- Revalidar físicamente el **avatar manual final PR #135/#136/#137**: seleccionar, abrir menú, ver, cambiar, eliminar, persistencia y separación del contenido.
- Crear, editar, fijar, mover y eliminar notas como flujo normal completo.
- Títulos largos, etiquetas y carpetas.
- Añadir una imagen **dentro del contenido** y confirmar que funciona de forma independiente del avatar.
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

1. Instalar `OANIX-main-PR137.apk` **encima de la existente, sin desinstalar**.
2. Con una nota que ya tenga avatar, tocar el círculo por segunda vez y confirmar que aparece el menú `Ver`, `Cambiar`, `Eliminar` sin pantalla negra.
3. Probar `Ver`, `Cambiar`, `Eliminar`; volver a elegir una foto y reabrir OANIX para comprobar persistencia.
4. Confirmar que la foto del avatar nunca aparece como bloque dentro del contenido.
5. Si pasa, marcar avatar como validado en #124 y continuar inmediatamente el resto del smoke test RC.
6. Si todo queda verde, generar/nombrar la APK RC y usarla varios días.
7. Solo después avanzar a #125: appId/version final, icono/splash, firma release, política/ficha y AAB de publicación.
