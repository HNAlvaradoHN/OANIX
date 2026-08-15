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

La misma capa criptográfica admite bytes y JSON para que imágenes y otros tipos binarios sigan la misma política.

### Notas y editor enriquecido

Las notas se almacenan como registros cifrados de tipo `note`. El contenido usa un modelo estructurado `blocks-v1`; no se persiste el `innerHTML` de `contentEditable`.

El editor solo transforma a datos persistentes los elementos que OANIX reconoce actualmente: párrafos, encabezados, listas, citas, separadores, bloques de código, referencias de imagen y segmentos de texto con negrita, cursiva o enlaces permitidos. Cualquier estructura del DOM fuera de ese modelo se aplana a texto o se descarta como formato.

Los enlaces se normalizan y solo se conservan con protocolos `http`, `https`, `mailto` o `tel`. El pegado de texto introduce texto plano, evitando que estilos, scripts o marcado externo entren directamente al modelo persistido.

Los bloques de código almacenan únicamente texto y un identificador de lenguaje permitido. El selector de lenguaje es metadato de presentación: OANIX no evalúa, interpreta ni ejecuta el contenido del bloque. La acción de copiar solo entrega ese texto al portapapeles del dispositivo.

El autoguardado cifra el modelo completo antes de cada escritura. Las mutaciones de una misma nota se serializan para impedir que dos actualizaciones concurrentes, por ejemplo título y contenido, se sobrescriban entre sí.

### Imágenes cifradas

Las imágenes no se incrustan como base64 ni como bytes en el registro JSON de la nota. La nota cifrada conserva únicamente un bloque `image` con una referencia aleatoria y metadatos necesarios para la interfaz, mientras los bytes se almacenan en un registro cifrado independiente de tipo `image`.

Los bytes de cada imagen pasan por `encryptVaultBytes` con la misma clave activa de la bóveda, un IV AES-GCM aleatorio nuevo y AAD ligado al tipo `image` y al identificador aleatorio de la imagen. En IndexedDB no se persiste una copia descifrada de esos bytes.

En esta etapa se admiten JPEG, PNG, WebP y GIF, con un límite de 50 MiB por imagen original en V1. SVG se rechaza para evitar introducir contenido activo basado en marcado dentro del flujo de imágenes. El tipo declarado se usa únicamente para presentar el `Blob` descifrado al navegador; OANIX nunca ejecuta la imagen como código.

Para no renderizar originales pesados dentro de la nota, OANIX intenta generar una vista previa de hasta aproximadamente 1600 px durante la inserción. Esa vista previa se cifra en un registro separado de tipo `image-preview`; nunca se guarda una miniatura en texto plano. Las imágenes antiguas sin preview pueden generar una de forma perezosa al volver a mostrarse. Al abrir la imagen en grande se descifra el original, no la preview. Las URL `blob:` temporales de ambas representaciones se revocan al desmontar el editor o quitar la imagen.

La interfaz admite selección de archivos/galería, varias imágenes, pegado desde el portapapeles cuando el navegador entrega un archivo de imagen, descripción opcional y vista ampliada. La descripción y el nombre forman parte del registro cifrado de la nota.

Al quitar una imagen, OANIX conserva temporalmente sus registros cifrados mientras la acción todavía puede deshacerse en la sesión actual. Al abandonar la nota o bloquear la bóveda, después de guardar la nota sin la referencia, intenta eliminar tanto el original como su preview cifrada. Si esa limpieza falla, puede quedar un blob cifrado huérfano ocupando espacio, pero no se destruye una imagen que todavía esté referenciada por una nota persistida.

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
