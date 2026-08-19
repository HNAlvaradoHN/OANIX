# OANIX — Instrucciones para IA y agentes

Este archivo es la puerta de entrada obligatoria para cualquier IA, agente de código o colaborador que vaya a continuar OANIX.

## Objetivo

El repositorio debe servir también como memoria operativa del proyecto. Si el usuario entrega únicamente el enlace de GitHub y dice algo como **«continuemos con lo que estaba»**, no se le debe pedir que reconstruya conversaciones anteriores si la información ya está registrada aquí o en la documentación de continuidad.

Antes de proponer o implementar un cambio, leer y contrastar:

1. `AGENTS.md` — reglas de trabajo y traspaso entre IAs.
2. `docs/CURRENT_STATE.md` — checkpoint corto y actualizado para reanudar desde otro chat.
3. `docs/ROADMAP.md` — alcance oficial, versión activa y orden obligatorio.
4. `docs/PROJECT_MEMORY.md` — decisiones funcionales, pendientes, ideas diferidas, excepciones y contexto histórico de continuidad.
5. `docs/ARCHITECTURE.md` — arquitectura vigente.
6. `docs/SECURITY.md` — invariantes y modelo de seguridad.
7. `docs/CHANGELOG.md` — cambios ya realizados.
8. Código, issues, PRs y pruebas de `main` — verificación final del estado realmente implementado.

`docs/CURRENT_STATE.md` es un checkpoint operativo, no reemplaza los documentos históricos. Si contradice `main`, prevalece el repositorio real y debe corregirse el checkpoint.

No asumir que un chat, una memoria externa o una descripción antigua representa el estado actual. Verificar siempre el repositorio.

## Identidad y principios de OANIX

- El nombre oficial se escribe **OANIX**.
- OANIX es una aplicación de notas segura, offline-first y con cifrado local.
- La cuenta online es opcional; no sustituye la contraseña maestra.
- El transporte normal de sincronización mantiene E2EE y sobres opacos. La recuperación por correo es una excepción explícita del modelo de confianza documentada en `docs/PROJECT_MEMORY.md`.
- La misma base React + TypeScript + Vite/PWA está empaquetada también como aplicación Android mediante Capacitor; no mantener dos lógicas de negocio paralelas.
- La arquitectura debe ser modular: un cambio debe afectar lo mínimo posible al resto del sistema, sin crear una proliferación innecesaria de carpetas, stores, cachés o capas paralelas.
- No crear persistencia paralela cuando pueda reutilizarse de forma segura el modelo existente.
- Ante una duda de sincronización, se prioriza conservar datos sobre sobrescribirlos silenciosamente.
- La contraseña maestra y la clave de bóveda no se persisten en texto plano. Las integraciones nativas deben respetar las fronteras de seguridad registradas para Android Keystore, biometría y temporales/URIs nativos.

## Regla de versiones

OANIX se desarrolla estrictamente por versiones y en el orden de `docs/ROADMAP.md`.

Si el usuario propone una función de una versión futura:

1. indicar con claridad a qué versión pertenece;
2. no implementarla antes de tiempo, salvo preparación arquitectónica estrictamente necesaria y documentada;
3. registrarla en `docs/PROJECT_MEMORY.md` como `DEFERRED`, incluyendo versión objetivo y lo acordado;
4. continuar con el bloque oficial activo.

Si por una razón válida se implementa algo fuera de orden, debe quedar registrado en `docs/PROJECT_MEMORY.md` como una **excepción de orden**, con fecha, motivo, alcance y efecto sobre el roadmap.

## Protocolo de decisiones

Toda decisión relevante conversada con el usuario debe sobrevivir al chat.

Actualizar `docs/PROJECT_MEMORY.md` o el checkpoint vigente cuando ocurra cualquiera de estos casos:

- se define cómo debe funcionar una característica;
- se modifica una decisión anterior;
- se descarta una idea;
- se pospone una función para otra versión;
- aparece un problema conocido que aún no se resolverá;
- se implementa algo que estaba pendiente;
- se adelanta excepcionalmente una función;
- se detecta una discrepancia entre intención, documentación y código.

Usar estados consistentes:

- `DECIDED`: lógica acordada, todavía no necesariamente implementada.
- `IN_PROGRESS`: implementación activa.
- `IMPLEMENTED`: existe en código y debe verificarse con pruebas/estado del repositorio.
- `VALIDATION_DEBT`: implementación existente cuya validación real restante sigue visible y no debe inventarse.
- `DEFERRED`: aceptado o solicitado, pero reservado para una versión/bloque posterior.
- `SUPERSEDED`: reemplazado por una decisión posterior; conservar el historial y señalar la nueva decisión.
- `CANCELLED`: se decidió no hacerlo.

