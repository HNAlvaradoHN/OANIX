# OANIX — Memoria operativa del proyecto

Este documento conserva decisiones, pendientes, cambios pospuestos y contexto de continuidad que no deben depender de un chat concreto.

Su propósito es permitir que otra IA o colaborador continúe OANIX sin reconstruir conversaciones anteriores ni inventar requisitos.

> Antes de usar este archivo, leer también `AGENTS.md`, `docs/ROADMAP.md` y verificar el estado real de `main`.

---

## 1. Estado actual

**Última actualización:** 2026-08-16

**Versión activa:** V3 — Android con Capacitor

**V1 — Núcleo local:** CERRADA

**V2 — Cuenta y sincronización:** implementación funcional completada y se avanzó a V3. No borrar ni falsificar las deudas de validación restantes:
- Resolución de conflictos: implementación completa; detección real comprobada; casos restantes en issue #69.
- Historial cifrado de versiones: implementación publicada, retención de 5 puntos; validación real restante en issue #70.
- Recuperación por Email OTP: implementación integrada; validación real/multidispositivo/offline restante documentada en issue #73.

**V3 implementado hasta ahora:**
- Capacitor 8.4.2 y proyecto Android: PR #81.
- APK debug + AAB release de validación: PR #82.
- APK instalada en teléfono Android real: aplicación nativa abre y el modo local funciona.
- El flujo Android online/bóveda sincronizada todavía no funciona o no está validado; mantenerlo como deuda visible y no declararlo probado.
- Android Keystore: PR #83, compilación Android real de CI completada; prueba específica de sellar/abrir en dispositivo pendiente.
- Biometría/credencial segura del dispositivo: PR #84, compilación Android real de CI completada; prueba funcional en teléfono pendiente.
- Cámara nativa: PR #86, implementación y compilación APK/AAB completadas; prueba funcional en teléfono pendiente.

**Bloque oficial activo:** Integración nativa de archivos.

**Después:** compartir hacia OANIX → cierre/validación de V3 y preparación de publicación.

**No avanzar todavía:** V4 salvo preparación arquitectónica estrictamente necesaria y registrada.

---

## 2. Forma de trabajo acordada

### 2.1 Desarrollo por versiones
OANIX se desarrolla estrictamente por versiones y en el orden oficial del roadmap. Las ideas futuras se documentan en vez de implementarse por impulso.

### 2.2 Modularidad
Reutilizar de forma segura lo existente antes que crear bases, stores, cachés o capas paralelas. Mantener módulos suficientemente independientes para modificar funciones sin afectar innecesariamente al resto.

En Android, Capacitor envuelve la misma aplicación. No crear una segunda lógica de notas, cifrado, imágenes o sincronización solo para la APK.

### 2.3 Seguridad y datos
- Offline-first sigue siendo fundamental.
- El contenido privado permanece cifrado localmente.
- El transporte normal de sincronización mantiene E2EE y sobres opacos.
- Una sesión normal de Google/correo no desbloquea por sí sola la bóveda.
- **Excepción explícita:** la recuperación por correo confía en el backend/proveedor de autenticación para recuperar temporalmente la misma clave de bóveda después de un OTP reciente. No describir este mecanismo como zero-knowledge frente al proveedor.
- La contraseña maestra no se guarda en Supabase ni en Android.
- La clave de bóveda no se guarda en claro en tablas de cliente ni en preferencias Android.
- La `CryptoKey` activa del runtime web sigue siendo no extraíble.
- Ante incertidumbre de sincronización, conservar datos tiene prioridad sobre sobrescribir silenciosamente.

### 2.4 Continuidad entre IAs
Una IA que continúe OANIX debe leer `AGENTS.md`, `ROADMAP.md`, esta memoria, `ARCHITECTURE.md`, `SECURITY.md` y `CHANGELOG.md`; verificar `main`; no pedir al usuario decisiones ya documentadas; no inventar requisitos; registrar cambios, aplazamientos y excepciones.

### 2.5 Avance automático de ajustes pequeños
El usuario pidió explícitamente no perder tiempo deteniéndose por ajustes pequeños. Cuando un cambio es local, de bajo riesgo, no altera seguridad/datos/alcance ni una decisión importante y puede validarse con pruebas, la IA debe corregirlo, probarlo, integrarlo y continuar automáticamente.

Sí debe pedir decisión cuando haya alternativas reales que cambien seguridad, datos, alcance o experiencia importante.

---

## 3. Registro de decisiones

### DEC-2026-08-16-001 — Resolución de conflictos multidispositivo
**Estado:** IMPLEMENTED / VALIDATION_DEBT

