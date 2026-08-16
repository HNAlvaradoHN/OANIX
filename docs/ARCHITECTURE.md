# OANIX — Architecture

## Objetivo

Mantener OANIX modular, clara y fácil de modificar sin convertir el repositorio en una proliferación de carpetas y archivos.

## Principios

1. Cada módulo tiene una responsabilidad clara.
2. La interfaz no conoce detalles internos de almacenamiento o cifrado.
3. El almacenamiento no depende de la interfaz.
4. El cifrado se concentra en una capa de seguridad dedicada.
5. Las funciones compartidas viven únicamente en `shared/` cuando realmente son compartidas.
6. No se crea una carpeta por cada botón, componente pequeño o función trivial.
7. Los cambios deben afectar el menor número razonable de módulos.
8. Antes de modificar una función existente se revisa su implementación actual.
9. Ninguna función debe dejar copias, cachés, blobs o registros persistentes auxiliares sin una necesidad explícita y una política de limpieza definida.

## Estructura prevista

La estructura se crea gradualmente a medida que los módulos sean necesarios.

```text
src/
├── app/
├── features/
│   ├── notes/
│   ├── editor/
│   ├── attachments/
│   ├── folders/
│   ├── tags/
│   ├── search/
│   └── backup/
├── security/
│   ├── crypto/
│   ├── keys/
│   └── vault/
├── storage/
│   ├── local/
│   └── repositories/
├── shared/
└── pwa/
```

La carpeta `sync/` se incorporará en V2 y la integración Android/Capacitor en V3. No se implementan antes de su versión correspondiente.

## Flujo de dependencias

```text
UI / Editor
    ↓
Feature service
    ↓
Repository
    ↓
Security / Encryption
    ↓
Local storage
```

La UI no debe acceder directamente a IndexedDB ni manipular claves criptográficas.

## Dirección de interfaz

OANIX adopta una experiencia de navegación inspirada en la claridad de aplicaciones de mensajería como Telegram, pero mantiene una identidad y arquitectura propias orientadas exclusivamente a notas privadas.

Principios de esta experiencia:

- la lista principal presenta las notas como entradas compactas similares a una lista de conversaciones;
- abrir una nota debe sentirse tan directo como entrar a una conversación, sin convertir el contenido en un chat ni introducir mensajería entre personas;
- en móvil se navega de la lista a la nota abierta y se vuelve con una acción clara;
- en tablet y PC se aprovecha un diseño de dos paneles: lista a la izquierda y nota abierta a la derecha;
- las carpetas se representarán como pestañas sobre la lista cuando llegue el punto `Carpetas` del roadmap; no se implementan antes;
- fijados, archivo, etiquetas y búsqueda se añadirán únicamente cuando su alcance correspondiente esté activo;
- no se copian logotipos, activos gráficos ni funciones sociales de Telegram.

La inspiración es de interacción y organización, no una dependencia técnica ni una copia literal de interfaz.

## Contenido de una nota

OANIX se diseña alrededor de bloques para evitar que una nota dependa de un único documento HTML gigante.

Tipos previstos para V1:

- texto enriquecido;
- encabezado;
- lista;
- checklist;
- cita;
- separador;
- código;
- imagen;
- ficha de contacto privada.

La ficha de contacto permitirá guardar dentro de una nota información como nombre, teléfono, correo y observaciones. No convierte OANIX en una red social ni sincroniza contactos del sistema por defecto.

Los archivos adjuntos generales se prepararán arquitectónicamente, pero su alcance exacto se confirmará antes de implementarlos.

## Modelo inicial de nota

Una nota V1 contiene:

- identificador aleatorio;
- título;
- fecha de creación;
- fecha de actualización;
- contenido `blocks-v1` cifrado.

El editor de texto enriquecido amplía `blocks-v1` sin cambiar el contenedor ni guardar HTML arbitrario. Los bloques de texto almacenan segmentos de texto y únicamente las marcas que OANIX entiende, como negrita, cursiva o un enlace validado. Encabezados, listas, citas y separadores se representan como tipos de bloque explícitos.

