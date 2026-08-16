# OANIX — Memoria operativa del proyecto

Este documento conserva decisiones, pendientes, cambios pospuestos y contexto de continuidad que no deben depender de un chat concreto.

Su propósito es permitir que otra IA o colaborador continúe OANIX sin reconstruir conversaciones anteriores ni inventar requisitos.

> Antes de usar este archivo, leer también `AGENTS.md` y verificar el estado actual de `main`.

---

## 1. Estado actual

**Última actualización:** 2026-08-16

**Versión activa:** V2 — Cuenta y sincronización

**V1 — Núcleo local:** CERRADA

**Completado en V2 según el estado actual del repositorio:**

- Cuenta de usuario.
- Autenticación.
- Backend de sincronización.
- Sincronización E2EE.
- Varios dispositivos.
- Autosync E2EE de registros no binarios.
- Autosync E2EE de imágenes originales y previews.
- Restauración de la bóveda sincronizada en un dispositivo nuevo mediante bootstrap cifrado.
- Realtime como aviso de cambios remotos, con comprobación periódica de respaldo.
- Protección contra sobrescritura silenciosa cuando hay divergencia concurrente.
- Primera fase de Resolución de conflictos no binarios integrada en `main` mediante PR #66.

**Bloque oficial activo:** Resolución de conflictos — `IN_PROGRESS`.

**Segunda fase implementada en PR #67:** resolución explícita de conflictos de imágenes originales y reconciliación automática de `image-preview` como dato derivado. Tests, build y auditoría offline pasan. El bloque no se considera cerrado hasta validarlo en uso real con dos dispositivos.

**Después del bloque actual:**

1. Historial de versiones.
2. Recuperación de acceso.

**No avanzar todavía:** V3 — Android con Capacitor ni V4 — Funciones avanzadas, salvo preparación arquitectónica estrictamente necesaria y registrada.

---

## 2. Forma de trabajo acordada

### 2.1 Desarrollo por versiones

OANIX se desarrolla estrictamente por versiones y en el orden oficial del roadmap.

Si aparece una idea que pertenece a otra versión, debe conservarse en este documento como `DEFERRED` en lugar de implementarse por impulso.

### 2.2 Modularidad

Cada función o componente debe ser lo suficientemente independiente para poder modificarse sin afectar innecesariamente al resto.

Esto no autoriza a crear una estructura excesiva de carpetas, capas, bases, stores o cachés. Se prefiere reutilizar de forma segura lo existente antes que crear sistemas paralelos.

### 2.3 Seguridad y datos

- Offline-first sigue siendo una propiedad fundamental.
- El contenido privado debe permanecer cifrado localmente.
- La sincronización debe conservar E2EE.
- La autenticación online no desbloquea por sí sola la bóveda.
- La contraseña maestra y la clave de bóveda sin cifrar no deben llegar al backend.
- Cuando exista incertidumbre durante una sincronización, conservar datos tiene prioridad sobre sobrescribir silenciosamente.

### 2.4 Continuidad entre IAs

Si el usuario entrega el repositorio a otra IA y dice «continuemos con lo que estaba», esa IA debe:

