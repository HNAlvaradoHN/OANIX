# V2 — Recuperación de acceso por correo

Estado de esta rama: implementación funcional en validación.

- Broker de recuperación desplegado en Supabase.
- Envoltura de recuperación cifrada por usuario; sin grants de cliente.
- Recuperación exige OTP reciente por correo.
- `Recuperar por correo` añadido a la pantalla de bóveda sincronizada.
- Tras OTP correcto, OANIX obliga a crear y confirmar una nueva contraseña maestra.
- La misma clave de bóveda se reenvuelve; no se crea una segunda bóveda ni se recifran todas las notas.
- La recuperación se prepara automáticamente después de una entrada correcta en la bóveda sincronizada.
- La generación de seguridad aumenta tras una recuperación.
- Pendiente de validación real: confirmar que la plantilla de Email OTP de Supabase muestra `{{ .Token }}` como código numérico y ejecutar un ciclo completo de recuperación en dispositivo real.
