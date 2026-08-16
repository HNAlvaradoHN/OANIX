# OANIX — Recuperación de bóveda por correo

## Decisión de producto

OANIX mantiene una sola contraseña maestra permanente para la bóveda sincronizada. Si el usuario la olvida, puede recuperar acceso mediante un código temporal enviado al correo de la cuenta online y debe crear inmediatamente una nueva contraseña maestra.

No existe una segunda clave de recuperación permanente que el usuario tenga que recordar o guardar.

## Modelo de confianza

Esta modalidad prioriza usabilidad y modifica el modelo de confianza original: el proveedor de autenticación/backend participa en la recuperación. El contenido normal continúa cifrado localmente y sincronizado cifrado, pero OANIX no debe describir la recuperación por correo como zero-knowledge frente al proveedor.

El backend no guarda la contraseña maestra ni la clave de bóveda en texto plano. Guarda una envoltura de recuperación cifrada por usuario y solo libera temporalmente la misma clave de bóveda después de una autenticación OTP de correo reciente.

## Flujo

1. El usuario entra normalmente en una bóveda sincronizada con su contraseña maestra.
2. OANIX prepara/actualiza automáticamente la envoltura de recuperación para esa misma clave de bóveda.
3. Si más adelante olvida la contraseña, pulsa `Recuperar por correo`.
4. OANIX comprueba que la bóveda tenga recuperación preparada y solicita un OTP al correo de la cuenta existente; no crea usuarios nuevos.
5. El usuario introduce el código y escribe dos veces una nueva contraseña maestra.
6. Una sesión OTP reciente puede solicitar al broker la clave de bóveda protegida para recuperación.
7. El cliente reenvuelve esa misma clave con la nueva contraseña y actualiza el bootstrap sincronizado mediante versión esperada.
8. La envoltura de recuperación se rota a una generación nueva.
9. OANIX restaura la bóveda sincronizada con la nueva contraseña y comprueba el almacenamiento local.

## Controles de seguridad

- El broker exige JWT válido.
- `recover` exige que el método de autenticación más reciente sea `otp` y tenga como máximo 10 minutos.
- `register` no puede sustituir una recuperación ya preparada por una clave de bóveda distinta.
- La actualización del bootstrap usa la versión remota esperada para evitar pisar una rotación concurrente.
- Tras recuperar, la nueva contraseña es obligatoria y la generación de seguridad aumenta.
- El modo exclusivamente local no ofrece recuperación por correo.
- Un dispositivo totalmente offline puede conservar temporalmente una protección antigua; no se promete revocación mágica de copias offline.

## Dependencia de correo

Supabase Email OTP solo muestra un código numérico si la plantilla de correo correspondiente incluye `{{ .Token }}`. La prueba real de recuperación debe confirmar que el proyecto envía el código y no únicamente un Magic Link.
