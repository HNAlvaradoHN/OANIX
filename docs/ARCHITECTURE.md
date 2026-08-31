# OANIX — Arquitectura actual

**Última actualización:** 2026-08-21

Este documento describe fronteras arquitectónicas vigentes. El estado operativo y el siguiente trabajo pertenecen a `CURRENT_STATE.md`; las decisiones permanentes, a `PROJECT_MEMORY.md`.

## Principios

- Una sola base React + TypeScript + Vite para PWA y Android/Capacitor.
- La UI no conoce detalles internos de persistencia, cifrado ni proveedores remotos.
- Reutilizar repositorios/stores existentes antes de crear persistencia paralela.
- El contenido privado se cifra antes de persistirse o salir del dispositivo, salvo fronteras de confianza explícitamente documentadas en `SECURITY.md`.
- Cambios pequeños: modificar el menor número razonable de módulos.
- Todo recurso temporal debe tener ciclo de vida y limpieza definidos.
- No crear carpetas, capas o abstracciones sin una responsabilidad real.

## Capas principales

```text
UI / Editor
    ↓
Features / Services
    ↓
Repositories / Transfer orchestration
    ↓
Security / Crypto
    ↓
Local storage o OanixStorageProvider
```

La UI no accede directamente a IndexedDB ni manipula material criptográfico persistente.

Áreas relevantes actuales:

```text
src/
├── app/                 composición y navegación
├── features/            notas, editor, cuenta, sync, archivos grandes…
├── security/            crypto, vault y claves
├── storage/             persistencia local y repositorios
├── shared/              utilidades realmente compartidas
└── pwa/                 integración web/PWA
android/                  integración nativa Capacitor
```

## Notas y contenido estructurado

La implementación histórica de notas usa `blocks-v1` y sigue disponible como referencia/datos legacy. La reconstrucción post-unlock usa una capa v2 incremental propia; no se debe volver a meter un documento grande entero en un solo registro por comodidad.

Formato activo de la reconstrucción:

```text
note.v2.meta
    ↓
note.v2.manifest
    ↓ referencias ordenadas
note.v2.text-chunk (IDs/revisiones estables)
    ↓
sync.v2.pending (solo unidades pendientes)
```

Reglas:
- metadata de lista pequeña separada del cuerpo;
- manifiesto pequeño como autoridad del orden de unidades;
- texto en chunks acotados; una edición localizada no debe mover/recrear artificialmente todos los chunks posteriores;
- una unidad sin cambios conserva ID/revisión y no se vuelve a cifrar/escribir;
- escrituras y borrados relacionados se confirman en una sola transacción local después del cifrado;
- la cola de sync es un índice de trabajo pendiente, no una copia paralela de la nota;
- `note.v2.body/plain-text-v1` es fallback transitorio para notas creadas antes de este formato y migra perezosamente al editar el cuerpo.

El editor visual no conoce IndexedDB ni claves. Recibe/entrega estado mediante servicios; los futuros bloques ricos (hoja, código, checklist, imágenes, archivos) deben conservar unidades/IDs propios y no obligar a reserializar el documento completo.

Los registros privados se cifran antes de entrar en IndexedDB. Imágenes y otros binarios privados se almacenan separadamente y se referencian mediante identificadores opacos.

## Persistencia local

- La bóveda y registros privados usan la infraestructura local existente; no crear una segunda bóveda/store por función.
- Cachés y temporales no son una segunda fuente de verdad.
- Un dato auxiliar persistente debe ser mínimo, justificable y eliminable.
- Antes de escribir, detectar no-op cuando sea barato y fiable; no renovar revisiones ni cifrar por actividad que no cambió contenido.
- Agrupar cambios relacionados en commits consistentes y evitar colas duplicadas por la misma unidad.
- Backups, exportaciones y verificaciones no dejan por defecto copias permanentes adicionales.

La caché técnica de transferencias grandes está separada de `oanix-vault` y conserva únicamente el estado necesario para reanudar; no debe convertirse en un almacén alternativo de archivos.