El DOM editable del navegador es solo una vista temporal. Antes de persistir una nota, OANIX lo transforma a su modelo estructurado y el repositorio cifra ese modelo completo. Al volver a abrir la nota, la vista se reconstruye desde esos bloques validados.

Esto permite agregar posteriormente bloques de código, imágenes, checklists y fichas de contacto sin convertir notas antiguas en documentos incompatibles ni depender de HTML almacenado.

## Mutaciones y autoguardado

Las mutaciones de una misma nota se serializan en el servicio de notas para evitar que una actualización de título y una actualización de contenido se sobrescriban entre sí.

El editor usa autoguardado con una espera breve después de escribir y fuerza una escritura pendiente antes de cambiar de nota, volver a la lista o bloquear la bóveda. No existe un botón obligatorio de `Guardar`.

## Regla de cambios

Antes de modificar código existente:

1. revisar el estado actual del repositorio;
2. identificar el módulo responsable;
3. modificar solo lo necesario;
4. ejecutar las pruebas relacionadas;
5. registrar el cambio mediante Git.

No se reescriben archivos completos basándose en memoria o suposiciones cuando ya existe una implementación funcional.

## Higiene de almacenamiento

- Se reutilizan los repositorios y stores existentes antes de crear una nueva capa persistente.
- Un recurso temporal debe permanecer en memoria siempre que sea razonable y debe liberarse al terminar su operación.
- Si una función requiere persistencia auxiliar, debe justificarla, documentar su ciclo de vida y eliminar los datos cuando dejan de ser necesarios.
- Backups, exportaciones y procesos de validación no crean por defecto una segunda copia permanente de la bóveda dentro de OANIX.
- Antes de cerrar V1 se revisarán posibles registros o blobs huérfanos para evitar crecimiento innecesario del almacenamiento local.

## Regla responsive de OANIX

- Cada cambio de interfaz se diseña como un único comportamiento para móvil, tablet y PC; no se mantienen versiones paralelas del mismo componente.
- El contenedor y el viewport visible gobiernan el tamaño mediante `minmax`, `clamp`, flex/grid, wrapping y container queries.
- Los breakpoints se reservan para cambios estructurales reales (por ejemplo, una o dos columnas), no para parchear modelos concretos de dispositivo.
- Menús, overlays, imágenes, código y controles deben permanecer dentro del espacio visible y considerar teclado virtual, safe areas, zoom y textos largos.
- Toda modificación visual debe revisarse en un rango continuo de anchos antes de considerarse cerrada.

Los checklists de V1 son bloques estructurados dentro de `blocks-v1`: cada elemento guarda únicamente su texto y estado completado. Se cifran junto con el resto de la nota y no dependen de HTML persistido.

## Fichas de contacto privadas V1

- Una ficha de contacto es un bloque `contact` dentro de `blocks-v1`; se cifra y guarda junto con la nota.
- V1 no escribe en la agenda del sistema ni sincroniza contactos con servicios externos.
- Los campos iniciales son nombre, teléfono, correo, organización y notas; todos permanecen opcionales para permitir fichas parciales.
- La tarjeta usa una sola implementación fluida por contenedor para móvil, tablet y PC.

## Entradas por día dentro de una nota

- Cada cambio de día se representa con un bloque marcador `dailyEntry` dentro de `blocks-v1`; el contenido continúa siendo una lista plana de bloques y no se anidan documentos dentro de documentos.
- El marcador guarda la fecha local `YYYY-MM-DD` y un título opcional de la entrada.
- Las notas antiguas se preparan en memoria con un primer marcador basado en su fecha de creación y se persistirán de forma natural en la siguiente edición.
- Al abrir una nota en un día distinto al último marcador, el editor prepara una nueva entrada para la fecha local actual; el contenido solo se persiste cuando existe una edición real.
- El marcador de día es estructural y no debe desaparecer por una selección global accidental.

