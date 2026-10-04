# Protección del consumo de Gemini frente a abuso

## Identidad y estado

Feature ID: `gemini-abuse-protection`. Documento canónico: `specs/gemini-abuse-protection/spec.md`.
Estado: WAITING_FOR_USER. Revisión documental: DOC-11. Plan de implementación: PLAN-1, aprobado por el usuario el 2026-10-04. TASK-001 DONE; TASK-002 TODO.
Checkout observado: `E:/Freelance/PasaData`; rama seleccionada: `codex/gemini-abuse-protection`; base: `b681cb82f0b44548641ef64d5c973260fad1441b`, merge de PR #1. Commit de aplicación aceptado: `f26d6a254f2dddff8c959b316b8cfcebe23bebb8`. La base original propuesta `812a82b0b153462a7b359f1445af8071ab71d59a` no difería en aplicación/configuración relevante. Estado restante a preservar fuera de los commits: next-env.d.ts regenerado y `.codegraph/` untracked. Este spec registra el cierre del work unit y sus decisiones pendientes.
Engram: no hay herramientas del proveedor disponibles en esta sesión; espejo pendiente en `odd/gemini-abuse-protection/tasks`. Linear: no activado.
Próxima acción: presentar TASK-001 completada y obtener decisión explícita de continuación hacia TASK-002. Antes de su implementación se necesita conexión Pencil y aprobación del diseño; no se inicia automáticamente por la aprobación del plan.

## Objetivo y evidencia de base

El usuario pidió una nueva feature para impedir que scripts o ataques contra la web agoten la cuota, los tokens o el saldo de Google Gemini. Autorización actual: PLAN-1 e inicio explícito de TASK-001; TASK-002 no iniciada.

- `src/app/api/extract/route.ts`: único POST de extracción observado; valida multipart, consentimiento declarado, formato, firma y tamaño de la imagen antes de invocar Gemini. No autentica al solicitante ni limita llamadas o concurrencia. El consentimiento declarado puede enviarlo un script.
- `src/server/gemini.ts`: adaptador exclusivo del servidor; clave en `GEMINI_TOKEN`, modelo fijo `gemini-3.8-flash`, una llamada a generateContent, salida limitada a 4096 tokens y timeout de 30 segundos. Estos límites individuales no controlan consumo acumulado.
- `README.md`: documenta que el endpoint sin autenticación necesita controles de abuso y costo antes del despliegue.
- `package.json`: Next.js y TypeScript, Zod, Vitest. Comprobaciones existentes: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. No se ejecutaron en esta preparación.
- `specs/handwritten-interview-export/spec.md`: la feature anterior eligió Vercel y no incorporó autenticación ni almacenamiento. Esa exclusión pertenece a la entrega anterior; no decide el alcance de esta nueva feature.
- `.codegraph/` apareció al retomar; no hay herramientas CodeGraph disponibles en el catálogo de esta sesión. Se preserva y se usan lecturas y búsquedas acotadas.

## Decisiones confirmadas y pendientes

El usuario respondió el 2026-10-04: cualquier visitante con protección antibots; Vercel y sitio todavía no publicado; aproximadamente diez extracciones como máximo por día.

Semántica aprobada en PLAN-1: diez intentos globales diarios de llamada a Gemini para toda la web, reinicio a medianoche de `America/Argentina/Buenos_Aires`. Fallos y timeouts posteriores a la reserva consumen cupo conservadoramente; solicitudes inválidas o bloqueadas antes de reservar no consumen cupo.

Proveedores aprobados para el código: Cloudflare Turnstile y Upstash Redis mediante REST. No se autoriza crear cuentas ni configurar servicios externos.
TDD aprobado: ON con Vitest, por aprobación explícita de PLAN-1.
Pendiente operativo antes de producción: cuenta gratuita/paga, proyecto Gemini dedicado o compartido, hostname de producción, credenciales y configuración efectiva de Vercel/proxy. No se inspeccionaron secretos.

## PLAN-1: criterios y enfoque propuestos

Estos criterios forman PLAN-1, aprobado explícitamente por el usuario.

