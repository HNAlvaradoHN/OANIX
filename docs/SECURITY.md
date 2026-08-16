# OANIX — Security

## Objetivo de seguridad

OANIX cifra el contenido privado en el dispositivo antes de almacenarlo y antes de transportarlo mediante la sincronización normal.

Para el **transporte normal de sincronización**, una copia de `sync_records` y de los objetos cifrados no debe bastar para leer las notas sin la clave de bóveda. La recuperación por correo introducida en V2 es una excepción explícita: el backend mantiene material de recuperación protegido y, tras un OTP reciente, puede procesar temporalmente la misma clave de bóveda para permitir cambiar una contraseña maestra olvidada. Por ello OANIX completo no debe describirse como zero-knowledge frente al proveedor de backend.

## Reglas

- No inventar algoritmos criptográficos propios.
- Usar primitivas y librerías criptográficas conocidas y mantenidas.
- No guardar notas privadas en texto plano cuando la bóveda está protegida.
- Imágenes, miniaturas y futuros adjuntos privados deben seguir la misma política de cifrado que las notas.
- La contraseña maestra no debe enviarse ni almacenarse en el servidor como contenido recuperable.
- La búsqueda privada debe ejecutarse localmente sobre contenido descifrado.
- El código pegado dentro de una nota se trata como contenido, no se ejecuta.
- El editor no persiste HTML arbitrario del navegador; transforma la vista editable a un modelo propio de bloques y marcas permitidas.
- Los enlaces guardados por el editor se limitan a protocolos explícitamente permitidos.
- No introducir IA remota en el núcleo de seguridad de V1.
- Cualquier excepción de confianza, como la recuperación por correo de V2, debe quedar documentada de forma explícita y no presentarse como E2EE/zero-knowledge frente al proveedor.

## V1

En V1 la seguridad se concentra en el dispositivo:

```text
Contraseña maestra
        ↓
Argon2id
        ↓
Clave de envoltura
        ↓
Clave aleatoria de la bóveda
        ↓
Cifrado autenticado del contenido
        ↓
Almacenamiento local
```

La contraseña maestra no cifra directamente las notas. Su función es derivar una clave de envoltura que protege una clave aleatoria independiente de la bóveda. Esto permite cambiar la contraseña sin volver a cifrar todo el contenido.

## Formato criptográfico V1

### Contraseña maestra

- Longitud mínima inicial: 15 caracteres Unicode.
- No se exigen combinaciones artificiales de mayúsculas, números o símbolos.
- Se aceptan espacios y Unicode.
- Antes de la derivación se aplica normalización Unicode NFC.
- No se recortan espacios ni se cambia el uso de mayúsculas/minúsculas.
- La contraseña nunca se persiste.

### Derivación de clave

OANIX V1 usa Argon2id v1.3 mediante una implementación WebAssembly mantenida (`hash-wasm`).

Parámetros iniciales:

```text
Memoria:       65536 KiB (64 MiB)
Iteraciones:   3
Paralelismo:   1
Salt:          16 bytes aleatorios
Salida:        32 bytes (256 bits)
```

Los parámetros y el salt se almacenan junto con los metadatos de protección para permitir compatibilidad y futuras actualizaciones. No se reducirá silenciosamente la protección de una bóveda ya creada.

### Clave de la bóveda

Al proteger una bóveda por primera vez se generan 32 bytes aleatorios mediante el generador criptográfico del navegador. Esa clave es independiente de la contraseña maestra y es la raíz del cifrado del contenido local.

La clave de la bóveda se protege con AES-256-GCM mediante Web Crypto:

```text
Clave de cifrado:  clave derivada por Argon2id
IV:                12 bytes aleatorios por envoltura
Tag GCM:           128 bits
AAD:               OANIX:vault-key:v1
```

En IndexedDB solo se persisten para esta protección:

- versión del esquema;
- salt y parámetros de Argon2id;
- IV de AES-GCM;
- clave de bóveda cifrada y autenticada;
- identificador versionado del formato criptográfico.

No se almacenan la contraseña maestra, la salida de Argon2id ni la clave de bóveda en texto plano.

### Cifrado del contenido local

Los registros privados se cifran con AES-256-GCM usando la clave de bóveda desbloqueada. Cada escritura genera un IV aleatorio nuevo de 12 bytes y usa una etiqueta de autenticación GCM de 128 bits.

El formato persistido del contenido es versionado:

```text
Esquema:       aes-gcm-v1
IV:            12 bytes aleatorios
Ciphertext:    contenido cifrado + tag GCM
AAD:           [OANIX, content, 1, tipo de registro, id de registro]
```

El tipo y el identificador del registro forman parte de los datos autenticados. Copiar un ciphertext válido hacia otro tipo o identificador hace fallar la autenticación al intentar descifrarlo.

La capa de repositorio recibe datos en memoria, los cifra antes de escribirlos en IndexedDB y solo devuelve datos después de descifrarlos con la clave activa. La interfaz no accede directamente a IndexedDB ni manipula la clave criptográfica.

