# OANIX — Changelog

Todos los cambios relevantes del proyecto se registran aquí por versión.

## Unreleased
- La navegación horizontal de Carpetas usa controles « » reservados fuera del carril, compatibles con mouse y tacto, sin cubrir nombres de carpetas.
- Corregida incompatibilidad de guardado: las imágenes reducidas en móvil ya son válidas para el modelo persistido y no invalidan la nota al releerla.
- Shell fluido inspirado en la estrategia responsive de OAVIX: tamaños gobernados por contenedores, `clamp`, `minmax`, wrap y un único conjunto de componentes.
- Navegación y cambio estructural a una sola columna alineados en el mismo límite de 760 px para evitar estados inconsistentes entre CSS e historial.
- Nueva cabecera de nota con menú `⋮`, información y eliminación; creación de nota mediante botón flotante.
- Dock persistente `↶ ↷ Aa ＋`: formato e inserción separados en paneles adaptativos.
- Bloques de código simplificados a lenguaje + pantalla completa + menú `⋮` para copiar/convertir/eliminar.

- Refuerzo de guardado local móvil con reintento de IndexedDB, error visible/reintentable, navegación Atrás integrada al historial, cierre automático de herramientas y breakpoints explícitos móvil/tablet/PC.
- Refinamiento móvil de imágenes y código: imágenes sin flujo lateral, escalado proporcional por ambos ejes, panel de acciones legible, código contenido y editor de código a pantalla completa.

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
- Menú contextual `⋮` por nota en la lista, con eliminación permanente movida fuera de la cabecera de edición.
- Zona final de escritura reforzada después de imágenes para poder colocar el cursor debajo de la última imagen de forma fiable.
- Menú `⋮` con dirección adaptativa según el espacio disponible y zona terminal independiente debajo de imágenes flotantes, sin perder el flujo de texto lateral.
- Pulido móvil del editor preparado: imágenes con rango de tamaño más pequeño, herramientas flotantes, Deshacer/Rehacer persistentes y controles largos reorganizados para evitar recortes.

## Versionado

OANIX utilizará versiones claras y progresivas. No se publicará una versión como cerrada hasta completar y validar su alcance definido en `ROADMAP.md`.

- Pulido responsive transversal: dock sobre teclado virtual, menús de código sin recortes, cierre explícito de opciones de imagen y eliminación de acciones duplicadas.

- Arrastre horizontal de imágenes desbloqueadas con ajuste responsive a izquierda, centro o derecha; alineación estable también en contenedores tipo tablet.
- Cierre `×` de opciones de imagen sin marco visual, conservando accesibilidad táctil.

- Checklists V1 como bloque nativo cifrado: tareas marcables, edición directa, Enter para añadir tarea, Backspace sobre una tarea vacía para retirarla y diseño responsive por contenedor.

- Corregida la alineación derecha de imágenes compactas cuando una tablet pasa a un contenedor vertical estrecho; al desactivar `float` se restauran márgenes de Izq./Centro/Der. de forma determinista.

- Fichas de contacto privadas V1 como bloque cifrado nativo con nombre, teléfono, correo, organización y notas; inserción desde `＋`, edición directa y layout fluido por contenedor.

- Entradas por día dentro de una misma nota: separador visual con fecha local automática, título opcional por entrada, preparación compatible con notas antiguas y nueva sección cuando cambia el día local del dispositivo.

- Carpetas cifradas V1: creación, renombrado, eliminación sin borrar notas, pestañas de filtro, creación contextual de notas y movimiento entre carpetas desde `⋮`.

- Portada de acceso renovada con composición visual animada, glass UI y movimiento respetuoso de `prefers-reduced-motion`.
- Las actualizaciones PWA dejan de recargar automáticamente la pantalla de contraseña; una versión nueva espera un reinicio seguro de la aplicación.
- Carpetas con orden manual cifrado, indicación de desplazamiento horizontal y cierre automático de la nota abierta al cambiar de carpeta.
