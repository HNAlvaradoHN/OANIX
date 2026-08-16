# OANIX — Memoria operativa del proyecto

Este documento conserva decisiones, pendientes, cambios pospuestos y contexto de continuidad que no deben depender de un chat concreto.

Su propósito es permitir que otra IA o colaborador continúe OANIX sin reconstruir conversaciones anteriores ni inventar requisitos.

> Antes de usar este archivo, leer también `AGENTS.md`, `docs/ROADMAP.md` y verificar el estado real de `main`.

---

## 1. Estado actual

**Última actualización:** 2026-08-16

**Versión activa:** V2 — Cuenta y sincronización

**V1 — Núcleo local:** CERRADA

**Completado/implementado en V2:**
- Cuenta de usuario y autenticación.
- Backend de sincronización.
- Sincronización E2EE para el transporte normal.
- Varios dispositivos, Realtime y autosync.
- Imágenes/previews cifrados en sync.
- Resolución de conflictos integrada mediante PR #66 y #67; validación de campo restante en #69.
- Historial cifrado de versiones integrado mediante PR #71 y retención reducida a 5 mediante PR #72; validación funcional restante en #70.
- Base criptográfica de cambio de contraseña integrada mediante PR #74.

**Bloque oficial activo:** Recuperación de acceso — implementación por correo en PR #75; pendiente validación real del OTP, rotación y varios dispositivos en issue #73.

**Después del bloque actual:** cierre de V2 y, cuando corresponda, V3 — Android con Capacitor.

**No avanzar todavía:** V3 ni V4 salvo preparación arquitectónica estrictamente necesaria y registrada.

---

## 2. Forma de trabajo acordada

### 2.1 Desarrollo por versiones
OANIX se desarrolla estrictamente por versiones y en el orden oficial del roadmap. Las ideas futuras se documentan en vez de implementarse por impulso.

### 2.2 Modularidad
Reutilizar de forma segura lo existente antes que crear bases, stores, cachés o capas paralelas. Mantener módulos suficientemente independientes para modificar funciones sin afectar innecesariamente al resto.

### 2.3 Seguridad y datos
- Offline-first sigue siendo fundamental.
- El contenido privado permanece cifrado localmente.
- El transporte normal de sincronización mantiene E2EE y sobres opacos.
- Una sesión normal de Google/correo no desbloquea por sí sola la bóveda.
- **Excepción explícita:** por decisión del usuario, la recuperación por correo confía en el backend/proveedor de autenticación para recuperar temporalmente la misma clave de bóveda después de un OTP reciente. No describir este mecanismo como zero-knowledge frente al proveedor.
- La contraseña maestra no se guarda en Supabase.
- La clave de bóveda no se guarda en claro en tablas de cliente; el broker de recuperación la procesa temporalmente y conserva únicamente una envoltura cifrada bajo una raíz de servidor.
- Ante incertidumbre de sincronización, conservar datos tiene prioridad sobre sobrescribir silenciosamente.

### 2.4 Continuidad entre IAs
Una IA que continúe OANIX debe leer `AGENTS.md`, `ROADMAP.md`, esta memoria, `ARCHITECTURE.md`, `SECURITY.md` y `CHANGELOG.md`; verificar `main`; no pedir al usuario decisiones ya documentadas; no inventar requisitos; registrar cambios, aplazamientos y excepciones.

### 2.5 Avance automático de ajustes pequeños
El usuario pidió explícitamente no perder tiempo deteniéndose por ajustes pequeños. Cuando un cambio es local, de bajo riesgo, no altera seguridad/datos/alcance ni una decisión importante y puede validarse con pruebas, la IA debe corregirlo, probarlo y continuar automáticamente.

Sí debe pedir decisión cuando haya alternativas reales que cambien seguridad, datos, alcance o experiencia importante.

---

## 3. Registro de decisiones

### DEC-2026-08-16-001 — Resolución de conflictos multidispositivo
**Estado:** IMPLEMENTED / VALIDATION_DEBT