- AC-001: Turnstile se valida en servidor, incluyendo success, action de extracción y hostname de allowlist configurada. Tokens ausentes, inválidos, vencidos o repetidos no permiten llamar a Gemini. La imagen no se envía a Cloudflare.
- AC-002: como máximo una reserva por IP cada 60 segundos. En Vercel se usa exclusivamente la IP suministrada por su proxy confiable; nunca una IP de formulario ni headers arbitrarios fuera de ese entorno. No se promete una única llamada simultánea global.
- AC-003: un cupo global compartido reserva atómicamente como máximo diez intentos por día calendario de Buenos Aires antes de llamar al proveedor. La reserva evalúa el cupo diario y el intervalo por IP conjuntamente. Rotar IP o cambiar instancia no elude el cupo. Los intentos reservados no se devuelven ante fallo, timeout, aborto o caída del proceso; no hay reintentos automáticos.
- AC-004: una configuración inválida o la indisponibilidad del control global impide llamadas pagas; un mecanismo operativo permite suspender nuevas extracciones.
- AC-005: errores diferenciados y sanitizados para verificación, frecuencia, cupo diario e indisponibilidad; no-store y Retry-After cuando corresponde. El cliente requiere token antes del POST, lo invalida después de cada intento y maneja expiración, reemplazo y desmontaje sin resultados tardíos. La extracción, revisión y exportación legítimas conservan su comportamiento.
- AC-006: no se almacenan imágenes ni datos extraídos. Solo contador diario e identificador HMAC de IP con TTL: contador hasta 48 horas después del cierre de su día para impedir vencimiento anticipado; límite por IP por 60 segundos. Namespace global y credenciales de Redis permanecen estables entre despliegues; rotar el secreto HMAC no reinicia el cupo global. No se guardan claves, challenge tokens ni IP en claro en respuestas o registros.
- AC-007: pruebas sintéticas verifican rechazo sin invocación del proveedor, carreras al llegar al cupo, fallas del control y flujo legítimo. La atomicidad se prueba contra un Redis compatible real usando un namespace sintético desechable; mocks solos no prueban ese criterio. No se usan llamadas pagas ni imágenes generadas como evidencia.

Enfoque: Cloudflare Turnstile y Upstash Redis por REST, sin nuevas dependencias previstas. Script EVAL atómico para comprobar y reservar los dos límites; no GET seguido de INCR, contador local ni helper que permita continuar por timeout. Orden: configuración válida y extracción habilitada, validación existente de imagen, Turnstile, reserva, única llamada a Gemini. Respuestas ambiguas de Redis bloquean y no reintentan la reserva. Las llamadas a servicios de protección llevan timeout y respuesta acotada. Un contador en memoria de una instancia no alcanza para Vercel. CORS y Origin por sí solos no autentican scripts.

Producción, previews y desarrollo requieren configuración explícita de hostnames y namespace. Las previews quedan sin extracción por defecto; si se habilitan con la misma clave de Gemini deben compartir el cupo global, nunca una bolsa adicional accidental. No existe bypass de producción para desarrollo. La clave de Gemini permanece exclusivamente en servidor.

No se promete impedir todo ataque ni un techo exacto en dólares. El límite cuenta intentos, no tokens; protege las llamadas de esta aplicación con el store y namespace preservados. Consumo directo de la clave/proyecto desde otras aplicaciones queda fuera de ese contador. Un atacante que supere Turnstile puede gastar las diez reservas y afectar disponibilidad. Solicitudes bloqueadas todavía pueden consumir recursos de Vercel y de los controles. Antes de producción se deben evaluar también reglas del hosting y los topes del proyecto Google.

## Referencias externas verificadas el 2026-10-04

