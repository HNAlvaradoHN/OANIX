# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-19

Este archivo es el checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Contrastar siempre con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs citados.

## Estado general

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente. #69 conflictos y #73 recuperación Email OTP están cerrados; #73 conserva deuda multidispositivo adicional explícitamente no bloqueante.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- **RC Android — #124:** CERRADO COMO COMPLETADO ✅ el 19 ago 2026 tras smoke test físico completo.
- **V4 / OANIX Pro — #80:** ACTIVO en definición pre-publicación.
- **Publicación Android — #125:** preparación activa; por decisión del producto no existe periodo de soak obligatorio.
- La APK debug interna usa firma estable; la firma definitiva de Play Store será independiente.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor.

## Dirección visual aprobada

- Diseño general de la aplicación aprobado; no rediseñar la interfaz principal sin una necesidad real.
- El icono actual NO es definitivo.
- Referencia visual elegida para el sello final: fondo negro, símbolo O/documento y candado naranja. Debe recrearse de forma limpia como icono oficial antes de publicación.

## Bloqueadores cerrados

- #105 biometría/cold start ✅.
- #70 historial/restauración reversible ✅.
- #68 privacidad por nota + Caja privada ✅.
- #69 conflictos multidispositivo ✅.
- #73 recuperación principal por Email OTP ✅.

## Base funcional validada

- PR #138 merge `7bec28335ef5ef425a648b812ae4cebca6f30fb2`.
- Android `main` #183 ✅.
- `oanix/stable-debug-signing = success` ✅.
- Smoke test físico completo de #124 ✅: notas, carpetas/etiquetas, avatar, imágenes, temas, contraseña maestra, biometría/timeout, privacidad/Caja privada, backup, sincronización Google/reapertura, compartir/recibir, cámara/documentos/permisos y CI.

## OANIX Pro — #80 ACTIVO

### Principio
OANIX Free seguirá siendo una app completa y útil. No se retirarán detrás de un pago funciones que ya existen y fueron validadas en el RC.

### Free conserva
- notas/edición, cifrado y contraseña maestra;
- offline-first y sincronización E2EE;
- backup cifrado básico;
- biometría, timeout, protección por nota y Caja privada;
- carpetas, etiquetas, búsqueda, imágenes y compartir/recibir;
- funciones Android existentes y temas actuales.

### Dirección Pro v1
Preferencia comercial: **compra única / desbloqueo permanente**, no suscripción obligatoria.

Función insignia: **Escáner Seguro de Documentos**:
`cámara -> detectar bordes -> corregir perspectiva -> mejorar imagen -> PDF -> OCR -> texto buscable -> cifrar y guardar en la bóveda`.

Complementos candidatos para Pro v1:
- PDF avanzado y gestión documental;
- OCR/búsqueda dentro de documentos;
- exportaciones avanzadas;
- organización documental avanzada;
- personalización premium adicional sin quitar temas gratuitos;
- audio/notas de voz avanzadas solo si no comprometen privacidad/offline ni retrasan innecesariamente publicación.

No cobrar por cifrado, backup básico ni seguridad esencial.

## Recuperación #73

El flujo principal de Email OTP está cerrado y validado. Persisten como cobertura adicional no bloqueante:
- confirmar contraseña nueva desde un segundo dispositivo;
- confirmar que un OTP usado no se reutiliza;
- probar reconciliación de un dispositivo que estuvo offline durante rotación.

No bloquean RC ni publicación.

## Publicación — #125

**Estado:** preparación activa; todavía no enviar a producción.

Orden actual:
1. cerrar alcance exacto OANIX Free vs Pro (#80);
2. cerrar icono/splash oficiales;
3. confirmar `appId`, `versionCode` y `versionName`;
4. crear/custodiar firma release definitiva;
5. integrar Google Play Billing y derechos Pro después de cerrar alcance;
6. generar/verificar AAB release;
7. preparar política de privacidad, ficha, textos y capturas;
8. verificación final y envío a Play Store.

## Forma de trabajo acordada

- El agente hace directamente GitHub: ramas, archivos, PRs, CI, logs, merges, issues y artifacts cuando las herramientas lo permitan.
- No convertir al usuario en operador de GitHub.
- El usuario interviene principalmente en pruebas físicas inevitables del teléfono/cuenta.
- Si aparece un bug: cambio mínimo + tests + PR + CI/Android + merge + validación física puntual.
- No prometer trabajo en segundo plano.

## Próximo paso exacto

Cerrar el alcance de **OANIX Pro v1** y luego comenzar la implementación pre-publicación, manteniendo intactas las funciones actuales de OANIX Free. En paralelo, cerrar el sello visual final (icono/splash) antes de firma release y AAB.