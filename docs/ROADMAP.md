# OANIX — Roadmap

Este documento define el orden oficial de desarrollo de OANIX.

## Regla principal

OANIX se desarrolla estrictamente por versiones. Una función perteneciente a una versión futura se puede registrar, pero no se implementa antes de tiempo salvo preparación técnica estrictamente necesaria y documentada.

## V1 — Núcleo local

Objetivo: entregar una PWA útil, segura, offline-first y completamente funcional en un solo dispositivo.

- [x] Base del proyecto PWA
- [x] Diseño responsive para móvil, tablet y PC
- [x] Bóveda local
- [x] Contraseña maestra
- [x] Cifrado local
- [x] Notas
- [x] Editor de texto enriquecido
- [x] Bloques de código
- [x] Imágenes
- [x] Pulido móvil del editor
- [x] Checklists
- [x] Fichas de contacto privadas
- [x] Entradas por día dentro de una nota
- [x] Carpetas
- [x] Etiquetas
- [x] Búsqueda local
- [x] Backup, exportación y restauración cifrada
- [x] Funcionamiento offline
- [x] Pruebas de la V1

**Estado:** CERRADA ✅

---

## V2 — Cuenta y sincronización

Objetivo: sincronización cifrada entre dispositivos sin exponer contenido al servidor durante el transporte normal. La recuperación por correo es una excepción explícita al modelo zero-knowledge: el backend participa como parte confiable únicamente en el flujo de recuperación elegido por el usuario.

