# OANIX — Instrucciones para IA y agentes

Este archivo es la puerta de entrada obligatoria para cualquier IA, agente de código o colaborador que continúe OANIX.

## Repositorio canónico

- Repositorio: `HNAlvaradoHN/OANIX`.
- Rama de autoridad: `main`.
- Toda lectura, búsqueda, PR, commit, issue, gate o modificación debe empezar acotada a ese repositorio.
- Si una herramienta abre otro repositorio, ignorarlo y volver a `HNAlvaradoHN/OANIX` antes de inferir estado.
- GitHub actual manda sobre memoria, chats y documentación desactualizada.

## Arranque obligatorio

Antes de proponer o implementar un cambio, contrastar como mínimo:

1. `AGENTS.md`.
2. `docs/OANIX_CHAT_PROTOCOL.md`.
3. `docs/OANIX_ACTIVE_CHECKPOINT.md`.
4. `docs/CURRENT_STATE.md`.
5. `docs/ROADMAP.md`.
6. `docs/PROJECT_MEMORY.md` cuando la tarea dependa de una decisión duradera.
7. `docs/ARCHITECTURE.md` y `docs/SECURITY.md` cuando la tarea toque esas fronteras.
8. Código, PRs, issues y tests actuales de `main` implicados en el frente activo.

`docs/OANIX_CHAT_PROTOCOL.md` y `docs/OANIX_ACTIVE_CHECKPOINT.md` son las únicas autoridades documentales para el número del chat. `CURRENT_STATE.md` resume el estado general, pero si contradice `main` debe corregirse.

No pedir al usuario que reconstruya decisiones que ya estén registradas.

## Identidad e invariantes

- El nombre oficial es **OANIX**.
- OANIX es offline-first, con cifrado local y cuenta online opcional.
- La cuenta no sustituye la contraseña maestra.
- El transporte normal de sincronización mantiene E2EE; recuperación por correo conserva la excepción de confianza documentada en `SECURITY.md` y `PROJECT_MEMORY.md`.
- PWA y Android/Capacitor comparten una sola base React + TypeScript; no duplicar lógica de negocio.
- Seguridad, vault/session, cifrado y datos existentes no se degradan por conveniencia.
- Ante incertidumbre de sync o conflictos, conservar datos tiene prioridad sobre sobrescribir silenciosamente.
- No guardar secretos, claves, tokens o credenciales en código, repositorio, notas, localStorage, IndexedDB o la bóveda salvo el formato seguro expresamente diseñado para ello.

## Arquitectura, escala y rendimiento

- Mantener la separación `UI → estado/servicios → dominio → almacenamiento cifrado → vault/crypto`.
- No crear persistencia paralela si el modelo existente puede resolver el caso de forma segura.
- Cada módulo debe tener una responsabilidad clara; evitar archivos monolíticos, dependencias cruzadas y utilidades-cajón.
- Diseñar para notas grandes, miles de registros, muchas imágenes y archivos de varios GB.
- Evitar escaneos completos cuando exista una alternativa indexada/incremental.
- No cargar datos gigantes completos en RAM si pueden procesarse por fragmentos.
- No repetir cifrado, escritura, lectura, render, hash, subida o sync de datos que no cambiaron.
- Detectar no-op, conservar revisiones/baselines, deduplicar pendientes y cancelar/postergar trabajo obsoleto cuando sea seguro.
- La eficiencia no justifica sobreingeniería.
- Toda UI nueva debe considerarse en PC + móvil + Día + Noche.

## Evaluación técnica

Antes de ejecutar una propuesta técnica importante del usuario, evaluar si la dirección es correcta, qué riesgos tiene y si existe una alternativa mejor. No implementar mecánicamente una idea si perjudica OANIX.

No inventar archivos, funciones, commits, configuraciones ni estado de repositorio. Si hace falta conocerlos, comprobarlos.

Al corregir un problema, buscar la causa real y considerar efectos sobre lo que ya funciona.

## Decisiones y memoria

Las decisiones relevantes deben sobrevivir al chat. Actualizar `PROJECT_MEMORY.md`, `CURRENT_STATE.md` o el checkpoint según corresponda cuando:

- se define o cambia una característica;
- se descarta, aplaza o sustituye una idea;
- aparece un problema conocido pendiente;
- se implementa algo que estaba pendiente;
- se detecta discrepancia entre intención, documentación y código.

Estados duraderos permitidos: `DECIDED`, `IN_PROGRESS`, `IMPLEMENTED`, `VALIDATION_DEBT`, `DEFERRED`, `SUPERSEDED`, `CANCELLED`.

No borrar silenciosamente decisiones históricas que expliquen compatibilidad, seguridad o arquitectura. Sí eliminar de los documentos activos las instrucciones obsoletas que puedan reabrir trabajo ya terminado.

