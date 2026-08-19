# OANIX — Estado actual para continuidad

**Última actualización:** 2026-08-18

Este archivo es un checkpoint operativo corto para retomar OANIX desde otro chat o con otro agente sin reconstruir conversaciones. Siempre contrastarlo con `main`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` y los issues/PRs mencionados.

## Estado de versiones

- **V1 — Núcleo local:** cerrada.
- **V2 — Cuenta y sincronización:** cerrada funcionalmente; siguen visibles deudas de validación, especialmente #69, #70 y #73.
- **V3 — Android con Capacitor:** cerrada formalmente en #79.
- La APK debug interna tiene **firma estable** y se validó físicamente una actualización APK sobre APK sin desinstalar. La firma definitiva de Play Store sigue siendo independiente.
- La PWA y Android comparten la misma base React + TypeScript + Vite/Capacitor; no crear lógica paralela.

## Dirección visual aprobada

- Base graphite/blue-night con acento violeta contenido; evitar volver a una interfaz excesivamente morada u oscura.
- Sistema de personalización/temas ya existe y debe respetarse mediante variables semánticas.
- Tarjetas de notas, ellipsis de títulos largos, menús y editor ya tienen pulidos post-V3; no rediseñar la dirección principal sin necesidad.
- Priorizar legibilidad y consistencia antes que agregar controles decorativos.

## Privacidad — estado actual

### Protección individual por nota

Implementada y pendiente de validación física final dentro de issue #68.

Invariantes:
- El código de nota es una barrera adicional dentro de la bóveda ya cifrada.
- No se guarda el código en plaintext.
- La autorización temporal vive únicamente en `unlockedNoteIds: Set<string>` dentro de `NotePrivacyRuntime`.
- Un relock manual solo elimina el ID de ese Set; no modifica PBKDF2, el verificador, `note.privacy`, sync, Caja privada ni cifrado.

### PR #133

PR #133 añadió relock manual durante la sesión:
- protegida bloqueada -> candado cerrado;
- código correcto -> autorización temporal en memoria;
- desbloqueada -> candado abierto;
- tocar el candado abierto -> borrar solo esa autorización temporal y ocultar de nuevo el contenido.

### PR #134 — ajuste visual del candado

**En curso durante este checkpoint.** Rama: `fix/note-row-session-lock`.

Decisión de UX acordada con el usuario:
- el candado de sesión debe estar visible **dentro de la burbuja/tarjeta de la nota en la lista**, no junto al título grande de la vista abierta;
- debe verse pequeño, tecnológico y discreto;
- usa SVG con `currentColor` y tokens del tema, no emoji grande;
- nota sin protección: no muestra control;
- protegida bloqueada: candado cerrado;
- protegida desbloqueada temporalmente: candado abierto;
- tocar el candado no debe abrir accidentalmente la tarjeta (`preventDefault` + `stopPropagation`);
- el control reutiliza `unlockedNoteIds`; no crear un segundo store/estado/localStorage/sessionStorage;
- el título existente debe ceder espacio mediante el ellipsis ya implementado; candado y menú `⋮` no se aplastan;
- en ancho <= 360 px, una nota protegida puede ocultar la fecha antes que sacrificar candado/menú;
- el pseudo-candado redundante del título se suprime cuando existe el control explícito;
- relock de una nota distinta a la seleccionada no debe desenfocar el editor activo; `blur()` solo aplica si se relockea la nota abierta.

Archivos de implementación:
- `src/features/privacy/NotePrivacyRuntime.tsx`
- `src/features/privacy/manualNoteRelock.css`
- `tests/manualNoteRelock.test.ts`

Validación requerida antes de merge:
- `npm test` / OANIX CI verde;
- build web/offline audit verde;
- OANIX Android verde;
- revisar que el diff no incluya workflows temporales.

Después del merge, generar/descargar la APK desde el workflow de `main` y entregarla al usuario para prueba física de #68.

## Prueba física pendiente para cerrar #68

En Android:
1. Proteger una nota con código.
2. Código incorrecto -> rechazo.
3. Código correcto -> contenido visible y candado abierto.
4. Tocar candado abierto en la tarjeta -> vuelve a cerrado y oculta contenido inmediatamente.
5. Tocar candado cerrado -> vuelve a pedir código.
6. Quitar protección -> nota normal y sin candado.
7. Mover nota a Caja privada -> desaparece de lista/búsqueda normal.
8. Entrar a Caja privada mediante huella/credencial o contraseña maestra.
9. Cerrar Caja privada y comprobar que reentrar exige autenticación otra vez.

No cerrar #68 antes de esta confirmación física.

## Otros pendientes importantes

- **#69:** validación de resolución de conflictos multidispositivo (local/remoto/combinar, resolución obsoleta, imágenes, delete-vs-edit). Es el siguiente bloque técnico importante después de cerrar privacidad.
- **#70:** validación restante de historial cifrado.
- **#73:** validación restante de recuperación por Email OTP.
- **#105:** huella puede tardar 2–3 aperturas en cold start. Resolver durante pulido Android/RC; no debilitar biometría para ocultarlo.
- **#124:** checklist general de Release Candidate.
- **#125:** preparación de publicación; no comenzar Play Store/firma release definitiva antes de cerrar RC.
- Monetización/OANIX Pro sigue diferida; no implementarla durante el cierre RC.

## Forma de trabajo acordada con el usuario

- El agente debe hacer directamente las operaciones de GitHub que tenga disponibles: ramas, archivos, PRs, CI, logs, reintentos, merges, issues y artifacts.
- No convertir al usuario en operador de GitHub si la herramienta puede hacerlo.
- Para cambios pequeños/locales y seguros, avanzar, probar, integrar y documentar sin detenerse a pedir confirmaciones innecesarias.
- Para seguridad/datos/alcance importante, detenerse si existe una decisión real que deba tomar el usuario.
- Después de cambios Android, si se necesita prueba física, descargar el artifact APK y entregarlo directamente cuando las herramientas lo permitan.

## Próximo paso recomendado

1. Terminar PR #134 con CI + Android verde.
2. Fusionarlo a `main`.
3. Verificar el workflow Android de `main` y firma debug estable.
4. Entregar APK resultante al usuario.
5. Validar físicamente #68.
6. Si todo pasa: documentar y cerrar #68, actualizar #124.
7. Continuar con #69; no abrir funciones nuevas antes de cerrar estas deudas RC.