1. leer `AGENTS.md`;
2. leer `docs/ROADMAP.md`;
3. leer este documento;
4. contrastar `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y `docs/CHANGELOG.md`;
5. revisar el estado real de `main` antes de implementar;
6. no pedir al usuario que repita decisiones ya documentadas;
7. no inventar detalles que no estén definidos;
8. registrar cualquier nueva decisión, cambio, aplazamiento o excepción.

---

## 3. Registro de decisiones

### DEC-2026-08-16-001 — Resolución de conflictos multidispositivo

**Estado:** IN_PROGRESS

**Versión / bloque:** V2 — Resolución de conflictos

**Problema que resuelve:**

La misma nota o registro puede modificarse en dos dispositivos partiendo de una misma base antes de que ambos cambios se sincronicen entre sí. OANIX debe impedir que una de esas versiones legítimas desaparezca de forma silenciosa.

**Decisión funcional acordada para notas y registros combinables:**

Cuando exista un conflicto real, OANIX conserva ambas versiones y ofrece al usuario tres caminos principales:

1. **Usar esta versión.**
   - La versión seleccionada queda como resultado final.
   - La otra no se mezcla dentro del contenido final.

2. **Usar la otra versión.**
   - La versión seleccionada queda como resultado final.
   - La primera no se mezcla dentro del contenido final.

3. **Combinar ambas.**
   - OANIX conserva completos los contenidos de ambos lados.
   - Primero coloca la versión cuyo cambio fue **aceptado primero por la sincronización remota**.
   - En el renglón/párrafo siguiente coloca la segunda versión.
   - No inserta rótulos permanentes como «PC», «Teléfono», «Versión A» o «Versión B» dentro de la nota resultante.
   - La pantalla de resolución sí puede indicar temporalmente de qué lado proviene cada versión.

**Aclaración importante sobre el orden al combinar:**

No usar «el dispositivo que primero tuvo Internet» como criterio, porque no es una señal suficientemente fiable ni necesariamente observable. El criterio acordado es cuál cambio fue **aceptado primero por el sistema de sincronización remoto**. Debe utilizarse información controlada por el servidor/protocolo de sincronización y no el reloj local del dispositivo.

**Qué NO debe hacer OANIX al combinar:**

- No intentar un merge semántico palabra por palabra que pueda cambiar el significado.
- No inventar una tercera versión.
- No eliminar automáticamente fragmentos porque parezcan duplicados sin una regla segura y explícita.
- No convertir silenciosamente bloques estructurados a texto plano.
- No resolver con simple «último cambio gana» si eso implica pérdida silenciosa de una versión legítima.

**Bloques estructurados:**

Checklists, fichas de contacto y demás bloques estructurados deben conservar su tipo. Si no existe una combinación segura para un tipo, OANIX conserva las alternativas y pide una decisión explícita en lugar de degradar los datos.

**Principio rector:**

`detectar -> conservar -> mostrar -> usuario decide`

La combinación automática solo es aceptable cuando se pueda demostrar que no destruye ni altera de forma ambigua los cambios de ninguna de las partes.

#### Implementación — primera fase (PR #66, integrada en `main`)

- El centro de conflictos vive dentro de `features/sync/` y no modifica el editor principal para mantener modularidad.
- Los conflictos no binarios se reconstruyen usando la versión local cifrada, la fila remota y el `system.sync-state` cifrado existente; no se añadió IndexedDB, store, caché ni cola paralela.
- La pantalla ofrece la versión **Primera en sincronizarse** y la versión **Este dispositivo**.
- Elegir una versión aplica exactamente ese lado como resultado final.
- Antes de aplicar cualquier decisión, OANIX vuelve a comprobar el payload local y la versión remota esperada. Si otro dispositivo cambió algo mientras el usuario decidía, la operación se rechaza y el conflicto debe revisarse de nuevo.
- Las escrituras remotas continúan usando versión esperada para evitar sobrescrituras concurrentes.
- `Combinar ambas` está habilitado únicamente cuando ambos lados son la misma nota y no difieren en título, carpeta, etiquetas, estado fijado u orden manual. Si esos metadatos también cambiaron, el usuario debe elegir una de las versiones.
- Al combinar una nota compatible se conservan primero todos los bloques de la versión ya aceptada remotamente y después todos los bloques de la versión local.
- Los bloques locales reciben identificadores nuevos al incorporarse a la combinación para evitar colisiones, conservando su tipo y contenido estructurado.
- No se insertan rótulos permanentes dentro de la nota combinada.
- Eliminación contra contenido no admite `Combinar`; el usuario elige cuál estado conservar.
- Los conflictos anómalos que no pueden resolverse de forma segura se muestran/bloquean en lugar de adivinar.
- CI: pruebas, build y auditoría offline completados correctamente.

#### Implementación — segunda fase binaria (PR #67)

**Regla nueva y obligatoria:** `image` es el original autoritativo; `image-preview` es una optimización derivada y regenerable.

- Un conflicto de `image` se presenta en el mismo centro de conflictos.
- Para una imagen original se ofrecen **Usar esta versión** y **Usar la otra versión**.
- `Combinar ambas` permanece deshabilitado para imágenes: OANIX no inventa una mezcla gráfica entre dos originales.
- Al abrir el conflicto, las dos imágenes se descifran únicamente en memoria para comparación visual; las URLs temporales creadas para mostrarlas se revocan al cerrar o cambiar de conflicto.
- La comparación visual no crea archivos, stores, cachés ni copias persistentes en texto plano.
- Elegir el lado remoto descarga todos sus fragmentos cifrados, verifica SHA-256 por fragmento y longitud total, vuelve a verificar que la fila remota no cambió durante la descarga y solo entonces reemplaza la copia local.
- Elegir el lado local publica el original mediante fragmentos cifrados de 6 MiB, mantiene el manifiesto cifrado y usa versión remota esperada; si otro dispositivo cambió la fila, OANIX aborta sin sobrescribir.
- Cuando se reemplaza una imagen remota, los fragmentos anteriores se agregan a la misma cola cifrada/reintentable de limpieza usada por el autosync binario.
- Después de resolver el original, el `image-preview` del mismo `imageId` se invalida de ambos lados cuando corresponde y se deja regenerar desde el original elegido.
- Un conflicto independiente de `image-preview` no requiere una decisión del usuario: como el preview no es autoritativo, se invalida/reconcilia automáticamente en vez de mostrar dos conflictos por una sola foto.
- El estado binario sigue reutilizando `system.sync-state` con id `binary`; no existe persistencia paralela nueva.
- Los manifiestos y rutas remotas continúan siendo opacos; no se añade el nombre ni el tipo local de la imagen a la ruta del bucket.
- CI de esta fase: pruebas, build y auditoría offline completados correctamente antes de integrar.

#### Pendiente para cerrar Resolución de conflictos

La implementación automática está cubierta, pero **no marcar este bloque como terminado todavía**. Falta validación real con dos dispositivos usando la misma bóveda/cuenta.

Pruebas obligatorias antes de marcar `[x]` en `ROADMAP.md`:

1. **Nota — elegir primera en sincronizarse:** crear una divergencia real y comprobar que queda exactamente el lado remoto elegido.
2. **Nota — elegir este dispositivo:** crear otra divergencia y comprobar que el lado local se publica y llega al segundo dispositivo.
3. **Nota — combinar ambas:** con metadatos compatibles, comprobar que queda primero la versión aceptada remotamente y debajo la local, sin rótulos añadidos y conservando bloques estructurados.
4. **Cambio concurrente durante la decisión:** modificar desde el segundo dispositivo mientras el diálogo está abierto y comprobar que OANIX rechaza una resolución obsoleta en vez de sobrescribir.
5. **Imagen — elegir primera en sincronizarse:** provocar una divergencia de original, verificar visualmente ambos lados y confirmar que el remoto elegido queda igual en ambos dispositivos.
6. **Imagen — elegir este dispositivo:** repetir el caso eligiendo el original local y confirmar propagación al segundo dispositivo.
7. **Preview derivado:** después de resolver una imagen, comprobar que el preview se regenera desde el original elegido y que el autosync vuelve a estado sin conflicto.
8. **Eliminación contra modificación:** validar al menos un conflicto donde un lado elimina y el otro modifica, comprobando que la elección explícita se respeta.

Solo después de esas pruebas se puede cambiar `Resolución de conflictos` a completado y avanzar a **Historial de versiones**.

---

### DEC-2026-08-16-002 — Criterio de verdad para continuar el proyecto

**Estado:** DECIDED

Las conversaciones anteriores ayudan a entender intención, pero el repositorio debe ser la fuente persistente de continuidad.

Antes de cambiar código, una IA debe verificar el estado real de `main`. Si una memoria externa contradice el código o la documentación versionada, debe señalar la discrepancia y resolverla con evidencia antes de actuar.

---

### DEC-2026-08-16-003 — Memoria operativa dentro del repositorio

**Estado:** IMPLEMENTED

Se adopta el siguiente mecanismo:

- `AGENTS.md`: reglas estables de trabajo y protocolo de traspaso entre IAs.
- `docs/PROJECT_MEMORY.md`: decisiones, pendientes, aplazamientos, excepciones y continuidad detallada.
- `docs/ROADMAP.md`: orden y alcance oficial por versiones.
- `docs/CHANGELOG.md`: lo que efectivamente se implementó.

Esta documentación no forma parte de la lógica de ejecución de OANIX y no debe introducir comportamiento en la aplicación.

---

## 4. Registro de ideas y funciones diferidas

Toda petición válida que no corresponda al bloque actual debe añadirse aquí para evitar que se pierda.

### DEFERRED — Historial de versiones

**Versión:** V2

**Orden:** después de Resolución de conflictos.

**Estado:** pendiente de definición funcional detallada.

### DEFERRED — Recuperación de acceso

**Versión:** V2

**Orden:** después de Historial de versiones.

**Requisitos ya definidos:**

- cambiar la contraseña maestra debe reenvolver la misma clave de bóveda en lugar de volver a cifrar todas las notas;
- una bóveda sincronizada debe propagar la rotación de forma coherente entre dispositivos;
- Google/Supabase no pueden saltarse E2EE si se olvidó la contraseña maestra;
- la recuperación por olvido requerirá un mecanismo preparado previamente, como código/clave de recuperación protegido por el usuario;
- no almacenar contraseña maestra ni clave de bóveda en texto plano en Supabase.

### DEFERRED — V3 Android

Incluye Capacitor, APK/AAB, Android Keystore, biometría, cámara nativa, integración nativa de archivos y compartir hacia OANIX.

No implementar todavía.

### DEFERRED — V4 funciones avanzadas

Incluye PDF, audio, dibujos, tablas, OCR, compartir notas, personalización avanzada, avatar/foto opcional por nota e IA opcional con un modelo de privacidad definido.

No implementar todavía.

---

## 5. Excepciones de orden

Registrar aquí cualquier función implementada antes de su bloque oficial.

**Estado actual:** no hay una excepción nueva registrada en esta memoria.

Formato para futuras entradas:

- Fecha.
- Función.
- Versión a la que pertenecía.
- Motivo por el que se adelantó.
- Alcance exacto adelantado.
- Riesgos o deuda creada.
- PR/commit relacionado.
- Si modifica o no el orden posterior del roadmap.

---

## 6. Problemas o discrepancias que deben recordarse

### Repositorio actualmente público

**Estado:** ATTENTION

El repositorio aparece actualmente con visibilidad pública.

No cambiar visibilidad, permisos ni configuración sensible de GitHub sin una instrucción explícita del usuario. Si en el futuro se decide cambiar la visibilidad, registrar aquí la decisión y actualizar `AGENTS.md` si cambia la regla general.

---

## 7. Cómo registrar decisiones futuras

Añadir una entrada con este formato:

```md
### DEC-AAAA-MM-DD-NNN — Título corto

**Estado:** DECIDED | IN_PROGRESS | IMPLEMENTED | DEFERRED | SUPERSEDED | CANCELLED

**Versión / bloque:** ...

**Contexto:** ...

**Decisión:** ...

**Razón:** ...

**Qué no hacer:** ...

**Dependencias:** ...

**Estado de implementación:** ...

**PR / commit:** ...
```

Si una decisión cambia, no borrar la anterior. Marcarla como `SUPERSEDED` y enlazar o nombrar la decisión que la reemplaza.

---

## 8. Regla de cierre de cada trabajo

Antes de considerar terminado un bloque relevante, revisar:

- ¿Se implementó exactamente lo acordado?
- ¿Hay una decisión nueva que deba quedar aquí?
- ¿Se pospuso algo que podría olvidarse?
- ¿Se adelantó algo fuera de versión?
- ¿El roadmap cambió de estado?
- ¿El changelog refleja lo hecho?
- ¿Las pruebas/CI aplicables pasan?
- ¿Hay alguna discrepancia entre documentación y código que deba señalarse?

Si cualquiera de esas respuestas requiere contexto para el futuro, documentarlo antes de cerrar el trabajo.