No borrar silenciosamente decisiones anteriores. Si cambian, marcarlas como sustituidas para conservar la trazabilidad.

## Protocolo después de implementar

Al completar un cambio relevante:

1. verificar pruebas y CI aplicables;
2. actualizar la documentación de continuidad (`docs/CURRENT_STATE.md` y/o `docs/PROJECT_MEMORY.md` según corresponda);
3. actualizar `docs/CHANGELOG.md` cuando el cambio forme parte del historial de producto;
4. actualizar `docs/ROADMAP.md` cuando corresponda cambiar el estado oficial de un bloque;
5. mantener `AGENTS.md` estable salvo que cambien las reglas generales o su checkpoint de continuidad quede obsoleto.

La documentación de memoria no debe introducir lógica de ejecución ni modificar el comportamiento de la aplicación; es documentación de continuidad.

## Avance automático de ajustes pequeños

El usuario pidió explícitamente no detener el desarrollo por cambios pequeños y seguros. Si un ajuste es de bajo riesgo, local, no cambia seguridad/datos/alcance ni una decisión de producto importante y puede validarse con pruebas, corregirlo, probarlo, integrarlo y continuar con el siguiente trabajo útil.

Detenerse para pedir decisión únicamente cuando exista una alternativa real que cambie seguridad, datos, alcance o una experiencia importante.

## Regla operativa de GitHub

Cuando el agente tenga herramientas integradas de GitHub debe usarlas directamente para ramas, archivos, PRs, CI, logs, reintentos, merges, issues y artifacts. No convertir al usuario en operador de GitHub si la herramienta puede realizar la acción.

Si una tarea requiere prueba física en Android, el agente debe llegar hasta generar/verificar el artifact y, cuando sus herramientas lo permitan, entregar la APK directamente al usuario. Nunca afirmar que un build fue probado físicamente si solo pasó CI.

## Secuencia acordada para cerrar RC y publicación

La secuencia vigente es deliberada:

1. cerrar las validaciones funcionales visibles del RC, sin introducir nuevas funciones por impulso;
2. mantener estable la dirección visual ya aprobada;
3. validar en Android real los cambios que lo requieran;
4. corregir el pendiente biométrico #105 durante pulido Android/RC sin debilitar seguridad;
5. cerrar el checklist RC #124;
6. preparar identidad/firma release/AAB/publicación bajo #125.

No adelantar V4, monetización u OANIX Pro mientras existan deudas RC activas, salvo preparación arquitectónica explícitamente justificada y documentada.

## Estado de continuidad actual

A fecha de **2026-08-18**:

- V1 — Núcleo local: cerrada.
- V2 — Cuenta y sincronización: cerrada funcionalmente; continúan deudas de validación visibles, especialmente #69, #70 y #73.
- V3 — Android con Capacitor: cerrada formalmente en issue #79.
- Firma debug estable: configurada y validada por CI; se comprobó físicamente una actualización APK sobre APK sin desinstalar. No confundirla con la futura firma definitiva de Play Store.
- Rediseño visual post-V3: dirección aprobada e integrada; existen temas/personalización y pulidos de tarjetas, menús y editor.
- Privacidad por nota + Caja privada: implementadas; issue #68 permanece abierto únicamente por validación física final.
- PR #133 añadió relock manual de una nota protegida durante la sesión usando el mismo `unlockedNoteIds` en memoria.
- Ajuste visual siguiente: PR #134 / rama `fix/note-row-session-lock` mueve el candado visible a la tarjeta de la nota, mantiene ellipsis y no crea estado/persistencia paralelos. Consultar `docs/CURRENT_STATE.md` para los detalles exactos y su estado más reciente.
- Deuda Android diferida: #105 — la huella puede tardar 2–3 cold starts. Resolver durante pulido Android/RC; no reducir requisitos de seguridad biométrica para ocultarlo.
- Después de cerrar #68, el siguiente bloque técnico prioritario es la validación de conflictos #69.
- #124 concentra el Release Candidate; #125 la preparación de publicación.

## Regla especial de traspaso entre IAs

Cuando una IA nueva reciba este repositorio:

- debe leer `AGENTS.md` y `docs/CURRENT_STATE.md` primero, después los documentos históricos y el estado real de `main`;
- no debe inventar requisitos para llenar huecos;
- si encuentra contradicciones, debe señalarlas y usar evidencia del repo antes de actuar;
- no debe pedir al usuario que repita decisiones que ya estén registradas;
- debe registrar nuevas decisiones o pendientes antes de cerrar el trabajo correspondiente;
- si el usuario dice «esto después», «guardalo para otra versión» o equivalente, debe quedar registrado aunque no se implemente ahora.

## Visibilidad del repositorio

El repositorio aparece actualmente como público. No cambiar su visibilidad, permisos o configuración sensible sin una instrucción explícita del usuario.