Cuando existe divergencia real OANIX conserva ambos lados y el usuario decide. Para notas compatibles puede elegir la versión sincronizada, la local o combinar ambas. La combinación conserva completos ambos contenidos: primero el cambio aceptado primero por la sincronización remota y luego el otro, sin merge semántico, sin rótulos permanentes y sin convertir bloques estructurados a texto plano. Principio: `detectar -> conservar -> mostrar -> usuario decide`.

PR #66 cubre conflictos no binarios y PR #67 imágenes originales/previews. La detección real fue comprobada; deuda restante en #69.

### DEC-2026-08-16-002 — Criterio de verdad
**Estado:** DECIDED

El repositorio es la fuente persistente de verdad. Conversaciones previas ayudan con intención, pero si contradicen código/documentación actual se debe resolver la discrepancia con evidencia.

### DEC-2026-08-16-003 — Memoria operativa en repositorio
**Estado:** IMPLEMENTED

`AGENTS.md` guarda reglas estables; `PROJECT_MEMORY.md` decisiones/pendientes; `ROADMAP.md` orden oficial; `CHANGELOG.md` implementación; issues de deuda/diferidos conservan contexto específico.

### DEC-2026-08-16-004 — Historial de versiones cifrado
**Estado:** IMPLEMENTED / VALIDATION_DEBT

- Snapshots `note-history` dentro de `encrypted_records`.
- Máximo 5 snapshots por nota; al sexto se elimina el más antiguo.
- Ventana automática mínima de 5 minutos.
- Centro `🕘`, vista previa y restauración con checkpoint `pre-restore`.
- Historial puede sincronizarse con transporte E2EE no binario.
- No duplica binarios históricos; si falta una imagen original requerida, bloquea la restauración en lugar de producir una nota incompleta.
- Al eliminar permanentemente una nota se elimina su historial.
- Validación real restante en #70.

### DEC-2026-08-16-005 — Recuperación con clave permanente bajo control del usuario
**Estado:** SUPERSEDED

La propuesta inicial era exigir una segunda clave/código de recuperación permanente guardado por el usuario. Esta propuesta fue descartada por fricción de uso.

**Sustituida por:** DEC-2026-08-16-006.

### DEC-2026-08-16-006 — Recuperación de contraseña maestra por Email OTP
**Estado:** IMPLEMENTED / VALIDATION_DEBT

**Versión / bloque:** V2 — Recuperación de acceso

**Referencia:** issue #73, PR #74 y PR #75.

**Decisión funcional definitiva:**
- Solo existe una contraseña maestra permanente para la bóveda sincronizada.
- No existe una segunda clave permanente que el usuario tenga que recordar o guardar.
- Si se olvida la contraseña: `Recuperar por correo` → código temporal al correo → introducir código → crear y confirmar obligatoriamente una nueva contraseña maestra.
- Un nuevo proceso futuro genera otro OTP; el código anterior no es una credencial permanente.
- El modo exclusivamente local no puede usar recuperación por correo.

**Cambio explícito del modelo de confianza:**
La comodidad de recuperación por correo implica confiar en el proveedor de autenticación/backend durante ese flujo. El transporte normal sigue cifrado/E2EE, pero la solución completa ya no es zero-knowledge frente al proveedor porque el broker puede recuperar temporalmente la clave de bóveda después de una autenticación OTP reciente.

**Implementación:**
- PR #74: reenvoltorio de la misma clave de bóveda al cambiar contraseña; no recifra todas las notas ni crea una segunda bóveda.
- PR #75: flujo Email OTP y broker de recuperación.
- Supabase producción: `oanix_recovery_root` y `vault_recovery_envelopes`, sin grants directos a `anon`/`authenticated`.
- `vault-recovery-broker` exige JWT y OTP reciente para recuperar.
- `securityGeneration` evita que dispositivos obsoletos reviertan silenciosamente la protección.

**Deuda que permanece visible al haber avanzado a V3:**
- Confirmar flujo real completo OTP → nueva contraseña → misma bóveda → contraseña anterior inválida.
- Validar segundo dispositivo, reutilización de OTP y comportamiento de dispositivo offline.
- Un dispositivo completamente offline puede conservar una protección antigua hasta reconectarse; no prometer revocación instantánea.

### DEC-2026-08-16-007 — Android usa una sola base de aplicación
**Estado:** IMPLEMENTED

**Referencia:** issue #79, PR #81 y #82.

