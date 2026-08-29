# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-29

Checkpoint operativo corto. Antes de trabajar, verificar siempre el `main` real y PR recientes; GitHub es la fuente de verdad del código.

## Estado actual

- V1 local, V2 cuenta/sync y V3 Android/Capacitor están cerradas funcionalmente.
- OANIX sigue siendo offline-first y debe funcionar sin nube.
- No dividir por ahora OANIX en Free/Pro ni bloquear funciones artificialmente. La monetización queda para una decisión posterior.
- PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor.
- La apariencia global activa se limita a **Día** y **Noche**.
- Verificar siempre el SHA actual de `main`; no reutilizar un SHA guardado en este documento como fuente de verdad.

## Reglas de trabajo

- Cambios pequeños y aislados; una función importante = rama + PR.
- Ejecutar OANIX CI y OANIX Android. No fusionar si alguno falla; si ambos pasan y el cambio ya está autorizado, puede fusionarse automáticamente.
- El workflow automático de Qwen en GitHub no es gate de merge; su revisión se consulta manualmente por chat cuando sea útil. Un fallo de cuota/API de ese workflow no invalida CI/Android.
- No hacer refactorizaciones generales para resolver problemas pequeños.
- No tocar cifrado, notas, sync, bóveda o almacenamiento existente sin necesidad real.

## Imágenes — experiencia congelada

PR #169 retiró del montaje activo `NotebookCanvasRuntime`, `NotebookFreeRowsRuntime` y `NotebookSimpleImageRuntime`. No reactivarlos sin autorización.

PR #170–#172 fijaron la experiencia compartida PWA/APK:
- tarjeta fija y compacta; miniatura izquierda, controles derecha;
- sin mover, alinear, redimensionar manualmente ni candado;
- no mostrar nombre del archivo;
- mantener Abrir, Quitar y tamaño cuando corresponda;
- descripción en franja inferior; texto largo con elipsis + `+`;
- descripción y visor se cierran con X, toque fuera y Atrás;
- tocar miniatura abre original; visor con zoom aproximado 4x y desplazamiento.

No modificar ampliamente `ImageNoteEditor.tsx` ni el formato persistido de imágenes para ajustes menores.

## Workspace infográfico — dirección visual vigente

El workspace visual se desacopló de la lógica de producto mediante un contrato estable de tema. El diseño infográfico suministrado por el usuario es ahora una capa visual aislada: puede sustituirse en el futuro sin duplicar notas, carpetas, etiquetas, privacidad, cifrado, sync o persistencia. El estado inmediatamente anterior se conserva en la rama de checkpoint `checkpoint/pre-theme-shell-refactor` desde `71774220f0a74bd816e284d91cc493691e8504f0`.

La referencia anterior v38/v39 queda **SUPERSEDED como autoridad visual activa**, pero se conserva en el historial y en código no montado como referencia/rollback. La nueva capa mantiene los hooks DOM necesarios para privacidad e historial y usa handlers/servicios reales de OANIX.

La superficie principal sigue siendo una sola experiencia compartida por PWA y APK:
- cabecera compacta usando el logo real seleccionado de OANIX;
- etiquetas reales en chips horizontales debajo de la cabecera;
- lista real de notas en tarjetas infográficas translúcidas;
- dock horizontal de carpetas en la parte inferior;
- portada/color de la carpeta activa como ambiente visual del workspace, siempre con capas de contraste que preserven la legibilidad;
- nombres de carpetas, contadores, notas, etiquetas y acciones siempre provenientes de datos/handlers reales de OANIX;
- no usar Tailwind CDN, Phosphor CDN, imágenes demo ni una segunda lógica de producto.

### Personalización de notas

Cada nota expone una sola entrada `Personalizar` dentro de su menú `⋮`. Permite cambiar para la representación de lista:
- título;
- descripción breve;
- categoría principal elegida entre etiquetas reales;
- icono central;
- color visual de la tarjeta.

La tarjeta de lista usa icono central, no una foto. Estos datos son campos opcionales del mismo `NoteRecord` cifrado; no se crea un store paralelo ni se cambia `blocks-v1`. La categoría visual no debe borrar las demás etiquetas reales de la nota.