Para localizar registros, IndexedDB conserva una clave técnica derivada del tipo e identificador del registro. El contenido privado permanece dentro del payload cifrado. La misma capa criptográfica admite bytes y JSON para que imágenes y otros tipos binarios sigan la misma política.

### Notas y editor enriquecido

Las notas se almacenan como registros cifrados de tipo `note`. El contenido usa un modelo estructurado `blocks-v1`; no se persiste el `innerHTML` de `contentEditable`.

El editor solo transforma a datos persistentes los elementos que OANIX reconoce: párrafos, encabezados, listas, citas, separadores, bloques de código, referencias de imagen y segmentos de texto con marcas permitidas. Estructuras ajenas se aplanan a texto o se descartan como formato.

Los enlaces se normalizan y solo se conservan con protocolos `http`, `https`, `mailto` o `tel`. El pegado de texto introduce texto plano. Los bloques de código almacenan texto y un identificador de lenguaje permitido; OANIX no ejecuta ese contenido.

El autoguardado cifra el modelo completo antes de cada escritura. Las mutaciones de una misma nota se serializan para impedir sobrescrituras concurrentes entre título y contenido.

### Imágenes cifradas

Las imágenes no se incrustan como base64 en el JSON de la nota. La nota cifrada conserva una referencia aleatoria y los bytes se almacenan en un registro cifrado independiente de tipo `image`.

Los bytes pasan por `encryptVaultBytes` con la misma clave de bóveda, IV AES-GCM aleatorio y AAD ligado al tipo e identificador de imagen. IndexedDB no persiste una copia descifrada.

Se admiten JPEG, PNG, WebP y GIF, con límite de 50 MiB por original. SVG se rechaza para evitar contenido activo basado en marcado.

Las previews se cifran en `image-preview`. Las URL `blob:` temporales se revocan al dejar de necesitarlas. Al quitar una imagen, la limpieza evita destruir originales todavía referenciados por una nota persistida.

### Búsqueda local

La búsqueda se ejecuta sobre notas ya descifradas en memoria después de desbloquear la bóveda. OANIX no crea ni persiste un índice de búsqueda en texto plano ni envía consultas o contenido privado a servicios externos.

### Backup cifrado V1

El backup `.oanixbackup` copia metadatos de protección y registros ya cifrados; no exporta una representación descifrada de notas o imágenes.

Antes de restaurar, OANIX deriva la clave con la contraseña proporcionada y autentica cada registro AES-GCM antes de modificar la bóveda local. Una contraseña incorrecta, un registro manipulado o un formato incompatible detienen el proceso.

Cuando ya existe una bóveda, OANIX exige confirmación antes de reemplazarla. El reemplazo se realiza transaccionalmente. No se crea una segunda bóveda persistente ni una caché permanente para la operación.

### Comprobación de almacenamiento cifrado

Después de crear o desbloquear la bóveda, OANIX puede realizar una comprobación de ida y vuelta con un registro técnico aleatorio: cifra, escribe, lee, descifra, compara y elimina. Si falla, la interfaz no presenta la bóveda como lista para usar.

### Desbloqueo y sesión

Para desbloquear OANIX se deriva la clave de envoltura y se intenta descifrar la clave de bóveda. Una contraseña incorrecta o metadatos manipulados hacen fallar AES-GCM.

Tras un desbloqueo correcto, la clave se importa como `CryptoKey` no extraíble y se conserva únicamente en memoria. Al recargar/cerrar el proceso, esa sesión se pierde. La implementación sobrescribe buffers temporales controlados cuando es posible, aunque JavaScript no puede garantizar borrado perfecto de todas las copias internas del runtime.

### Recuperación en V1

V1 no tenía recuperación de contraseña. Una bóveda exclusivamente local sigue sin tener recuperación por correo. La recuperación por correo pertenece a V2 y solo existe para bóvedas vinculadas a una cuenta online que hayan preparado previamente su envoltura de recuperación.

## Referencias técnicas

- RFC 9106 — Argon2 Memory-Hard Function.
- OWASP Password Storage Cheat Sheet.
- NIST SP 800-63B — Passwords y normalización Unicode NFC.
- NIST SP 800-38D — AES-GCM.
- W3C Web Cryptography API — AES-GCM y manejo de `CryptoKey`.

## V2

### Autenticación

La identidad online y la bóveda son dominios separados durante el acceso normal:

- Supabase Auth identifica mediante correo + contraseña o Google.
- Una sesión normal no deriva ni desbloquea automáticamente la clave de bóveda.
- La contraseña maestra nunca se envía a Supabase ni a Google.
- Cerrar la sesión online no elimina la bóveda local.
- Google solicita identidad básica, no permisos de Gmail, Drive ni Contactos.
- **Excepción de recuperación:** un JWT cuyo método de autenticación más reciente sea un Email OTP válido y reciente puede autorizar al broker a devolver temporalmente la misma clave de bóveda para crear una protección maestra nueva.