- Capacitor envuelve la misma base React + TypeScript + Vite/PWA.
- La PWA conserva su estrategia de Service Worker y `/OANIX/`; el bundle nativo usa rutas apropiadas para WebView y no registra el Service Worker de actualización de la PWA.
- No mantener una implementación paralela de notas/cifrado/sync para Android.
- App ID actual: `io.github.hnalvaradohn.oanix`. Se considera provisional antes de publicación; después de publicar en Play Store no debe cambiarse.
- La firma definitiva de Play Store todavía no fue creada ni almacenada; tratar esa credencial permanente de forma explícita antes de publicación.

### DEC-2026-08-16-008 — Android Keystore separado de la clave activa web
**Estado:** IMPLEMENTED / VALIDATION_DEBT

**Referencia:** PR #83.

- `OanixKeystorePlugin` genera una clave AES-256-GCM no exportable dentro de `AndroidKeyStore` con alias `oanix.device-seal.v1`.
- Usa IV aleatorio, AAD de propósito y limita el material sellado a 4 KiB.
- Esta clave genérica NO es la `CryptoKey` activa de la bóveda y no almacena contraseña maestra.
- Se mantiene deliberadamente separada de la clave usada por biometría para evitar cambiar silenciosamente los parámetros de un alias que ya pueda existir en un dispositivo.
- Compilación APK/AAB pasó; falta una prueba real específica `seal/open` en teléfono.

### DEC-2026-08-16-009 — Desbloqueo rápido Android con biometría fuerte o credencial del dispositivo
**Estado:** IMPLEMENTED / VALIDATION_DEBT

**Referencia:** PR #84, issue #79.

**UX aprobada por el usuario:**
- La contraseña maestra continúa siendo la credencial principal y el fallback.
- Después de un desbloqueo correcto con contraseña, OANIX puede activar acceso rápido en ese teléfono.
- En aperturas posteriores puede usar huella/rostro fuerte o PIN/patrón/contraseña segura del dispositivo.
- Si la autenticación se cancela, se invalida la clave, cambia el entorno o no es compatible, OANIX vuelve al flujo normal de contraseña maestra.

**Modelo técnico:**
- Alias separado `oanix.biometric-vault.v1` dentro de Android Keystore.
- AES-256-GCM y autenticación obligatoria por cada uso (`timeout = 0`).
- Solo `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`; no usar `BIOMETRIC_WEAK` para liberar material criptográfico de bóveda.
- La implementación se habilita desde Android 11 / API 30 para mantener un camino criptográfico coherente con biometría fuerte + credencial del dispositivo. Android anterior conserva la contraseña maestra.
- La clave de bóveda se guarda nativamente únicamente como ciphertext autenticado por Keystore, con IV y binding; nunca como texto plano en SharedPreferences.
- El binding es `primary:${metadata.createdAt}`. Una envoltura de otra bóveda no debe abrir una bóveda reemplazada accidentalmente.
- Tras autenticar, los 32 bytes de clave cruzan el bridge solo de forma temporal; el lado TypeScript los importa inmediatamente como `CryptoKey` AES-GCM **no extraíble** y limpia los arrays temporales.
- La `CryptoKey` activa existente no se vuelve exportable para implementar biometría.
- CI web + auditoría offline + compilación Android APK/AAB pasaron antes del merge.
- Falta prueba en teléfono real: enrolar acceso rápido, cerrar/reabrir, autenticar, cancelar, usar contraseña fallback e invalidación de credencial/biometría.

### DEC-2026-08-16-010 — Identidad visual Android pendiente de publicación
**Estado:** DECIDED / DEFERRED_WITHIN_V3

- El icono Android actual es provisional.
- Dirección aprobada: identidad premium de OANIX basada en hoja/bloc de notas, una `O` integrada y un detalle de seguridad sutil.
- Paleta preferida: azul noche/negro azulado + cian/azul brillante + blanco/plateado.
- Evitar candado grande, aspecto genérico o texto pequeño/ilegible dentro del icono.
- Sustituir los assets provisionales antes de publicación, sin bloquear Cámara/Archivos/Compartir.

### DEC-2026-08-16-011 — Cámara nativa usa temporales privados y el mismo cifrado de imágenes
**Estado:** IMPLEMENTED / VALIDATION_DEBT

**Referencia:** PR #86, issue #79.

