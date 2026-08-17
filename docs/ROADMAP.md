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
- [x] Recuperación de acceso *(implementación por correo integrada; validación real/multidispositivo/offline restante documentada en #73)*

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

**Estado:** implementación funcional completada y se avanzó a V3. Las deudas #69, #70 y #73 siguen siendo reales y no deben declararse probadas hasta ejecutar sus casos de campo.

---

## V3 — Android con Capacitor

Objetivo: empaquetar la misma base de código como aplicación Android y añadir integraciones nativas sin duplicar la lógica de negocio ni debilitar el cifrado existente.

- [x] Capacitor *(PR #81)*
- [x] APK / AAB *(PR #82; APK instalada en Android real y modo local validado; firma final de Play Store pendiente para publicación)*
- [x] Android Keystore *(PR #83; implementación/CI completos; prueba específica de campo pendiente)*
- [x] Biometría / credencial segura del dispositivo *(PR #84; implementación/CI completos; prueba real pendiente)*
- [ ] **Cámara nativa — BLOQUE ACTIVO**
- [ ] Integración nativa de archivos
- [ ] Compartir hacia OANIX

### Capacitor / empaquetado

- Se reutiliza la misma base React + TypeScript + Vite/PWA.
- La PWA conserva su comportamiento; Android usa el proyecto `android/` generado por Capacitor.
- `appId` actual: `io.github.hnalvaradohn.oanix`, provisional hasta publicación.
- El workflow Android compila APK debug y AAB release de validación.
- No existe todavía una clave privada definitiva de firma para Play Store.

### Android Keystore

- Una clave AES-256-GCM no exportable vive dentro de `AndroidKeyStore` para sellado nativo pequeño.
- La `CryptoKey` activa de la bóveda web no se vuelve exportable.
- La contraseña maestra no se almacena en Android.
- La clave genérica de sellado y la clave biométrica se mantienen separadas.

### Biometría / credencial

- La contraseña maestra sigue siendo principal y fallback.
- Android 11+ puede usar biometría fuerte o PIN/patrón/contraseña segura del dispositivo como acceso rápido.
- La clave biométrica de Keystore exige autenticación por cada uso.
- No se acepta `BIOMETRIC_WEAK` para liberar la clave de bóveda.
- La copia local para acceso rápido se conserva solo como ciphertext AES-GCM ligado a una bóveda concreta; tras autenticar se importa a Web Crypto como clave no extraíble.
- Android anterior conserva el flujo de contraseña maestra.

### Deudas visibles de V3

- APK/mode local: validado en teléfono real.
- Cuenta/bóveda sincronizada dentro de Android: todavía no se declara funcional/validada.
- Keystore `seal/open`: falta prueba específica en dispositivo.
- Biometría: falta prueba real de enrolamiento, reapertura, cancelación, fallback e invalidación.
- Icono Android actual: provisional; dirección visual premium ya definida y debe aplicarse antes de publicación.

### Orden restante V3

1. Cámara nativa.
2. Integración nativa de archivos.
3. Compartir hacia OANIX.
4. Completar validaciones de campo pendientes.
5. Identidad visual, firma y preparación de publicación cuando corresponda.

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

**V2 — Cuenta y sincronización: implementación funcional completada; deudas de validación #69, #70 y #73 continúan visibles.**

**Versión activa: V3 — Android con Capacitor.**

**Bloque oficial activo: Cámara nativa.**

No avanzar a V4 mientras V3 siga abierta, salvo preparación arquitectónica estrictamente necesaria y registrada.
