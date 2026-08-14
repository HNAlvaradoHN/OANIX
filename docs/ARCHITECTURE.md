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

## Contenido de una nota

OANIX se diseña alrededor de bloques para evitar que una nota dependa de un único documento HTML gigante.

Tipos previstos para V1:

- texto
- encabezado
- lista
- checklist
- cita
- código
- imagen

Los archivos adjuntos generales se prepararán arquitectónicamente, pero su alcance exacto se confirmará antes de implementarlos.

## Regla de cambios

Antes de modificar código existente:

1. revisar el estado actual del repositorio;
2. identificar el módulo responsable;
3. modificar solo lo necesario;
4. ejecutar las pruebas relacionadas;
5. registrar el cambio mediante Git.

No se reescriben archivos completos basándose en memoria o suposiciones cuando ya existe una implementación funcional.