### Carpetas y Día/Noche

- El control inferior izquierdo conserva `+` para carpetas y usa el segundo botón como alternancia visual **Día/Noche del tema infográfico**. El workspace ya no usa `classic-day` / `classic-night` como autoridad de esa superficie; el sistema compartido se conserva únicamente donde otras pantallas aún lo necesitan.
- Cada tarjeta de carpeta expone un engranaje arriba a la derecha.
- El engranaje concentra en un solo menú: Abrir, Fijar/Desfijar, Favorito, Renombrar, Color/Icono, Imagen local y Eliminar.
- Nombre, eliminar, portada y color/icono reutilizan los handlers/servicios existentes.
- Fijado y favorito se conservan dentro del registro cifrado `folder-appearance` junto con color/icono; no modifican automáticamente `folder-order` ni sustituyen el orden manual del usuario.
- La portada de la carpeta seleccionada cambia el fondo del workspace sin reducir la legibilidad de cabecera, chips, tarjetas o dock.

El diseño conserva Día/Noche y se adapta con `dvh`, safe areas, scroll horizontal y breakpoints estructurales cuando haga falta para evitar desbordes sin perder la composición.

### Reordenamiento — regla común

Carpetas, etiquetas y notas comparten la misma interacción:
1. mantener presionado el elemento durante un breve intervalo;
2. todos los elementos del grupo entran en jiggle/vibración;
3. sin soltar, arrastrar a la posición deseada mientras los demás se recolocan;
4. al soltar se persiste el orden y el modo termina automáticamente.

No debe existir un botón visible `↕`, `Listo` o `✓` para entrar/salir del modo de ordenamiento. Un toque normal sigue seleccionando/abriendo; scroll normal no debe disparar el long-press accidentalmente.

Persistencia:
- carpetas reutilizan `folder-order` cifrado;
- notas reutilizan `manualOrder`/`persistNoteOrder` existente;
- etiquetas reutilizan la infraestructura cifrada con un registro `tag-order`, sin crear un store paralelo ni cambiar el formato v1 de cada etiqueta.

Implementación vigente en el tema infográfico:
- una sola autoridad Pointer Events aislada dentro del tema para carpetas, etiquetas y notas;
- long-press de 500/400/400 ms, clon visible, jiggle de carpetas, autoscroll y momentum;
- no usa una ruta paralela `TouchEvent`;
- al soltar delega la persistencia a `onFolderOrder`, `onTagOrder` y `onNoteOrder`, que continúan usando los servicios cifrados existentes;
- notas fijadas/no fijadas no se mezclan durante el drag;
- la validación física continua en PWA/APK sigue siendo **VALIDATION_DEBT** hasta ejecutarla en dispositivo real.

## Archivos grandes — motor actual

Objetivo de producto inicial: manejar archivos de 5 GB sin diseñar el motor con un techo arquitectónico de 5 GB. El protocolo conserva un límite de seguridad mayor (~20 GiB) por ahora.

Implementado:
- planificación y procesamiento secuencial por fragmentos;
- AES-GCM por fragmento con IV independiente;
- SHA-256 y manifiestos criptográficos;
- checkpoints persistentes y transferencias reanudables por rangos;
- caché temporal cifrada separada de `oanix-vault`, conservando un solo bloque activo;
- reanudación desde mitad de bloque/avance remoto confirmado;
- preflight de destino y cuota;
- orquestador completo de transferencia;
- abstracción `OanixStorageProvider` para no acoplar el motor a un proveedor concreto.

Para Google Drive, el plaintext del bloque se ajusta para que el ciphertext AES-GCM completo quede alineado a 256 KiB; los bloques completos enviados son de aproximadamente 8 MiB.

Nunca cargar archivos gigantes completos en RAM. Limpiar buffers temporales y mantener el procesamiento acotado por fragmentos.

## Google Drive

Google Drive es el primer proveedor, no la nube obligatoria de OANIX.

