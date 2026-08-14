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
- [ ] Cifrado local
- [ ] Notas
- [ ] Editor de texto enriquecido
- [ ] Bloques de código
- [ ] Imágenes
- [ ] Checklists
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
- [ ] IA opcional con modelo de privacidad definido

## Estado actual

**Versión activa: V1 — Núcleo local**

No se implementan funciones de V2, V3 o V4 mientras V1 no esté cerrada, salvo preparación arquitectónica explícitamente documentada.
