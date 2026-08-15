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
