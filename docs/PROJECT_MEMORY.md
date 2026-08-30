# OANIX — Memoria operativa del proyecto

Este documento conserva **decisiones duraderas y restricciones de producto/arquitectura** que no deben depender de un chat. No es un changelog ni un duplicado de `CURRENT_STATE.md`.

Antes de trabajar: leer `AGENTS.md` y `docs/CURRENT_STATE.md`, verificar `main` y PR recientes. GitHub es la fuente de verdad del código actual.

**Última actualización:** 2026-08-29

## 1. Principios permanentes

- OANIX es offline-first. La nube es opcional.
- PWA y Android/Capacitor comparten una sola base de aplicación; no crear lógica paralela por plataforma salvo integración nativa necesaria.
- Reutilizar módulos/stores existentes antes de crear persistencias paralelas.
- Conservar datos tiene prioridad ante incertidumbre; no sobrescribir silenciosamente.
- En conflictos multidispositivo: detectar → conservar ambos lados → mostrar → usuario decide. Si se combinan notas compatibles, va primero el cambio aceptado primero por la sincronización remota y después el otro; #69 validó este flujo. Etiqueta histórica de validación: `VALIDATION_DEBT`; verificar el issue antes de asumir que sigue pendiente.
- Si el `remoteKey` conocido de un registro quedó eliminado o desapareció y existe una única fila remota activa que descifra al mismo `localKey`, OANIX presenta la situación como eliminación/estado local frente a esa versión remota activa y permite elegir. No debe bloquearla como dos identidades incompatibles ni decidir silenciosamente cuál conservar.
- Cambios pequeños y aislados. No refactorizar ampliamente para arreglar un problema local.
- Una función importante usa rama + PR. OANIX CI y OANIX Android deben pasar antes de fusionar.
- Seguridad, cifrado, bóveda, notas y sync no se modifican por comodidad.
- No guardar secretos, tokens Google, refresh tokens ni credenciales en código, repositorio, notas, localStorage, IndexedDB o bóveda.

## 2. Producto y monetización

OANIX comenzó como bloc de notas privado y evoluciona para permitir guardar dentro de las notas imágenes y archivos generales, incluidos PDF, Office, ZIP, APK, audio y video.

Decisión vigente: **no dividir por ahora OANIX en Free/Pro ni bloquear funciones artificialmente**. Primero terminar una OANIX realmente buena y útil. La arquitectura puede permitir monetización futura, pero no debe diseñarse alrededor de candados Premium ni impedir probar el producto.

La apariencia global expone únicamente **Día** y **Noche**. Los ambientes/presets visuales antiguos no forman parte del producto activo; una preferencia antigua debe migrar al modo base claro u oscuro equivalente sin afectar datos de la bóveda.

## 3. Experiencia de imágenes aprobada

PR #169 desactivó `NotebookCanvasRuntime`, `NotebookFreeRowsRuntime` y `NotebookSimpleImageRuntime`. No reactivarlos sin autorización explícita.

PR #170–#172 fijaron la experiencia PWA/APK:
- tarjeta fija, compacta, miniatura izquierda y controles derecha;
- sin mover/alinear/redimensionar manualmente y sin candado;
- nombre del archivo oculto;
- Abrir, Quitar y tamaño cuando corresponda;
- descripción en franja inferior; texto largo termina en elipsis + `+`;
- descripción completa y visor cerrables con X, toque fuera y Atrás;
- tocar miniatura abre original; zoom táctil aproximado 4x con desplazamiento.

No cambiar el formato persistido de imágenes ni modificar ampliamente `ImageNoteEditor.tsx` salvo necesidad demostrada.

## 4. Workspace, carpetas y representación de notas

La dirección antigua de **home de carpetas independiente/full-screen con rail lateral** queda SUPERSEDED. Desde PR #250, carpetas, etiquetas y lista de notas forman un único workspace orgánico compartido por PWA y Android. La referencia `Organic Responsive 3D Folders v38.3` refina esa base; es una referencia visual/interactiva, no una segunda aplicación.

Reglas duraderas:
- cabecera compacta con identidad real de OANIX; cualquier maqueta que use otro logo se adapta al logo real seleccionado;
- etiquetas reales como chips horizontales debajo de la cabecera;
- notas reales en tarjetas infográficas translúcidas;
- carpetas reales en dock horizontal inferior tanto en la dirección visual PWA como en la base compartida que empaqueta Capacitor;
- portada real de la carpeta activa puede ocupar el fondo del workspace, pero siempre con capas de contraste que mantengan legibles cabecera, chips, notas y dock;
- no copiar datos demo, imágenes externas, Tailwind CDN, Phosphor CDN ni funciones simuladas del prototipo;
- `+`, abrir, renombrar, eliminar, portada, color/icono, búsqueda, Atrás y reordenamiento reutilizan handlers/servicios existentes; un rediseño no justifica CRUD paralelo.

### Tema de workspace intercambiable — IMPLEMENTED

Decisión del usuario (2026-08-29): el diseño del workspace debe poder reemplazarse completo sin volver a conectar o reescribir la lógica de producto. El límite arquitectónico es un contrato de props/callbacks estable entre OANIX y la capa visual.