- Uso opcional; OANIX debe seguir funcionando sin Drive.
- Usa almacenamiento de la cuenta Google del usuario.
- Scope: `drive.appdata`; archivos remotos en `appDataFolder`, sin acceso general al Drive.
- Los archivos se cifran antes de salir del dispositivo.
- Tokens Google son temporales y solo en memoria: nunca localStorage, IndexedDB, notas, bóveda o repositorio.
- PWA: Google Identity Services y `VITE_GOOGLE_DRIVE_WEB_CLIENT_ID`; no inventar un client ID si falta.
- Android: autorización nativa mediante `AuthorizationClient`, separada del login OANIX.
- La tarjeta de Cuenta y acceso muestra conexión/cuota y ayuda `?` discreta; conectar Drive no inicia una subida automáticamente.
- URLs reanudables se restringen al host/ruta esperados de Google; no filtrar Bearer tokens a destinos arbitrarios.

## Transferencias — UI y pruebas validadas

Fases del motor/UI: Preparando → Cifrando → Subiendo → Verificando → Guardado ✓, además de pausado/error/reanudación. `100% transferido` no equivale a `Guardado` hasta terminar la verificación.

Validado en PWA:
- archivo real de ~120 MiB: subida cifrada completa, recuperación remota por rangos, SHA-256, descifrado y comparación íntegra;
- corte de Wi-Fi alrededor del 30%, cierre completo de la PWA, reapertura, reconexión de Drive y continuación desde el progreso remoto confirmado;
- archivo real de **818 MB**: subida completa, `Guardado ✓`, **103 fragmentos íntegros y descifrados** en la recuperación/verificación final.

PR #219 amplió la prueba controlada a **100 MiB–1 GiB**. Todavía no saltar directamente a 5 GB.

## Segundo plano

Decisión de producto:
- **Android/APK:** las transferencias grandes deberán poder continuar en segundo plano cuando el usuario cambie de aplicación o apague la pantalla, dentro de las restricciones reales de Android.
- **PWA:** no prometer ejecución continua en segundo plano porque el navegador puede suspender la página; la garantía será checkpoint seguro y reanudación desde el progreso confirmado al volver.

No implementar todavía este bloque mientras se valida estabilidad del motor base.

## Próximo paso exacto

1. Validar visualmente el nuevo tema infográfico en la PWA real, primero móvil/tablet y después PC: cabecera con botones reales OANIX, chips/controles de etiquetas, línea central y alternancia, colores de notas, dock, engranajes, modales y fondo por carpeta.
2. Corregir únicamente diferencias reales detectadas en esa validación y mantener el contrato de tema estable.
3. Validar físicamente el gesto continuo de reordenamiento en carpetas, etiquetas y notas: mantener → jiggle → arrastrar sin soltar → soltar → persistir → normalidad.
4. Hacer checkpoint físico en Android/APK sobre la misma base: safe areas, toque/long-press, teclado, Atrás, selector de imágenes y Día/Noche local del tema.
5. Repetir la prueba de ~818 MB con interrupción de red aproximadamente al 30–50%, cerrar/reabrir OANIX y confirmar reanudación sin empezar desde cero.
6. Solo después aumentar gradualmente el tamaño; 5 GB es una meta posterior, no la siguiente prueba inmediata.
7. Después de estabilizar transferencias: integrar archivos grandes al flujo normal de notas.
8. Antes de considerar terminado el sistema de archivos grandes en Android, implementar y validar transferencia en segundo plano.
9. Más adelante: reproducción de video por rangos/seek, caché bajo demanda, Guardar sin conexión y Liberar del dispositivo (distinto de Eliminar de OANIX).

## Checkpoints históricos útiles

- Base funcional estable histórica: `1ad13a27c1a2e429be1beb839aa3992586361103`.
- Antes de paridad de imágenes Android: `d6d847e7a053f05808518b4e18f871855eb0e9a7`.

Los detalles históricos pertenecen a `CHANGELOG.md`, PRs/issues y `PROJECT_MEMORY.md`; no duplicarlos aquí salvo que afecten el siguiente trabajo.