## Carpetas V1

- Las carpetas son registros cifrados independientes de tipo `folder`; sus nombres no se almacenan en texto plano.
- Cada nota guarda opcionalmente `folderId` dentro de su propio registro cifrado; notas antiguas sin este campo siguen siendo válidas.
- Eliminar una carpeta nunca elimina notas: primero se desvinculan y vuelven al estado `Sin carpeta`.
- La lista usa una única fila de pestañas fluida para `Todas` y las carpetas creadas; la misma estructura funciona en móvil, tablet y PC.

## Backend de sincronización V2 — diseño previo

El backend de V2 se diseña primero como un almacén de sobres cifrados. Supabase autentica al usuario y autoriza filas, pero no recibe la contraseña maestra ni claves capaces de descifrar la bóveda.

### Superficie mínima del servidor

La primera migración debe preferir **una sola tabla general de registros sincronizados**, en lugar de crear tablas separadas por notas, carpetas, etiquetas, imágenes o futuras funciones. El tipo semántico del registro permanece dentro del payload cifrado siempre que el protocolo no necesite conocerlo.

Cada fila necesita únicamente metadatos operativos mínimos:

- `user_id`: propietario Supabase, usado exclusivamente para RLS;
- `record_key`: identificador opaco generado por el cliente, sin título ni nombre legible;
- `ciphertext`: sobre cifrado versionado producido en el cliente;
- `version`: contador/versionado necesario para sincronización y conflictos posteriores;
- `updated_at`: marca temporal del servidor para consultas incrementales;
- estado de borrado lógico únicamente si el protocolo de sincronización lo requiere para propagar eliminaciones.

No se almacenarán en columnas separadas títulos, nombres de carpeta, etiquetas, texto de notas, nombres de contactos ni descripciones de imágenes.

### RLS y acceso

La tabla expuesta a la aplicación debe tener RLS habilitado desde su creación. Las políticas se limitan al rol `authenticated` y comprueban que `(select auth.uid()) = user_id` tanto al leer como al insertar/modificar. `anon` no recibe acceso a registros sincronizados.

El `user_id` debe estar indexado porque participa en todas las políticas y consultas. Las consultas del cliente también filtrarán explícitamente por `user_id`, aun cuando RLS ya imponga el mismo límite, para permitir mejores planes de ejecución.

La clave `service_role` o cualquier secreto capaz de saltarse RLS nunca se incluye en el navegador, el repositorio público ni la PWA.

### Separación entre autenticación y cifrado

```text
Cuenta Google / correo
        ↓
Supabase Auth
        ↓
JWT de usuario
        ↓
RLS: solo sus filas

Contraseña maestra
        ↓
Clave de bóveda local
        ↓
Cifrado E2EE del registro
        ↓
Servidor recibe solo ciphertext
```

Una sesión Supabase válida autoriza transporte y almacenamiento, pero no desbloquea la bóveda local. Un usuario puede cerrar sesión online sin borrar ni bloquear sus datos locales.

### Higiene local durante V2

La sincronización no debe crear un segundo IndexedDB ni stores por función. Cuando haga falta persistir estado técnico de sync, se reutilizará la infraestructura local existente y se mantendrá el mínimo estado necesario; los cursores o metadatos que deban sobrevivir reinicios se guardarán de forma compacta y, si contienen información sensible, cifrada.

No se implementará una caché paralela de registros remotos. El servidor es una réplica cifrada para sincronización, no un tercer formato local de la bóveda.

### Fuera de este primer bloque

Todavía no pertenecen al backend base: protocolo E2EE multi-dispositivo, envoltura de claves por dispositivo, resolución de conflictos, historial, recuperación y estrategia definitiva para binarios grandes. Esos puntos tienen bloques propios en V2 y se diseñan sobre esta base sin debilitar el modelo local existente.