Cuando existe divergencia real OANIX conserva ambos lados y el usuario decide. Para notas compatibles puede elegir la versión sincronizada, la local o combinar ambas. La combinación conserva completos ambos contenidos: primero el cambio **aceptado primero por la sincronización remota** y luego el otro, sin merge semántico, sin rótulos permanentes y sin convertir bloques estructurados a texto plano. Principio: `detectar -> conservar -> mostrar -> usuario decide`.

PR #66 cubre conflictos no binarios y PR #67 imágenes originales/previews. La detección real fue comprobada; deuda restante en #69.

### DEC-2026-08-16-002 — Criterio de verdad
**Estado:** DECIDED

El repositorio es la fuente persistente de verdad. Conversaciones previas ayudan con intención, pero si contradicen código/documentación actual se debe resolver la discrepancia con evidencia.

### DEC-2026-08-16-003 — Memoria operativa en repositorio
**Estado:** IMPLEMENTED

`AGENTS.md` guarda reglas estables; `PROJECT_MEMORY.md` decisiones/pendientes; `ROADMAP.md` orden oficial; `CHANGELOG.md` implementación; issues de deuda/diferidos conservan contexto específico.

### DEC-2026-08-16-004 — Historial de versiones cifrado
**Estado:** IMPLEMENTED / VALIDATION_DEBT

- Snapshots `note-history` dentro de `encrypted_records`.
- Máximo 5 snapshots por nota; al sexto se elimina el más antiguo.
- Ventana automática mínima de 5 minutos.
- Centro `🕘`, vista previa y restauración con checkpoint `pre-restore`.
- Historial puede sincronizarse con transporte E2EE no binario.
- No duplica binarios históricos; si falta una imagen original requerida, bloquea la restauración en lugar de producir una nota incompleta.
- Al eliminar permanentemente una nota se elimina su historial.
- Validación real restante en #70.

### DEC-2026-08-16-005 — Recuperación con clave permanente bajo control del usuario
**Estado:** SUPERSEDED

La propuesta inicial era exigir una segunda clave/código de recuperación permanente guardado por el usuario para conservar un modelo donde el servidor no pudiera recuperar la bóveda. Esta propuesta fue descartada por el usuario por fricción de uso.

**Sustituida por:** DEC-2026-08-16-006.

### DEC-2026-08-16-006 — Recuperación de contraseña maestra por Email OTP
**Estado:** IN_PROGRESS / IMPLEMENTATION_READY_FOR_MERGE

**Versión / bloque:** V2 — Recuperación de acceso

**Referencia:** issue #73, PR #74 y PR #75.

**Decisión funcional definitiva:**
- Solo existe una contraseña maestra permanente para la bóveda sincronizada.
- No existe una segunda clave permanente que el usuario tenga que recordar o guardar.
- Si se olvida la contraseña: `Recuperar por correo` → código temporal al correo → introducir código → crear y confirmar obligatoriamente una nueva contraseña maestra.
- Un nuevo proceso futuro genera otro OTP; el código anterior no es una credencial permanente.
- El modo exclusivamente local no puede usar recuperación por correo.

**Cambio explícito del modelo de confianza:**
La comodidad de recuperación por correo implica confiar en el proveedor de autenticación/backend durante ese flujo. El transporte normal sigue cifrado/E2EE, pero la solución completa ya no es zero-knowledge frente al proveedor porque el broker puede recuperar temporalmente la clave de bóveda después de una autenticación OTP reciente.

