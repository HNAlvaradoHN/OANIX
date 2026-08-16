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

**Siguiente bloque oficial:** Resolución de conflictos.

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

**Estado:** DECIDED

**Versión / bloque:** V2 — Resolución de conflictos

**Problema que resuelve:**

La misma nota o registro puede modificarse en dos dispositivos partiendo de una misma base antes de que ambos cambios se sincronicen entre sí. OANIX ya evita sobrescribir silenciosamente una modificación concurrente; falta la interfaz y lógica final para que el usuario resuelva qué versión conservar.

**Decisión funcional acordada:**

Cuando exista un conflicto real, OANIX debe conservar ambas versiones y ofrecer al usuario tres caminos principales:

1. **Usar esta versión.**
   - La versión seleccionada queda como resultado final.
   - La otra no debe mezclarse dentro del contenido final.

2. **Usar la otra versión.**
   - La versión seleccionada queda como resultado final.
   - La primera no debe mezclarse dentro del contenido final.

3. **Combinar ambas.**
   - OANIX conserva completos los contenidos de ambos lados.
   - Primero se coloca la versión cuyo cambio fue **aceptado primero por la sincronización remota**.
   - En el renglón/párrafo siguiente se coloca la segunda versión.
   - No se deben insertar rótulos permanentes como «PC», «Teléfono», «Versión A» o «Versión B» dentro de la nota resultante.
   - La pantalla de resolución sí puede indicar temporalmente de qué dispositivo o lado proviene cada versión.

**Aclaración importante sobre el orden al combinar:**

No usar «el dispositivo que primero tuvo Internet» como criterio, porque no es una señal suficientemente fiable ni necesariamente observable. El criterio acordado es cuál cambio fue **aceptado primero por el sistema de sincronización remoto**. Debe utilizarse información controlada por el servidor/protocolo de sincronización y no el reloj local del dispositivo cuando se implemente el detalle técnico.

**Qué NO debe hacer OANIX al combinar:**

- No intentar un merge semántico palabra por palabra que pueda cambiar el significado.
- No inventar una tercera versión.
- No eliminar automáticamente fragmentos porque parezcan duplicados sin una regla segura y explícita.
- No convertir silenciosamente todos los bloques estructurados a texto plano.
- No resolver el conflicto con un simple «último cambio gana» si eso implica pérdida silenciosa de una versión legítima.

**Bloques estructurados:**

Checklists, fichas de contacto, imágenes u otros bloques estructurados deben conservar su tipo. La combinación puede necesitar reglas específicas por tipo de bloque; si no existe una combinación segura para un tipo, OANIX debe conservar ambas alternativas y pedir una decisión explícita en lugar de degradar los datos.

**Principio rector:**

`detectar -> conservar -> mostrar -> usuario decide`

La combinación automática solo es aceptable cuando se pueda demostrar que no destruye ni altera de forma ambigua los cambios de ninguna de las partes.

**Estado de implementación:** todavía pendiente. Este es el siguiente bloque oficial.

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

**Estado actual:** no hay una excepción nueva registrada en esta memoria al momento de crearla.

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
