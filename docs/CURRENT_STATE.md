# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-20

Este archivo es el checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Contrastar siempre con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs citados.

## Estado general

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente. #69 conflictos y #73 recuperación Email OTP están cerrados; #73 conserva deuda multidispositivo adicional explícitamente no bloqueante.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- **RC Android — #124:** CERRADO COMO COMPLETADO ✅ el 19 ago 2026 tras smoke test físico completo.
- **Pre-Pro Free — adjuntos cifrados #174:** primer bloque implementado en PR #176; validación física Android pendiente. Se adelanta por decisión explícita del usuario antes del entitlement Free/Pro.
- **V4 / OANIX Pro — #80:** ACTIVO, pero el primer cambio técnico de entitlement queda después de cerrar/validar el bloque Free #174.
- **Publicación Android — #125:** preparación activa; por decisión del producto no existe periodo de soak obligatorio.
- La APK debug interna usa firma estable; la firma definitiva de Play Store será independiente.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor.

## Checkpoints y puntos estables

- Checkpoint de repositorio inmediatamente anterior a adjuntos/Pro: `04c6848fb22980a9ba15381c987d81fd7ceb992d`.
- Rama congelada de recuperación: `checkpoint/pre-pro-v1-2026-08-20` apuntando al checkpoint anterior.
- Base funcional de aplicación previa al cambio documental de alcance: `1ad13a27c1a2e429be1beb839aa3992586361103`.
- Punto inmediatamente anterior a la paridad de imágenes Android: `d6d847e7a053f05808518b4e18f871855eb0e9a7`.
- PR #169 retiró del montaje activo `NotebookCanvasRuntime`, `NotebookFreeRowsRuntime` y `NotebookSimpleImageRuntime`, junto con sus CSS experimentales. Permanecen dormidos en el repositorio y **no deben reactivarse sin autorización explícita del usuario**.
- No volver al sistema experimental de tocar cualquier renglón para escribir, texto lateral de imágenes, filas virtuales ni posiciones absolutas del cuaderno.

## Imágenes — experiencia aprobada compartida

PR #170 definió la tarjeta fija/visor táctil en PWA; #171 ocultó el nombre del archivo; #172 llevó la misma experiencia a Capacitor/APK.

Estado aprobado para PWA y Android:
- tarjeta fija, proporcionada y compacta;
- vista previa a la izquierda y controles a la derecha;
- sin mover, alinear, redimensionar manualmente ni candado;
- sin nombre de archivo ni control Mostrar/Ocultar nombre;
- se conservan Abrir, Quitar imagen y tamaño del archivo;
- descripción como único texto identificativo de la imagen, ocupando toda la franja inferior;
- descripción larga con elipsis + botón `+` y burbuja completa cerrable con X, toque fuera o Atrás;
- tocar miniatura abre original;
- visor cerrable con X, toque fuera o Atrás;
- pellizco de zoom hasta aproximadamente 4x y desplazamiento cuando está ampliada.

No modificar ampliamente `ImageNoteEditor.tsx`, el formato persistido de imágenes, cifrado, almacenamiento, notas o sincronización para ajustes visuales de esta experiencia.

## Adjuntos cifrados Free — #174 / PR #176

### Decisión de producto vigente

OANIX permanece centrada en **notas**. Se descartó por ahora crear un nuevo inicio con gestor de archivos/bóveda independiente. En su lugar, cada nota puede reunir texto, imágenes y archivos relacionados dentro de la misma hoja.

### Primer bloque implementado

- clip `📎` en las herramientas del editor y opción `Archivo` dentro de Insertar;
- acepta archivos generales: PDF, Word/Office, ZIP/comprimidos, APK, imágenes, video, audio y otros binarios;
- OANIX importa una copia real: borrar el original externo después de importar no debe borrar la copia guardada por OANIX;
- los bytes se cifran con la clave activa de la bóveda y se guardan como registros binarios `attachment` dentro del `encrypted_records` existente;
- el índice `note-attachments` también permanece cifrado y solo contiene metadatos necesarios de la tarjeta;
- la nota no incrusta el binario ni Base64 dentro de `blocks-v1`; el formato persistido de notas e imágenes existentes no cambia;
- tarjeta ligera con nombre, tamaño, tipo y acciones Abrir / Exportar / Quitar;
- APK y otros binarios se tratan como archivos opacos: OANIX no los ejecuta;
- al quitar un adjunto se elimina su blob cifrado; al eliminar una nota se intenta limpiar también todos sus adjuntos;
- el backup `.oanixbackup` los incluye automáticamente porque ya copia todos los registros cifrados de la bóveda;
- límite inicial deliberado: **50 MiB por archivo**, porque el cifrado binario local actual todavía materializa el archivo completo en memoria.

