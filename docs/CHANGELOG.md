# OANIX — Changelog

Todos los cambios relevantes del proyecto se registran aquí por versión.

## Unreleased
- Pulido del tema infográfico: la cabecera y las filas de notas dejan de heredar superficies del tema clásico, se elimina el fondo exterior de la nota seleccionada y el botón `+` de nueva nota vuelve a ser una acción directa. Se retira del workspace activo el flujo de `Marcar notas`/acciones múltiples; la privacidad individual y su refresco siguen intactos.
- Workspace intercambiable: introduce un contrato estable entre lógica real y tema visual y activa el diseño infográfico suministrado por el usuario como capa aislada. Conserva los botones reales del header (buscar, bloquear, historial, cuenta y menú), conecta datos/acciones reales de notas, carpetas y etiquetas, usa Día/Noche local del tema, timeline central alternada y un drag aislado con long-press/ghost/jiggle/autoscroll que persiste mediante los servicios existentes. Se preserva el checkpoint `checkpoint/pre-theme-shell-refactor` para rollback.
- Reorder y toque tras scroll: el orden de notas se refleja en React al soltar antes de persistir, el primer toque nuevo cancela la supresión residual del scroll, las escrituras de orden ceden entre notas, omiten notificaciones intermedias y abandonan trabajo supersedido. El drag de etiquetas queda limitado antes del control `+` para que ni el clon ni el auto-scroll atraviesen el extremo útil.
- Reorder de notas móvil — PR #368: separa explícitamente los motores por entrada. Ratón/escritorio mantiene SortableJS; coarse/mobile usa un único flujo Pointer Events con captura best-effort, scroll vertical manual previo al long press y persistencia existente. Se elimina la ruta paralela `TouchEvent`/`pan-y` que podía dejar el gesto vertical bajo control del navegador/WebView y se conserva `.note-row` en el overlay visible para que sus estilos coincidan correctamente.
- Post-V3 Rediseño visual — primer pase `Midnight Violet`: nueva capa de tema semántico negro/morado con cian técnico, bordes definidos y glow suave, tipografía reforzada contra recortes de descendentes, `O` tecnológica con núcleo/orbita sutil y movimiento reducido, workspace/editor convertidos a superficie oscura premium y notas separadas en tarjetas tipo papel digital.
- Post-V3 Miniaturas de notas: el avatar de lista y de nota abierta reutiliza la primera imagen ya cifrada como miniatura mediante `loadEncryptedImagePreview`; si no existe mantiene la inicial. La imagen solo vive como Blob URL temporal en memoria y se revoca al desmontar/cambiar.
- V3 cerrada: firma debug estable verificada con SHA-256 exacta, estado observable en CI y prueba física de continuidad APK `versionCode 1` → `versionCode 2` aceptada sin desinstalar. Issue #79 cerrado; #105 permanece diferido al pulido Android/RC.
- V3 Archivos nativos — PR #87: backup cifrado integrado con el Storage Access Framework de Android. Guardar usa `ACTION_CREATE_DOCUMENT` y escritura por fragmentos UTF-8 a una sesión efímera; restaurar usa `ACTION_OPEN_DOCUMENT` y entrega el documento seleccionado al mismo `restoreEncryptedBackupFromFile` existente, conservando contraseña, autenticación AES-GCM de todos los registros y sustitución transaccional. No añade permisos amplios de almacenamiento ni URI persistente y mantiene el flujo web fuera de Android. Tests, build, auditoría offline y compilación APK/AAB pasaron; validación real en teléfono queda pendiente.
- V3 Cámara nativa — PR #86: OANIX abre la cámara del sistema mediante `ACTION_IMAGE_CAPTURE`, escribe el JPEG original solo de forma temporal en caché privada con `FileProvider`, lo expone al WebView como `content://`/`Capacitor.convertFileSrc` y lo entrega al mismo `insertFiles -> storeEncryptedImage` existente para cifrar original y preview. No guarda automáticamente en galería ni añade permisos `CAMERA`/almacenamiento; limita la captura a 24 MiB, conserva una captura activa frente a recreación de Activity y elimina temporales después de importar/cancelar, con limpieza de abandonados. Tests, build, auditoría offline y compilación APK/AAB pasaron; validación real en teléfono queda pendiente.
- V3 Biometría/credencial segura — PR #84: acceso rápido Android con una clave AES-256-GCM separada en Android Keystore, autenticación obligatoria por cada uso mediante `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` en Android 11+, ciphertext ligado a la bóveda concreta y contraseña maestra como fallback. La clave temporal se importa al runtime como `CryptoKey` no extraíble. Tests, build, auditoría offline y compilación APK/AAB pasaron; validación funcional en teléfono real queda pendiente.
- V3 Android Keystore — PR #83: plugin nativo de sellado con clave AES-256-GCM no exportable dentro de `AndroidKeyStore`, IV aleatorio, AAD de propósito y bridge TypeScript exclusivo de Android. No exporta la clave activa de OANIX ni guarda la contraseña maestra. Compilación Android APK/AAB validada en CI; prueba específica `seal/open` en dispositivo pendiente.
- V3 APK/AAB — PR #82: workflow Android compila APK debug y AAB release de validación. La APK fue instalada en un teléfono Android real y el modo local funciona; el flujo Android online/sincronizado todavía no se declara validado. La firma definitiva de Play Store sigue pendiente.
- V3 Capacitor — PR #81: la misma base React + TypeScript + Vite/PWA se empaqueta como Android con Capacitor 8.4.2, proyecto `android/` versionado y build nativo separado para no registrar el Service Worker de la PWA dentro del WebView.
- V2 Recuperación de acceso por correo: OANIX mantiene una sola contraseña maestra permanente para la bóveda sincronizada. `Recuperar por correo` solicita un Email OTP para la cuenta existente, exige una autenticación OTP reciente, obliga a crear y confirmar una nueva contraseña maestra y reenvuelve la MISMA clave de bóveda sin recifrar todas las notas. La recuperación se prepara automáticamente tras una entrada correcta, usa `securityGeneration`, actualiza el bootstrap con versión esperada y restaura registros/binarios. El broker `vault-recovery-broker` está aislado de clientes directos y guarda únicamente una envoltura cifrada; esta modalidad confía explícitamente en el backend durante recuperación y no se describe como zero-knowledge frente al proveedor. Implementación PR #75, con deuda de validación real/multidispositivo documentada en #73.
- V2 Historial de versiones: las notas conservan snapshots cifrados `note-history` dentro del mismo `encrypted_records`, con hasta 5 puntos por nota y coalescencia automática de 5 minutos. Un nuevo centro responsive `🕘` permite elegir nota, revisar fecha/hora y vista previa en memoria y restaurar con confirmación; antes de abrir espera el guardado visible y antes de restaurar crea un checkpoint `pre-restore` para hacer la operación reversible. El historial viaja mediante el sync E2EE no binario existente, no crea persistencia paralela y bloquea una restauración si faltan originales de imágenes históricas en vez de producir una nota incompleta. Al eliminar permanentemente una nota se elimina también su historial. La retención se redujo de 30 a 5 puntos por decisión del usuario. Deuda de validación real en #70.
- V2 Resolución de conflictos — segunda fase binaria: los conflictos de imágenes originales se integran al centro de revisión con comparación visual descifrada solo en memoria y elección explícita entre la versión sincronizada o local; `Combinar ambas` no aplica a imágenes. Se revalidan fingerprints, versión remota, manifiestos y fragmentos SHA-256 antes de reemplazar; se mantienen fragmentos cifrados de 6 MiB y limpieza reintentable. `image-preview` se trata como dato derivado y regenerable. Deuda de validación real restante en #69.
- V2 Resolución de conflictos — primera fase no binaria: centro de revisión que conserva ambos lados, permite elegir la versión sincronizada o local y combina únicamente notas compatibles colocando primero la versión aceptada remotamente; revalida payload local y versión remota antes de aplicar, conserva bloques estructurados, reutiliza `system.sync-state` cifrado y no crea persistencia paralela.
- V2 Varios dispositivos — imágenes en autosync E2EE: originales y previews cifrados se transfieren mediante un único bucket privado en fragmentos de 6 MiB con rutas aleatorias, manifiesto cifrado en `sync_records`, verificación SHA-256 por fragmento y limpieza cifrada/reintentable de objetos obsoletos sin crear otro store local.
- V2 Varios dispositivos — primera fase: autosync E2EE bidireccional para registros no binarios, activado por cambios locales, reconexión, regreso a la app y comprobación periódica; los cambios remotos se aplican al IndexedDB existente y la interfaz se remonta sin recargar ni perder la clave de bóveda en memoria.
- V2 Varios dispositivos — arranque de dispositivo nuevo: la cuenta guarda en la misma tabla un paquete de bootstrap con la clave de bóveda ya envuelta por la contraseña maestra existente; el dispositivo nuevo inicia sesión, introduce esa misma contraseña, descifra localmente la clave y restaura los sobres E2EE sin enviar la contraseña maestra a Supabase.
- V2 E2EE validada en uso real: el envío cifrado funcionó correctamente y Supabase confirmó filas activas con identificadores opacos aleatorios y ciphertext, sin exponer contenido privado.
- V2 Sincronización E2EE — primera fase endurecida: registros no binarios mediante sobres AES-GCM, `record_key` remoto aleatorio generado criptográficamente, reconocimiento de filas existentes solo después de descifrarlas localmente y omisión de escrituras cuando el payload ya está al día.
- Orden manual de notas refinado: el modo `↕` sustituye las flechas por un asa `⠿` con Pointer Events para sostener, arrastrar y soltar con mouse, lápiz o tacto, conservando `manualOrder` cifrado y el grupo de notas fijadas.
- V2 Backend de sincronización implementado en Supabase: una sola tabla general `public.sync_records` para sobres cifrados, RLS habilitado, acceso exclusivo del propietario autenticado, privilegios mínimos y timestamp controlado por trigger; el backend no interpreta el contenido privado durante la sincronización normal.
- Organización de notas: fijar/desfijar desde `⋮` y orden manual mediante modo `↕`, guardando `pinned` y `manualOrder` dentro del registro cifrado existente sin crear stores ni cachés adicionales.
- Actualizaciones PWA controladas por el usuario: OANIX avisa cuando hay una nueva versión y solo recarga después de pulsar `Actualizar` y esperar un estado de guardado seguro; se reutiliza el Service Worker existente.
- Acceso con Google en ventana auxiliar: la pestaña principal de OANIX permanece activa durante OAuth para no perder innecesariamente la clave de bóveda que vive solo en memoria.
- V2 Autenticación UX: el acceso a Cuenta se mueve del botón flotante a la cabecera principal junto al candado, reduciendo toques accidentales sin cambiar el flujo de seguridad ni el modo local.
- V2 Backend de sincronización: diseño previo documentado con una superficie compacta de registros cifrados, RLS por `auth.uid()`, metadatos mínimos y modelo de amenazas antes de crear tablas o transportar contenido real.
- V2 Autenticación validada en uso real: acceso con Google, sesión online, cierre de sesión y modo local coexistiendo sin que la cuenta sustituya la contraseña maestra ni desbloquee la bóveda durante el acceso normal.
- V2 Autenticación: modo local explícito sin correo, inicio/cierre de sesión por correo, sesión online persistente y acceso con Google preparado dentro del mismo módulo `features/account/`, sin activar todavía sincronización ni tocar la bóveda local.
- V2 Cuenta de usuario: cuenta online opcional mediante Supabase, separada de la contraseña maestra y del contenido cifrado local.
- Funcionamiento offline V1 reforzado: el service worker precachea explícitamente el app shell ejecutable (`js`, `css`, `html` y futuros `wasm`), conserva `index.html` como fallback de navegación y limpia cachés obsoletos sin crear un sistema paralelo de almacenamiento.
- En móvil, la tarjeta de acceso/restauración se prioriza y permanece dentro del viewport; si crece por la restauración de un backup, su contenido puede desplazarse internamente sin perder los campos de contraseña.
- Backup/exportación/restauración cifrada V1: archivo `.oanixbackup` versionado con metadatos de protección y todos los registros ya cifrados; antes de restaurar OANIX verifica la contraseña maestra y autentica secuencialmente cada registro AES-GCM, y solo después reemplaza la bóveda en una transacción. El archivo se procesa en memoria sin crear copias persistentes auxiliares.
- Búsqueda local global: ignora la carpeta/etiqueta activa mientras se busca y muestra carpeta, ubicación, fragmento y cantidad de coincidencias antes de abrir una nota.
- Búsqueda local V1 sobre contenido ya descifrado en memoria, insensible a mayúsculas/acentos, con términos múltiples y combinable con Carpetas + Etiquetas, sin persistir un índice en texto plano.
- Etiquetas V1 cifradas: CRUD, asignación múltiple por nota, filtro combinado con carpetas, chips en la nota y eliminación sin borrar contenido.
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

OANIX utiliza versiones claras y progresivas. No se declara un bloque completamente validado cuando aún existen pruebas reales explícitamente registradas como deuda.

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
