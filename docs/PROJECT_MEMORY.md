# OANIX — Memoria operativa del proyecto

Este documento conserva **decisiones duraderas y restricciones de producto/arquitectura** que no deben depender de un chat. No es un changelog ni un duplicado de `CURRENT_STATE.md`.

Antes de trabajar: leer `AGENTS.md` y `docs/CURRENT_STATE.md`, verificar `main` y PR recientes. GitHub es la fuente de verdad del código actual.

**Última actualización:** 2026-08-21

## 1. Principios permanentes

- OANIX es offline-first. La nube es opcional.
- PWA y Android/Capacitor comparten una sola base de aplicación; no crear lógica paralela por plataforma salvo integración nativa necesaria.
- Reutilizar módulos/stores existentes antes de crear persistencias paralelas.
- Conservar datos tiene prioridad ante incertidumbre; no sobrescribir silenciosamente.
- En conflictos multidispositivo: detectar → conservar ambos lados → mostrar → usuario decide. Si se combinan notas compatibles, va primero el cambio aceptado primero por la sincronización remota y después el otro; #69 validó este flujo. Etiqueta histórica de validación: `VALIDATION_DEBT`; verificar el issue antes de asumir que sigue pendiente.
- Cambios pequeños y aislados. No refactorizar ampliamente para arreglar un problema local.
- Una función importante usa rama + PR. OANIX CI y OANIX Android deben pasar antes de fusionar.
- Seguridad, cifrado, bóveda, notas y sync no se modifican por comodidad.
- No guardar secretos, tokens Google, refresh tokens ni credenciales en código, repositorio, notas, localStorage, IndexedDB o bóveda.

## 2. Producto y monetización

OANIX comenzó como bloc de notas privado y evoluciona para permitir guardar dentro de las notas imágenes y archivos generales, incluidos PDF, Office, ZIP, APK, audio y video.

Decisión vigente: **no dividir por ahora OANIX en Free/Pro ni bloquear funciones artificialmente**. Primero terminar una OANIX realmente buena y útil. La arquitectura puede permitir monetización futura, pero no debe diseñarse alrededor de candados Premium ni impedir probar el producto.

## 3. Experiencia de imágenes aprobada

PR #169 desactivó `NotebookCanvasRuntime`, `NotebookFreeRowsRuntime` y `NotebookSimpleImageRuntime`. No reactivarlos sin autorización explícita.

PR #170–#172 fijaron la experiencia PWA/APK:
- tarjeta fija, compacta, miniatura izquierda y controles derecha;
- sin mover/alinear/redimensionar manualmente y sin candado;
- nombre del archivo oculto;
- Abrir, Quitar y tamaño cuando corresponda;
- descripción en franja inferior; texto largo termina en elipsis + `+`;
- descripción completa y visor cerrables con X, toque fuera y Atrás;
- tocar miniatura abre original; zoom táctil aproximado 4x con desplazamiento.

No cambiar el formato persistido de imágenes ni modificar ampliamente `ImageNoteEditor.tsx` salvo necesidad demostrada.

## 4. Carpetas

- Inicio visual: 4 carpetas por fila.
- Imagen personalizada por pulsación larga.
- Imagen de carpeta cifrada y almacenada separadamente del registro de carpeta.
- Movimiento ambiental premium, suave y discreto; respuesta 3D/brillo a dedo/puntero; respetar `prefers-reduced-motion`.
- Atrás: nota → lista → inicio de carpetas → salir; conservar historial real correcto en PWA y comportamiento equivalente en APK.

## 5. Archivos grandes

Objetivo inicial de producto: **5 GB por archivo**, sin diseñar el motor con un techo arquitectónico de 5 GB. El límite de seguridad del protocolo puede ser mayor (~20 GiB actualmente).

Reglas:
- procesamiento secuencial por fragmentos, alrededor de 8 MiB;
- AES-GCM por fragmento, IV independiente y autenticación;
- SHA-256/manifiestos para integridad y reconstrucción;
- nunca materializar archivos gigantes completos en RAM;
- limpiar buffers temporales;
- checkpoint persistente y subida reanudable;
- reanudar desde progreso remoto confirmado, incluso después de caída de red/app;
- descargas por rangos;
- caché local limitada y bajo demanda;
- `Liberar del dispositivo` debe ser distinto de `Eliminar de OANIX`.

La UI de transferencia distingue Preparando → Cifrando → Subiendo → Verificando → Guardado ✓. Llegar a 100% transferido no significa Guardado hasta terminar la verificación.

## 6. Proveedores de almacenamiento

Principio arquitectónico: **OANIX nunca depende de un único proveedor**.

El motor usa la abstracción `OanixStorageProvider`. Google Drive es el primer proveedor demostrado, no una dependencia conceptual del motor. Proveedores futuros posibles: almacenamiento local, OneDrive, S3 compatible, WebDAV/NAS o nube propia; no implementarlos hasta necesitarlos.

### Google Drive

- Opcional; OANIX funciona sin Drive.
- Usa el almacenamiento de la cuenta Google del usuario.
- Scope exclusivo `drive.appdata` y `appDataFolder`; no pedir acceso general al Drive.
- Los bytes se cifran antes de salir del dispositivo.
- Token temporal exclusivamente en memoria.
- PWA usa Google Identity Services con `VITE_GOOGLE_DRIVE_WEB_CLIENT_ID`.
- Android usa `AuthorizationClient` mediante integración Capacitor independiente.
- El login OANIX y la autorización Drive son dominios separados.
- Antes de una transferencia grande comprobar destino/cuota y, cuando corresponda, conectividad.
- Las URLs de sesión reanudable deben validarse/restringirse para evitar fuga de credenciales.

## 7. Seguridad existente que no debe degradarse

- Contraseña maestra y clave de bóveda son conceptos separados.
- La clave activa web permanece como `CryptoKey` no extraíble.
- El contenido local privado se cifra antes de persistirse.
- El transporte normal de sync conserva E2EE; la recuperación Email OTP es una excepción de confianza explícita documentada en `SECURITY.md`.
- Android Keystore/biometría no sustituyen la contraseña maestra ni convierten la clave activa web en exportable.
- No describir OANIX completo como zero-knowledge frente al proveedor mientras exista el broker de recuperación por correo.

## 8. Evidencia validada de archivos grandes

En PWA se validó con un video real de ~120 MiB:
- subida cifrada completa a Google Drive;
- descarga posterior por rangos;
- hashes, descifrado y comparación íntegra del archivo;
- interrupción de Wi-Fi alrededor del 30%;
- cierre completo de PWA;
- reapertura y nueva autorización Drive;
- selección del mismo archivo y reanudación desde el progreso remoto confirmado, sin reiniciar desde cero.

PR #219 amplió la prueba controlada a 100 MiB–1 GiB. La siguiente validación es cercana a 1 GiB; no saltar todavía directamente a 5 GB.

## 9. Checkpoints históricos que vale conservar

- `1ad13a27c1a2e429be1beb839aa3992586361103`: base funcional estable histórica importante.
- `d6d847e7a053f05808518b4e18f871855eb0e9a7`: inmediatamente anterior a llevar la experiencia aprobada de imágenes a Android.

El resto del historial de implementación pertenece a `CHANGELOG.md`, PRs e issues. No acumular aquí detalles triviales, números de CI o estados transitorios.
