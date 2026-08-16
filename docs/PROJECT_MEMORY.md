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
- Resolución de conflictos no binarios integrada mediante PR #66.
- Resolución de conflictos de imágenes originales y previews derivados integrada mediante PR #67.
- Historial cifrado de versiones integrado mediante PR #71.

**Resolución de conflictos:** implementación completa. La detección de divergencia fue validada en dos dispositivos; las pruebas reales restantes quedaron registradas como deuda visible en issue #69 por decisión explícita del usuario de continuar sin frenar el desarrollo.

**Bloque oficial activo:** Historial de versiones — implementación publicada; validación funcional real pendiente en issue #70.

**Después del bloque actual:** Recuperación de acceso.

**No avanzar todavía:** V3 — Android con Capacitor ni V4 — Funciones avanzadas, salvo preparación arquitectónica estrictamente necesaria y registrada.

---

## 2. Forma de trabajo acordada

### 2.1 Desarrollo por versiones

OANIX se desarrolla estrictamente por versiones y en el orden oficial del roadmap.

Si aparece una idea que pertenece a otra versión, debe conservarse en este documento o en un issue `[DEFERRED][PROJECT_MEMORY]` en lugar de implementarse por impulso.

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

**Estado:** IMPLEMENTED / VALIDATION_DEBT

**Versión / bloque:** V2 — Resolución de conflictos

**Problema que resuelve:**

La misma nota o registro puede modificarse en dos dispositivos partiendo de una misma base antes de que ambos cambios se sincronicen entre sí. OANIX debe impedir que una de esas versiones legítimas desaparezca de forma silenciosa.

**Decisión funcional acordada para notas y registros combinables:**

Cuando exista un conflicto real, OANIX conserva ambas versiones y ofrece al usuario tres caminos principales:

1. **Usar esta versión.** La versión seleccionada queda como resultado final y la otra no se mezcla dentro del contenido final.
2. **Usar la otra versión.** La versión seleccionada queda como resultado final.
3. **Combinar ambas.** OANIX conserva completos los contenidos de ambos lados; primero coloca la versión cuyo cambio fue aceptado primero por la sincronización remota y después la segunda, sin insertar rótulos permanentes.

No usar «el dispositivo que primero tuvo Internet» como criterio. El criterio es cuál cambio fue aceptado primero por el sistema de sincronización remoto.

**Qué NO debe hacer OANIX al combinar:**

- No intentar un merge semántico palabra por palabra que pueda cambiar el significado.
- No inventar una tercera versión.
- No eliminar automáticamente fragmentos porque parezcan duplicados sin una regla segura y explícita.
- No convertir silenciosamente bloques estructurados a texto plano.
- No resolver con simple «último cambio gana» si eso implica pérdida silenciosa.

**Principio rector:** `detectar -> conservar -> mostrar -> usuario decide`.

**Implementación:**

- PR #66: centro de conflictos no binarios, elección explícita y combinación segura de notas compatibles.
- PR #67: conflictos de imágenes originales; `image-preview` queda como dato derivado y regenerable.
- CI, build y auditoría offline pasaron antes de integrar ambas fases.
- La detección de divergencia real ya fue comprobada por el usuario en dos dispositivos.
- Deuda de validación de campo restante: issue #69. No afirmar que esas pruebas pendientes se realizaron hasta hacerlo realmente.

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
- Issues con prefijo `[DEFERRED][PROJECT_MEMORY]` o `[VALIDATION DEBT]`: contexto detallado que todavía no debe darse por cerrado.

Esta documentación no forma parte de la lógica de ejecución de OANIX y no debe introducir comportamiento en la aplicación.

---

### DEC-2026-08-16-004 — Historial de versiones cifrado

**Estado:** IMPLEMENTED / VALIDATION_DEBT

**Versión / bloque:** V2 — Historial de versiones

**Objetivo:** poder recuperar estados anteriores de una nota sin romper E2EE, offline-first ni crear almacenamiento paralelo.

**Decisiones implementadas en PR #71:**

