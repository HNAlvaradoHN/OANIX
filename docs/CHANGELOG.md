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
- Sistema inicial de notas cifradas con creación, listado, apertura, cambio de título y eliminación permanente confirmada con limpieza de imágenes asociadas.
- Navegación principal inspirada en una lista de conversaciones, adaptada a notas y responsive en móvil, tablet y PC.
- Editor de texto enriquecido sobre `blocks-v1` con párrafos, encabezados, negrita, cursiva, listas, citas, enlaces validados y separadores.
- Bloques de código inertes con selector de lenguaje, indentación, copia, conversión a texto y eliminación confirmada.
- Imágenes cifradas separadas del registro de la nota, con redimensionado, alineación, bloqueo, vista ampliada y zoom.
- Previews cifradas ligeras para imágenes pesadas, conservando el original cifrado para la vista ampliada.
- Flujo de texto alrededor de imágenes compactas alineadas a izquierda o derecha en pantallas amplias.
- Historial bidireccional de Deshacer/Rehacer para cambios del contenido de la nota, con botones ↶/↷ y atajos Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z y Ctrl+Y.
- Imágenes y bloques de código protegidos contra borrado accidental por selección global, Delete/Backspace, cortar, pegar o reemplazar texto; solo sus acciones explícitas pueden eliminarlos.
- Selección visual neutral para bloques protegidos y posicionamiento del cursor en espacios vacíos entre, al lado o después de imagen/código.
- Protección del cursor frente a arrastres de selección: un gesto de selección ya no puede activar el reposicionamiento de clic en espacio vacío.
- Autoguardado cifrado del contenido y serialización de mutaciones de una misma nota para evitar sobrescrituras entre título y contenido.
- Vista previa de texto real de cada nota en la lista principal.

## Versionado

OANIX utilizará versiones claras y progresivas. No se publicará una versión como cerrada hasta completar y validar su alcance definido en `ROADMAP.md`.
