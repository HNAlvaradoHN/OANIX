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
- Navegación principal inspirada en una lista de conversaciones, adaptada a notas y responsive en móvil, tablet y PC.
- Editor de texto enriquecido sobre `blocks-v1` con párrafos, encabezados, negrita, cursiva, listas, citas, enlaces validados y separadores.
- Autoguardado cifrado del contenido y serialización de mutaciones de una misma nota para evitar sobrescrituras entre título y contenido.
- Vista previa de texto real de cada nota en la lista principal.

## Versionado

OANIX utilizará versiones claras y progresivas. No se publicará una versión como cerrada hasta completar y validar su alcance definido en `ROADMAP.md`.