- `WorkspaceThemeProps` define datos y acciones reales que recibe cualquier tema.
- El tema infográfico suministrado por el usuario es la autoridad visual activa; su HTML/CSS/movimiento se adapta a React sin copiar `datos.js`, almacenamiento demo, CDN ni CRUD paralelo.
- El header conserva **los botones reales actuales de OANIX y sus funciones**: Buscar, Bloquear, Historial, Cuenta y menú `⋮`. Un tema futuro solo debe reservar el host visual para esos controles.
- En el tema infográfico, la cabecera visual pertenece al diseño nuevo: del header anterior solo se conservan el logo, el nombre **OANIX** y esos botones reales. No mostrar el nombre de la carpeta activa como subtítulo ni reintroducir la barra opaca anterior.
- El botón `+` de nueva nota crea y abre la nota directamente. El flujo `Agregar nota / Marcar notas` y la selección múltiple asociada quedan **SUPERSEDED**; eliminar y privacidad se resuelven desde cada nota individual.
- Etiquetas, carpetas, notas, contadores, colores persistidos y acciones provienen de registros/handlers reales.
- El selector de color de nota sigue persistiendo `visualColor` en el mismo `NoteRecord`; no crear un store visual paralelo.
- Día/Noche del workspace pertenece al tema infográfico y no usa `classic-day` / `classic-night` como autoridad de esa superficie. El sistema compartido anterior no se elimina a ciegas porque otras superficies aún pueden depender de él.
- El drag del workspace pertenece al tema activo: long-press, ghost, jiggle, autoscroll y movimiento visual pueden cambiar con el tema, pero al soltar deben delegar a los callbacks reales de persistencia. No crear persistencia de orden paralela.
- Privacidad, cifrado, sincronización, historial y almacenamiento quedan fuera del tema y nunca se reemplazan al cambiar de diseño.
- Punto de retorno previo al cambio: rama `checkpoint/pre-theme-shell-refactor` sobre `71774220f0a74bd816e284d91cc493691e8504f0`.

La antigua afirmación de que el workspace debía reutilizar obligatoriamente la presentación v38/v39 y el toggle visual `classic-day/classic-night` queda **SUPERSEDED** por esta decisión. La persistencia y las fronteras de seguridad anteriores siguen vigentes.

### Notas en la lista

- Cada tarjeta usa **icono central, no foto**, como identidad visual del elemento en la lista.
- El menú `⋮` de una nota contiene una sola entrada `Personalizar` para título, descripción breve, categoría principal, icono central y color visual.
- La categoría se elige entre etiquetas reales. Marcar una categoría principal no debe borrar otras etiquetas ya asignadas.
- La personalización de lista vive como campos opcionales dentro del mismo `NoteRecord` cifrado; no crear un `note-appearance` paralelo ni cambiar `blocks-v1` por motivos visuales.
- La personalización visual no sustituye el contenido real ni la edición normal de la nota.
- En el drag de notas, V383 conserva apariencia; `pointer-events` y `touch-action` pertenecen al contrato funcional de reorder. La restricción histórica de no crear un motor pointer paralelo quedó **SUPERSEDED** por PR #368 tras una causa nueva demostrada: en móvil, `pan-y` + la ruta `TouchEvent` permitían que el navegador/WebView conservara el gesto vertical. Estado vigente: SortableJS para ratón/escritorio y un único motor Pointer Events para coarse/mobile, con scroll vertical manual previo al long press, pointer capture best-effort y `persistNoteOrder` como autoridad. No reintroducir una ruta táctil paralela ni `TouchEvent` sin evidencia nueva.

### Carpetas

- Cada tarjeta de carpeta muestra un engranaje arriba a la derecha; no volver a una fila de botones sueltos debajo de cada carpeta.
- El engranaje concentra: Abrir, Fijar/Desfijar, Favorito, Renombrar, Cambiar color/Icono, Cambiar imagen local y Eliminar.
- Imagen personalizada de carpeta sigue cifrada y almacenada separadamente del registro de carpeta.
- Color, icono, fijado y favorito viven en `folder-appearance`, conservando compatibilidad con registros anteriores y sin borrar una preferencia al modificar otra.
- Fijado/favorito son estados visuales/organizativos y **no deben reescribir silenciosamente `folder-order`**. El orden manual sigue siendo autoridad hasta que se decida otra semántica explícita.
- El control inferior izquierdo mantiene `+` y usa el segundo botón como alternancia directa Día/Noche mediante `classic-day` / `classic-night`.
- Reordenamiento manual por pulsación larga reutiliza la persistencia cifrada existente: `folder-order`, `manualOrder` y `tag-order`. Mantener → jiggle → arrastrar sin soltar → soltar → persistir → volver a normalidad.
- No mostrar botones persistentes `↕`, `Listo` o `✓` para entrar/salir del reordenamiento.
- Atrás debe conservar navegación real correcta; no crear un historial visual paralelo.

### Islas atómicas del editor — IMPLEMENTED

Decisión del usuario (2026-08-29): imagen, fecha Daily Entry, título opcional y otros bloques especiales deben comportarse como la consola frente a selección y borrado.