- La cámara nativa no crea una galería, base o store de imágenes paralelo.
- OANIX usa `ACTION_IMAGE_CAPTURE` con un `FileProvider` y un JPEG temporal dentro de la caché privada de la aplicación.
- El flujo no guarda la foto automáticamente en la galería y no añade permisos `CAMERA`, `READ_MEDIA_IMAGES` ni almacenamiento; se declara únicamente la visibilidad del intent de cámara.
- La foto original no cruza el bridge como Base64: Android devuelve un URI `content://`, el WebView lo lee mediante `Capacitor.convertFileSrc` y construye un `File` JPEG.
- `NativeCameraRuntime` entrega ese archivo al input de imágenes ya existente. La ruta autoritativa sigue siendo `insertFiles -> storeEncryptedImage`, incluyendo original cifrado y preview cifrada.
- El límite específico de cámara es 24 MiB. El importador general conserva sus propias reglas existentes.
- El temporal se elimina al cancelar o después de que JavaScript termina la importación; temporales abandonados se limpian en un arranque posterior después de una hora.
- `saveInstanceState/restoreState` conserva ruta y URI de una captura activa frente a recreación de Activity.
- La UI muestra `Cámara` dentro de Insertar y también en la toolbar nativa para anchos mayores; antes de abrir la cámara conserva el punto actual de inserción.
- CI web, build, auditoría offline y compilación APK/AAB pasaron antes del merge.
- Falta prueba real en teléfono: capturar, cancelar, insertar en la posición esperada, confirmar que la foto reaparece tras cerrar/abrir la nota y revisar que no se copie a la galería.

---

## 4. Ideas y funciones diferidas

### DEFERRED — Protección opcional por nota + sesión de desbloqueo
**Referencia:** issue #68.

Decisiones ya tomadas:
- El título real de una nota protegida permanece visible por defecto con indicador `🔒`.
- Mientras está bloqueada no muestra preview, contenido ni coincidencias internas de búsqueda.
- Búsqueda por título sí puede localizarla.
- Ocultar también el título podría ser opción futura, no predeterminada.
- Se estudia contraseña por nota y política configurable de re-bloqueo.
- La biometría global Android de V3 no implementa automáticamente una capa de cifrado independiente por nota.

No implementar esta función solo por existir biometría global; requiere su propio bloque/decisión de seguridad.

### V3 pendiente en orden
1. Integración nativa de archivos — ACTIVO.
2. Compartir hacia OANIX desde Android.
3. Validaciones de campo restantes, identidad visual/firma/publicación cuando corresponda.

### DEFERRED — V4 funciones avanzadas
PDF, audio, dibujos, tablas, OCR, compartir notas, personalización avanzada, avatar/foto opcional por nota e IA opcional con modelo de privacidad definido.

---

## 5. Excepciones de orden y deudas no bloqueantes

### Avance desde Resolución de conflictos con deuda de validación
Por decisión explícita del usuario se inició Historial de versiones sin completar todas las pruebas reales de conflictos. Deuda #69. No afirmar pruebas que no ocurrieron.

### Avance desde Historial de versiones con deuda de validación
Por decisión explícita del usuario se inició Recuperación de acceso con Historial ya implementado/publicado pero sin completar toda la prueba real. Deuda #70.

### Avance desde V2 a V3 con deuda de validación
Se avanzó a V3 sin borrar las deudas reales de #69, #70 y #73. La implementación principal de V2 existe; estas validaciones deben seguir visibles y cualquier regresión se corrige.

### Android real
- APK/mode local: VALIDADO EN TELÉFONO REAL.
- Android online/sync: NO VALIDADO / actualmente no funciona o no se comprobó correctamente.
- Keystore `seal/open`: implementación y build completos; prueba real pendiente.
- Biometría/credencial: implementación y build completos; prueba real pendiente.
- Cámara nativa: implementación y build completos; prueba real pendiente.

---

## 6. Problemas o discrepancias a recordar

### Repositorio actualmente público
**Estado:** ATTENTION

El repositorio aparece actualmente con visibilidad pública. No cambiar visibilidad, permisos ni configuración sensible sin instrucción explícita del usuario.

### Android online/sincronización
**Estado:** VALIDATION_REQUIRED

El usuario confirmó que en la APK actual funciona el modo local. No afirmar que cuenta/bóveda sincronizada funciona dentro de Android hasta diagnosticarla y validarla en dispositivo.

### Firma de Play Store
**Estado:** NOT_CONFIGURED

No existe todavía una clave privada definitiva de publicación registrada por este proyecto. No inventar, subir ni pedir una clave privada en chat. Diseñar su manejo explícitamente cuando llegue la etapa de publicación.

---

## 7. Regla de cierre

Antes de cerrar un bloque relevante revisar: implementación exacta, nuevas decisiones, pendientes, excepciones, roadmap, changelog, CI y discrepancias. Cualquier contexto necesario para continuidad debe quedar documentado antes del cierre.
