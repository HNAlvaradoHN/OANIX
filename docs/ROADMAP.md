# OANIX — Roadmap

**Última actualización:** 2026-08-21

Este documento indica dirección y orden. El estado exacto del trabajo actual vive en `CURRENT_STATE.md`; el historial detallado vive en `CHANGELOG.md`, PRs e issues.

## Cerrado funcionalmente

### V1 — Núcleo local

PWA offline-first con bóveda local, contraseña maestra, cifrado, notas y editor estructurado, imágenes, checklists, fichas de contacto, entradas por día, carpetas, etiquetas, búsqueda y backup/restauración cifrada.

**Estado:** cerrada funcionalmente.

### V2 — Cuenta y sincronización

Cuenta opcional, autenticación, backend de sincronización, transporte E2EE, multidispositivo, conflictos, historial y recuperación de acceso.

La recuperación Email OTP es una frontera de confianza explícita distinta del transporte normal E2EE; ver `SECURITY.md`.

Deudas de validación de campo que siguen siendo reales:
- #69: conflictos multidispositivo (`VALIDATION_DEBT`);
- #70: historial/versiones;
- #73: recuperación en escenarios multidispositivo/offline.

**Estado:** cerrada funcionalmente; no declarar esas deudas como validadas hasta ejecutar sus casos reales.

### V3 — Android / Capacitor

Misma base React/TypeScript empaquetada con Capacitor, con integraciones nativas de Keystore/biometría, cámara, archivos, compartir y navegación Atrás. La lógica de negocio no se duplica en Kotlin.

La firma definitiva de publicación/Play Store, identidad final de publicación y validaciones nativas pendientes pertenecen al cierre de distribución, no justifican una segunda aplicación Android.

**Estado:** cerrada funcionalmente.

## Fase actual — archivos y almacenamiento

OANIX evoluciona de bloc de notas a contenedor privado capaz de manejar imágenes y archivos generales (PDF, Office, ZIP, APK, audio, video y otros) conservando formato original, cifrado y bajo consumo de memoria.

### Motor de archivos grandes

Implementado:
- procesamiento secuencial por fragmentos;
- AES-GCM por fragmento e IV independiente;
- SHA-256/manifiestos;
- checkpoint persistente y reanudación;
- subida/descarga por rangos;
- caché técnica separada de la bóveda;
- preflight de destino/cuota;
- abstracción `OanixStorageProvider`;
- Google Drive como primer proveedor.

Validado en PWA con archivo real de ~120 MiB:
- subida cifrada completa;
- recuperación remota, hashes y descifrado íntegros;
- corte de Internet, cierre de PWA, reapertura y reanudación desde progreso remoto confirmado.

PR #219 amplió la prueba controlada a **100 MiB–1 GiB**.

### Orden inmediato

1. Probar archivo cercano a **1 GiB** hasta Guardado + recuperación verificada.
2. Repetirlo con interrupción alrededor del 30–50%, cerrar/reabrir OANIX y confirmar reanudación sin reiniciar.
3. Aumentar tamaños gradualmente después de validar estabilidad. **No saltar directamente a 5 GB.**
4. Integrar archivos grandes al flujo normal de notas solo después de estabilizar el motor y la UX de transferencia.

Objetivo inicial de producto: **5 GB por archivo**, sin convertir 5 GB en techo arquitectónico.

## Después de estabilizar transferencias

### Archivos dentro de notas

- selector/adjunto general reutilizando el motor estable;
- representación compacta dentro de la nota;
- mantener archivo original cifrado;
- abrir/descargar/exportar de forma segura;
- distinguir `Liberar del dispositivo` de `Eliminar de OANIX`.

### Video bajo demanda

No descargar videos gigantes completos para reproducirlos.

- lectura remota por rangos;
- descifrado únicamente de lo necesario;
- reproducción y seek;
- caché local limitada/bajo demanda;
- `Guardar sin conexión` y `Liberar espacio`.

### Proveedores adicionales

Google Drive demuestra la frontera `OanixStorageProvider`, pero OANIX no dependerá exclusivamente de Google.

Candidatos futuros según necesidad real: almacenamiento local, OneDrive, S3 compatible, WebDAV/NAS y eventualmente infraestructura propia. **No implementar múltiples proveedores anticipadamente.**

## Publicación y producto

Antes de distribución pública estable:
- resolver firma/identidad definitiva de Android;
- revisar permisos y políticas de tienda;
- ejecutar validaciones reales pendientes relevantes;
- auditoría de seguridad/privacidad y limpieza de datos temporales;
- comprobar PWA y APK en dispositivos representativos.

## Monetización

Decisión vigente: **no dividir por ahora OANIX en Free/Pro ni bloquear funciones artificialmente**. Primero terminar un producto sólido y útil. Compra única, Pro, donaciones u otro modelo se decidirán después con evidencia de uso; no diseñar el núcleo alrededor de Premium.

## Regla del roadmap

No usar este archivo como lista infinita de PRs. Registrar aquí solo etapas y orden de producto. Los detalles históricos van a `CHANGELOG.md`; el siguiente trabajo concreto va a `CURRENT_STATE.md`.
