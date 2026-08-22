# OANIX — Seguridad

**Última actualización:** 2026-08-21

Este documento describe el modelo de seguridad vigente y sus fronteras de confianza. No es un historial de implementación.

## Principios

- No inventar algoritmos criptográficos.
- El contenido privado se cifra en el dispositivo antes de persistirse y antes del transporte normal.
- Contraseña maestra y clave de bóveda son conceptos distintos.
- La contraseña maestra no se persiste ni se envía al backend como contenido recuperable.
- No guardar secretos, tokens Google, refresh tokens o credenciales en código, repositorio, notas, localStorage, IndexedDB o bóveda.
- La UI no manipula directamente la persistencia cifrada ni material criptográfico persistente.
- No describir OANIX completo como zero-knowledge frente al proveedor mientras exista la recuperación por correo confiada descrita abajo.

## Bóveda local

```text
Contraseña maestra
        ↓ Argon2id
Clave de envoltura
        ↓ AES-256-GCM
Clave aleatoria de bóveda
        ↓ AES-256-GCM
Registros privados
```

### Contraseña y derivación

- mínimo inicial: 15 caracteres Unicode;
- normalización NFC; no recortar espacios ni cambiar mayúsculas/minúsculas;
- Argon2id v1.3 (`hash-wasm`);
- memoria 65536 KiB, 3 iteraciones, paralelismo 1;
- salt aleatorio de 16 bytes y salida de 32 bytes.

Los parámetros/salt se guardan para compatibilidad. No se reduce silenciosamente la protección de una bóveda existente.

### Clave de bóveda y registros

La clave de bóveda es aleatoria, independiente de la contraseña y se protege con AES-256-GCM. La clave activa web se importa como `CryptoKey` no extraíble y permanece solo en memoria durante la sesión desbloqueada. Cambiar la contraseña reenvuelve la misma clave; no recifra todas las notas.

Cada escritura privada usa AES-256-GCM con IV aleatorio y AAD ligado al tipo/id del registro. IndexedDB conserva claves técnicas para localizar registros, no contenido privado en claro.

Notas usan `blocks-v1`, no `innerHTML`. Imágenes originales/previews son registros cifrados independientes. URLs `blob:` descifradas son temporales. La búsqueda privada se ejecuta localmente y no mantiene un índice persistente en texto plano.

## Backup y restauración

`.oanixbackup` contiene metadatos de protección y registros ya cifrados. La restauración autentica registros antes de sustituir una bóveda existente y el reemplazo es transaccional. No se crea una segunda bóveda persistente para validar/restaurar.

## Sincronización normal

Identidad online y cifrado de bóveda son dominios separados. Una sesión Supabase/Google autoriza transporte, pero no desbloquea por sí sola la bóveda.

`sync_records` y objetos asociados contienen ciphertext y metadatos operativos mínimos, protegidos además por RLS por usuario. Conflictos siguen `detectar → conservar → mostrar → usuario decide`; no existe overwrite silencioso deliberado. El historial conserva snapshots cifrados. Las validaciones de campo pendientes permanecen en sus issues.

## Recuperación por correo — frontera de confianza explícita

Email OTP es una excepción deliberada al transporte normal E2EE. Una bóveda online puede preparar una envoltura de recuperación de la **misma clave de bóveda**. El broker mantiene material protegido bajo una raíz de recuperación del servidor. Un OTP reciente puede autorizar al broker a procesar temporalmente esa clave para crear una nueva contraseña maestra y reenvolver la misma clave.

Consecuencia: un compromiso suficientemente privilegiado del backend de recuperación podría comprometer claves recuperables. OANIX no debe presentarse globalmente como zero-knowledge frente al proveedor.

Controles esenciales:
- contraseña maestra nunca almacenada por el backend;
- material de recuperación sin acceso directo de clientes normales;
- recuperación exige OTP reciente y validación del usuario;
- una sesión normal no sustituye silenciosamente una recuperación existente por otra clave;
- la rotación incrementa la generación de seguridad correspondiente.

## Archivos grandes

Los archivos grandes se procesan por fragmentos para no materializar gigabytes completos en memoria.

Cada fragmento:
- se lee de forma acotada;
- se cifra con AES-GCM e IV independiente;
- conserva manifiesto/hash SHA-256 para integridad y reconstrucción;
- se libera cuando deja de ser necesario.

Los checkpoints contienen solo el estado necesario para reanudar y viven en una caché técnica separada de `oanix-vault`. No contienen tokens del proveedor ni deben convertirse en una copia permanente adicional del archivo.

La recuperación/verificación remota descarga por rangos, comprueba hashes y autentica/descifra fragmento por fragmento. `100%` de bytes enviados no equivale a `Guardado` hasta completar confirmación/verificación.

## Google Drive

Google Drive es almacenamiento opcional del usuario y el primer `OanixStorageProvider`; no forma parte de la raíz de confianza criptográfica de OANIX.

- Scope exclusivo `drive.appdata`; objetos en `appDataFolder`.
- No solicitar acceso general al Drive.
- Los archivos llegan a Drive ya cifrados.
- Access token temporal exclusivamente en memoria; no persistir refresh token.
- PWA usa Google Identity Services; Android usa `AuthorizationClient` nativo.
- Autorización Drive separada del login OANIX.
- URLs de sesiones reanudables restringidas/validadas para no enviar Bearer tokens a destinos arbitrarios.
- Preflight comprueba cuota/destino antes de cargas grandes cuando corresponde.

Amenazas relevantes:
- una cuenta Drive comprometida sin clave de bóveda puede exponer/borrar ciphertext, no debería revelar plaintext solo con esos objetos;
- un token temporal robado permite operaciones del scope mientras sea válido, razón para no persistirlo;
- AES-GCM y hashes detectan alteración, pero no evitan borrado, retención o rollback remoto;
- una URL reanudable manipulada nunca debe recibir credenciales fuera del destino autorizado.

## Android

Android Keystore protege claves nativas no exportables usadas para sellado/acceso rápido. No vuelve exportable la `CryptoKey` web ni sustituye la contraseña maestra.

Biometría/credencial del dispositivo autoriza acceso rápido a material protegido; OANIX no recibe ni almacena PIN, patrón, contraseña del dispositivo o huella.

Cámara, archivos y compartir usan temporales privados, límites explícitos y limpieza posterior; no justifican permisos generales de almacenamiento.

## Límites del modelo

- JavaScript no garantiza borrado físico perfecto de todas las copias internas del runtime; se limpian buffers controlados cuando es posible.
- Un dispositivo comprometido mientras la bóveda está desbloqueada está fuera de la protección del cifrado en reposo.
- Un dispositivo offline puede conservar protección antigua hasta reconectarse; al volver debe respetar la generación remota más reciente.
- Cifrado autenticado detecta manipulación, no garantiza disponibilidad frente a borrado remoto.

## Revisión obligatoria

Cualquier cambio que afecte claves, cifrado, recuperación, formatos persistidos, almacenamiento remoto, checkpoints o autorización de proveedores debe revisarse contra este documento y `PROJECT_MEMORY.md` antes de fusionarse.