## Después de implementar

Al completar un cambio relevante:

1. verificar tests y gates aplicables;
2. actualizar `OANIX_ACTIVE_CHECKPOINT.md` y `CURRENT_STATE.md` si cambió el punto operativo;
3. actualizar `PROJECT_MEMORY.md` si cambió una decisión duradera;
4. actualizar `CHANGELOG.md` cuando corresponda al historial de producto;
5. actualizar `ROADMAP.md` si cambió el orden o estado de una etapa.

No dejar para otro chat documentación activa que ya se sabe desactualizada.

## Avance automático de ajustes pequeños

Si un ajuste es de bajo riesgo, local, reversible, no cambia seguridad/datos/alcance ni una decisión importante y puede validarse, corregirlo y continuar sin pedir confirmación adicional.

Detenerse solo cuando exista una decisión real que cambie seguridad, datos, alcance o una experiencia importante.

## Resolución de fallos hasta verde

Cuando falle una prueba, build o workflow aplicable:

1. confirmar que el fallo corresponde al HEAD actual;
2. localizar el primer error concreto, no el `exit code 1` terminal;
3. contrastarlo con código y tests actuales;
4. identificar si la causa es implementación, test obsoleto, tipos/lint/build, configuración o infraestructura;
5. si la causa está suficientemente verificada y el cambio es pequeño/reversible, aplicar de inmediato la corrección mínima correcta;
6. no degradar comportamiento correcto para satisfacer una prueba vieja: actualizar la prueba si conserva un contrato obsoleto;
7. ejecutar de nuevo todos los gates aplicables;
8. repetir desde el primer error real del nuevo run hasta verde.

Seguir repitiendo el mismo diagnóstico cuando ya existe evidencia suficiente para actuar se considera estancamiento.

Un trabajo no se considera cerrado mientras un gate técnico aplicable siga rojo. Una revisión automática externa que falle solo por cuota/API no sustituye los gates técnicos reales.

## GitHub

Cuando existan herramientas integradas de GitHub, usarlas directamente para ramas, archivos, PRs, CI, logs, reintentos, merges, issues y artifacts. No convertir al usuario en operador de GitHub si la herramienta puede realizar la acción.

No afirmar una validación física de Android/PWA si solo pasó CI.

## Prioridad operativa actual

La reconstrucción post-unlock de Home/editor ya está **IMPLEMENTED** y no debe reabrirse por documentación histórica. El editor natural por renglones quedó consolidado por PR #629; Home/lista y reorder recientes quedaron integrados en PR #630–#638.

La sincronización incremental v2 con Supabase + R2 quedó implementada por PR #639–#641 y es el frente vigente de validación real.

Orden actual:

1. preservar seguridad/bootstrap/vault y almacenamiento v2;
2. validar sync v2 extremo a extremo entre dispositivos/sesiones reales;
3. comprobar offline/reconexión, notas, carpetas y etiquetas, protección durante edición y ausencia de descargas innecesarias;
4. corregir cualquier defecto encontrado en el flujo v2 actual y volver a verde;
5. solo después abrir el siguiente bloque funcional indicado por el roadmap/checkpoint actualizado.

No volver a buscar `qwen.html`, `appquen.js`, reconstruir el editor ni reactivar `AutoSyncRuntime` legacy salvo una nueva decisión explícita o evidencia técnica nueva.

## Estado de continuidad

El detalle vivo no se duplica aquí. Consultar `docs/OANIX_ACTIVE_CHECKPOINT.md` y verificarlo contra `main` antes de continuar.

Reglas permanentes actuales:
- `RebuildApp` es la autoridad post-unlock mientras `main` no demuestre una sustitución posterior.
- `encrypted_records_v2` es el store cifrado v2 indexado/aditivo mientras `main` no demuestre una sustitución posterior.
- `V2AutoSyncRuntime` es el runtime de sync incremental activo post-unlock; no sustituirlo por el runtime legacy por comodidad.

## Traspaso entre IAs

Una IA nueva debe:

- fijar primero `HNAlvaradoHN/OANIX`;
- leer protocolo y checkpoint antes de inferir número o siguiente acción;
- verificar `main`, PRs/gates vivos y archivos del frente activo;
- corregir documentación activa si está desfasada antes de continuar;
- no pedir decisiones ya registradas;
- no reabrir frentes `IMPLEMENTED` solo porque sobreviva documentación histórica;
- dejar registrado el nuevo estado y siguiente acción antes de cerrar.

## Visibilidad del repositorio

El repositorio aparece actualmente como público. No cambiar visibilidad, permisos o configuración sensible sin instrucción explícita del usuario.