**Implementación:**
- PR #74: reenvoltorio de la misma clave de bóveda al cambiar contraseña; no recifra todas las notas ni crea una segunda bóveda.
- PR #75: `EmailRecoveryPanel`, `recoveryService`, recuperación desde la pantalla de bóveda sincronizada, prueba criptográfica y backend versionado.
- Supabase producción: tablas `oanix_recovery_root` y `vault_recovery_envelopes`, RLS habilitado y sin grants directos a `anon`/`authenticated`.
- Edge Function `vault-recovery-broker`, `verify_jwt=true`.
- `status`: consulta si la recuperación está preparada.
- `register`: prepara/rota la envoltura; una recuperación ya preparada no puede reemplazarse con una clave de bóveda diferente desde una sesión normal.
- `recover`: exige JWT válido cuyo método AMR más reciente sea `otp` y tenga como máximo 10 minutos.
- OANIX prepara automáticamente la recuperación después de una entrada correcta a la bóveda sincronizada con la contraseña vigente.
- Tras recuperación aumenta `securityGeneration`, actualiza el bootstrap con versión esperada y restaura la misma bóveda con la nueva contraseña.
- La recuperación reutiliza la misma clave de bóveda: no recifra cada nota.

**Validación pendiente antes de cerrar V2:**
1. Confirmar que el email de Supabase muestra código numérico; la plantilla debe incluir `{{ .Token }}` y no solo Magic Link.
2. Entrar una vez normalmente para preparar recuperación.
3. Recuperar con OTP real y contraseña nueva.
4. Confirmar mismas notas/imágenes.
5. Confirmar que la contraseña anterior ya no abre el bootstrap sincronizado y la nueva sí.
6. Validar en segundo dispositivo.
7. Comprobar que un OTP usado no se reutiliza.
8. Comprobar comportamiento de un dispositivo que estuvo offline durante la rotación.

**Limitación física:** un dispositivo completamente offline puede conservar una copia local que todavía acepte la contraseña antigua. No prometer revocación instantánea de una copia local desconectada.

---

## 4. Ideas y funciones diferidas

### DEFERRED — Protección opcional por nota + sesión de desbloqueo
**Referencia:** issue #68.

Decisiones ya tomadas:
- El título real de una nota protegida permanece visible por defecto con indicador `🔒`.
- Mientras está bloqueada no muestra preview, contenido ni coincidencias internas de búsqueda.
- Búsqueda por título sí puede localizarla.
- Ocultar también el título podría ser opción futura, no predeterminada.
- Se estudia contraseña por nota y política configurable de re-bloqueo.
- Se estudia auto-bloqueo general al permanecer OANIX en segundo plano.
- Bloqueo físico exacto del dispositivo, biometría y Keystore quedan para V3 Android si es fiable.

No implementar antes de asignarlo formalmente después de cerrar el alcance actual de V2.

### DEFERRED — V3 Android
Capacitor, APK/AAB, Android Keystore, biometría, cámara nativa, archivos nativos y compartir hacia OANIX.

### DEFERRED — V4 funciones avanzadas
PDF, audio, dibujos, tablas, OCR, compartir notas, personalización avanzada, avatar/foto opcional por nota e IA opcional con modelo de privacidad definido.

---

## 5. Excepciones de orden

### Avance desde Resolución de conflictos con deuda de validación
Por decisión explícita del usuario se inició Historial de versiones sin completar todas las pruebas reales de conflictos. Deuda #69. No afirmar pruebas que no ocurrieron.

### Avance desde Historial de versiones con deuda de validación
Por decisión explícita del usuario se inició Recuperación de acceso con Historial ya implementado/publicado pero sin completar toda la prueba real. Deuda #70. Cualquier regresión se corrige antes de cerrar V2.

---

## 6. Problemas o discrepancias a recordar

### Repositorio actualmente público
**Estado:** ATTENTION

El repositorio aparece actualmente con visibilidad pública. No cambiar visibilidad, permisos ni configuración sensible sin instrucción explícita del usuario.

### Plantilla Email OTP de Supabase
**Estado:** VALIDATION_REQUIRED

La implementación espera un código numérico. Supabase envía OTP numérico cuando la plantilla de correo usa `{{ .Token }}`. Las herramientas conectadas actuales no exponen edición de esa plantilla; comprobarlo en prueba real antes de declarar recuperación cerrada.

---

## 7. Regla de cierre

Antes de cerrar un bloque relevante revisar: implementación exacta, nuevas decisiones, pendientes, excepciones, roadmap, changelog, CI y discrepancias. Cualquier contexto necesario para continuidad debe quedar documentado antes del cierre.