- [x] Cuenta de usuario
- [x] Autenticación
- [x] Backend de sincronización
- [x] Sincronización E2EE
- [x] Varios dispositivos
- [x] Resolución de conflictos *(implementación completa; validación de campo restante en #69)*
- [x] Historial de versiones *(implementación publicada; validación funcional restante en #70)*
- [x] Recuperación de acceso *(flujo principal validado en uso real; deuda multidispositivo/offline restante documentada en #73)*

### Reglas de acceso V2

- El modo local permanece disponible sin correo ni proveedor social.
- La cuenta online es opcional y no sustituye la contraseña maestra durante el acceso normal.
- Una sesión normal de Google/correo no desbloquea por sí sola la bóveda.
- La excepción deliberada es `Recuperar por correo`: un OTP reciente puede autorizar temporalmente al broker de recuperación para recuperar la misma clave de bóveda y obligar a crear una contraseña maestra nueva.
- No se solicitan permisos de Gmail, Drive ni Contactos para autenticarse con Google.
- La misma clave de bóveda se conserva al rotar la contraseña; no se recifran todas las notas.

### Backend y E2EE V2

- `public.sync_records` conserva sobres cifrados y manifiestos E2EE del transporte normal con RLS por `auth.uid()`.
- El backend de sincronización normal no interpreta el contenido privado.
- Binarios usan el bucket privado `oanix-encrypted-blobs`, fragmentos cifrados de 6 MiB y manifiesto cifrado.
- Autosync usa cambios locales, reconexión, regreso a la app, Realtime y polling de respaldo.
- El estado compacto de sincronización y resolución se conserva cifrado bajo `system.sync-state` dentro de `encrypted_records`; no existe una base/store paralelo para esa coordinación.
- Conflictos se conservan y se entregan al usuario; no existe overwrite silencioso deliberado.
- Historial guarda hasta 5 snapshots cifrados por nota dentro del almacenamiento general existente.
- Recuperación por correo usa un broker separado y representa una frontera de confianza explícita diferente del transporte normal E2EE.

**Estado:** CERRADA FUNCIONALMENTE ✅. Las deudas #69, #70 y #73 siguen siendo reales y no deben declararse probadas hasta ejecutar sus casos de campo.

---

## V3 — Android con Capacitor

Objetivo: empaquetar la misma base de código como aplicación Android y añadir integraciones nativas sin duplicar la lógica de negocio ni debilitar el cifrado existente.

- [x] Capacitor *(PR #81)*
- [x] APK / AAB *(PR #82; APK instalada en Android real y modo local validado; firma final de Play Store pendiente para publicación)*
- [x] Android Keystore *(PR #83; implementación/CI completos; prueba específica `seal/open` pendiente)*
- [x] Biometría / credencial segura del dispositivo *(PR #84 + #88/#89/#90 + #94; huella validada, PIN/patrón explícito implementado y pendiente de validación real)*
- [x] Cámara nativa *(PR #86; implementación/CI y prueba funcional básica real completadas)*
- [x] Integración nativa de archivos *(PR #87; implementación/CI y prueba funcional básica real completadas)*
- [x] Compartir hacia OANIX *(PR #91 + #92/#93; cola/progreso para arranque frío y caliente implementados; validación consolidada pendiente)*
- [x] Navegación Atrás / salida segura *(PR #94; implementación/CI completos; prueba real pendiente)*

### Capacitor / empaquetado

- Se reutiliza la misma base React + TypeScript + Vite/PWA.
- La PWA conserva su comportamiento; Android usa el proyecto `android/` generado por Capacitor.
- `appId` actual: `io.github.hnalvaradohn.oanix`, provisional hasta publicación.
- El workflow Android compila APK debug y AAB release de validación.
- No existe todavía una clave privada definitiva de firma para Play Store.
- Las APK debug de CI todavía no mantienen una firma de pruebas estable entre runners; una build nueva puede requerir desinstalar la anterior. No confundir esta deuda con la firma definitiva de publicación.

### Android Keystore

- Una clave AES-256-GCM no exportable vive dentro de `AndroidKeyStore` para sellado nativo pequeño.
- La `CryptoKey` activa de la bóveda web no se vuelve exportable.
- La contraseña maestra no se almacena en Android.
- La clave genérica de sellado y la clave biométrica se mantienen separadas.

### Biometría / credencial

- La contraseña maestra sigue siendo principal y fallback.
- Android 11+ puede usar biometría fuerte o PIN/patrón/contraseña segura del dispositivo como acceso rápido.
- No se acepta `BIOMETRIC_WEAK` para liberar la clave de bóveda.
- La envoltura biométrica v2 usa AES-256-GCM con clave no exportable de Android Keystore y una ventana breve de autorización después del `BiometricPrompt`.
- La copia local para acceso rápido se conserva solo como ciphertext ligado a una bóveda concreta; tras autenticar se importa a Web Crypto como clave no extraíble.
- Al enviar OANIX realmente a segundo plano se limpia la clave activa de la sesión; al regresar se exige nuevamente autorización.
- Si se cancela el prompt, la pantalla de contraseña permanece disponible y muestra `Desbloquear con huella` para reintentar sin escribir antes la contraseña.
- PR #94 añade `Usar PIN o patrón del teléfono`, que solicita únicamente `DEVICE_CREDENTIAL` a Android y reutiliza la misma envoltura cifrada `oanix.biometric-vault.v2`; OANIX nunca recibe ni guarda el PIN, patrón o contraseña del teléfono.
- Flujo de huella, reapertura, cancelación y botón manual de reintento fueron validados en teléfono real. El botón explícito de credencial del dispositivo queda pendiente de prueba real.

### Cámara nativa

- OANIX abre la cámara del sistema mediante `ACTION_IMAGE_CAPTURE` y un `FileProvider` privado.
- La captura original queda temporalmente en caché privada de OANIX; no se guarda automáticamente en la galería.
- Android entrega un URI `content://` y el WebView lo lee mediante `Capacitor.convertFileSrc`; la foto no cruza el bridge como Base64.
- El archivo resultante se entrega al mismo input de imágenes existente y sigue `insertFiles -> storeEncryptedImage`, por lo que original y preview usan el cifrado ya implementado.
- No se solicitan permisos `CAMERA`, `READ_MEDIA_IMAGES` ni almacenamiento para este flujo de cámara externa.
- Cada captura se limita a 24 MiB, se elimina tras importarla o cancelarla y existe limpieza de temporales abandonados.
- El estado de una captura pendiente se conserva frente a recreación de Activity mediante `saveInstanceState/restoreState`.
- Flujo funcional básico validado en teléfono real.

### Integración nativa de archivos

- El backup cifrado conserva el mismo formato `.oanixbackup`, la misma serialización y la misma validación criptográfica ya implementada en V1.
- En Android, guardar usa `ACTION_CREATE_DOCUMENT`: el usuario elige la ubicación exacta y OANIX escribe el backup cifrado al URI seleccionado.
- La escritura cruza el bridge en fragmentos UTF-8 acotados y se completa como una sesión efímera; ante fallo se aborta y se intenta eliminar el archivo parcial.
- Restaurar usa `ACTION_OPEN_DOCUMENT`: Android entrega únicamente el documento que el usuario selecciona y OANIX lo pasa al mismo `restoreEncryptedBackupFromFile` existente.
- La restauración sigue verificando contraseña y todos los registros AES-GCM antes de sustituir la bóveda local en una transacción.
- No se solicitan permisos amplios de almacenamiento (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `MANAGE_EXTERNAL_STORAGE` ni `READ_MEDIA_IMAGES`).
- No se toma permiso persistente sobre el URI ni se crea una copia durable paralela dentro de Android.
- Fuera de Android se conserva el flujo web de descarga/selección de archivo.
- Flujo funcional básico validado en teléfono real.

### Compartir hacia OANIX

- Android expone OANIX como destino para `text/plain` y `image/*`; la importación valida internamente y solo acepta imágenes JPEG, PNG, WebP o GIF.
- `ACTION_SEND` admite texto/enlace, una imagen o ambos; `ACTION_SEND_MULTIPLE` admite hasta 10 imágenes por envío.
- Cada envío crea una nota nueva para no mezclar accidentalmente el contenido con una nota existente.
- El bridge se consume únicamente dentro del área desbloqueada. Si la bóveda está cerrada, el usuario debe autenticarse antes de que OANIX copie/importa el contenido.
- Las imágenes no se copian a almacenamiento de OANIX mientras la bóveda está bloqueada. Después del desbloqueo pasan brevemente por caché privada, se validan y reutilizan `storeEncryptedImage`; el temporal se elimina al terminar.
- PR #93 corrige entregas con OANIX ya viva: cada Intent se conserva solo en una cola en memoria, el runtime escucha `shareReceived`, procesa de uno en uno y muestra progreso local `Preparando` → `Procesando foto N de M` → `Guardando` → `100%`.
- La nota se abre automáticamente solo después de terminar la creación cifrada.
- Temporales de compartir abandonados se eliminan al cargar de nuevo el plugin.
- Límites: texto 250 000 caracteres; imagen 50 MiB; hasta 10 imágenes / 120 MiB temporales por envío.
- Ante fallo se eliminan blobs cifrados creados por ese intento para evitar imágenes huérfanas.
- No se añaden permisos generales de almacenamiento.

### Navegación Atrás Android

- PR #94 intercepta el Back nativo mediante `OnBackPressedDispatcher` únicamente mientras la bóveda está desbloqueada.
- Desde una nota, Back reutiliza la acción existente de regreso, por lo que primero ejecuta el guardado pendiente y finaliza eliminaciones de imágenes antes de volver a la lista.
- Desde la lista/inicio, el primer Back muestra `¿Deseas salir de OANIX?` con `Cancelar` y `Salir`.
- Si la confirmación está visible y se vuelve a usar Back, Android cierra la Activity.
- La apariencia de esta confirmación es deliberadamente funcional; el pulido visual se hará después en la fase de rediseño PWA.

### Estrategia de cierre funcional y fase visual

- Primero se terminan y validan las funciones de V3 y sus fallos nativos.
- Después se congela la lógica funcional de V3 salvo correcciones reales.
- Luego se hace el rediseño/pulido visual completo principalmente en la PWA, donde es más rápido validar móvil, tablet y PC.
- Como Android empaqueta la misma base React, el rediseño PWA se hereda en la APK; solo las diferencias nativas se validan posteriormente en una build consolidada.
- No entrar en V4 para retrasar indefinidamente el rediseño visual.
- Los cambios puramente visuales —incluido el aspecto definitivo del botón Atrás y de los diálogos— se reservan para esta fase PWA, no para las iteraciones funcionales de APK.

### Deudas visibles / validación restante de V3

- APK / modo local: validado en teléfono real.
- Cuenta/bóveda sincronizada dentro de Android: todavía no se declara funcional/validada.
- Keystore `seal/open`: falta prueba específica en dispositivo.
- Biometría: huella y reintento manual validados; PIN/patrón explícito de PR #94 e invalidación por cambio biométrico pendientes de prueba real.
- Cámara nativa: prueba funcional básica completada.
- Archivos nativos: prueba funcional básica completada.
- Compartir hacia OANIX: validar PR #93 con app cerrada y ya abierta/en segundo plano, varias imágenes, texto/enlace y barra de progreso.
- Atrás/salida segura: validar PR #94 en nota e inicio, incluyendo guardado antes de volver y segundo Back para salir.
- Firma estable de pruebas: pendiente; no comprometer una clave privada en el repositorio público.
- Icono Android actual: provisional; dirección visual premium ya definida y debe aplicarse antes de publicación.
- App ID: provisional hasta preparar publicación.

### Orden restante V3

1. Validación consolidada en teléfono de PR #93/#94: compartir en caliente, Atrás/salida y PIN/patrón explícito.
2. Diagnosticar/validar cuenta y sincronización dentro del WebView Android.
3. Resolver firma estable de builds de prueba sin exponer claves privadas.
4. Congelar funcionalidad V3 y ejecutar el rediseño/pulido visual completo en la PWA.
5. Validar una APK consolidada con el diseño final; completar icono/splash y confirmar `appId` antes de publicación.
6. Revisar deudas de campo no bloqueantes y declarar cierre completo de V3 cuando corresponda.

---

## V4 — Funciones avanzadas

- [ ] PDF
- [ ] Audio
- [ ] Dibujos
- [ ] Tablas
- [ ] OCR
- [ ] Compartir notas
- [ ] Temas y personalización avanzada
- [ ] Avatar o foto opcional por nota, almacenada de forma privada
- [ ] IA opcional con modelo de privacidad definido

---

## Estado actual

**V1 — Núcleo local: CERRADA ✅**

**V2 — Cuenta y sincronización: CERRADA FUNCIONALMENTE ✅; deudas de validación #69, #70 y #73 continúan visibles.**

**Versión activa: V3 — Android con Capacitor.**

**Implementación funcional V3: completa. Bloque de validación activo: build consolidada PR #93/#94 en dispositivo real.**

No avanzar a V4 mientras V3 siga abierta, salvo preparación arquitectónica estrictamente necesaria y registrada.