- Los snapshots se guardan bajo el tipo cifrado `note-history` dentro del mismo `encrypted_records` existente.
- Cada snapshot conserva una copia completa de `NoteRecord`; no se modifica el schema `NoteRecord.version = 1` solo para añadir historial.
- Los snapshots son elegibles para el autosync E2EE no binario existente, por lo que el historial puede viajar con la bóveda sincronizada.
- Retención actual: máximo 5 snapshots por nota. La implementación inicial se publicó con 30; el usuario decidió reducirla posteriormente a 5 para mantener la lista corta y útil. Al crear un sexto punto, se elimina el más antiguo y permanecen los cinco más recientes.
- Coalescencia automática: una ventana de 5 minutos evita crear una versión por cada autoguardado/tecla.
- Solo se crea snapshot cuando existe un cambio real.
- Todas las mutaciones normales de una nota pasan por la captura centralizada anterior a la modificación.
- Un fallo al escribir historial no debe impedir guardar el estado actual de la nota; se emite una advertencia interna en vez de sacrificar el guardado principal.
- La interfaz inicial es un Centro de historial accesible desde la cabecera de OANIX (`🕘`), con selector de nota, lista cronológica, fecha/hora, motivo y vista previa legible.
- La versión seleccionada se revisa en modo solo lectura antes de restaurar.
- `Restaurar esta versión` pide confirmación y crea primero un checkpoint `pre-restore`, haciendo la restauración reversible.
- Antes de abrir el centro de historial, OANIX fuerza el blur/guardado de la nota visible y espera a que desaparezca el estado `Cambios pendientes/Guardando`, evitando perder un cambio recién escrito.
- Si una versión histórica referencia una imagen original que ya no existe localmente, la restauración se bloquea con un error explícito en lugar de producir una nota incompleta.
- La disponibilidad de la imagen se comprueba por existencia del registro cifrado sin descifrar/cargar todo el binario en memoria.
- Al eliminar una nota completa, también se elimina su historial para no dejar versiones huérfanas que no tienen una superficie de recuperación definida.
- Las imágenes NO se duplican dentro de cada snapshot; los snapshots conservan `imageId`.

**Limitación consciente de esta primera implementación:**

Una imagen que el usuario eliminó de la nota puede haber sido eliminada también del almacenamiento binario actual. Por eso una versión antigua que todavía la referencia puede quedar no restaurable de forma completa; OANIX lo detecta y bloquea la restauración. No inventar que existe retención histórica de binarios hasta implementar explícitamente una política/GC de imágenes históricas.

**Estado de validación:**

- PR #71 fue integrado y publicado después de pasar pruebas automáticas, build y auditoría offline.
- Falta prueba funcional real registrada en #70: editar una nota, generar al menos dos snapshots, abrir el centro, revisar una versión, restaurarla y confirmar que el checkpoint pre-restauración permite volver al estado previo.

---

## 4. Registro de ideas y funciones diferidas

### DEFERRED — Protección opcional por nota + sesión de desbloqueo

**Referencia:** issue #68.

Decisiones ya tomadas:

- Una nota protegida mantiene visible su título real por defecto para poder identificarla rápidamente.
- Mientras está bloqueada no muestra preview, fragmentos de contenido ni coincidencias internas de búsqueda.
- Puede mostrar `🔒` junto al título.
- Ocultar también el título puede existir como opción futura de privacidad reforzada, pero no será el comportamiento predeterminado.
- Se estudia contraseña libre por nota y política configurable de re-bloqueo.
- Se estudia bloqueo automático general de OANIX tras permanecer en segundo plano, evitando pedir la contraseña maestra por cambios breves entre aplicaciones.
- La detección exacta de bloqueo físico del dispositivo y biometría/Keystore quedan para V3 Android si la integración nativa lo permite.

No implementar antes de asignarlo formalmente a un bloque después de cerrar el alcance actual de V2.

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

### 2026-08-16 — Avance desde Resolución de conflictos con deuda de validación

- **Función:** inicio de Historial de versiones antes de completar todas las pruebas reales de campo de Resolución de conflictos.
- **Motivo:** decisión explícita del usuario de no frenar el desarrollo una vez completada la implementación y validada la detección real de divergencia.
- **Deuda creada:** issue #69.
- **Regla:** no afirmar que las pruebas pendientes de #69 ocurrieron; si aparece una regresión de conflictos, corregirla antes de cerrar V2.
- **Orden posterior:** no cambia; Historial de versiones sigue antes de Recuperación de acceso.

---

## 6. Problemas o discrepancias que deben recordarse

### Repositorio actualmente público

**Estado:** ATTENTION

El repositorio aparece actualmente con visibilidad pública.

No cambiar visibilidad, permisos ni configuración sensible de GitHub sin una instrucción explícita del usuario.

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
