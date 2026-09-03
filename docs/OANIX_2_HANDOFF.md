# OANIX — Handoff nocturno para OANIX #2

Fecha: 2026-09-02

Este documento deja el plan exacto acordado al cierre de `OANIX #1` para iniciar una sesión larga/nocturna desde un chat nuevo con contexto limpio. GitHub sigue siendo la fuente de verdad del código actual.

## Continuidad de chat

- Chat actual al crear este handoff: `OANIX #1`.
- El siguiente chat de trabajo debe asignarse como `OANIX #2` en cuanto el usuario lo abra dentro del proyecto OANIX.
- El asistente no puede crear ni cambiar de chat por sí solo. Para trabajo nocturno/largo, pedir al usuario abrir el chat nuevo antes de empezar para reducir el riesgo de alcanzar el límite de conversación mientras está ausente.
- Al entrar a `OANIX #2`, recuperar primero GitHub y actualizar `docs/PROJECT_MEMORY.md` / `docs/CURRENT_STATE.md` con el nuevo chat activo y estas decisiones.

## Rama y preview actuales

- Rama de trabajo visible al usuario: `agent/oanix-notes-sheet-2026-09-02`.
- PR de integración de la nueva hoja: `#592`.
- La preview de Vercel de esta rama es el lugar de validación antes de fusionar a `main`.
- No fusionar todavía a `main` mientras se estén diseñando/validando los elementos insertables y su interacción.

## Estado aprobado de la hoja

- La hoja suministrada por el usuario es la autoridad visual/interactiva actual.
- Preservar barra superior, iconos, menú lateral, tirador flotante arrastrable, temas y flujo continuo de escritura.
- Persistencia real: usar la infraestructura cifrada/incremental de OANIX; no usar `localStorage` de la maqueta.
- Escritura móvil en Brave/Android quedó aprobada tras corregir crecimiento del textarea, seguimiento del cursor, scroll y barra superior fija.
- No volver a introducir overlays o ajustes que oculten renglones o hagan parpadear el contenido.
- El título debe ser visualmente grande y muy marcado; el texto `Título` es solo placeholder. Las notas nuevas nacen con título vacío. No insertar `Nota nueva` ni `Ingrese título` como valor real.

## Regla de inserción de contenido

- El cursor marca el punto de inserción.
- Al insertar un elemento, se termina/separa el renglón actual y el elemento se coloca en el siguiente espacio del documento.
- Debe quedar espacio visual arriba y abajo del elemento para seguir escribiendo antes/después sin romper la sensación de hoja continua.
- La hoja sigue siendo principalmente texto continuo; los elementos son interrupciones visuales dentro del documento, no un editor de cajones genéricos.
- Todo elemento insertable debe poder eliminarse sin afectar el texto anterior/posterior.

## Elementos a diseñar/implementar

Diseñar e integrar progresivamente:

- Entrada
- Imagen
- Archivos
- Código
- Checklist
- Contacto
- Separador
- Representaciones necesarias de formatos de texto cuando corresponda

Primero construir el sistema visual/interactivo y validarlo en preview; después conectar almacenamiento/funcionalidad real de cada tipo empezando por Imagen.

## Diseño visual de elementos

- No usar rectángulos planos/genéricos ni colores planos pobres.
- Cada tipo debe tener una tarjeta/representación visual propia, interactiva, elegante y con sensación premium.
- Mantener coherencia con OANIX: llamativas sin competir con el contenido principal.
- Adaptarse correctamente a todos los temas de hoja: Claro, Crema, Sepia, Oscuro, Medianoche, Bosque, Rosa y Lavanda.
- Contraste de texto, iconos, bordes, sombras y estados debe seguir siendo legible en todos los temas.

## Menú propio por elemento

- Cada elemento insertado tiene su propio menú contextual/configuración según su tipo.
- Debe existir una acción clara de eliminar.
- El menú calcula su posición según espacio disponible: cerca de la parte baja abre hacia arriba; cerca de la parte alta abre hacia abajo.
- Nunca debe quedar cortado por el viewport.
- Se cierra al tocar/clickear fuera, al iniciar scroll o al elegir una opción.
- Debe funcionar tanto en PC como en móvil (mouse, trackpad, touch y teclado cuando aplique).

## Vista previa limitada y expansión

- Ningún elemento puede crecer indefinidamente ni deformar la hoja.
- Cada tipo tiene una altura/preview controlada.
- Código: aproximadamente 5 líneas visibles; el resto se oculta.
- Entrada, Contacto, texto largo y similares: si exceden la preview, truncar/ocultar contenido sin agrandar la tarjeta de forma descontrolada.
- Cuando hay más contenido, ofrecer botón/acción de expandir.
- La expansión abre una vista completa/overlay sin modificar el layout original de la hoja.
- La vista completa debe poder cerrarse con botón, toque/click fuera cuando corresponda y Atrás de Android.
- Al cerrar, volver al mismo punto de la nota.

## Pegado y portapapeles

- Pegado de texto corto/normal: insertar en el cursor.
- Pegado de texto muy grande: evitar congelar la hoja. Usar umbral basado en tamaño total y/o líneas, no solo líneas.
- Si el pegado excede el umbral, representarlo como elemento de texto largo/consola optimizada en vez de forzar miles de líneas directamente al textarea.
- Mantener el contenido completo, con preview limitada y expansión bajo demanda.
- Evitar copias completas, reflows gigantes y operaciones síncronas pesadas en pegados grandes.
- Soportar imágenes desde el portapapeles cuando el navegador/PWA las entregue mediante `paste` / Clipboard API.
- Las imágenes pegadas se tratan como imágenes insertadas normales: almacenamiento real de OANIX, menú propio y eliminación.
- No depender solo de un botón de pegado programático, porque Brave/Android puede restringirlo; capturar también el pegado nativo del editor.

## Rendimiento

- Todo debe sentirse fluido en PC y móvil.
- No sacrificar estabilidad por representar pegados o contenido gigantes como texto normal.
- Evaluar cada elemento con notas largas y muchos elementos insertados.
- Evitar cargar archivos/imágenes grandes completos en memoria cuando exista una estrategia incremental/chunked/lazy.
- Mantener la UI aprobada mientras las optimizaciones ocurren debajo de la superficie.

## Orden de trabajo nocturno

1. Recuperar estado exacto de la rama `agent/oanix-notes-sheet-2026-09-02` y PR #592.
2. Actualizar memoria operativa y `CURRENT_STATE` para `OANIX #2`.
3. No tocar la mecánica móvil de escritura aprobada salvo regresión demostrada.
4. Crear el sistema visual reutilizable de elementos insertados y menús contextuales adaptativos.
5. Diseñar cada elemento con identidad propia y temas claros/oscuros.
6. Implementar preview limitada + expansión/cierre universal + eliminación.
7. Implementar posicionamiento/cierre de menús en PC y móvil.
8. Integrar Imagen primero, incluyendo selección y pegado desde portapapeles con almacenamiento real.
9. Implementar estrategia de pegado de texto grande/consola optimizada.
10. Continuar con Archivos, Código, Checklist, Contacto, Entrada y Separador, respetando las mismas reglas.
11. Validar continuamente en preview de Vercel y mantener checkpoints en GitHub.
12. No fusionar a `main` hasta tener una base visual/funcional suficientemente validada.