- Un bloque especial exterior usa `contenteditable=false` y `data-editor-atomic-block`.
- Una zona que sí admite edición dentro de ese bloque usa un host local `contenteditable=true` con `data-editor-local-editable=true`.
- `Ctrl/Cmd+A` dentro de un host local selecciona solo ese host; desde la hoja se deja que el navegador trate los bloques atómicos como islas.
- Si una selección de la hoja cruza imágenes u otros bloques atómicos y se borra, OANIX intercepta `beforeinput delete*` y elimina únicamente los tramos de texto normal seleccionados. No desmontar el bloque atómico para después reconstruirlo.
- Daily Entry conserva fecha y título como espacios visuales separados; el título ya no depende de un `input` dentro del host principal, sino de un editor local independiente.
- La descripción opcional de imagen usa el mismo patrón local dentro de la tarjeta atómica.
- Como defensa secundaria, si una imagen debe reconstruirse por reconciliación/historial, la preview cacheada debe reaplicarse al nuevo nodo; no dejar la tarjeta en “Descifrando imagen…” hasta reabrir la nota.
- No convertir estos bloques en capas flotantes: la separación es semántica/DOM, no posicionamiento absoluto, para evitar coste y desalineación innecesarios.

## 5. Archivos grandes

Objetivo inicial de producto: **5 GB por archivo**, sin diseñar el motor con un techo arquitectónico de 5 GB. El límite de seguridad del protocolo puede ser mayor (~20 GiB actualmente).

Reglas:
- procesamiento secuencial por fragmentos, alrededor de 8 MiB;
- AES-GCM por fragmento, IV independiente y autenticación;
- SHA-256/manifiestos para integridad y reconstrucción;
- nunca materializar archivos gigantes completos en RAM;
- limpiar buffers temporales;
- checkpoint persistente y subida reanudable;
- reanudar desde progreso remoto confirmado, incluso después de caída de red/app;
- descargas por rangos;
- caché local limitada y bajo demanda;
- `Liberar del dispositivo` debe ser distinto de `Eliminar de OANIX`.

La UI de transferencia distingue Preparando → Cifrando → Subiendo → Verificando → Guardado ✓. Llegar a 100% transferido no significa Guardado hasta terminar la verificación.

## 6. Proveedores de almacenamiento

Principio arquitectónico: **OANIX nunca depende de un único proveedor**.

El motor usa la abstracción `OanixStorageProvider`. Google Drive es el primer proveedor demostrado, no una dependencia conceptual del motor. Proveedores futuros posibles: almacenamiento local, OneDrive, S3 compatible, WebDAV/NAS o nube propia; no implementarlos hasta necesitarlos.

### Google Drive

- Opcional; OANIX funciona sin Drive.
- Usa el almacenamiento de la cuenta Google del usuario.
- Scope exclusivo `drive.appdata` y `appDataFolder`; no pedir acceso general al Drive.
- Los bytes se cifran antes de salir del dispositivo.
- Token temporal exclusivamente en memoria.
- PWA usa Google Identity Services con `VITE_GOOGLE_DRIVE_WEB_CLIENT_ID`.
- Android usa `AuthorizationClient` mediante integración Capacitor independiente.
- El login OANIX y la autorización Drive son dominios separados.
- Antes de una transferencia grande comprobar destino/cuota y, cuando corresponda, conectividad.
- Las URLs de sesión reanudable deben validarse/restringirse para evitar fuga de credenciales.

## 7. Seguridad existente que no debe degradarse

- Contraseña maestra y clave de bóveda son conceptos separados.
- La clave activa web permanece como `CryptoKey` no extraíble.
- El contenido local privado se cifra antes de persistirse.
- El transporte normal de sync conserva E2EE; la recuperación Email OTP es una excepción de confianza explícita documentada en `SECURITY.md`.
- Android Keystore/biometría no sustituyen la contraseña maestra ni convierten la clave activa web en exportable.
- No describir OANIX completo como zero-knowledge frente al proveedor mientras exista el broker de recuperación por correo.

## 8. Evidencia validada de archivos grandes

En PWA se validó con un video real de ~120 MiB:
- subida cifrada completa a Google Drive;
- descarga posterior por rangos;
- hashes, descifrado y comparación íntegra del archivo;
- interrupción de Wi-Fi alrededor del 30%;
- cierre completo de PWA;
- reapertura y nueva autorización Drive;
- selección del mismo archivo y reanudación desde el progreso remoto confirmado, sin reiniciar desde cero.

PR #219 amplió la prueba controlada a 100 MiB–1 GiB. La siguiente validación es cercana a 1 GiB; no saltar todavía directamente a 5 GB.

## 9. Checkpoints históricos que vale conservar

- `1ad13a27c1a2e429be1beb839aa3992586361103`: base funcional estable histórica importante.
- `d6d847e7a053f05808518b4e18f871855eb0e9a7`: inmediatamente anterior a llevar la experiencia aprobada de imágenes a Android.

El resto del historial de implementación pertenece a `CHANGELOG.md`, PRs e issues. No acumular aquí detalles triviales, números de CI o estados transitorios.