- [Límites de Gemini](https://ai.google.dev/gemini-api/docs/rate-limits): cuotas por proyecto, no por API key. Los valores reales dependen del modelo, tier y cuenta.
- [Facturación y spend caps de Gemini](https://ai.google.dev/gemini-api/docs/billing#spend-caps): topes mensuales por proyecto; el control está descrito como experimental, con posibles excedentes por latencia aproximada de diez minutos. No se verificó su disponibilidad en la cuenta del usuario.
- [Spend cap budgets de Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps): disponibles para servicios elegibles, incluido Gemini; no son instantáneos y las solicitudes en curso pueden completar con cargos.
- [Validación de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): validación obligatoria en servidor; tokens de un solo uso con vigencia de cinco minutos.
- [REST de Upstash](https://upstash.com/docs/redis/features/restapi) y [aislamiento de scripts](https://upstash.com/docs/redis/features/key-locking): EVAL permite comprobar y reservar de forma atómica.
- [Headers de Vercel](https://vercel.com/docs/headers/request-headers): `x-vercel-forwarded-for` proviene de Vercel. El despliegue debe corresponder al modelo de proxy documentado; no extender confianza a servidores expuestos directamente.

La configuración del proyecto Google, del hosting o de controles externos requiere alcance autorizado y evidencia de la conexión; no se modificó ninguna cuenta.

## Aprobación, tareas y entrega

Aprobación: APPROVE_CURRENT_PLAN. Evidencia directa del usuario el 2026-10-04: “Apruebo plan-1 y el inicio de la task-001”. Cubre AC-001–AC-007, proveedores, TDD ON, estrategia single-pr propuesta y preparación/commits locales; autoriza iniciar solo TASK-001. Diseño de TASK-002 pendiente. No autoriza push, PR, merge ni despliegue.

| Task / WU | Objetivo / criterios | Dependencias | Scope / estado | Estimación de líneas cambiadas |
| --- | --- | --- | --- | --- |
| TASK-001 / WU-001 | Barrera completa de servidor; AC-001 a AC-004, AC-006 y AC-007 servidor | Aprobación e inicio explícito; checks/review/commit aceptados | DONE. `src/app/api/extract/route.ts` y test, `src/server/gemini.ts`, nuevos `src/server/extraction-protection.ts` y test, `README.md`; gemini.test.ts sin cambios | 482 líneas, seis archivos; `f26d6a254f2dddff8c959b316b8cfcebe23bebb8` |
| TASK-002 / WU-002 | Challenge y recuperación accesible; AC-005 y AC-007 cliente | TASK-001 DONE con commit aceptado; diseño aprobado; continuación explícita | TODO. `src/components/extraction-workspace.tsx` y test, nuevos `src/components/turnstile-challenge.tsx` y test, `README.md`; CSS solo según diseño aprobado | 245–450; 4–6 archivos, confianza media |

Total previsto: 675–1140 líneas de adiciones más eliminaciones, 9–11 archivos únicos; sin assets ni lockfile previstos. Ownership: únicamente Implementer para aplicación. Recursos compartidos: contrato multipart/errores, extracción y README; ejecución secuencial.

TASK-001 Done When aceptado: la undécima reserva se rechaza incluso con solicitudes concurrentes; con nueve consumidas solo una nueva reserva gana; nueva instancia/IP no reinicia cupo; frontera del día de Buenos Aires y TTL correctos; intervalo por IP aplicado; fallos de protección bloquean sin Gemini; fallos de Gemini no devuelven reserva; kill switch operativo. Script real probado en Redis temporal, verificación independiente completa, Reviewer APPROVED y commit local confirmado.

TASK-002 Done When: ningún POST sin token válido; cada retry manual renueva token; expiry/fallo ofrece recuperación accesible; desmontaje/reemplazo invalida callbacks; mensajes de cupo y protección no pierden revisión/exportación; comportamiento consistente con Pencil aprobado.

TDD ON aprobado con Vitest. Checks por unidad: pruebas focalizadas de sus archivos y semántica de `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Se ejecutan mediante bins instalados cuando npm no está disponible. Riesgo alto por seguridad y concurrencia: ejecución independiente en Verification-only y Reviewer antes de Delivery; fuente sin cambios entre receipts y commit. Integración Redis real necesaria para AC-007 y disponible en runtime portable loopback; no se autoriza escribir en una cuenta externa mediante aprobación local del plan.

Entrega propuesta: una rama `codex/gemini-abuse-protection` en este mismo checkout desde HEAD verificado; dos commits coherentes, uno por WU. Si ya existe la rama se inspeccionará y no se sobreescribirá. Agrupación single-pr por feature, pese a superar 400 líneas orientativas porque cada barrera incluye comportamiento y pruebas inseparables. Aprobación de PLAN-1 autorizaría preparación de rama y commits locales revisados; push, PR, merge, cuentas externas y despliegue requieren autorización correspondiente. Commits candidatos: `feat: guard Gemini extraction with shared abuse controls`; `feat: require bot verification before extraction`.

Rollback: primero deshabilitar extracción; no revertir la barrera dejando el endpoint público activo. Kill switch por entorno necesita propagación/redeploy y no cancela llamadas ya enviadas.
Ejecución prevista según AGENTS.md: checkout actual, una tarea y un escritor por vez; Implementer escribe código y realiza Delivery; revisión independiente y verificación antes del commit local. Cada siguiente tarea necesita una decisión explícita de continuación.
Diseño: TASK-002 cambia materialmente el envío e incorpora verificación antibots. Requiere Designer, frontend-design y nodos de `PasaDataDesign.pen` aprobados explícitamente antes de implementar esa tarea. No hay herramientas Pencil disponibles en esta sesión; diseño pendiente, sin afirmar un candidato creado. TASK-001 solo toca servidor y puede tener aprobación acotada independiente. No se generan capturas ni exports.

## Progreso, evidencia y cierre de TASK-001

Explorer y Architect prepararon PLAN-1 usando evidencia de código y respuestas del usuario. Usuario aprobó plan e inicio de TASK-001 el 2026-10-04. Delivery `task001_prepare` creó la rama desde base verificada mediante escalación aprobada. Implementer `task001_implementation` trabajó solo en paths del servidor de extracción y README; candidato detenido antes de checks independientes. No se usaron worktrees ni se declaró aislamiento por prompt/TOML.

TDD del escritor: RED de módulo nuevo con 56 fallos y RED de ruta con 12/32 fallos antes de integrar comportamiento; GREEN focalizado 114 tests. Typecheck inicial detectó unión string/Buffer en helper de test; se corrigió y rerun final exitoso. Resultado final: 475 adiciones y siete eliminaciones, seis archivos, dentro del forecast; UI, paquetes, lockfile y gemini.test.ts sin cambios.

Prueba Redis real: ZIP portable 5.0.14.1 de [publisher](https://github.com/tporadowski/redis/releases/tag/v5.0.14.1), SHA256 `018EA18A35876383CBB5F4CD0258ADFC87747CF9D619BCE1CF73A2E36F720CCF`; TEMP `pasadata-task001-redis-161b2ae829b84b91983193be7c5b2709/redis-server.exe`. Descarga mediante escalación aprobada, sin instalar servicio. Test opt-in usa `EXTRACTION_TEST_REDIS_EXECUTABLE`, script productivo exportado, loopback, puerto efímero, namespace sintético y persistencia deshabilitada. Nueve reservas más veinte contendientes: un ganador y diecinueve rechazos; carreras de IP, TTL, corrupción y ventanas obsoletas también comprobadas. Fixture espera salida de su child; comprobación posterior no encontró redis-server. No cuenta externa ni proveedor Gemini utilizados.

Verificación independiente `task001_verification`: COMPLETED. Con Node bundled 24.19.0, `node_modules/vitest/vitest.mjs run` y executable Redis configurado: seis archivos, 171/171, cero omitidos. `node_modules/eslint/bin/eslint.js .`, `node_modules/next/dist/bin/next typegen`, `node_modules/typescript/bin/tsc --noEmit`, `node_modules/next/dist/bin/next build` y `git diff --check`: exit 0. Son bins equivalentes a scripts de package.json; npm literal no disponible. Redis versión/ZIP verificados independientemente; root/ref/HEAD/index y seis hashes fuente sin cambios antes/después. Checks regeneraron next-env.d.ts una sola vez: dos adiciones/dos eliminaciones de `.next/dev/types` a `.next/types`; estable durante verifier y excluido del commit.

Reviewer `task001_review`: APPROVED / READY_TO_CONTINUE, sin findings, sobre DOC-9 y seis fuentes/diff/hashes. Aceptó AC-001–004, AC-006, AC-007 servidor y respuesta de AC-005 servidor; gates previos conservados. Acceso a fuentes mediante adaptador read-only auditado: lecturas literales y diff/hash exclusivamente, sin ejecutar checks ni modificaciones. No se afirma enforcement de los TOML. Root confirmó identidad fuente y ausencia de escritor activo antes de Delivery.

Delivery `task001_prepare`: commit `f26d6a254f2dddff8c959b316b8cfcebe23bebb8`, parent `b681cb82f0b44548641ef64d5c973260fad1441b`, `feat: guard Gemini extraction with shared abuse controls`. Staging solo seis paths revisados y staged diff-check exitoso. Root readback confirmó SHA/parent, alcance, 475/7 numstat, ningún diff de esos paths contra HEAD e índice vacío. Commit fuente y commit aceptado en feature branch son el mismo; sin integración separada. Solo tras esa evidencia TASK-001 se marca DONE.

Feature incompleta: TASK-002 TODO y sin inicio autorizado. El navegador actual todavía no envía Turnstile; extracción permanece cerrada hasta frontend y configuración real. Diseño material necesita Pencil y aprobación explícita. Conexión Pencil ausente en esta sesión. Pruebas de frontera temporal/TTL no esperaron medianoche real ni 60 segundos; wiring Vercel/Turnstile/Upstash sigue pendiente antes de producción. No llamadas reales a Google/Cloudflare/Upstash, inspección de secretos, publicación, merge, despliegue, imágenes ni exports. Engram no disponible, espejo pendiente; Linear no activado. Preservados `.codegraph/` y regeneración de next-env.d.ts fuera del commit. Siguiente acción: decisión explícita del usuario sobre TASK-002.
