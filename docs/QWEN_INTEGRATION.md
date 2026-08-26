# Integración de Qwen en OANIX

## Objetivo

Qwen funciona como revisor técnico independiente y segunda opinión sobre los cambios de OANIX.

No sustituye GitHub como fuente de verdad ni a los checks de CI/Android. El workflow automático no modifica código ni fusiona PRs: revisa y comenta.

## Componentes

La integración deliberadamente está aislada en pocos puntos:

- `/QWEN.md`: contexto permanente, protocolo de frescura y rol independiente.
- `/.github/workflows/qwen-pr-review.yml`: revisión automática de PRs.
- `QWEN_API_KEY`: secret de GitHub Actions creado manualmente por el propietario.
- `.gitignore`: ignora configuración local `.qwen/` y posibles credenciales temporales de GitHub App.

No requiere cambios en código de producción, datos, cifrado, Android, Supabase ni persistencia.

## Activación

1. Obtener una API key compatible con Qwen Code/DashScope.
2. En GitHub: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.
3. Crear exactamente:

   `QWEN_API_KEY`

4. No guardar nunca la clave en `QWEN.md`, workflows, commits, issues o comentarios.

Después de existir el secret, cada PR del propio repositorio se revisará automáticamente cuando se abra, reabra, actualice o pase a ready-for-review.

Los PRs desde forks se excluyen deliberadamente para no exponer secretos.

## Modelo de permisos

El workflow usa el `GITHUB_TOKEN` temporal de GitHub Actions con permisos mínimos:

- `contents: read`
- `pull-requests: write`

La escritura se usa únicamente para publicar el comentario de revisión. Qwen recibe instrucciones explícitas de no modificar archivos, hacer commits, pushes o merges.

No se instala una GitHub App inicialmente. Esto reduce superficie de permisos y hace la eliminación más simple. Si en el futuro se justifica una GitHub App, debe evaluarse por separado.

## Frescura de contexto

`QWEN.md` no sustituye leer el repositorio.

Cada revisión obliga a Qwen a:

- resolver el SHA actual de `origin/main`;
- declarar `MAIN ANALIZADO`;
- declarar `PR HEAD`;
- comparar el PR con `origin/main`;
- leer archivos completos relacionados y pruebas;
- marcar cualquier parte de `QWEN.md` que haya quedado obsoleta.

Así el contexto permanente aporta continuidad sin convertir notas antiguas en fuente de verdad.

## Independencia respecto a ChatGPT

`QWEN.md` contiene objetivos, restricciones y hechos arquitectónicos útiles, pero no prescribe que Qwen adopte la solución propuesta por ChatGPT.

El revisor debe:

- razonar desde código actual;
- buscar causas raíz por sí mismo;
- cuestionar cambios cuando tenga evidencia;
- proponer alternativas mejores cuando existan;
- aceptar una solución de ChatGPT solo si su propia revisión la sostiene.

El objetivo es obtener una segunda perspectiva real, no duplicar el mismo razonamiento.

## Cómo eliminar Qwen rápidamente

La integración está diseñada para poder retirarse sin afectar OANIX.

1. Eliminar `/.github/workflows/qwen-pr-review.yml`.
2. Eliminar `/QWEN.md` si ya no se desea conservar el contexto.
3. Opcionalmente eliminar `/docs/QWEN_INTEGRATION.md`.
4. Eliminar el secret `QWEN_API_KEY` desde GitHub Actions Secrets.
5. Opcionalmente retirar las dos entradas de Qwen en `.gitignore`.

No hay migraciones, tablas, dependencias npm, cambios de datos ni código de producción que revertir.

## Evolución futura

Después de validar varias revisiones automáticas, pueden evaluarse por separado:

- revisión bajo demanda mediante menciones/comandos;
- triage de issues;
- análisis programado de deuda/regresiones;
- una GitHub App con permisos finos si aporta una ventaja concreta.

No se deben activar capacidades de escritura automática sobre código o merge sin una decisión explícita del propietario del proyecto.
