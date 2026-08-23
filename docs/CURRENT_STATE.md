# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-22

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

## Carpetas — dirección visual vigente

- El inicio de carpetas ocupa **todo el workspace**; no vive dentro del ancho de la lista de notas.
- En PC/tablet ancho usa la referencia visual entregada por el usuario: rail lateral de aproximadamente 140 px, iconos orgánicos con nombre real y contador real, portada real como wallpaper y tarjeta glass de detalles abajo a la izquierda.
- El `+` visible reutiliza el administrador real de carpetas. No existe un engranaje ficticio sin función.
- En móvil, la misma base se convierte en un dock horizontal inferior; no crear una segunda UI/lógica de carpetas.
- La tarjeta muestra el nombre real y cantidad real de notas. `Abrir carpeta` usa la navegación existente; `Opciones` abre las funciones reales de la carpeta.
- El inicio no muestra `Nueva nota`; esa acción pertenece a la vista interna después de abrir una carpeta/lista.
- La búsqueda del panel sigue limitada a la carpeta seleccionada y no expone notas de Caja privada.
- Imagen personalizada de carpeta: cifrada y separada del registro de carpeta.
- Color e icono: persistidos cifrados en `folder-appearance`, con compatibilidad hacia registros anteriores. En Opciones se presentan juntos detrás de un único botón `Cambiar color / Icono`.
- Reordenamiento manual por pulsación larga reutiliza el orden cifrado existente y mantiene efecto visual de jiggle/arrastre.
- Atrás: nota → lista → inicio de carpetas → salir, incluyendo historial real en PWA y comportamiento equivalente en APK.
- `folderGrid.css` vuelve a ser la fuente visual principal del home; `folderReferencePolish.css` y `folderFullWorkspace.css` quedan como shells temporales para no volver a acumular capas visuales contradictorias.

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

1. Validar visualmente el nuevo home de carpetas en PWA real con una captura de PC y otra móvil, comprobando nombres, contadores, portada, Abrir y Opciones.
2. Repetir la prueba de ~818 MB con interrupción de red aproximadamente al 30–50%, cerrar/reabrir OANIX y confirmar reanudación sin empezar desde cero.
3. Solo después aumentar gradualmente el tamaño; 5 GB es una meta posterior, no la siguiente prueba inmediata.
4. Después de estabilizar transferencias: integrar archivos grandes al flujo normal de notas.
5. Antes de considerar terminado el sistema de archivos grandes en Android, implementar y validar transferencia en segundo plano.
6. Más adelante: reproducción de video por rangos/seek, caché bajo demanda, Guardar sin conexión y Liberar del dispositivo (distinto de Eliminar de OANIX).

## Checkpoints históricos útiles

- Base funcional estable histórica: `1ad13a27c1a2e429be1beb839aa3992586361103`.
- Antes de paridad de imágenes Android: `d6d847e7a053f05808518b4e18f871855eb0e9a7`.

Los detalles históricos pertenecen a `CHANGELOG.md`, PRs/issues y `PROJECT_MEMORY.md`; no duplicarlos aquí salvo que afecten el siguiente trabajo.
