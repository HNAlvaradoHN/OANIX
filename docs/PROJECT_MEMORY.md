# OANIX — Memoria operativa del proyecto

Este documento conserva **decisiones duraderas y restricciones de producto/arquitectura**. No es un changelog ni un checkpoint de ejecución. GitHub `main` es la fuente de verdad del código actual.

**Última actualización:** 2026-09-06

## 0. Continuidad

- Tratamiento del usuario: **Inge**.
- El número del chat no se guarda aquí; sus únicas autoridades son `docs/OANIX_CHAT_PROTOCOL.md` y `docs/OANIX_ACTIVE_CHECKPOINT.md`.
- El siguiente trabajo exacto vive en `docs/OANIX_ACTIVE_CHECKPOINT.md` y el estado general en `docs/CURRENT_STATE.md`.
- No reabrir trabajo marcado `IMPLEMENTED` solo porque sobreviva una referencia histórica.
- Si una decisión cambia, conservar únicamente la parte histórica necesaria para entender compatibilidad, seguridad o arquitectura; el detalle de evolución pertenece a Git/PRs/`CHANGELOG.md`.

## 1. Principios permanentes

- OANIX es offline-first; la nube es opcional.
- PWA y Android/Capacitor comparten una sola base React + TypeScript.
- Conservar datos tiene prioridad ante incertidumbre; no sobrescribir silenciosamente.
- UI, dominio, persistencia, seguridad y sincronización permanecen desacoplados por contratos.
- Reutilizar módulos/stores existentes antes de crear persistencias paralelas.
- Cambios pequeños y aislados; no hacer refactors amplios para arreglar fallos locales.
- Rendimiento y escala son requisitos de producto: notas grandes, miles de registros, muchas imágenes y archivos de varios GB son cargas esperadas.
- Evitar escaneos completos, descifrado global, re-render completo y materialización de archivos gigantes en RAM cuando exista alternativa incremental/indexada/por fragmentos.
- No repetir cifrado, escritura, hash, subida o sync de unidades sin cambios.
- Seguridad, cifrado, bóveda, notas y sync no se degradan por conveniencia.
- No guardar secretos, tokens o credenciales en código/repositorio/notas/localStorage/IndexedDB/bóveda fuera del formato seguro expresamente diseñado.

## 2. Seguridad y cuenta

- Contraseña maestra y clave de bóveda son conceptos separados.
- La clave activa web permanece como `CryptoKey` no extraíble.
- El contenido privado se cifra antes de persistirse o salir del dispositivo.
- La cuenta online es opcional y no sustituye la contraseña maestra.
- El transporte normal de sync mantiene E2EE.
- Recuperación Email OTP conserva una frontera de confianza explícita distinta del transporte normal; no describir OANIX completo como zero-knowledge frente al proveedor mientras exista ese mecanismo.
- Android Keystore/biometría no sustituyen la contraseña maestra ni vuelven exportable la clave activa.
- En conflictos multidispositivo: detectar → conservar ambos lados → presentar → usuario decide. No resolver silenciosamente una colisión destructiva.

## 3. Arquitectura post-unlock vigente

La reconstrucción post-unlock ya está **IMPLEMENTED**. No es un frente pendiente.

- `RebuildApp` es la autoridad de la experiencia post-unlock mientras `main` no demuestre una sustitución posterior.
- `encrypted_records_v2` es el almacenamiento cifrado v2 indexado/aditivo vigente.
- La UI no escribe directamente IndexedDB ni posee cifrado/sync.
- Dirección permanente: `UI → estado/servicios → dominio → almacenamiento cifrado → vault/crypto`.
- Toda UI nueva debe funcionar en PC + móvil + Día + Noche.

La antigua reconstrucción de Home/editor, plantillas externas y referencias a `qwen.html`/`appquen.js` quedan **SUPERSEDED como trabajo activo**. Git conserva ese historial si alguna idea concreta necesita consulta.

## 4. Home, carpetas, etiquetas y lista — IMPLEMENTED

- Home/lista recientes quedaron consolidados en PR #630–#638.
- Carpetas, etiquetas y notas reutilizan persistencia cifrada v2; no crear CRUD o stores paralelos por motivos visuales.
- Cada nota puede tener personalización visual persistida dentro de su metadata cifrada, sin sustituir contenido ni etiquetas reales.
- Orden de `Todas` y orden por carpeta son independientes.
- Drag/reorder móvil usa un propietario de pointer estable, hit-test vertical, autoscroll y continuidad visual; no reintroducir rutas táctiles paralelas sin evidencia nueva.
- Fijado/favorito de carpetas no debe reescribir silenciosamente el orden manual.
- Portadas/fondos de carpeta son assets cifrados separados, no base64 incrustado en el registro.

## 5. Editor — IMPLEMENTED / NO ES FRENTE ACTIVO

PR #629 consolidó el editor natural vigente por renglones.

Decisiones permanentes:
- renglones de texto mediante `div contentEditable`;
- selección/cursor mediante `Selection`/`Range`;
- Párrafo/H2/H3 con comportamiento natural por renglón;
- Enter divide y continúa en Párrafo; Backspace al inicio puede fusionar con el renglón anterior;
- pegado de texto plano, undo/redo y atajos dentro del editor;
- selección local se conserva cuando paneles/controles roban foco;
- el host de OANIX es adaptador de persistencia (`loadBlocks`, `saveBlockChanges`, flush al cerrar), no autoridad de interacción del editor;
- escritura se agrupa por idle y no cifra/escribe por cada tecla;
- `EditorSurface` permanece como frontera reemplazable entre Home y editor.

