# OANIX — Instrucciones para IA y agentes

Este archivo es la puerta de entrada obligatoria para cualquier IA, agente de código o colaborador que vaya a continuar OANIX.

## Objetivo

El repositorio debe servir también como memoria operativa del proyecto. Si el usuario entrega únicamente el enlace de GitHub y dice algo como **«continuemos con lo que estaba»**, no se le debe pedir que reconstruya conversaciones anteriores si la información ya está registrada aquí o en `docs/PROJECT_MEMORY.md`.

Antes de proponer o implementar un cambio, leer y contrastar:

1. `AGENTS.md` — reglas de trabajo y traspaso entre IAs.
2. `docs/ROADMAP.md` — alcance oficial, versión activa y orden obligatorio.
3. `docs/PROJECT_MEMORY.md` — decisiones funcionales, pendientes, ideas diferidas, excepciones y contexto de continuidad.
4. `docs/ARCHITECTURE.md` — arquitectura vigente.
5. `docs/SECURITY.md` — invariantes y modelo de seguridad.
6. `docs/CHANGELOG.md` — cambios ya realizados.
7. Código y pruebas de `main` — verificación final del estado realmente implementado.

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

Actualizar `docs/PROJECT_MEMORY.md` cuando ocurra cualquiera de estos casos:

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
2. actualizar `docs/CHANGELOG.md`;
3. actualizar `docs/ROADMAP.md` cuando corresponda cambiar el estado oficial de un bloque;
4. actualizar `docs/PROJECT_MEMORY.md` con el resultado, incluyendo cualquier desviación de lo acordado;
5. mantener `AGENTS.md` estable salvo que cambien las reglas generales de trabajo o su estado de continuidad quede obsoleto.

La documentación de memoria no debe introducir lógica de ejecución ni modificar el comportamiento de la aplicación; es documentación de continuidad.

## Avance automático de ajustes pequeños

El usuario pidió explícitamente no detener el desarrollo por cambios pequeños y seguros. Si un ajuste es de bajo riesgo, local, no cambia seguridad/datos/alcance ni una decisión de producto importante y puede validarse con pruebas, corregirlo, probarlo, integrarlo y continuar con el siguiente trabajo útil.

Detenerse para pedir decisión únicamente cuando exista una alternativa real que cambie seguridad, datos, alcance o una experiencia importante.

## Secuencia acordada para cerrar V3 y diseñar la interfaz

La secuencia vigente es deliberada:

1. terminar y validar primero todas las funciones y correcciones funcionales pertenecientes a V3, incluidas las que solo pueden verificarse en Android real;
2. congelar la lógica funcional de V3 salvo bugs reales;
3. hacer después un rediseño/pulido visual completo principalmente sobre la PWA, porque comparte la misma base React con Android y permite iterar más rápido en móvil/tablet/PC;
4. generar una APK consolidada para validar las diferencias nativas del diseño ya estabilizado;
5. cerrar firma, icono/splash, `appId` y preparación de publicación.

No adelantar cambios puramente visuales mientras todavía se estén cerrando fallos funcionales Android, salvo UI mínima necesaria para operar/probar una función.

## Estado de continuidad actual

A fecha de **2026-08-17**:

- V1 — Núcleo local: cerrada.
- V2 — Cuenta y sincronización: cerrada funcionalmente; continúan deudas de validación visibles en #69, #70 y #73.
- Versión activa: **V3 — Android con Capacitor**.
- Capacitor PR #81 y empaquetado APK/AAB PR #82 completados; modo local Android validado.
- Android Keystore PR #83 implementado; prueba específica `seal/open` pendiente.
- Huella / acceso rápido: PR #84 + #88/#89/#90; reapertura, cancelación y reintento manual por huella validados en teléfono real.
- Cámara nativa PR #86 y archivos nativos PR #87: implementación y prueba funcional básica real completadas.
- Compartir hacia OANIX: PR #91 + #92/#93. PR #93 usa cola de intents solo en memoria, soporta entregas repetidas con Activity viva, muestra progreso local y abre la nota al finalizar; falta validación consolidada en teléfono.
- PR #94 implementa la navegación Android Atrás/salida segura y una acción explícita `Usar PIN o patrón del teléfono` mediante `DEVICE_CREDENTIAL`, reutilizando la misma envoltura cifrada de acceso rápido. Implementación/CI completas; falta prueba real.
- En una nota, Back debe guardar y volver a la lista. Desde la lista, primer Back pregunta si se desea salir; segundo Back con la confirmación visible sale.
- El flujo Android online/sincronizado todavía no se declara validado.
- Las APK debug de CI aún no tienen firma de pruebas estable, por lo que una build nueva puede exigir desinstalar la anterior.
- El icono/appId siguen provisionales antes de publicación.
- **Bloque inmediato:** validación consolidada en teléfono de PR #93/#94.
- Después: cuenta/sync Android → firma estable de pruebas → congelar funcionalidad V3 → rediseño visual completo en PWA → APK visual consolidada → publicación.
- No avanzar a V4 antes de cerrar V3 salvo preparación arquitectónica explícitamente justificada y registrada.

La especificación exacta, deudas y decisiones de seguridad están en `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md` e issue #79.

## Regla especial de traspaso entre IAs

Cuando una IA nueva reciba este repositorio:

- debe leer los documentos anteriores antes de diseñar cambios;
- no debe inventar requisitos para llenar huecos;
- si encuentra contradicciones, debe señalarlas y usar evidencia del repo antes de actuar;
- no debe pedir al usuario que repita decisiones que ya estén registradas;
- debe registrar nuevas decisiones o pendientes antes de cerrar el trabajo correspondiente;
- si el usuario dice «esto después», «guardalo para otra versión» o equivalente, debe quedar registrado aunque no se implemente ahora.

## Visibilidad del repositorio

El repositorio aparece actualmente como público. No cambiar su visibilidad, permisos o configuración sensible sin una instrucción explícita del usuario.
