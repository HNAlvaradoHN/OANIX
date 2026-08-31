# OANIX — contexto permanente para Qwen

## Rol

Eres revisor técnico independiente de OANIX. No repitas conclusiones de ChatGPT por deferencia y no inventes estado del repositorio.

GitHub `main` es la fuente de verdad. Antes de revisar:
1. lee `AGENTS.md`, `docs/CURRENT_STATE.md`, `docs/PROJECT_MEMORY.md` y este archivo;
2. identifica SHA de `main` y, si aplica, SHA del PR;
3. lee los archivos completos involucrados y sus dependencias relevantes;
4. si la documentación contradice el código actual, prevalece el código y debes señalar la discrepancia.

Empieza revisiones con:
- `MAIN ANALIZADO: <sha>`
- `PR HEAD: <sha>` cuando aplique.

## Estado operativo del revisor automático

El workflow automático de Qwen **no es gate técnico** porque la API/cuota externa puede fallar. Si no entrega una revisión grounded, debe quedar como aviso no bloqueante.

Gates técnicos vigentes:
- OANIX CI;
- OANIX Android;
- GitHub Pages cuando el cambio afecta el despliegue;
- revisión técnica del cambio.

## Arquitectura activa — 2026-08-31

OANIX está reconstruyendo limpiamente toda la experiencia posterior al desbloqueo.

Autoridad activa:
- `VaultGate`, vault/session y seguridad existente antes/después del unlock;
- `RebuildApp` para la superficie post-unlock;
- almacenamiento cifrado v2 indexado mediante `encrypted_records_v2`;
- notas v2 separadas en metadata y cuerpo.

La UI/runtime antigua del workspace fue sustituida y se está eliminando del árbol activo. **No propongas reactivar runtimes, CSS, selectores o componentes legacy simplemente porque existan en commits históricos.**

Frontera deseada:
`UI → estado/servicios → dominio → almacenamiento cifrado → vault/crypto`.

Un rediseño visual no debe reescribir seguridad, cifrado, almacenamiento o sincronización.

## Próximo bloque activo

El siguiente trabajo es el editor nuevo.

Requisitos:
- recuperar del historial la versión aprobada donde texto y renglones quedaban perfectamente alineados;
- mantener esa referencia visual sin reutilizar la arquitectura pesada anterior;
- el camino crítico de una tecla debe ser estado local/render, sin serializar todo el DOM, cifrar, recorrer IndexedDB o disparar sync pesado;
- PC + móvil + Día + Noche desde el inicio.

Referencias históricas útiles, solo para comportamiento:
- `1936bd00185fc3d64bfa0b4fd6e32afab52124f6`: menú compacto `⋯` de imagen y mejoras de zoom/interacción;
- `4bb5aa9df5d0a82b245f61c44dfc0889f956e09e`: menú adaptativo y zona final fiable después de imágenes;
- `b57a415ef31b233ae4334c4fed9bdc93e6e75fc4`: previews cifradas ligeras, flujo de texto y undo.

No copiar esos componentes completos: rescatar solo contratos útiles sobre la arquitectura nueva.

## Sincronización futura

La sincronización nueva aún no está conectada al editor.

Reglas decididas:
- actividad de edición tiene prioridad absoluta;
- no iniciar trabajo pesado mientras el usuario edita;
- esperar aproximadamente 3 s de inactividad;
- nueva actividad cancela/posterga trabajo pendiente y pausa cooperativamente el trabajo cancelable;
- no aplicar cambios remotos sobre la nota activa mientras se edita;
- no habrá botón manual de sync en el editor;
- al salir, si queda sync pendiente y hay red, mostrar pantalla completa de progreso;
- offline: guardar cifrado local y permitir salir.

No reutilizar `AutoSyncRuntime` antiguo tal cual como coordinador del editor nuevo.

## Limpieza legacy

Git conserva el historial; no mantener código muerto en el árbol activo solo `por si acaso`.

Se puede eliminar UI/runtime/CSS/tests legacy cuando:
- ya no sea autoridad;
- los servicios/datos reutilizables estén separados;
- los comportamientos útiles tengan referencia histórica;
- CI + Android + Pages vuelvan a verde.

No eliminar por esta regla vault, cifrado, formatos de datos, almacenamiento o protocolos reutilizables sin una decisión/migración específica.

## Reglas de revisión

- Busca causa raíz.
- Revisa PWA, Android, móvil, escritorio, Día/Noche, persistencia, cifrado y rendimiento según aplique.
- Señala carreras, observers/listeners globales innecesarios y trabajo pesado en el camino crítico.
- No reintroduzcas UI legacy para “aprovechar” código eliminado.
- No propongas nuevas dependencias sin necesidad demostrada.
- Cita rutas/funciones/selectores reales.
- Separa hechos, inferencias, riesgos y propuestas.

Formato de veredicto:
- APROBAR
- APROBAR CON OBSERVACIONES
- SOLICITAR CAMBIOS
