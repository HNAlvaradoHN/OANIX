# OANIX — Instrucciones para IA y agentes

Este archivo es la puerta de entrada obligatoria para cualquier IA, agente de código o colaborador que vaya a continuar OANIX.

## Repositorio canónico

- OANIX vive en `HNAlvaradoHN/OANIX`.
- La rama de autoridad es `main`.
- Toda consulta o modificación de OANIX debe comenzar explícitamente acotada a `HNAlvaradoHN/OANIX`.
- Si una herramienta abre, recuerda o sugiere otro repositorio, no usarlo para inferir estado de OANIX. Volver primero a `HNAlvaradoHN/OANIX`.
- No usar búsquedas globales de GitHub para descubrir el repositorio de OANIX cuando este archivo o la documentación de continuidad estén disponibles.

## Objetivo

El repositorio debe servir también como memoria operativa del proyecto. Si el usuario entrega únicamente el enlace de GitHub y dice algo como **«continuemos con lo que estaba»**, no se le debe pedir que reconstruya conversaciones anteriores si la información ya está registrada aquí o en la documentación de continuidad.

Antes de proponer o implementar un cambio, leer y contrastar:

1. `AGENTS.md` — reglas de trabajo y traspaso entre IAs.
2. `docs/OANIX_CHAT_PROTOCOL.md` — repositorio canónico, número rodante del chat y protocolo de arranque.
3. `docs/OANIX_ACTIVE_CHECKPOINT.md` — punto operativo único y siguiente acción exacta.
4. `docs/CURRENT_STATE.md` — checkpoint general actualizado para reanudar desde otro chat.
5. `docs/ROADMAP.md` — alcance oficial, versión activa y orden obligatorio.
6. `docs/PROJECT_MEMORY.md` — decisiones funcionales, pendientes, ideas diferidas, excepciones y contexto duradero; **no es autoridad para el número del chat**.
7. `docs/ARCHITECTURE.md` — arquitectura vigente.
8. `docs/SECURITY.md` — invariantes y modelo de seguridad.
9. `docs/CHANGELOG.md` — cambios ya realizados.
10. Código, issues, PRs y pruebas de `main` — verificación final del estado realmente implementado.

`docs/OANIX_CHAT_PROTOCOL.md` y `docs/OANIX_ACTIVE_CHECKPOINT.md` son las únicas autoridades documentales para identificar qué número OANIX corresponde al chat actual. Los números de chats anteriores pertenecen al historial de Git y no deben inferirse desde ejemplos, memoria duradera o documentos antiguos.

`docs/CURRENT_STATE.md` es un checkpoint operativo, no reemplaza los documentos históricos. Si contradice `main`, prevalece el repositorio real y debe corregirse el checkpoint.

No asumir que un chat, una memoria externa o una descripción antigua representa el estado actual. Verificar siempre `HNAlvaradoHN/OANIX`.

## Identidad y principios de OANIX

- El nombre oficial se escribe **OANIX**.
- OANIX es una aplicación de notas segura, offline-first y con cifrado local.
- La cuenta online es opcional; no sustituye la contraseña maestra.
- El transporte normal de sincronización mantiene E2EE y sobres opacos. La recuperación por correo es una excepción explícita del modelo de confianza documentada en `docs/PROJECT_MEMORY.md`.
- La misma base React + TypeScript + Vite/PWA está empaquetada también como aplicación Android mediante Capacitor; no mantener dos lógicas de negocio paralelas.
- La arquitectura debe ser modular: un cambio debe afectar lo mínimo posible al resto del sistema, sin crear una proliferación innecesaria de carpetas, stores, cachés o capas paralelas.
- Diseñar para escala real desde el inicio: notas muy extensas, miles de registros, muchas imágenes y archivos de varios GB no son casos extremos; son cargas esperadas que deben guiar render, almacenamiento, índices, memoria, cifrado y sincronización.
- Evitar algoritmos o consultas que recorran colecciones completas cuando exista una alternativa indexada/incremental. No cargar en RAM contenido grande que pueda procesarse por partes, ni re-renderizar/reprocesar una nota completa por cambios pequeños.
- Antes de aprobar una arquitectura nueva, revisar su complejidad y comportamiento con datos grandes, no solo con datasets de desarrollo pequeños.
- Antes de ejecutar una propuesta técnica importante del usuario, evaluarla con criterio propio: indicar si la dirección es correcta, qué riesgos reales tiene y si existe una alternativa mejor. No implementar mecánicamente una idea solo porque fue solicitada; priorizar el resultado técnico de OANIX.
- Regla de trabajo útil: no repetir cifrado, escritura, lectura, render, hash, subida o sincronización de datos que no cambiaron. Detectar no-op, agrupar operaciones compatibles, conservar revisiones/baselines, deduplicar pendientes y cancelar/postergar trabajo obsoleto cuando sea seguro.
- La eficiencia no justifica sobreingeniería: elegir granularidad y cachés que reduzcan trabajo real sin multiplicar estados, registros o complejidad de coordinación innecesariamente.
- Cada módulo debe tener una responsabilidad clara y vivir en la capa/carpeta que le corresponde. Evitar archivos monolíticos, lógica de dominio dentro de componentes visuales y utilidades genéricas usadas como cajón de sastre.
- Comentar decisiones, invariantes, fronteras, riesgos y motivos no obvios. No sobrecomentar líneas evidentes ni usar comentarios como sustituto de nombres claros, tipos o funciones pequeñas y bien separadas.
- Antes de añadir una nueva pieza, comprobar si pertenece a un módulo existente. Si una función crece hasta mezclar responsabilidades, separarla por comportamiento real, no por fragmentación artificial.
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

