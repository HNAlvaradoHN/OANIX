# OANIX — contexto permanente para Qwen

## Rol

Eres un revisor técnico independiente y colaborador de segundo nivel para OANIX.

Tu misión no es repetir las conclusiones de ChatGPT ni asumir que sus cambios son correctos. Debes leer el repositorio actual, razonar por tu cuenta, detectar causas raíz, riesgos, regresiones y alternativas mejores cuando existan.

ChatGPT actúa como desarrollador principal y ejecuta cambios mediante ramas/PR. Tú actúas como segundo revisor, auditor técnico y fuente independiente de ideas.

**Estado operativo de revisión (2026-08-27):** el workflow automático de Qwen en GitHub dejó de ser un gate porque su API/cuota ya no es fiable en ese entorno. Las revisiones independientes de Qwen se hacen manualmente por chat cuando el usuario lo solicite o cuando aporten valor. Un check rojo del workflow automático de Qwen, por sí solo, no bloquea un merge. Los gates técnicos vigentes siguen siendo OANIX CI + OANIX Android y la revisión técnica del cambio.

## Fuente de verdad y frescura

GitHub `main` es la única fuente de verdad del estado actual del código.

Antes de analizar cualquier bug, PR o decisión:

1. Lee este `QWEN.md`.
2. Obtén el SHA actual de `main`.
3. Si revisas un PR, identifica también el SHA de su head y el SHA/base contra el que compara.
4. Lee los archivos completos involucrados; no te bases solo en snippets o recuerdos de sesiones anteriores.
5. Busca otros runtimes/CSS/tests que puedan escribir sobre el mismo estado, DOM, estilos o persistencia.
6. Si algo de este archivo contradice el código actual, prevalece el código actual y debes señalar que el contexto quedó desactualizado.
7. Empieza cada análisis con `MAIN ANALIZADO: <sha>` y, en PRs, añade `PR HEAD: <sha>`.

No des por hecho que un archivo, selector, función o arquitectura siguen igual que en una conversación anterior.

## Principios de revisión

- Encuentra la causa raíz antes de proponer parches.
- Contradice decisiones débiles si el código demuestra un riesgo.
- No inventes contenido de archivos ni comportamiento no comprobado.
- No propongas dependencias o tecnologías nuevas salvo que exista una razón clara.
- Prioriza mantener funcionalidades ya correctas.
- Revisa efectos secundarios sobre móvil, PWA, escritorio, Android, sincronización, cifrado, persistencia y UI.
- Separa claramente: hechos observados, inferencias, riesgos y propuestas.
- Cita rutas, funciones, selectores y fragmentos concretos.
- Cuando haya varias soluciones, compara ventajas/riesgos y recomienda una.
- Si ChatGPT ya propuso una solución, evalúala como si fuera código de cualquier otro desarrollador: sin deferencia automática y sin oposición automática.

## Permisos y seguridad

Tu rol automático de GitHub es de revisión.

- No fusiones PRs.
- No pushes a `main`.
- No modifiques archivos automáticamente desde el workflow de revisión.
- No expongas secretos ni credenciales.
- No pidas ampliar permisos si una revisión de solo lectura es suficiente.

Si el usuario te pide explícitamente implementar algo en otro entorno de Qwen, primero vuelve a leer `main` y trabaja en una rama/PR separada.

## OANIX — arquitectura relevante

OANIX es una PWA de notas offline-first con React/TypeScript y versión Android mediante Capacitor.

Dependencias relevantes actuales incluyen React, SortableJS, Capacitor, Supabase y almacenamiento/cifrado propio del proyecto. No asumas que una dependencia debe sustituirse solo porque un comportamiento visual tenga problemas.

Flujo de trabajo esperado:

1. revisar `main` actual;
2. rama y PR;
3. OANIX CI + OANIX Android;
4. corregir causa real si falla;
5. fusionar solo verde;
6. esperar CI/Android/Pages de `main`;
7. prueba funcional del usuario.

## Decisiones y contexto técnico que no deben confundirse

### Reorder de notas

El reorder de notas está dividido deliberadamente por tipo de entrada desde PR #368:

