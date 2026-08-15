# OANIX — Roadmap

Este documento define el orden oficial de desarrollo de OANIX.

## Regla principal

OANIX se desarrolla estrictamente por versiones. Una función perteneciente a una versión futura se puede registrar, pero no se implementa antes de tiempo salvo que sea necesaria únicamente como preparación técnica de arquitectura.

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

### Pendiente inmediato antes de Checklists — Pulido móvil del editor

- [x] Permitir reducir más las imágenes en móvil manteniendo siempre su proporción, especialmente imágenes verticales tipo recibo.
- [x] Mantener controles de imagen utilizables y legibles cuando la imagen sea pequeña, sin invadir el contenido.
- [x] Sustituir en móvil la barra horizontal de formato por un botón flotante de herramientas que permanezca accesible durante el scroll y permita añadir más acciones en el futuro.
- [x] Mantener Deshacer y Rehacer como controles flotantes de acceso rápido en móvil.
- [x] Revisar el comportamiento con teclado virtual, scroll, selección de texto, imágenes y bloques especiales.
- [x] En móvil, tratar imágenes como bloques completos sin texto lateral y permitir escalarlas desde cualquier esquina sin salir del margen útil.
- [x] Mantener los bloques de código contenidos dentro de la nota y ofrecer una vista/editor de código a pantalla completa para líneas largas.
- [x] Auditar botones, menús, tarjetas y controles responsive para evitar textos cortados, desbordados o ilegibles; incluye acciones largas como `Convertir a texto` y `Eliminar bloque`.
- [x] Validar visualmente en móvil y pasar CI antes de continuar.
- [x] Confirmar guardado cifrado real en móvil, navegación Atrás/gesto y auditoría responsive en móvil, tablet y PC.

- [x] Checklists
- [x] Fichas de contacto privadas
- [x] Entradas por día dentro de una nota (fecha automática + título opcional)
- [ ] Carpetas
- [ ] Etiquetas
- [ ] Búsqueda local
- [ ] Backup/exportación cifrada
- [ ] Funcionamiento offline
- [ ] Pruebas de la V1

## V2 — Cuenta y sincronización

Objetivo: sincronización cifrada entre dispositivos sin que el servidor pueda leer el contenido.

- [ ] Cuenta de usuario
- [ ] Autenticación
- [ ] Backend de sincronización
- [ ] Sincronización E2EE
- [ ] Varios dispositivos
- [ ] Resolución de conflictos
- [ ] Historial de versiones
- [ ] Recuperación de acceso

## V3 — Android con Capacitor

Objetivo: empaquetar la misma base de código como aplicación Android.

- [ ] Capacitor
- [ ] APK / AAB
- [ ] Android Keystore
- [ ] Biometría
- [ ] Cámara nativa
- [ ] Integración nativa de archivos
- [ ] Compartir hacia OANIX

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

## Estado actual

**Versión activa: V1 — Núcleo local**

**Siguiente bloque de trabajo:** Carpetas.

No se implementan funciones de V2, V3 o V4 mientras V1 no esté cerrada, salvo preparación arquitectónica explícitamente documentada.