### Sincronización y archivos grandes

- `attachment` se marca como binario para que el sync no binario actual no intente enviar un archivo grande como una fila pequeña.
- `note-attachments` se mantiene local-only en esta primera fase.
- La sincronización E2EE de adjuntos entre dispositivos **todavía no está implementada**. No presentar aún OANIX como única copia cloud de estos archivos.
- Archivos mayores de 50 MiB, cifrado/lectura por fragmentos, reanudación, descarga bajo demanda y nube de archivos se diseñan después; referencia #175.
- No prometer almacenamiento ilimitado. Cualquier nube propia necesita cuotas/costos; también se estudiará almacenamiento aportado por el usuario y un modelo híbrido, siempre cifrando antes de subir.

## Dirección visual aprobada

- Diseño general de la aplicación aprobado; no rediseñar la interfaz principal sin una necesidad real.
- **Identidad oficial definida:** fondo negro mate/grafito; C abierta grande en plata; candado cobrizo dentro; bloc/documento cobrizo a la derecha con renglones, esquina superior doblada y remate de hoja inferior; píxeles cuadrados cobrizos arriba; palabra `OANIX` completa abajo con `OANI` plata y `X` naranja.
- Mantener sombra negra suave, profundidad premium y margen seguro. No introducir colores ajenos a negro/plata/cobrizo ni glow exagerado.
- El SVG oficial PWA es `public/oanix-icon.svg`.
- PWA y bundle Capacitor usan la misma identidad dentro de la interfaz mediante una ruta resuelta con `import.meta.env.BASE_URL`.
- Android launcher normal/redondo/adaptive usa una adaptación VectorDrawable del mismo sello, escalada dentro de la safe zone para evitar recortes por máscaras del fabricante.
- El splash bitmap existente es un asset separado y no se considera sustituido por el cambio de launcher; cerrarlo explícitamente antes del AAB release si sigue pendiente.

## Bloqueadores cerrados

- #105 biometría/cold start ✅.
- #70 historial/restauración reversible ✅.
- #68 privacidad por nota + Caja privada ✅.
- #69 conflictos multidispositivo ✅.
- #73 recuperación principal por Email OTP ✅.

## Base funcional validada

- RC físico #124 ✅.
- PR #172 merge `1ad13a27c1a2e429be1beb839aa3992586361103` ✅.
- OANIX CI y OANIX Android del PR #172 ✅.
- `oanix/stable-debug-signing = success` ✅.
- Smoke test físico completo previo de #124 ✅: notas, carpetas/etiquetas, avatar, imágenes, temas, contraseña maestra, biometría/timeout, privacidad/Caja privada, backup, sincronización Google/reapertura, compartir/recibir, cámara/documentos/permisos y CI.
- La experiencia visual/táctil exacta de imágenes del PR #172 debe comprobarse físicamente en APK; una diferencia frente a PWA se trata como regresión puntual, no como rediseño del editor.
- Para PR #176, CI/build no sustituye la validación física Android de selector, archivo persistido, Abrir/Exportar/Quitar y reinstalación/backup.

## OANIX Free — alcance fijado

OANIX Free seguirá siendo una aplicación completa. **No se moverá detrás de pago ninguna función que ya exista y haya sido validada en el RC.**

