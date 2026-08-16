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

Objetivo: sincronización cifrada entre dispositivos sin que el servidor pueda leer el contenido.

- [x] Cuenta de usuario
- [x] Autenticación
- [x] Backend de sincronización
- [ ] Sincronización E2EE ← implementación técnica, validación real pendiente
- [ ] Varios dispositivos
- [ ] Resolución de conflictos
- [ ] Historial de versiones
- [ ] Recuperación de acceso

### Reglas de acceso V2

- El modo local permanece disponible sin correo ni proveedor social.
- La cuenta online es opcional y no sustituye la contraseña maestra.
- OANIX admite acceso por correo + contraseña y acceso con Google usando la misma identidad Supabase.
- La autenticación online no concede por sí sola acceso al contenido descifrado de la bóveda.
- No se solicitan permisos de Gmail, Drive ni Contactos para autenticarse con Google.

### Backend V2 validado

- Supabase usa una sola tabla general `public.sync_records` para sobres cifrados.
- RLS está habilitado y todas las políticas de lectura/escritura se limitan a `authenticated` con propiedad por `auth.uid()`.
- `anon` no tiene privilegios sobre los registros de sincronización.
- El cliente autenticado solo puede modificar `ciphertext`, `version` y `deleted`; propietario, clave opaca y timestamp del servidor no son modificables por esa vía.
- El backend no interpreta el contenido privado; únicamente almacena los sobres producidos por el cliente E2EE.

### Sincronización E2EE — primera fase

- El envío es manual desde Cuenta mientras se valida el protocolo; no se ejecuta una sincronización silenciosa en segundo plano.
- Cada registro local elegible conserva su payload ya cifrado y se encapsula nuevamente en un sobre AES-GCM usando la clave activa de la bóveda, que permanece en memoria.
- `record_key` remoto es un identificador aleatorio generado criptográficamente y no deriva de título, tipo, identificador local ni otros metadatos predecibles.
- Para reconocer filas ya existentes, OANIX descifra sus sobres únicamente en memoria y reconstruye de forma temporal la relación con la clave local; no persiste un mapa paralelo.
- Si un sobre remoto no puede descifrarse con la bóveda activa, OANIX se detiene y no lo sobrescribe.
- Los registros cuyo payload cifrado no cambió se verifican localmente pero no se reescriben ni incrementan artificialmente su versión.
- Después de escribir en Supabase, OANIX lee la fila devuelta, descifra el sobre en memoria y verifica que coincida con el registro local antes de contarla como validada.
- `image` e `image-preview` quedan fuera de esta primera fase para no cargar ni duplicar binarios grandes antes de definir su estrategia específica.
- Todavía no se descargan registros hacia otro dispositivo, no se comparte la clave de bóveda entre dispositivos y no se resuelven conflictos; esos alcances pertenecen a los siguientes puntos de V2.
- No se crea un segundo IndexedDB, store, caché, cola persistente ni copia local de los registros remotos.

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

**Siguiente bloque de trabajo:** Sincronización E2EE — validación real del primer transporte cifrado.

La cuenta online es opcional y debe permanecer separada de la contraseña maestra y de la bóveda local. No se implementan funciones de V3 o V4 mientras V2 no esté cerrada, salvo preparación arquitectónica explícitamente documentada.
