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
- No introducir IA remota en el núcleo de seguridad de V1.

## V1

En V1 la seguridad se concentra en el dispositivo:

```text
Contraseña maestra
        ↓
Derivación de clave
        ↓
Claves de la bóveda
        ↓
Cifrado autenticado
        ↓
Almacenamiento local
```

Las decisiones concretas de algoritmos, parámetros, formato de claves y recuperación se documentarán antes de implementar el módulo criptográfico.

## V2

La sincronización deberá transportar únicamente contenido cifrado y metadatos mínimos necesarios. La arquitectura exacta del backend y el protocolo de sincronización se definirán en V2.

## Android

Android Keystore y biometría pertenecen a V3. La V1 solo debe evitar decisiones que impidan integrarlos posteriormente.

## Revisión

Cualquier cambio que afecte claves, cifrado, recuperación, almacenamiento de secretos o formato de datos cifrados debe revisarse de forma aislada antes de integrarse.
