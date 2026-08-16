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
- [x] Carpetas
- [x] Etiquetas
- [x] Búsqueda local
- [x] Backup, exportación y restauración cifrada
- [x] Funcionamiento offline
- [x] Pruebas de la V1

## V2 — Cuenta y sincronización

Objetivo: sincronización cifrada entre dispositivos sin exponer contenido al servidor durante el transporte normal. La recuperación por correo es una excepción explícita al modelo zero-knowledge: el backend participa como parte confiable únicamente en el flujo de recuperación elegido por el usuario.

- [x] Cuenta de usuario
- [x] Autenticación
- [x] Backend de sincronización
- [x] Sincronización E2EE
- [x] Varios dispositivos
- [x] Resolución de conflictos *(implementación completa; validación de campo restante registrada en #69)*
- [x] Historial de versiones *(implementación publicada; validación funcional restante registrada en #70)*
- [ ] Recuperación de acceso *(implementación por correo en PR #75; pendiente validación real OTP y multidispositivo en #73)*

### Reglas de acceso V2

- El modo local permanece disponible sin correo ni proveedor social.
- La cuenta online es opcional y no sustituye la contraseña maestra durante el acceso normal.
- OANIX admite acceso por correo + contraseña y acceso con Google usando la misma identidad Supabase.
- Una sesión normal de Google/correo no desbloquea por sí sola la bóveda.
- La única excepción deliberada es `Recuperar por correo`: un OTP reciente puede autorizar temporalmente al broker de recuperación para recuperar la misma clave de bóveda y obligar a crear una contraseña maestra nueva.
- No se solicitan permisos de Gmail, Drive ni Contactos para autenticarse con Google.
- Al iniciar OANIX, el usuario puede elegir explícitamente entre su bóveda sincronizada y el modo local antes de introducir la contraseña maestra correspondiente.

### Backend V2 validado

- Supabase usa una sola tabla general `public.sync_records` para sobres cifrados y manifiestos E2EE del transporte normal.
- RLS está habilitado y todas las políticas de lectura/escritura de `sync_records` se limitan a `authenticated` con propiedad por `auth.uid()`.
- `anon` no tiene privilegios sobre los registros de sincronización.
- El cliente autenticado solo puede modificar `ciphertext`, `version` y `deleted`; propietario, clave opaca y timestamp del servidor no son modificables por esa vía.
- El backend de sincronización normal no interpreta el contenido privado; únicamente almacena sobres producidos por el cliente E2EE.
- La recuperación por correo usa un broker separado y tablas de recuperación sin grants para `anon`/`authenticated`; el broker es la excepción explícita de confianza y solo libera material de recuperación después de OTP reciente.
- Los binarios usan un único bucket privado `oanix-encrypted-blobs`; los objetos se guardan bajo el UID autenticado y RLS impide acceder a objetos de otro usuario.

### Sincronización E2EE — validada

- El primer transporte cifrado fue validado en uso real desde OANIX y se verificaron filas opacas activas en Supabase.
- Cada registro local elegible conserva su payload ya cifrado y se encapsula nuevamente en un sobre AES-GCM usando la clave activa de la bóveda, que permanece en memoria.
- `record_key` remoto es un identificador aleatorio generado criptográficamente y no deriva de título, tipo, identificador local ni otros metadatos predecibles.
- Para reconocer filas ya existentes, OANIX descifra sus sobres únicamente en memoria durante la sincronización normal; no expone al servidor la clave local del registro.
- Si un sobre remoto no puede descifrarse con la bóveda activa, OANIX se detiene y no lo sobrescribe.
- Los registros cuyo payload cifrado no cambió se verifican localmente pero no se reescriben ni incrementan artificialmente su versión.
- No se crea un segundo IndexedDB, store o caché para E2EE.

### Varios dispositivos — validado en dispositivo real

- El guardado local continúa siendo automático y offline-first.
- Con una cuenta conectada, la sincronización E2EE es automática: el usuario no depende de un botón manual para subir o bajar cambios.
- Al entrar con la misma cuenta en un dispositivo nuevo, OANIX puede traer la misma bóveda cifrada; en el flujo normal el usuario sigue necesitando conocer su contraseña maestra para abrir la clave de bóveda localmente.
- Durante la sincronización normal la contraseña maestra y la clave de bóveda sin cifrar no se envían al backend. La recuperación por correo es una excepción deliberada: el broker puede procesar temporalmente la clave de bóveda tras OTP reciente para permitir el restablecimiento.
- Al volver a una instancia anterior de OANIX, los cambios hechos en otro dispositivo se comprueban y reflejan automáticamente cuando hay conexión.
- El autosync se activa tras cambios locales, al recuperar Internet, al volver a la app, mediante Realtime como aviso de cambios remotos y con una comprobación periódica de respaldo mientras está visible.
- El estado de sincronización se conserva como registros pequeños cifrados bajo el tipo general `system.sync-state` dentro de `encrypted_records`; no se crea otro store, base local, caché ni cola independiente.
- Las escrituras remotas usan versión esperada para evitar sobrescribir silenciosamente una modificación concurrente.
- Si ambos dispositivos modificaron de forma incompatible el mismo registro desde la última base común, OANIX conserva ambos lados sin sobrescribir y lo entrega al centro de Resolución de conflictos.
- `image` e `image-preview` forman parte del autosync E2EE: su ciphertext ya cifrado se procesa y transfiere en fragmentos de 6 MiB como `application/octet-stream` en el bucket privado para limitar el pico de memoria en móvil.
- El nombre, ID y tipo local de una imagen no forman parte de la ruta remota; la ruta usa únicamente el UID requerido por RLS y un identificador aleatorio.
- El manifiesto que relaciona una imagen local con sus fragmentos permanece cifrado dentro de `sync_records`; cada fragmento se verifica con SHA-256 antes de reconstruir el payload cifrado local.
- Al reemplazar o eliminar un binario, OANIX limpia los fragmentos que dejan de ser necesarios; una cola mínima de limpieza queda cifrada dentro del mismo estado de sincronización para reintentar sin crear almacenamiento paralelo.

### Historial de versiones — implementación V2

- Los estados anteriores de las notas se guardan como registros cifrados `note-history` dentro del mismo `encrypted_records`; no se crea otra base, store ni caché.
- Se conservan hasta 5 snapshots por nota y los snapshots automáticos se agrupan con una ventana mínima de 5 minutos para no crear una versión por cada autoguardado.
- El historial puede sincronizarse mediante el transporte E2EE no binario existente.
- Antes de restaurar se crea un checkpoint `pre-restore`, haciendo reversible la restauración.
- La interfaz permite seleccionar una nota, revisar fecha/hora y vista previa de una versión anterior y ejecutar `Restaurar esta versión` con confirmación explícita.
- Antes de abrir el historial se espera que la nota visible termine de guardarse, evitando capturar/restaurar sobre cambios pendientes.
- Si una versión histórica referencia un original de imagen que ya no está disponible, la restauración se bloquea explícitamente en vez de crear una nota incompleta.
- Los snapshots conservan referencias `imageId`; esta etapa no duplica binarios históricos.
- Al eliminar permanentemente una nota se elimina también su historial para no dejar versiones huérfanas sin una superficie de recuperación definida.

### Recuperación de acceso — implementación V2

- OANIX mantiene una sola contraseña maestra permanente para la bóveda sincronizada; no obliga al usuario a conservar una segunda clave de recuperación.
- Después de una entrada correcta en la bóveda sincronizada, OANIX prepara una envoltura de recuperación de la misma clave de bóveda mediante el broker del backend.
- Si el usuario olvida la contraseña, `Recuperar por correo` solicita un Email OTP para la cuenta existente con `shouldCreateUser: false`.
- `recover` exige un JWT válido cuyo método de autenticación más reciente sea `otp` y tenga una antigüedad máxima de 10 minutos.
- Tras validar el código, el usuario debe escribir y confirmar una nueva contraseña maestra antes de continuar.
- La misma clave de bóveda se reenvuelve con la contraseña nueva; no se crea otra bóveda ni se recifran todas las notas.
- El bootstrap remoto se actualiza con versión esperada para evitar sobrescribir una rotación concurrente.
- La generación de seguridad aumenta después de una recuperación y la envoltura de recuperación se rota.
- Una recuperación ya preparada no puede ser reemplazada desde una sesión normal usando una clave de bóveda diferente.
- Las tablas `oanix_recovery_root` y `vault_recovery_envelopes` no conceden acceso directo a `anon` ni `authenticated`; el acceso ocurre mediante el broker con service role y JWT del usuario validado.
- La contraseña maestra no se guarda en Supabase. La clave de bóveda no se guarda en claro en tablas; el broker la procesa temporalmente durante preparación/recuperación y almacena únicamente una envoltura cifrada bajo una raíz de servidor.
- Esta modalidad prioriza recuperación sencilla y por ello NO debe describirse como zero-knowledge frente al proveedor de backend.
- El modo exclusivamente local, sin cuenta online/correo, no puede usar recuperación por correo.
- Un dispositivo completamente offline puede conservar una protección antigua hasta reconectarse; OANIX no promete revocación instantánea de copias offline.
- Dependencia de validación real: la plantilla de Supabase Email OTP debe incluir `{{ .Token }}` para mostrar el código numérico en lugar de enviar solo un Magic Link.

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

**V1 — Núcleo local: CERRADA ✅**

**Versión activa: V2 — Cuenta y sincronización**

**Bloque oficial activo:** Recuperación de acceso — implementación por correo en PR #75; pendiente validación real del OTP, rotación y varios dispositivos en issue #73.

**Deudas de validación visibles:** Resolución de conflictos (#69) e Historial de versiones (#70). No bloquean el avance por decisión explícita del usuario, pero no deben darse por probadas hasta cerrar sus casos reales.

La cuenta online es opcional. No se implementan funciones de V3 o V4 mientras V2 no esté cerrada, salvo preparación arquitectónica explícitamente documentada.
