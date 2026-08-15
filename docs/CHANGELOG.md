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
- Cifrado autenticado de contenido local mediante AES-256-GCM con IV único por escritura y AAD ligado al tipo e identificador del registro.
- Repositorio genérico de registros cifrados para impedir que el contenido privado llegue a IndexedDB en texto plano.
- Comprobación de ida y vuelta de almacenamiento cifrado al desbloquear la bóveda.
- Sistema inicial de notas cifradas con creación, listado, apertura y cambio de título.
- Interfaz principal de notas inspirada en navegación tipo mensajería, adaptada a OANIX con vista de dos paneles en pantallas grandes y navegación lista → nota en móvil.
- Dirección documentada para pestañas de carpetas y fichas de contacto privadas sin adelantar su implementación.

## Versionado

OANIX utilizará versiones claras y progresivas. No se publicará una versión como cerrada hasta completar y validar su alcance definido en `ROADMAP.md`.