## Sincronización de registros

La sincronización normal usa sobres cifrados y metadatos operativos mínimos. El backend autoriza por usuario, pero no necesita interpretar el contenido privado durante el transporte normal.

El estado técnico de sync se mantiene compacto y reutiliza la infraestructura existente. No crear una caché local paralela de la réplica remota.

Conflictos siguen la regla `detectar → conservar → mostrar → usuario decide`; no existe overwrite silencioso deliberado. Las deudas de validación de campo se conservan en los issues correspondientes.

La recuperación por correo es una frontera de confianza separada y está descrita en `SECURITY.md`.

## Archivos grandes

El motor de archivos grandes está diseñado para procesamiento acotado por fragmentos y no para materializar el archivo completo en RAM.

```text
Archivo original
    ↓ planificación por fragmentos
Fragmento plaintext (~8 MiB)
    ↓ AES-GCM + IV independiente
Ciphertext autenticado
    ↓ SHA-256 / manifiesto / checkpoint
OanixStorageProvider
    ↓
Proveedor concreto (Google Drive primero)
```

Propiedades:
- cifrado AES-GCM secuencial por fragmento;
- IV independiente por fragmento;
- hashes/manifiestos necesarios para integridad y reconstrucción;
- checkpoint persistente para reanudación;
- subida y descarga por rangos;
- un solo bloque activo cuando sea posible y limpieza de buffers temporales;
- progreso separado de confirmación final: `100% transferido` no implica `Guardado` hasta verificar.

El objetivo inicial de producto es 5 GB por archivo, pero el motor no se diseña con 5 GB como techo arquitectónico. El protocolo mantiene actualmente un límite de seguridad mayor (~20 GiB).

## OanixStorageProvider

`OanixStorageProvider` es la frontera entre el motor de archivos y el destino físico. El motor de cifrado/reanudación no debe contener lógica específica de Google Drive.

Google Drive es el primer proveedor implementado. Otros proveedores futuros (local, OneDrive, S3 compatible, WebDAV/NAS u otro) deben poder añadirse mediante la misma frontera cuando exista una necesidad real; no implementarlos anticipadamente.

### Google Drive

- Scope `drive.appdata` y destino `appDataFolder`.
- No solicitar acceso general al Drive del usuario.
- PWA y Android tienen mecanismos de autorización distintos, pero alimentan el mismo dominio de almacenamiento.
- Tokens de acceso son temporales y permanecen en memoria.
- Las URLs de sesión reanudable se validan/restringen antes de enviar credenciales.
- Antes de transferencias grandes se comprueba destino/cuota.
- Drive exige alineación de los bloques intermedios reanudables a 256 KiB; el tamaño plaintext se ajusta considerando el tag AES-GCM para que el ciphertext completo quede alineado.

Drive es opcional: ninguna capa central de notas/bóveda debe depender de que esté conectado.

## Android / Capacitor

Android reutiliza la aplicación web y añade únicamente integraciones nativas que lo requieren: autorización nativa, Keystore/biometría, cámara, archivos, compartir y navegación del sistema.

La lógica de negocio compartida no se duplica en Kotlin. Las integraciones nativas entregan datos al mismo flujo seguro de la aplicación siempre que sea posible.

## Responsive

- Un solo comportamiento adaptable para móvil, tablet y PC.
- `minmax`, `clamp`, flex/grid, wrapping y container queries antes que parches por modelo de dispositivo.
- Breakpoints solo para cambios estructurales reales.
- Overlays, menús, imágenes, código y controles deben respetar viewport, safe areas, teclado virtual, zoom y textos largos.

## Regla para cambios arquitectónicos

Antes de crear una nueva capa, store, formato o dependencia:
1. comprobar el código actual;
2. demostrar que la responsabilidad no cabe limpiamente en una abstracción existente;
3. definir ciclo de vida, seguridad y limpieza si persiste datos;
4. evitar migraciones de formato por conveniencia;
5. documentar aquí solo la decisión arquitectónica estable, no cada PR que la implementó.
