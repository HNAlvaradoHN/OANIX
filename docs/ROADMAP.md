# OANIX — Roadmap

**Última actualización:** 2026-09-06

Este documento indica dirección y orden de producto. El estado operativo exacto vive en `docs/CURRENT_STATE.md` y `docs/OANIX_ACTIVE_CHECKPOINT.md`; el historial detallado vive en `docs/CHANGELOG.md`, PRs e issues. GitHub `main` prevalece ante cualquier contradicción.

## Cerrado funcionalmente

### V1 — Núcleo local

PWA offline-first con bóveda local, contraseña maestra, cifrado, notas, editor, imágenes, checklists, fichas de contacto, entradas por día, carpetas, etiquetas, búsqueda y backup/restauración cifrada.

**Estado:** cerrada funcionalmente.

### V2 — Cuenta y sincronización

Cuenta opcional, autenticación, transporte E2EE, multidispositivo, conflictos, historial y recuperación de acceso.

La recuperación Email OTP sigue siendo una frontera de confianza explícita distinta del transporte normal E2EE; ver `SECURITY.md`.

La implementación histórica de sync basada en el runtime legacy no es la dirección activa. El transporte incremental v2 actual usa almacenamiento local v2, metadata/cursor remoto en Supabase y payload cifrado en R2 mediante gateway privado.

**Estado funcional:** implementada. La validación real del transporte incremental v2 recién activado es el frente inmediato.

Deudas históricas de validación deben verificarse contra sus issues antes de asumir que siguen abiertas; no usar este roadmap como fuente de estado de issues.

### V3 — Android / Capacitor

Misma base React/TypeScript empaquetada con Capacitor, con integraciones nativas de Keystore/biometría, cámara, archivos, compartir y navegación Atrás. La lógica de negocio no se duplica en Kotlin.

La firma/identidad definitiva de publicación y otras validaciones de distribución pertenecen al cierre de publicación.

**Estado:** cerrada funcionalmente.

## Reconstrucción post-unlock — IMPLEMENTED

La reconstrucción de Home, lista de notas y editor ya no es un frente pendiente.

- `RebuildApp` es la autoridad post-unlock actual.
- El editor natural por renglones quedó consolidado por PR #629 detrás de `EditorSurface`.
- Orden, personalización, scroll y drag/reorder recientes de Home/lista quedaron integrados en PR #630–#638.
- No reabrir una sustitución de editor ni buscar plantillas antiguas salvo nueva decisión explícita o defecto concreto demostrado.

## Sincronización incremental v2 + R2 — FRENTE ACTUAL

Implementado en PR #639–#641:

- `sync_v2_records` como índice remoto pequeño con cursor monotónico;
- bindings opacos y protocolo incremental;
- `runV2IncrementalSync` consume la cola cifrada `sync.v2.pending`;
- payload cifrado almacenado en R2 detrás de un gateway privado;
- GitHub Pages conectado al endpoint público del gateway sin credenciales R2 en cliente;
- `V2AutoSyncRuntime` montado únicamente con bóveda desbloqueada;
- intento tras ~3 s de inactividad y consulta remota incremental cada 60 s;
- cancelación/postergación por actividad, offline u ocultamiento;
- no aplicar cambios remotos mientras una nota está abierta;
- refresco de `RebuildApp` después de aplicar remoto sin recarga completa;
- sin reactivar `AutoSyncRuntime` legacy ni escaneo completo de ciphertext.

### Orden inmediato

1. Validar sync real extremo a extremo entre dos dispositivos/sesiones con la misma cuenta y bóveda.
2. Verificar crear/editar nota, recepción remota sin reload completo y protección mientras el editor está abierto.
3. Verificar offline → cambios locales → reconexión → sincronización sin pérdida.
4. Verificar crear/editar/reordenar/eliminar carpetas y etiquetas mediante la cola incremental.
5. Confirmar que una bóveda sin cambios no descarga payload remoto innecesariamente.
6. Confirmar que fallos de red/auth/egress conservan contenido local y pendientes de forma no destructiva.
7. Corregir cualquier defecto encontrado en el flujo v2 actual y repetir gates hasta verde antes de abrir otro bloque funcional.

## Archivos grandes y almacenamiento — PRESERVADO / NO ES FRENTE INMEDIATO

El motor existente de archivos grandes no se elimina ni se reimplementa. Conserva procesamiento por fragmentos, AES-GCM por fragmento, manifiestos/hash, checkpoints/reanudación, subida/descarga por rangos, caché técnica separada, preflight y la frontera `OanixStorageProvider`.

La validación histórica de archivos grandes y la evolución hacia archivos dentro de notas, transferencias Android en segundo plano, video bajo demanda y proveedores adicionales siguen siendo trabajo futuro, pero **no desplazan la validación actual de sync v2**.

Objetivo de producto preservado: soportar archivos de hasta **5 GB** inicialmente sin convertir 5 GB en techo arquitectónico.

## Publicación y producto

Antes de distribución pública estable:
- resolver firma/identidad definitiva de Android;
- revisar permisos y políticas de tienda;
- ejecutar validaciones reales pendientes relevantes;
- auditoría de seguridad/privacidad y limpieza de temporales;
- comprobar PWA y APK en dispositivos representativos.

## Monetización

Decisión vigente: **no dividir por ahora OANIX en Free/Pro ni bloquear funciones artificialmente**. Primero terminar un producto sólido y útil. Compra única, Pro, donaciones u otro modelo se decidirán después con evidencia de uso; no diseñar el núcleo alrededor de Premium.

## Regla del roadmap

No usar este archivo como lista infinita de PRs ni como checkpoint de ejecución. Los detalles históricos van a `CHANGELOG.md`; el siguiente trabajo concreto va a `CURRENT_STATE.md` y `OANIX_ACTIVE_CHECKPOINT.md`.