Free conserva/incluye:
- notas y editor de texto enriquecido;
- bloques de código, checklists, contactos, entradas por día e imágenes con la experiencia aprobada actual;
- adjuntos básicos cifrados dentro de notas (#174): importar, conservar original, ver tarjeta, abrir/exportar/quitar y backup cifrado;
- cifrado local, contraseña maestra y funcionamiento offline-first;
- cuenta opcional, autenticación y sincronización E2EE de las funciones ya soportadas;
- resolución de conflictos, historial y recuperación principal ya implementados;
- backup/exportación/restauración cifrada básica;
- biometría/credencial segura, timeout, protección por nota y Caja privada;
- carpetas, etiquetas y búsqueda;
- compartir/recibir contenido y funciones Android existentes de cámara/archivos;
- temas y personalización que ya existen en la versión gratuita.

Regla: **cifrado, seguridad esencial, acceso a los datos propios, adjuntos básicos y backup básico no son funciones premium.**

## OANIX Pro v1 — alcance fijado

Modelo comercial objetivo: **compra única / desbloqueo permanente**, con restauración de compra en reinstalación o dispositivo compatible. No se introduce suscripción obligatoria en Pro v1.

### Núcleo Pro v1

1. **Escáner Seguro de Documentos**
   - captura/importación de páginas;
   - detección de bordes y recorte;
   - corrección de perspectiva;
   - mejora visual del documento;
   - varias páginas por documento;
   - generación de PDF;
   - cifrado y guardado dentro de la bóveda.

2. **OCR y búsqueda documental**
   - extracción de texto del documento;
   - texto OCR guardado cifrado;
   - búsqueda dentro de documentos sin crear un índice privado en texto plano;
   - priorizar procesamiento local/offline cuando sea técnicamente viable; cualquier dependencia de servidor requerirá una decisión explícita posterior de privacidad.

3. **PDF / exportación avanzada**
   - PDF generado por el escáner;
   - exportación/compartición avanzada a PDF de contenido compatible de OANIX;
   - diseño y paginación controlados sin alterar el formato persistido de las notas existentes.

4. **Personalización premium adicional**
   - nuevos paquetes/presets visuales Pro;
   - no retirar ni degradar los temas que ya existen gratis.

### Monetización / entitlement

Antes de exponer funciones Pro:
- diseñar un estado `free/pro` aislado de la bóveda y del contenido de notas;
- durante desarrollo, Pro se puede habilitar solo en builds internas de prueba sin introducir un bypass en producción;
- integrar más adelante compra única mediante Google Play Billing y testers con licencia;
- validar el derecho Pro de forma robusta y restaurable;
- no guardar secretos de facturación ni un simple `isPro=true` manipulable como fuente final de verdad;
- una pérdida temporal de verificación de compra no debe borrar, corromper ni volver inaccesibles los datos privados del usuario.

### Fuera de Pro v1 por ahora

Quedan diferidos para no inflar la primera versión premium:
- audio/notas de voz avanzadas;
- dibujos;
- tablas;
- IA de servidor;
- almacenamiento cloud adicional de pago;
- suscripción recurrente.

## Recuperación #73

El flujo principal de Email OTP está cerrado y validado. Persisten como cobertura adicional no bloqueante:
- confirmar contraseña nueva desde un segundo dispositivo;
- confirmar que un OTP usado no se reutiliza;
- probar reconciliación de un dispositivo que estuvo offline durante rotación.

No bloquean RC ni publicación.

## Publicación — #125

**Estado:** preparación activa; todavía no enviar a producción.

Orden actual:
1. alcance exacto OANIX Free vs Pro v1 — **FIJADO**;
2. implementar y validar adjuntos cifrados Free #174 / PR #176;
3. crear un nuevo checkpoint estable posterior a adjuntos y previo a Pro;
4. diseñar entitlement `free/pro` sin tocar datos/cifrado;
5. cerrar/verificar identidad oficial y splash;
6. confirmar `appId`, `versionCode` y `versionName`;
7. crear/custodiar firma release definitiva;
8. implementar Pro v1 de forma incremental e integrar Google Play Billing;
9. generar/verificar AAB release;
10. preparar política de privacidad, ficha, textos y capturas;
11. verificación final y envío a Play Store.

## Forma de trabajo acordada

- Revisar el `main` real antes de cada cambio.
- Cambios pequeños, aislados y con PR para cada bloque importante.
- OANIX CI y OANIX Android deben pasar antes de fusionar.
- Si ambos pasan y el cambio ya fue autorizado, puede fusionarse automáticamente a `main`.
- El agente hace directamente GitHub cuando las herramientas lo permiten; el usuario interviene principalmente en pruebas físicas inevitables.
- No reactivar los runtimes experimentales de cuaderno ni introducir refactorizaciones generales por un problema pequeño.

## Próximo paso exacto

Cerrar PR #176 solo con CI + Android verdes, entregar APK de prueba y validar físicamente en Android: adjuntar PDF/ZIP/APK u otro archivo, cerrar/reabrir la nota, Abrir/Exportar, Quitar, eliminación de nota y backup/restauración. Después crear un nuevo checkpoint estable **post-adjuntos / pre-Pro**. Solo entonces retomar el entitlement mínimo `free/pro`.
