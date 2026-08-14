# OANIX — Changelog

Todos los cambios relevantes del proyecto se registran aquí por versión.

## Unreleased

### Added

- Creación del repositorio independiente OANIX.
- Roadmap oficial por versiones.
- Principios de arquitectura modular.
- Principios iniciales de seguridad.
- Base React + TypeScript + Vite con soporte PWA.
- Validación automática mediante GitHub Actions.
- Publicación de la PWA mediante GitHub Pages.
- Bóveda local inicial basada en IndexedDB para metadatos técnicos no sensibles.
- Repositorio y servicio de bóveda separados de la interfaz.
- Contraseña maestra local con derivación Argon2id y normalización Unicode NFC.
- Clave aleatoria de bóveda protegida mediante AES-256-GCM y mantenida en memoria como `CryptoKey` no extraíble.
- Flujo de creación, desbloqueo y bloqueo de la bóveda desde la interfaz.

## Versionado

OANIX utilizará versiones claras y progresivas. No se publicará una versión como cerrada hasta completar y validar su alcance definido en `ROADMAP.md`.