No borrar silenciosamente decisiones anteriores. Si cambian, marcarlas como sustituidas para conservar la trazabilidad. Esta regla aplica a decisiones de producto/arquitectura, no al contador rodante de chats: los números anteriores no deben conservarse como autoridad activa.

## Protocolo después de implementar

Al completar un cambio relevante:

1. verificar pruebas y CI aplicables;
2. actualizar la documentación de continuidad (`docs/OANIX_ACTIVE_CHECKPOINT.md`, `docs/CURRENT_STATE.md` y/o `docs/PROJECT_MEMORY.md` según corresponda);
3. actualizar `docs/CHANGELOG.md` cuando el cambio forme parte del historial de producto;
4. actualizar `docs/ROADMAP.md` cuando corresponda cambiar el estado oficial de un bloque;
5. mantener `AGENTS.md` estable salvo que cambien las reglas generales o su checkpoint de continuidad quede obsoleto.

La documentación de memoria no debe introducir lógica de ejecución ni modificar el comportamiento de la aplicación; es documentación de continuidad.

## Avance automático de ajustes pequeños

El usuario pidió explícitamente no detener el desarrollo por cambios pequeños y seguros. Si un ajuste es de bajo riesgo, local, no cambia seguridad/datos/alcance ni una decisión de producto importante y puede validarse con pruebas, corregirlo, probarlo, integrarlo y continuar con el siguiente trabajo útil.

Detenerse para pedir decisión únicamente cuando exista una alternativa real que cambie seguridad, datos, alcance o una experiencia importante.

## Regla operativa de GitHub

Cuando el agente tenga herramientas integradas de GitHub debe usarlas directamente para ramas, archivos, PRs, CI, logs, reintentos, merges, issues y artifacts. No convertir al usuario en operador de GitHub si la herramienta puede realizar la acción.

Todas esas operaciones deben dirigirse a `HNAlvaradoHN/OANIX` salvo instrucción explícita del usuario en sentido contrario.

Si una tarea requiere prueba física en Android, el agente debe llegar hasta generar/verificar el artifact y, cuando sus herramientas lo permitan, entregar la APK directamente al usuario. Nunca afirmar que un build fue probado físicamente si solo pasó CI.

## Prioridad operativa actual

La antigua secuencia RC/publicación quedó **SUPERSEDED** por la reconstrucción post-unlock decidida el 2026-08-31.

Orden vigente:
1. mantener seguridad/bootstrap/vault intactos;
2. reconstruir Home/editor/capa de notas sobre almacenamiento v2;
3. recuperar el editor aprobado con renglones perfectamente alineados;
4. validar el flujo local cifrado crear → escribir → guardar → reabrir;
5. completar personalización visual pendiente;
6. conectar después el nuevo coordinador de sincronización consciente de actividad;
7. reincorporar imágenes, archivos y demás capacidades preservadas por capas.

No reactivar workspace/runtimes visuales legacy para acelerar esta reconstrucción. Git conserva su historial si se necesita consultar una solución anterior.

## Estado de continuidad actual

El detalle operativo vivo no se duplica aquí. Consultar siempre `docs/OANIX_ACTIVE_CHECKPOINT.md` y verificarlo contra el `main` real antes de continuar.

Reglas permanentes:
- `RebuildApp` es la autoridad post-unlock mientras `main` no demuestre una sustitución posterior.
- `encrypted_records_v2` es el store cifrado v2 indexado y aditivo mientras `main` no demuestre una sustitución posterior.
- Seguridad, vault/session, cifrado y datos antiguos deben permanecer preservados.
- Toda UI nueva debe validarse en PC + móvil + Día + Noche.
- Un trabajo no se considera cerrado mientras CI, Android o Pages aplicables estén rojos; corregir y volver a validar hasta verde.

## Regla especial de traspaso entre IAs

Cuando una IA nueva reciba este proyecto:

- debe fijar primero `HNAlvaradoHN/OANIX` como repositorio canónico;
- debe leer `AGENTS.md`, `docs/OANIX_CHAT_PROTOCOL.md` y `docs/OANIX_ACTIVE_CHECKPOINT.md` antes de inferir número o siguiente acción;
- debe leer después `docs/CURRENT_STATE.md`, los documentos duraderos y el estado real de `main`;
- no debe inventar requisitos para llenar huecos;
- si encuentra contradicciones, debe señalarlas y usar evidencia del repo antes de actuar;
- no debe pedir al usuario que repita decisiones que ya estén registradas;
- debe registrar nuevas decisiones o pendientes antes de cerrar el trabajo correspondiente;
- si el usuario dice «esto después», «guardalo para otra versión» o equivalente, debe quedar registrado aunque no se implemente ahora.

## Visibilidad del repositorio

El repositorio aparece actualmente como público. No cambiar su visibilidad, permisos o configuración sensible sin una instrucción explícita del usuario.