### Backend de sincronización normal

`public.sync_records` y el bucket privado almacenan sobres/fragmentos cifrados y metadatos operativos mínimos. El cliente usa RLS por `auth.uid()`; la publishable key no es un secreto y no debe saltarse esas políticas.

Durante el transporte normal, el servidor no necesita conocer título, contenido, carpeta, etiquetas, contacto, descripción de imagen ni tipo semántico del registro si permanece dentro del sobre cifrado.

### Recuperación por correo — excepción de confianza

Por decisión explícita de producto, OANIX V2 prioriza que una persona pueda recuperar una contraseña maestra olvidada sin conservar una segunda clave permanente.

Flujo:

1. después de una entrada correcta a la bóveda sincronizada, el cliente prepara una envoltura de recuperación de la misma clave de bóveda;
2. `vault-recovery-broker` cifra esa clave bajo una raíz de recuperación del servidor y almacena solamente el ciphertext por usuario;
3. `Recuperar por correo` solicita un Email OTP para una cuenta existente (`shouldCreateUser: false`);
4. `recover` exige un JWT válido cuyo método AMR más reciente sea `otp` y tenga como máximo 10 minutos;
5. el broker descifra temporalmente la clave de bóveda y la entrega al cliente autenticado por OTP;
6. el cliente obliga a crear y confirmar una nueva contraseña maestra y reenvuelve la **misma** clave de bóveda;
7. el bootstrap se actualiza con versión esperada y `securityGeneration` aumenta;
8. la envoltura de recuperación se rota.

Controles:

- `oanix_recovery_root` y `vault_recovery_envelopes` tienen RLS y no conceden acceso directo a `anon` ni `authenticated`.
- La Edge Function usa `verify_jwt=true` y valida además al usuario con Supabase Auth.
- Una sesión normal puede preparar/rotar la envoltura únicamente para la misma clave ya registrada; no puede reemplazar una recuperación existente con una clave distinta.
- La contraseña maestra no se almacena en el backend.
- La clave de bóveda no se almacena en claro en las tablas; el broker sí la procesa temporalmente durante preparación/recuperación.
- La plantilla Email OTP debe incluir `{{ .Token }}` para que la UX entregue un código numérico en lugar de únicamente Magic Link.

Consecuencia: un compromiso suficientemente privilegiado del backend que incluya la raíz de recuperación y las envolturas podría comprometer la capacidad de recuperar claves de bóveda. Esta es una consecuencia aceptada de la recuperación por correo y debe comunicarse con precisión; no ocultarla bajo el término E2EE.

### Modelo de amenazas V2

**Fuga de `sync_records`/bucket sin secretos de recuperación.** Debe revelar ciphertext y metadatos operativos, no contenido privado.

**Fuga completa del backend de recuperación.** Puede incluir material suficiente para recuperar claves de bóveda. El modelo de confianza acepta este riesgo para ofrecer recuperación por correo; la contraseña maestra en sí sigue sin almacenarse.

**Otro usuario autenticado.** RLS impide acceso a filas/objetos de otros usuarios. Las tablas de recuperación no tienen grants de cliente.

**Publishable key expuesta.** Es pública por diseño y no concede acceso por sí sola.

**Robo de sesión normal de cuenta.** No debe permitir `recover`, porque esa acción exige OTP reciente. Puede, sin embargo, operar con los permisos normales de la cuenta mientras la sesión sea válida.

**Compromiso del correo.** El correo es ahora un factor crítico de recuperación. Quien pueda completar el OTP y cumpla el flujo de cuenta puede intentar restablecer la bóveda. Esta consecuencia es inherente a la decisión de producto.

**Servidor malicioso/comprometido.** Puede borrar, retener, duplicar o reordenar ciphertext; además, por la ruta de recuperación confiada, un compromiso privilegiado puede afectar la confidencialidad de claves recuperables. AES-GCM detecta alteraciones de ciphertext, pero no resuelve rollback/borrado por sí solo.

**Dispositivo completamente offline durante una rotación.** Puede conservar localmente la protección antigua y seguir abriendo esa copia local con la contraseña vieja. OANIX no puede revocar mágicamente un dispositivo desconectado. Al volver a sincronizar debe respetar la generación/protección remota más reciente y no publicar metadatos antiguos sobre ella.

### Historial y conflictos

La resolución de conflictos evita pérdida silenciosa mediante `detectar -> conservar -> mostrar -> usuario decide`. El historial guarda hasta 5 snapshots cifrados por nota con checkpoint pre-restauración. Ambos bloques conservan deuda de validación real visible en #69/#70.

## Android

Android Keystore, biometría y detección fiable de bloqueo físico pertenecen a V3.

## Revisión

Cualquier cambio que afecte claves, cifrado, recuperación, almacenamiento de secretos, autenticación de recuperación o formato cifrado debe revisarse de forma aislada antes de integrarse.
