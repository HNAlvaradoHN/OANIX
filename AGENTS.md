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
- La contraseña maestra y la clave de bóveda no se persisten en texto plano. Las integraciones nativas deben respetar las fronteras de seguridad registradas para Android Keystore, biometría y temporales nativos.

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

## Estado de continuidad actual

A fecha de **2026-08-16**:

- V1 — Núcleo local: cerrada.
- V2 — Cuenta y sincronización: implementación funcional completada y se avanzó a V3; continúan deudas de validación visibles en #69, #70 y #73.
- Versión activa: **V3 — Android con Capacitor**.
- Capacitor: completado en PR #81.
- APK/AAB: completado en PR #82; APK instalada en Android real y modo local validado. El flujo Android online/sincronizado todavía no se declara validado.
- Android Keystore: base integrada en PR #83; prueba específica de campo pendiente.
- Biometría/credencial del dispositivo: integrada en PR #84 con autenticación por uso, biometría fuerte o bloqueo seguro del dispositivo y contraseña maestra como fallback; validación real en teléfono pendiente.
- Cámara nativa: implementada en PR #86 reutilizando el pipeline cifrado de imágenes; CI web y compilación APK/AAB pasaron, validación real en teléfono pendiente.
- **Siguiente bloque oficial: Integración nativa de archivos.**
- Después: compartir hacia OANIX.
- No avanzar a V4 antes de cerrar V3 salvo preparación arquitectónica explícitamente justificada y registrada.

La especificación exacta, deudas y decisiones de seguridad están en `docs/PROJECT_MEMORY.md` e issue #79.

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
