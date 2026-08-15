# OANIX — Security

## Objetivo de seguridad

OANIX debe cifrar el contenido privado en el dispositivo antes de almacenarlo o, en versiones futuras, sincronizarlo.

El diseño debe aspirar a que una copia completa de la base de datos del servidor no permita leer las notas del usuario sin las claves correspondientes.

## Reglas

- No inventar algoritmos criptográficos propios.
- Usar primitivas y librerías criptográficas conocidas y mantenidas.
- No guardar notas privadas en texto plano cuando la bóveda está protegida.
- Imágenes, miniaturas y futuros adjuntos privados deben seguir la misma política de cifrado que las notas.
- La contraseña maestra no debe enviarse al servidor como contenido recuperable.
- La búsqueda privada debe ejecutarse localmente sobre contenido descifrado.
- El código pegado dentro de una nota se trata como contenido, no se ejecuta.
- El editor no persiste HTML arbitrario del navegador; transforma la vista editable a un modelo propio de bloques y marcas permitidas.
- Los enlaces guardados por el editor se limitan a protocolos explícitamente permitidos.
- No introducir IA remota en el núcleo de seguridad de V1.

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

La contraseña maestra no cifra directamente las notas. Su función es derivar una clave de envoltura que protege una clave aleatoria independiente de la bóveda. Esto permite cambiar la contraseña en el futuro sin volver a cifrar todo el contenido.

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

Los parámetros y el salt se almacenan junto con los metadatos de protección para permitir compatibilidad y futuras actualizaciones. Antes del cierre de V1 se medirá el tiempo de desbloqueo en dispositivos reales y cualquier ajuste deberá quedar versionado; no se reducirá silenciosamente la protección de una bóveda ya creada.

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

Los registros privados de V1 se cifran con AES-256-GCM usando la clave de bóveda desbloqueada. Cada escritura genera un IV aleatorio nuevo de 12 bytes y usa una etiqueta de autenticación GCM de 128 bits.

El formato persistido del contenido es versionado:

```text
Esquema:       aes-gcm-v1
IV:            12 bytes aleatorios
Ciphertext:    contenido cifrado + tag GCM
AAD:           [OANIX, content, 1, tipo de registro, id de registro]
```

El tipo y el identificador del registro forman parte de los datos autenticados. Por ello, copiar un ciphertext válido hacia otro tipo o identificador hace fallar la autenticación al intentar descifrarlo.

La capa de repositorio recibe datos en memoria, los cifra antes de escribirlos en IndexedDB y solo devuelve datos después de descifrarlos con la clave activa. La interfaz no accede directamente a IndexedDB ni manipula la clave criptográfica.

Para localizar registros, IndexedDB conserva una clave técnica derivada del tipo e identificador del registro. El contenido privado permanece dentro del payload cifrado. Este metadato local deberá revisarse de nuevo al diseñar la sincronización de V2 para minimizar cualquier información visible al servidor.

La misma capa criptográfica admite bytes y JSON para que imágenes y otros tipos binarios puedan seguir la misma política cuando lleguen a su punto correspondiente del roadmap.

### Notas y editor enriquecido

Las notas se almacenan como registros cifrados de tipo `note`. El contenido usa un modelo estructurado `blocks-v1`; no se persiste el `innerHTML` de `contentEditable`.

El editor solo transforma a datos persistentes los elementos que OANIX reconoce actualmente: párrafos, encabezados, listas, citas, separadores y segmentos de texto con negrita, cursiva o enlaces permitidos. Cualquier estructura del DOM fuera de ese modelo se aplana a texto o se descarta como formato.

Los enlaces se normalizan y solo se conservan con protocolos `http`, `https`, `mailto` o `tel`. El pegado en esta etapa introduce texto plano, evitando que estilos, scripts o marcado externo entren directamente al modelo persistido.

El autoguardado cifra el modelo completo antes de cada escritura. Las mutaciones de una misma nota se serializan para impedir que dos actualizaciones concurrentes, por ejemplo título y contenido, se sobrescriban entre sí.

### Comprobación de almacenamiento cifrado

Después de crear o desbloquear la bóveda, OANIX puede realizar una comprobación de ida y vuelta con un registro técnico aleatorio:

1. genera un valor aleatorio sin contenido del usuario;
2. lo cifra y lo escribe mediante el repositorio cifrado;
3. lo lee y descifra;
4. comprueba que coincide;
5. elimina el registro técnico.

Si la comprobación falla, la interfaz no presenta la bóveda como lista para usar. Esta prueba confirma en el navegador que Web Crypto e IndexedDB funcionan juntos; no sustituye las pruebas criptográficas y de integración que deberán completarse antes de cerrar V1.

### Desbloqueo y sesión

Para desbloquear OANIX se deriva nuevamente la clave de envoltura y se intenta descifrar la clave de la bóveda. Una contraseña incorrecta o metadatos manipulados hacen fallar la autenticación de AES-GCM.

Tras un desbloqueo correcto, la clave de la bóveda se importa como `CryptoKey` no extraíble y se conserva únicamente en memoria. Al recargar o cerrar la aplicación, la sesión se pierde y la bóveda vuelve a quedar bloqueada.

La implementación intenta sobrescribir los `Uint8Array` temporales que contienen material de clave. Esto reduce exposición accidental, aunque JavaScript no permite garantizar el borrado completo de todas las copias internas realizadas por el runtime.

### Recuperación

V1 no incorpora recuperación de contraseña. Si el usuario pierde la contraseña maestra después de almacenar contenido cifrado, OANIX no tendrá una clave alternativa con la que abrir esa bóveda. La recuperación pertenece a V2 y deberá diseñarse sin introducir una puerta trasera que permita al servidor leer el contenido.

## Referencias técnicas

- RFC 9106 — Argon2 Memory-Hard Function.
- OWASP Password Storage Cheat Sheet.
- NIST SP 800-63B — Passwords y normalización Unicode NFC.
- NIST SP 800-38D — AES-GCM.
- W3C Web Cryptography API — AES-GCM y manejo de `CryptoKey`.

## V2

La sincronización deberá transportar únicamente contenido cifrado y metadatos mínimos necesarios. La arquitectura exacta del backend y el protocolo de sincronización se definirán en V2.

## Android

Android Keystore y biometría pertenecen a V3. La V1 solo debe evitar decisiones que impidan integrarlos posteriormente.

## Revisión

Cualquier cambio que afecte claves, cifrado, recuperación, almacenamiento de secretos o formato de datos cifrados debe revisarse de forma aislada antes de integrarse.
