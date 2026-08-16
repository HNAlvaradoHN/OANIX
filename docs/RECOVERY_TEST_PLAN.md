# Recuperación por correo — plan de validación

1. Entrar una vez correctamente en la bóveda sincronizada con la contraseña maestra actual para preparar la recuperación.
2. Bloquear OANIX y abrir de nuevo `Bóveda sincronizada`.
3. Pulsar `Recuperar por correo`.
4. Confirmar que llega un código numérico al correo de la misma cuenta y que no se crea una cuenta distinta.
5. Introducir un código incorrecto y confirmar que no se libera la bóveda.
6. Solicitar/usar el código correcto, crear y confirmar una nueva contraseña maestra.
7. Confirmar que OANIX restaura la misma bóveda, notas e imágenes.
8. Bloquear OANIX y confirmar que la contraseña anterior ya no abre la bóveda sincronizada.
9. Confirmar que la nueva contraseña sí abre la bóveda sincronizada en otro dispositivo.
10. Confirmar que un segundo intento de reutilizar el OTP anterior falla.
11. Confirmar que la recuperación puede repetirse en el futuro con un OTP nuevo y una nueva contraseña.
12. Probar un dispositivo que estuvo offline durante la rotación y verificar que no pueda sobrescribir el bootstrap de seguridad más nuevo al reconectarse.