No reconstruir o sustituir el editor salvo nueva solicitud explícita o defecto concreto demostrado.

### Bloques atómicos

Imagen, Daily Entry y otros bloques especiales se comportan como islas frente a selección/borrado:
- exterior `contenteditable=false` con identidad de bloque atómico;
- zonas locales editables usan hosts `contenteditable=true` independientes;
- borrar una selección que cruza bloques atómicos elimina solo texto normal seleccionado;
- no desmontar/recrear bloques especiales como estrategia normal de edición.

## 6. Persistencia incremental local — IMPLEMENTED

Las notas v2 usan unidades estables en lugar de reescribir toda la nota:
- `note.v2.meta` para metadata pequeña;
- `note.v2.manifest` para orden/referencias;
- `note.v2.text-chunk` para texto estable;
- objetivo aproximado de 16 Ki caracteres por chunk, evitando micro-registros;
- cambios localizados preservan unidades intactas cuando es posible;
- no-op evita cifrado/escritura innecesaria;
- lecturas cargan solo IDs referenciados por la nota;
- writes/deletes/tombstones y cola pendiente se coordinan atómicamente;
- `sync.v2.pending` deduplica por identidad determinista de unidad;
- datos legacy compatibles migran perezosamente sin borrado destructivo prematuro.

Regla permanente: imágenes/archivos son assets separados; cambiar metadata/descripción no vuelve a transferir el binario confirmado.

## 7. Sincronización incremental v2 + R2 — IMPLEMENTED / VALIDACIÓN REAL ACTUAL

PR #639–#641 sustituyeron como dirección activa al runtime legacy de sincronización.

Arquitectura vigente:
- Supabase conserva un índice remoto pequeño `sync_v2_records`, metadata/cursor y secuencia monotónica;
- R2 conserva payload cifrado detrás de un gateway privado;
- PWA/APK no reciben credenciales R2;
- `runV2IncrementalSync` consume `sync.v2.pending` y mueve únicamente unidades cambiadas;
- `V2AutoSyncRuntime` se monta solo con bóveda desbloqueada;
- intenta sync después de ~3 s de inactividad y consulta remoto cada 60 s;
- actividad, offline u ocultamiento cancelan/postergan trabajo;
- no aplicar cambios remotos mientras una nota esté abierta;
- después de aplicar remoto se refresca `RebuildApp` mediante `workspaceRevision`, sin `location.reload()`;
- carpetas y etiquetas producen revisiones/pending para crear, editar, reordenar y eliminar;
- fallos de red/auth/egress deben ser no destructivos y conservar contenido local + cola pendiente;
- una bóveda sin cambios no debe descargar payloads remotos innecesarios.

`AutoSyncRuntime` legacy y el escaneo completo de ciphertext **no deben reactivarse** para resolver problemas del flujo v2.

La siguiente deuda real es validación extremo a extremo en condiciones reales; el detalle exacto está en el checkpoint activo.

## 8. Imágenes y archivos

La experiencia histórica aprobada de imágenes se conserva como comportamiento de producto, pero sus runtimes legacy no se reactivan automáticamente.

Principios:
- originales y previews permanecen cifrados;
- previews temporales viven en memoria/Blob URL y se revocan cuando corresponde;
- bloques pesados referencian assets, no materializan binarios gigantes dentro del DOM.

### Archivos grandes — PRESERVADO / FUTURO

Objetivo inicial: **5 GB por archivo**, sin convertir 5 GB en techo arquitectónico.

Motor preservado:
- procesamiento secuencial por fragmentos (~8 MiB);
- AES-GCM por fragmento con IV independiente;
- SHA-256/manifiestos;
- checkpoint persistente y reanudación desde progreso remoto confirmado;
- subida/descarga por rangos;
- caché técnica separada;
- `OanixStorageProvider` como frontera de proveedor;
- Google Drive como primer proveedor demostrado, no dependencia conceptual.

`Liberar del dispositivo` debe seguir siendo distinto de `Eliminar de OANIX`.

La evolución de archivos dentro de notas, transferencias Android en segundo plano, video bajo demanda y proveedores adicionales permanece futura. No desplaza la validación actual de sync v2.

## 9. Producto y monetización

- Apariencia global activa: Día y Noche; presets/ambientes antiguos no son dirección activa.
- Identidad global base neutral; colores marcados pueden ser contextuales a carpetas/notas.
- No dividir por ahora OANIX en Free/Pro ni bloquear funciones artificialmente. Primero terminar un producto sólido; monetización futura se decide con evidencia de uso.

## 10. Regla de mantenimiento de esta memoria

Este archivo debe seguir siendo corto y durable:
- no acumular números de CI, HEADs transitorios ni cronologías de PRs;
- no duplicar el checkpoint o `CURRENT_STATE.md`;
- no conservar planes obsoletos como si fueran pendientes;
- mantener solo decisiones que todavía condicionen producto, compatibilidad, seguridad o arquitectura;
- usar `CHANGELOG.md`, PRs y Git para el historial detallado.