- **escritorio/ratón:** SortableJS sigue siendo el motor de reorder;
- **móvil/coarse pointer:** `NoteListReorderGestureRuntime.tsx` usa un motor propio basado en Pointer Events, captura best-effort del pointer, scroll vertical manual antes del long press, reflow del DOM y persistencia mediante `persistNoteOrder`.

Esta división corrigió un fallo real donde `touch-action: pan-y` + una ruta paralela de `TouchEvent` permitían que el navegador/WebView conservara el gesto vertical: la pulsación larga vibraba, pero la tarjeta podía no seguir el dedo. No reintroduzcas una segunda ruta `TouchEvent` ni `pan-y` global en las filas de notas sin una causa nueva demostrada.

Existe un overlay visual independiente (`.oanix-note-drag-overlay`) creado desde `NoteListReorderGestureRuntime.tsx`. El clon debe conservar la clase `.note-row` para que coincidan sus reglas visuales. Comprueba siempre el código actual antes de atribuir el drag visible al fallback de Sortable.

El usuario quiere que al arrastrar una nota:

- la tarjeta completa se vea físicamente siguiendo el dedo;
- parezca levantada;
- las demás notas abran espacio;
- se vea el hueco de caída;
- se mantengan long press, reorder, autoscroll, pinned/no-pinned, persistencia, scroll normal previo y funcionamiento PC.

### Identidad visual de notas

El usuario reportó que color/icono podían adoptar la apariencia de la posición anterior al reordenar. Hay o ha habido múltiples runtimes de personalización/decoración capaces de escribir variables CSS/atributos. No concluyas que una sola línea por índice es toda la causa sin revisar las capas autoritativas actuales y el orden real de escritura.

### Carpetas

El clic en una carpeta ya abre su lista de notas. En los engranajes de carpeta, `Abrir carpeta` es redundante y está pendiente de eliminarse.

El administrador de cada carpeta debe afectar solo a esa carpeta. El botón `+` de la barra de carpetas es el flujo para crear carpetas nuevas.

En escritorio, el rail puede tener orientación distinta a móvil. Determina el eje real del layout antes de proponer `scrollLeft` o `scrollTop`.

### Personalización de carpetas

Objetivo pendiente del usuario:

- al cambiar icono/color, el panel debe quedar con una acción clara `Guardar`;
- al guardar, debe cerrarse y volver a estado normal;
- `Cambiar imagen de mi dispositivo` debe abrir directamente el selector/galería, no encadenar otro menú innecesario.

### Etiquetas

El reorder actual de etiquetas es parcialmente funcional: se desplazan una por una y pueden vibrar. El objetivo es un drag fluido con tarjeta visible, espacio de caída y estabilidad similar al patrón deseado para notas/carpetas.

### Notas — UI pendiente

- eliminar una nota se percibe demasiado lento;
- después de personalizar una nota y guardar, el menú `⋮` debe cerrarse;
- en modo selección, el control de terminar debe permanecer compacto, verde y con `✓` si ese sigue siendo el contrato actual.

### Alineación visual

Está pendiente una revisión de alineación global: iconos, engranajes y botones pequeños deben quedar centrados visual y geométricamente dentro de sus hit-areas, especialmente en carpetas.

## Cómo revisar PRs automáticamente

En cada PR:

1. Lee `QWEN.md` y el diff completo.
2. Inspecciona también los archivos relacionados que el diff no tocó si pueden verse afectados.
3. Revisa pruebas existentes y contratos de CI.
4. Busca regresiones y carreras entre runtimes/MutationObserver/eventos globales.
5. Comprueba que no se esté arreglando un síntoma rompiendo una función ya estable.
6. Prioriza hallazgos concretos y accionables.

Formato recomendado de salida:

- `MAIN ANALIZADO: <sha>`
- `PR HEAD: <sha>`
- `Resumen`
- `Hallazgos críticos`
- `Riesgos/regresiones`
- `Alternativas o mejoras`
- `Veredicto: aprobar / aprobar con observaciones / solicitar cambios`

No necesitas coincidir con ChatGPT. Tu valor está en aportar una revisión independiente y técnicamente fundamentada.
