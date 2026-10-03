# Requerimientos: Etapa 1, Fase 2 (Comunicación y Automatizaciones)

**Proyecto:** Multichat Agente IA (Sistema Operativo para Negocios de Servicios Digitales)
**Paso del Método Builder:** 05-Requerimientos
**Versión:** 1.0
**Fecha:** 3 de octubre de 2026
**Cliente:** [Pendiente: nombre del cliente y del negocio]
**Base:** fork de ZernFlow, con la Fase 1 ya construida (migraciones `00001` a `00039`)

> **Cómo leer este documento (para la IA constructora):** este es el plano de la Fase 2. Leelo completo para tener el contexto, pero construí solo el bloque que se te pida en cada sesión. Lo que está marcado como "fuera de alcance" no se construye. Las rutas, tablas y archivos citados existen hoy en el repo salvo que diga "nuevo".

---

## 1. Mapa de ruta de fases

| Etapa | Fase | Duración estimada | Estado |
|---|---|---|---|
| **Etapa 1:** Sistema Operativo Base | Fase 1: Foundation, Canales y CRM | ~1 semana (4 bloques) | Hecha (testing de fase pendiente) |
| | **Fase 2: Comunicación y Automatizaciones** | ~6-7 días medio tiempo (4 bloques + testing) | **← ACTUAL** |
| | Fase 3: Agente IA, Analytics y Pulido | 3-5 días (2-3 bloques + testing integral) | Siguiente |
| **Etapa 2:** Publicación + Email + Roles + Ads | Fases 1-3 | Por definir | Futura |
| **Etapa 3:** Agente IA Integral + Fathom + MCP | Fases 1-3 | Por definir | Futura |
| **Etapa 4 (opcional):** Agendamiento + Ventas + Pipeline | Fases 1-3 | Por definir | Futura |

**Qué NO se construye ahora pero SÍ queda contemplado en el diseño:**

- **Agente IA conversacional (Fase 3):** el "cartero único" (F1), la capa de proveedores de IA (F4), el registro de uso de IA (`ai_usage_logs`) y la búsqueda en la base de conocimiento (F16) se diseñan para que el agente de Fase 3 los reutilice tal cual, sin rehacerlos.
- **Toggle de agente por conversación y memoria acumulativa (Fase 3):** no se tocan ahora. `contacts.ai_conversation_summary` ya existe desde la Fase 1.
- **Dashboards (Fase 3):** `ai_usage_logs`, `messages.sent_by_sequence_id` y los timestamps nuevos de `conversations` quedan listos para que la Fase 3 los grafique.
- **Registro extensible de nodos y triggers (decisión #24 del alcance):** en esta fase se ordena el flow builder en un registro (ver F3) para que los módulos futuros (ventas, agendamiento, tareas, forms) sumen triggers, acciones y condiciones sin tocar el core.
- **Email como canal de automatización (Etapa 2):** el cartero único tiene un punto de extensión para canales nuevos (email, YouTube, LinkedIn), pero en esta fase solo implementa Instagram y WhatsApp.

---

## 2. Objetivo de esta fase y mapa de bloques

**Objetivo:** que el sistema trabaje solo. Que los flows (automatizaciones visuales) y las secuencias (mensajes programados en serie) funcionen en Instagram **y WhatsApp**, a tiempo, con IA usando las keys propias del negocio (BYOK) y respondiendo con la información de su propia base de conocimiento.

**Por qué va en este orden:** la Fase 1 dejó los canales, los contactos y la bandeja. Sin automatizaciones confiables (que se disparen, esperen y envíen a tiempo en los dos canales) no hay sobre qué montar el agente IA de la Fase 3, que es básicamente un "flow de IA que no termina".

**Qué problema resuelve:** hoy el equipo tiene que responder y hacer seguimiento a mano. Con esta fase: los mensajes repetitivos se automatizan, los leads que no contestan reciben seguimiento solo, la IA responde con datos reales del negocio, y el equipo se entera al toque cuando tiene que intervenir.

### Hallazgos del código que cambian el alcance original

Al revisar el repo antes de escribir este plano aparecieron 4 cosas que el alcance daba por resueltas y no lo están. Se suman a esta fase:

| # | Hallazgo | Impacto | Dónde se resuelve |
|---|---|---|---|
| H1 | El webhook de WhatsApp (`app/api/webhooks/evolution/[secret]/route.ts`) **no dispara flows**. Y el motor de flows (`lib/flow-engine/engine.ts`) y el de secuencias (`lib/sequence-processor.ts`) **solo saben enviar por Zernio** (Instagram). | Ningún flow ni secuencia funciona en WhatsApp. | Bloque 1, F1 |
| H2 | Los crons (`vercel.json`) corren **1 vez por día** (plan gratis de Vercel). | Un "esperar 2 horas" tarda hasta 24 horas. Secuencias e inactividad inutilizables. | Bloque 1, F2 (pg_cron de Supabase) |
| H3 | La **auto-pausa de secuencias cuando el contacto responde no existe** (el alcance decía "ya existe en ZernFlow"). | Un lead que ya respondió sigue recibiendo la secuencia. | Bloque 3, F11 |
| H4 | El nodo "AI Response" usa **Vercel AI Gateway** (`workspaces.ai_api_key`), no las keys BYOK que se cargaron en la Fase 1. | Las keys BYOK no se usan en ningún lado. | Bloque 1, F4 |

### Bloques de ejecución de esta fase

| Bloque | Día | Qué se construye | Contexto compartido |
|---|---|---|---|
| Bloque 1: Motor multicanal, reloj y BYOK | 1-2 | F1 cartero único + flows en WhatsApp, F2 reloj con pg_cron, F3 verificación de los 18 nodos + registro extensible, F4 BYOK en nodo AI Response + registro de uso | `lib/flow-engine/*`, `lib/sequence-processor.ts`, webhooks de Evolution y Zernio, `messages`, `conversations`, `ai_usage_logs` (nueva), Vault |
| Bloque 2: Triggers nuevos y feedback de Instagram | 3 | F5 keyword en story reply, F6 nuevo contacto, F7 evento de CRM, F8 inactividad, F9 feedback de restricción de Instagram + alerta de 7 días | `triggers`, `trigger_firings` (nueva), `lib/flow-engine/trigger-matcher.ts`, `lib/actions/contacts.ts`, `lib/audit.ts`, pantalla del flow builder y bandeja |
| Bloque 3: Secuencias | 4 | F10 pantalla de secuencias adaptada, F11 auto-pausa en respuesta, F12 paso de IA en secuencias, F13 detección de colisión, F14 condición de secuencia en flows | `sequences`, `sequence_enrollments`, `/dashboard/sequences`, panel de condición del flow builder |
| Bloque 4: Base de conocimiento y notificaciones | 5-6 | F15 base de conocimiento (carga y conversión), F16 búsqueda inteligente con Voyage AI (RAG), F17 IA usando la base de conocimiento, F18 notificaciones para admins | `knowledge_documents` y `knowledge_chunks` (nuevas), pgvector, Supabase Storage, `/dashboard/knowledge` (nueva), `admin_notifications` |
| Testing de fase | 7 (medio día a 1 día) | Testing funcional de F1 a F18 + correcciones + colchón | No aplica |

---

## 3. Usuarios y roles

No cambian los roles de la Fase 1 (Owner, Admin, Member con scope duro de leads). Esta fase define qué puede hacer cada uno con los módulos nuevos.

| Rol | Flows | Secuencias | Base de conocimiento | Notificaciones |
|---|---|---|---|---|
| Owner | Crear, editar, publicar, archivar | Crear, editar, activar, pausar, gestionar inscripciones de todos | Crear, editar, borrar (soft), probar búsqueda | Ve todas las del workspace. Configura los avisos por email |
| Admin | Igual que Owner | Igual que Owner | Igual que Owner | Igual que Owner |
| Member | Solo ver (lectura) | Ver secuencias. Ver inscripciones **solo de sus contactos** (scope de leads). Inscribir manualmente a un contacto suyo | Solo ver | Solo las dirigidas a él (ej: derivación a humano de una conversación suya) |

- **Decisión por defecto (confirmar en testing):** Member no edita flows, secuencias ni la base de conocimiento, porque un error ahí afecta a todos los leads del negocio. Si el negocio quiere que un Member edite, se resuelve con los roles custom de Etapa 2.
- **Rol del primer usuario:** Owner (sin cambios).
- **Invitaciones:** sin cambios (Fase 1).

---

## 4. Alcance específico de esta fase

### 4.1. Cartero único (envío unificado multicanal)
- **Qué hace:** una sola función de envío (`sendOutboundMessage`) que recibe "a quién, por qué conversación, qué contenido" y decide sola si manda por Zernio (Instagram) o por Evolution API (WhatsApp). La usan los flows, las secuencias y (en Fase 3) el agente IA. Además, el webhook de WhatsApp pasa a disparar flows igual que el de Instagram.
- **Hasta dónde llega:** texto, imagen, audio y video en los dos canales. Botones, respuestas rápidas y carruseles se adaptan a texto con opciones numeradas en WhatsApp (Baileys no garantiza botones interactivos). Bloquea el envío a contactos con "no contactar". Registra cada envío en `messages` con su origen (flow, secuencia o persona).
- **Qué NO hace:** email, YouTube o LinkedIn como canal (Etapa 2). Plantillas oficiales de WhatsApp Business API (no aplica, se usa Baileys).
- **Dónde va lo que queda afuera:** Etapa 2.

### 4.2. Reloj del sistema (pg_cron)
- **Qué hace:** reemplaza los crons diarios de Vercel por `pg_cron` + `pg_net` dentro de Supabase, que llaman a los endpoints de cron de la app cada minuto (o lo que corresponda a cada uno).
- **Hasta dónde llega:** jobs (delays de flows y broadcasts heredados), secuencias, inactividad (nuevo), purga de borrados (diario). Protegido con `CRON_SECRET`. Configurado por migración idempotente.
- **Qué NO hace:** colas de trabajo dedicadas (BullMQ o similar). Precisión menor a 1 minuto.
- **Dónde va lo que queda afuera:** si el volumen lo pide, Etapa 3 (cola de auto-publicación).

### 4.3. Flow builder: verificación y registro extensible
- **Qué hace:** verificar que los 18 tipos de nodo existentes funcionen en los dos canales (o que avisen claramente cuando no aplican, ej: "Responder comentario" es solo Instagram). Reordenar la definición de triggers, acciones y condiciones en un registro central para que módulos futuros se sumen sin tocar el core.
- **Hasta dónde llega:** registro de tipos (`lib/flow-engine/registry.ts`, nuevo) con: tipo, etiqueta en español, canales compatibles, panel de configuración, ejecutor. El palette del builder se arma desde el registro. Avisos de compatibilidad por canal en el builder.
- **Qué NO hace:** nodos nuevos de módulos futuros (ventas, agenda, tareas). Rediseño visual del builder.
- **Dónde va lo que queda afuera:** cada módulo futuro registra los suyos (Etapa 4, Extras).

### 4.4. BYOK en el nodo AI Response
- **Qué hace:** el nodo "Respuesta con IA" deja de usar AI Gateway y usa las keys BYOK de la Fase 1 (OpenAI, Anthropic, Google, guardadas en Vault), vía Vercel AI SDK v6 con conexión directa a cada proveedor (decisión #4 del alcance).
- **Hasta dónde llega:** selector de proveedor (solo los conectados) y modelo en el nodo. Capa de abstracción `generateAiText()` (nueva, `lib/ai/`) que usan flows, secuencias y la Fase 3. Registro de cada llamada en `ai_usage_logs`. Manejo de key inválida o proveedor caído.
- **Qué NO hace:** fallback automático a otro proveedor. Pantalla de consumo de IA.
- **Dónde va lo que queda afuera:** pantalla de consumo, Fase 3 (dashboards). Fallback, fuera del proyecto por ahora (ver 13).

### 4.5. Triggers nuevos
- **Qué hace:** suma 3 tipos de trigger y un filtro:
  - **Keyword en story reply** (filtro sobre el trigger de keyword existente): solo dispara si el mensaje es una respuesta a una historia de Instagram.
  - **Nuevo contacto:** dispara cuando se crea un contacto.
  - **Evento de CRM:** dispara por cambios en el contacto (tag agregado o quitado, campo cambiado, setter o vendedor asignado, temperatura cambiada, marcado "no contactar").
  - **Inactividad:** dispara cuando pasa un tiempo X desde nuestro último mensaje sin respuesta del contacto.
- **Hasta dónde llega:** configuración en el panel del trigger, protección contra bucles y contra disparos repetidos.
- **Qué NO hace:** triggers por evento de agenda, venta, formulario o llamada. Bienvenida a nuevos seguidores (la API no lo permite, decisión #13).
- **Dónde va lo que queda afuera:** Etapa 3 (Fathom), Etapa 4 (agenda, ventas), Extra C (forms).

### 4.6. Feedback de restricciones de Instagram
- **Qué hace:** si un envío por Instagram falla (ventana de mensajería vencida u otro error de la API), el mensaje queda marcado como fallido con una explicación en español, visible en la bandeja. Si pasaron 7+ días sin que el lead escriba, se muestra una alerta en la conversación.
- **Hasta dónde llega:** reacción a errores, no prevención (decisión #16 del alcance). Rate limit de 200 mensajes automatizados por hora por canal de Instagram.
- **Qué NO hace:** lógica proactiva de ventana 24h/7d, botón de "reintentar envío".
- **Dónde va lo que queda afuera:** fuera del proyecto (decisión #16).

### 4.7. Secuencias
- **Qué hace:** adapta la pantalla existente de secuencias: paso de mensaje con IA, auto-pausa cuando el contacto responde (se construye, no existía), varias secuencias por contacto, alerta de colisión, gestión de inscripciones (pausar, reanudar, sacar) y condición "¿está en la secuencia X?" en el flow builder.
- **Hasta dónde llega:** funciona en Instagram y WhatsApp vía el cartero único. Respeta "no contactar".
- **Qué NO hace:** secuencias por email, envío en horario hábil o por zona horaria del contacto, ramificaciones dentro de una secuencia (para eso están los flows), A/B dentro de secuencias.
- **Dónde va lo que queda afuera:** email, Etapa 2. Horario hábil, ramificaciones y A/B, fuera del proyecto por ahora.

### 4.8. Base de conocimiento con búsqueda inteligente
- **Qué hace:** pantalla para cargar documentos del negocio (escribir o pegar texto, o subir `.md`, `.txt`, `.pdf`, `.docx`). Todo se convierte a markdown editable, con título y etiquetas. Cada documento se parte en pedazos y se indexa con **Voyage AI** (embeddings, o sea "huellas de significado" de cada pedazo) en Supabase con pgvector. La IA (nodo de flows y paso de secuencias) busca los pedazos más relevantes a la conversación y responde con esa información (RAG).
- **Hasta dónde llega:** key de Voyage cargada por el usuario (BYOK, Vault). Filtro por etiquetas. Pantalla de "probar búsqueda". Re-indexado automático al editar.
- **Qué NO hace:** OCR de PDFs escaneados (imágenes), lectura de URLs, imágenes o audio como fuente, reranking, sincronización con Google Drive o Notion.
- **Dónde va lo que queda afuera:** URLs y reranking, Fase 3 si hace falta. Video, Extra G. Drive/Notion, fuera del proyecto por ahora.

### 4.9. Notificaciones para admins
- **Qué hace:** extiende la campanita existente (`admin_notifications`) con nuevos avisos: derivación a humano, colisión de secuencias, key de IA o de Voyage inválida, documento que falló al procesarse. Aviso por email opcional (Resend) para los más urgentes.
- **Hasta dónde llega:** notificaciones in-app con link directo a lo que hay que mirar, dirigidas a Owner/Admin o a un usuario puntual (el asignado). Configuración de qué avisos llegan por email.
- **Qué NO hace:** push al celular, WhatsApp o Telegram al dueño, resúmenes diarios.
- **Dónde va lo que queda afuera:** aviso por WhatsApp/Telegram al dueño, Etapa 3 (agente integral). Push, fuera del proyecto (no hay app móvil).

---

## 5. Funcionalidades y criterios de aceptación (por bloque)

### Bloque 1: Motor multicanal, reloj y BYOK

#### F1: Cartero único y flows en WhatsApp
**Descripción:** una sola puerta de salida para todos los mensajes automáticos, que entiende los dos canales. Y que los mensajes de WhatsApp disparen flows igual que los de Instagram.

**Criterios de aceptación:**
- [ ] Existe `lib/messaging/send.ts` (nuevo) con `sendOutboundMessage({ workspaceId, conversationId, content, origin })`. `origin` es `{ type: 'flow' | 'sequence' | 'user' | 'agent', id }`.
- [ ] Según `conversations.platform`: `instagram` (y `facebook`/`twitter` si están conectados) envía por Zernio con la key de `readChannelSecret`; `whatsapp` envía por Evolution API (`lib/evolution-client.ts`) con el teléfono del contacto.
- [ ] Antes de enviar: si `contacts.do_not_contact = true`, **no envía**, devuelve `{ ok: false, reason: 'do_not_contact' }` y lo registra en `audit_log` (`action = 'send_blocked'`). Esto aplica a flows y secuencias; el envío manual de una persona sigue mostrando la advertencia de la Fase 1 y deja enviar.
- [ ] Todo envío exitoso o fallido se guarda en `messages` con `direction = 'outbound'`, `status`, `sent_by_flow_id`/`sent_by_node_id` o `sent_by_sequence_id` (nuevo) o `sent_by_user_id`, y en caso de error `error_code` y `error_message` (nuevos). Actualiza `conversations.last_outbound_at` (nuevo) y `last_message_at`/`last_message_preview`.
- [ ] El adaptador de plataforma existente (`lib/flow-engine/platform-adapter.ts`) se usa dentro del cartero: en WhatsApp, botones, quick replies y carruseles se convierten a texto con opciones numeradas ("Respondé 1, 2 o 3"); imagen, audio y video se mandan como media.
- [ ] Los nodos del motor de flows (`sendMessage`, `aiResponse`) y `lib/sequence-processor.ts` dejan de llamar a Zernio directo y usan el cartero. `commentReply` y `privateReply` siguen usando Zernio directo (son solo Instagram).
- [ ] El webhook de Evolution (`app/api/webhooks/evolution/[secret]/route.ts`), al guardar un mensaje entrante, hace lo mismo que el de Instagram: actualiza `conversations.last_inbound_at` (nuevo), evalúa triggers con `matchTrigger` y ejecuta el flow con `executeFlow`, respetando `is_automation_paused`.
- [ ] El webhook de Zernio también actualiza `conversations.last_inbound_at`.
- [ ] Un flow con trigger de keyword "hola" publicado sin canal específico responde tanto a un DM de Instagram como a un WhatsApp que digan "hola".
- [ ] La respuesta a un postback de botón convertido a número en WhatsApp ("1") se interpreta como el payload del botón 1 (mapeo guardado en la sesión del flow).
- [ ] Tests unitarios del ruteo por plataforma, del bloqueo por "no contactar" y de la conversión de botones a números.

#### F2: Reloj del sistema con pg_cron
**Descripción:** que las esperas, secuencias e inactividad corran a tiempo, sin pagar Vercel Pro.

**Criterios de aceptación:**
- [ ] Migración nueva habilita `pg_cron` y `pg_net` (si no están) y programa estos jobs, idempotente (`cron.unschedule` por nombre antes de `cron.schedule`):

| Job | Endpoint | Frecuencia |
|---|---|---|
| `zf_jobs` | `/api/cron/jobs` | cada 1 minuto |
| `zf_sequences` | `/api/cron/sequences` | cada 1 minuto |
| `zf_inactivity` | `/api/cron/inactivity` (nuevo, F8) | cada 5 minutos |
| `zf_purge_deleted` | `/api/cron/purge-deleted` | diario 04:00 UTC |

- [ ] La URL de la app y el `CRON_SECRET` se guardan en Supabase Vault (`app_base_url`, `cron_secret`) y el job los lee de ahí. **Nunca** quedan escritos en la migración. Si no existen, el job no hace nada y no tira error. El README explica cómo cargarlos (un `select vault.create_secret(...)`).
- [ ] Se sacan los crons de `vercel.json` (queda vacío o sin la clave `crons`) para no tener dos relojes.
- [ ] Los endpoints de cron son idempotentes y aguantan corridas superpuestas: usan el `claimed_at` existente (`scheduled_jobs`) y un "claim" equivalente en `sequence_enrollments` (`UPDATE ... WHERE status='active' AND next_step_at <= now() AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes') RETURNING`).
- [ ] Cada endpoint procesa como máximo 50 ítems por corrida y termina en menos de 50 segundos.
- [ ] Un flow con "Esperar 2 minutos" entre dos mensajes envía el segundo entre 2 y 3 minutos después del primero, en producción.

#### F3: Verificación de nodos y registro extensible
**Descripción:** confirmar que los 18 nodos funcionan y ordenarlos para que el sistema crezca sin deuda.

**Criterios de aceptación:**
- [ ] Existe `lib/flow-engine/registry.ts` (nuevo) con un registro de triggers, acciones y condiciones. Cada entrada declara: `type`, `label` (español), `description`, `category` (trigger, mensaje, lógica, contacto, IA, secuencias, integraciones), `platforms` compatibles, `panel` (componente de configuración) y `execute`.
- [ ] El palette del builder (`components/flow-builder/node-palette.tsx`) y el sidebar de configuración se arman leyendo el registro, no con listas escritas a mano.
- [ ] Los 18 tipos de `NodeType` están registrados, con etiquetas en español: Trigger, Enviar mensaje, Condición, Esperar, Agregar etiqueta, Quitar etiqueta, Cambiar campo, Pedido HTTP, Ir a otro flow, Suscribir, Desuscribir, Derivar a humano, Responder comentario, Respuesta privada, Prueba A/B, Espera inteligente, Respuesta con IA, Inscribir en secuencia.
- [ ] `commentReply` y `privateReply` declaran `platforms: ['instagram', 'facebook']`. Si el flow tiene un trigger atado a un canal de WhatsApp, el builder muestra un aviso amarillo en esos nodos ("Este paso solo funciona en Instagram") y al ejecutarse en WhatsApp se saltan sin romper el flow (queda logueado).
- [ ] Se mantiene: motor recursivo con profundidad máxima 50, interpolación de variables con dot-path, flow stack para sub-flujos.
- [ ] Checklist de verificación manual de los 18 nodos en los dos canales queda escrita en `docs/progreso.md` con resultado de cada uno.
- [ ] Agregar un trigger o acción de prueba al registro (en un test) lo hace aparecer en el palette sin modificar el builder.

#### F4: BYOK en el nodo "Respuesta con IA" + registro de uso
**Descripción:** que la IA use las keys propias del negocio y que quede registrado cuánto se usa.

**Criterios de aceptación:**
- [ ] Existe `lib/ai/generate.ts` (nuevo) con `generateAiText({ workspaceId, provider, model, system, messages, temperature, maxTokens, purpose, refs })`. Lee la key del proveedor de Vault (`aiProviderSecretName`), crea el cliente con `@ai-sdk/openai`, `@ai-sdk/anthropic` o `@ai-sdk/google` (dependencias nuevas) y llama a `generateText` del AI SDK v6.
- [ ] El nodo "Respuesta con IA" tiene selector de **Proveedor** (solo los conectados en Integraciones; si no hay ninguno, el selector muestra "Conectá un proveedor de IA" con link a `/dashboard/settings/integrations`) y de **Modelo** (lista de `AI_PROVIDER_DEFAULT_MODELS` + opción de escribir uno a mano).
- [ ] Se exponen al usuario: prompt de sistema, temperatura (0 a 1), máximo de tokens de respuesta (50 a 2000, default 500), cantidad de mensajes de contexto (1 a 30, default 10), "enviar directo" (existente). Lo demás lo fija el sistema.
- [ ] Migración de datos: los nodos existentes con modelo formato gateway (`openai/gpt-4o-mini`) se interpretan como `provider = openai`, `model = gpt-4o-mini` al cargarse (compatibilidad hacia atrás en código, sin migrar el JSON a mano).
- [ ] Se elimina el uso de `workspaces.ai_api_key`, `ai_provider` y `AI_GATEWAY_API_KEY` en el código, y la sección "AI Gateway" de `/dashboard/settings`. Las columnas quedan en la base (no se borran) marcadas como obsoletas en un comentario SQL. `.env.example` se actualiza.
- [ ] Cada llamada (éxito o error) se guarda en `ai_usage_logs` (nueva): proveedor, modelo, propósito (`flow_ai_response`, `sequence_ai_message`, `knowledge_embedding`, `knowledge_query`), tokens de entrada y salida, referencias (flow, nodo, secuencia, contacto, conversación), éxito y código de error.
- [ ] Errores: si la key es inválida (401/403) se crea una notificación `ai_key_invalid` para Owner/Admin (máximo 1 cada 6 horas por proveedor) y la sesión del flow se cancela sin mandar nada al lead. Si el proveedor está caído o limita (429/5xx) se reintenta 2 veces con espera creciente (2s, 6s) y si sigue fallando se cancela igual. Nunca se envía al lead el texto `{{ai_response}}` sin resolver.
- [ ] En los logs no aparece ninguna API key ni el prompt completo del sistema.

### Bloque 2: Triggers nuevos y feedback de Instagram

#### F5: Trigger keyword en respuesta a historia
**Descripción:** poder armar campañas tipo "respondé ESTO a mi historia y te mando el link".

**Criterios de aceptación:**
- [ ] El panel del trigger de keyword suma un switch "Solo respuestas a historias (Instagram)". Se guarda en `triggers.config.onlyStoryReplies = true`.
- [ ] Con el switch encendido, el trigger solo matchea si el mensaje entrante trae `storyReply` (dato que Zernio ya manda y la Fase 1 ya detecta). Con el switch apagado, se comporta igual que hoy.
- [ ] Si el flow está atado a un canal de WhatsApp, el switch aparece deshabilitado con la nota "Solo disponible en Instagram".

#### F6: Trigger "Nuevo contacto"
**Criterios de aceptación:**
- [ ] Nuevo tipo `new_contact` en `triggers.type` (migración que actualiza el check).
- [ ] Dispara cuando se crea un contacto por: mensaje entrante (webhooks), creación manual en `/dashboard/contacts`. **No** dispara por importación CSV salvo que el trigger tenga encendido "Incluir contactos importados por CSV" (`config.includeCsv`, default apagado), para no mandar mensajes masivos sin querer.
- [ ] Filtro opcional por canal de origen (Instagram, WhatsApp, cualquiera).
- [ ] Si el contacto se crea por un mensaje entrante que además matchea un trigger de keyword, se ejecutan los dos flows (primero el de nuevo contacto, después el de keyword), salvo que sean el mismo flow (se ejecuta una vez).
- [ ] Si el contacto no tiene ninguna conversación (creado a mano sin canal), el flow corre igual, pero los nodos de envío se saltan con log "sin conversación para enviar".

#### F7: Trigger "Evento de CRM"
**Criterios de aceptación:**
- [ ] Nuevo tipo `crm_event` con `config.event` en: `tag_added`, `tag_removed`, `field_changed`, `setter_assigned`, `vendedor_assigned`, `temperature_changed`, `do_not_contact_marked`. Con filtros según evento: qué tag, qué campo (fijo o custom) y opcionalmente qué valor nuevo, qué temperatura.
- [ ] Se dispara desde un único punto: `emitCrmEvent()` (nuevo, `lib/crm-events.ts`) que se llama desde las Server Actions de contacto, tags, custom fields, asignación y opt-out, **y** desde los nodos del flow que cambian tags o campos.
- [ ] La conversación usada para enviar es la última activa del contacto (`last_message_at` más reciente).
- [ ] **Protección contra bucles:** un flow disparado por evento de CRM no puede volver a disparar el mismo flow para el mismo contacto dentro de 10 minutos, y la cadena de eventos encadenados tiene profundidad máxima 5. Si se corta, queda en el log.
- [ ] Ejemplo verificable: flow "Cuando se agrega el tag `caliente` → enviar mensaje y asignar vendedor" se ejecuta al poner el tag desde la ficha del contacto.

#### F8: Trigger "Inactividad"
**Descripción:** seguimiento automático cuando el lead deja de responder.

**Criterios de aceptación:**
- [ ] Nuevo tipo `inactivity` con `config.after` (número) y `config.unit` (horas o días), rango de 1 hora a 30 días. Filtro opcional por canal.
- [ ] Regla de disparo: la conversación tiene `last_outbound_at` posterior a `last_inbound_at` (o sea, nosotros escribimos último) y pasó el tiempo configurado desde `last_outbound_at`. Solo conversaciones de Instagram o WhatsApp, no borradas, con contacto sin "no contactar" y sin `is_automation_paused`.
- [ ] Lo revisa el cron nuevo `/api/cron/inactivity` cada 5 minutos.
- [ ] Dispara **una sola vez** por cada "último mensaje nuestro sin respuesta": se registra en `trigger_firings` (nueva) con `(trigger_id, conversation_id, reference_at = last_outbound_at)` único. Si el lead responde y después volvemos a quedar sin respuesta, puede volver a disparar.
- [ ] En el builder, el panel explica en simple: "Se dispara si el contacto no responde a tu último mensaje en X tiempo. Usalo para hacer seguimiento."
- [ ] Nota para Instagram: si el seguimiento cae fuera de la ventana de mensajería, el envío va a fallar y se ve el aviso de F9 (no hay prevención, decisión #16).

#### F9: Feedback de restricciones de Instagram y alerta de 7 días
**Criterios de aceptación:**
- [ ] Cuando Zernio devuelve error al enviar, el cartero guarda `messages.status = 'failed'`, `error_code` y `error_message` en español. Mapeo mínimo: ventana de mensajería vencida → "Instagram no deja escribirle a esta persona porque pasó demasiado tiempo desde su último mensaje. Esperá a que vuelva a escribir."; límite de envíos → "Instagram limitó los envíos por un rato. Se va a reintentar más tarde."; otro → "Instagram rechazó el mensaje" + código.
- [ ] En la bandeja, el mensaje fallido se muestra con borde rojo, ícono de alerta y el texto del error al pasar el mouse (o al tocar en mobile).
- [ ] Si un envío de un flow falla, la sesión del flow se marca como cancelada (no sigue mandando los pasos siguientes) y queda en el log.
- [ ] Si la conversación es de Instagram y `now() - last_inbound_at > 7 días`, el hilo muestra arriba un banner amarillo: "Hace más de 7 días que esta persona no escribe. Es probable que Instagram no deje enviarle mensajes." (calculado en pantalla, sin columna nueva).
- [ ] Rate limit: máximo 200 mensajes automatizados (flows + secuencias) por hora por canal de Instagram. Si se alcanza, los envíos quedan como `scheduled_jobs` para la hora siguiente en vez de perderse. Los envíos manuales de personas no cuentan para el límite.

### Bloque 3: Secuencias

#### F10: Pantalla de secuencias adaptada
**Criterios de aceptación:**
- [ ] Se mantienen `/dashboard/sequences` y `/dashboard/sequences/[sequenceId]` existentes, traducidas al español y con los componentes del sistema (`select-field`, `DateField`).
- [ ] El editor permite 3 tipos de paso: **Mensaje** (texto con variables), **Mensaje con IA** (F12) y **Esperar** (minutos, horas o días).
- [ ] Estados de la secuencia: `draft` (borrador), `active` (activa), `paused` (pausada). Soft delete con `deleted_at` (nuevo). Pausar una secuencia **no** cancela las inscripciones (cambio respecto a hoy, que las cancela): quedan esperando y siguen al reactivarla.
- [ ] Lista de inscripciones con: contacto, canal, paso actual, próximo envío, estado, y acciones Pausar, Reanudar, Sacar (para Member, solo sus contactos y sin "Sacar").
- [ ] Estados de inscripción: `active`, `paused_reply` (respondió), `paused_manual`, `paused_optout` (Fase 1), `paused_collision` (no se usa automáticamente, ver F13), `failed`, `completed`, `cancelled`. Transiciones válidas en la sección 14.
- [ ] Inscribir manual: desde la ficha del contacto, botón "Inscribir en secuencia" (elige secuencia y canal entre las conversaciones del contacto).
- [ ] Un contacto puede estar en varias secuencias a la vez (se mantiene `UNIQUE(sequence_id, contact_id)`: no dos veces en la misma).

#### F11: Auto-pausa cuando el contacto responde
**Criterios de aceptación:**
- [ ] Al guardar un mensaje entrante (los dos webhooks), todas las inscripciones `active` de ese contacto **en el mismo canal** pasan a `paused_reply` con `paused_at = now()`.
- [ ] Configuración por secuencia `pause_on_reply` (default `true`, switch "Pausar si el contacto responde"). Si está apagado, la secuencia sigue aunque responda.
- [ ] La inscripción pausada muestra "Pausada porque respondió el [fecha]" y el botón "Reanudar" (Owner/Admin). Reanudar recalcula `next_step_at` desde ahora con el delay del paso actual.
- [ ] Queda registrado en `audit_log` (`entity_type = 'sequence_enrollments'`, `action = 'paused_reply'`).

#### F12: Paso "Mensaje con IA" en secuencias
**Criterios de aceptación:**
- [ ] El paso tiene: proveedor y modelo (como F4), instrucción ("Escribí un seguimiento corto preguntando si pudo ver la propuesta"), switch "Usar base de conocimiento" con filtro de etiquetas (F17).
- [ ] Al ejecutarse, la IA recibe: la instrucción, los datos del contacto (nombre, tags, temperatura, notas recientes, `ai_conversation_summary` si existe) y los últimos 10 mensajes de esa conversación. Genera el mensaje y lo envía con el cartero.
- [ ] Si la IA falla, se reintenta en la siguiente corrida del cron, hasta 3 veces. Después la inscripción pasa a `failed` con `last_error` y se notifica a Owner/Admin.
- [ ] El texto generado queda guardado en `messages` como cualquier envío (con `sent_by_sequence_id`).

#### F13: Detección de colisión de secuencias
**Criterios de aceptación:**
- [ ] Hay colisión cuando un contacto tiene más de una inscripción `active` (o recién creada) en **el mismo canal**.
- [ ] Se chequea al inscribir (manual, por nodo "Inscribir en secuencia" o reanudando). La inscripción se crea igual (no se bloquea, regla del alcance).
- [ ] Al detectarse: notificación `sequence_collision` a Owner/Admin con link al contacto, y badge naranja "Colisión" en la lista de inscripciones de ambas secuencias y en la ficha del contacto.
- [ ] Desde el badge, el admin elige: pausar una (`paused_manual`), dejar ambas (marca la colisión como revisada, `collision_ack_at`), o sacar al contacto de una (`cancelled`).

#### F14: Condición de secuencia en flows
**Criterios de aceptación:**
- [ ] El nodo Condición suma el campo "Secuencia" con operadores: "está inscripto en" (cualquier estado activo o pausado), "está activo en", "completó", "no está en". Se elige la secuencia de una lista.
- [ ] Se evalúa contra `sequence_enrollments` del contacto en el momento.
- [ ] Se registra en el registro de condiciones de F3 (no como caso especial en el motor).

### Bloque 4: Base de conocimiento y notificaciones

#### F15: Base de conocimiento (carga y conversión)
**Criterios de aceptación:**
- [ ] Pantalla nueva `/dashboard/knowledge` (ítem "Conocimiento" en el sidebar).
- [ ] Crear documento de dos formas: "Escribir" (editor markdown con vista previa) o "Subir archivo" (`.md`, `.txt`, `.pdf`, `.docx`, máximo 10 MB, varios a la vez hasta 10).
- [ ] Conversión server-side: `.docx` con `mammoth` (a HTML y luego a markdown con `turndown`), `.pdf` con `unpdf` (texto por página), `.md`/`.txt` directo. Validación del tipo real del archivo (magic bytes), no solo la extensión.
- [ ] Si un PDF no tiene texto (escaneado), el documento queda en estado `error` con el mensaje "Este PDF parece una imagen escaneada y no tiene texto para leer. Pegá el contenido a mano." No hay OCR.
- [ ] El archivo original se guarda en Supabase Storage, bucket privado `knowledge-files`, ruta `{workspace_id}/{document_id}/{nombre}`. Se puede descargar con URL firmada de 5 minutos.
- [ ] Cada documento tiene: título (obligatorio, máx 150), etiquetas (lista libre con autocompletado de las existentes), contenido markdown editable, estado (`processing`, `ready`, `error`), fecha y autor de última edición.
- [ ] Editar y guardar el contenido dispara el re-indexado (F16). Borrar es soft delete (y sus pedazos dejan de usarse en las búsquedas al instante).
- [ ] Todo cambio queda en `audit_log`.

#### F16: Búsqueda inteligente con Voyage AI (RAG)
**Descripción:** que la IA encuentre los párrafos que sirven para cada pregunta, aunque estén escritos con otras palabras.

**Criterios de aceptación:**
- [ ] En `/dashboard/settings/integrations`, sección IA, nueva tarjeta **"Voyage AI (búsqueda en base de conocimiento)"**: el usuario pega su API key, se valida con una llamada de prueba y se guarda en Vault (`voyage_api_key`). Fila en `integration_configs` con `type = 'embedding_provider'` (migración que actualiza el check).
- [ ] Modelo: `voyage-4`, 1024 dimensiones (multilingüe, US$0,06 por millón de tokens, los primeros 200 millones gratis). Configurable por variable en código, no en la UI.
- [ ] Indexado: el markdown se parte en pedazos de ~800 tokens con 100 de superposición, respetando títulos (`#`, `##`) como cortes preferidos. Cada pedazo se envía a `POST https://api.voyageai.com/v1/embeddings` con `input_type = 'document'` (hasta 128 pedazos por llamada) y se guarda en `knowledge_chunks` con su vector (pgvector, índice HNSW con distancia coseno).
- [ ] El indexado corre en segundo plano (job en `scheduled_jobs` tipo `knowledge_index`, lo levanta el cron de jobs). El documento pasa de `processing` a `ready` o `error`. Al re-indexar se borran los pedazos viejos de ese documento (son datos derivados, ver 8.3).
- [ ] Si el contenido no cambió (`content_hash` igual), no se re-indexa.
- [ ] Búsqueda: función `searchKnowledge({ workspaceId, query, tags?, limit = 5, minSimilarity = 0.35 })` (nueva, `lib/knowledge/search.ts`): calcula el vector de la pregunta con `input_type = 'query'` y llama a la función SQL `match_knowledge_chunks` (nueva). Solo devuelve pedazos de documentos `ready` y no borrados, filtrando por etiquetas si se piden.
- [ ] Pantalla "Probar búsqueda" dentro de `/dashboard/knowledge`: escribís una pregunta y ves los 5 pedazos encontrados, de qué documento vienen y su puntaje.
- [ ] Sin key de Voyage: la pantalla funciona (se pueden cargar y editar documentos), pero muestra un banner "Conectá Voyage AI para que la IA pueda usar estos documentos" y los documentos quedan en `processing` hasta que se conecte (al conectar, se indexan los pendientes).
- [ ] Cada llamada a Voyage se registra en `ai_usage_logs` (`knowledge_embedding` o `knowledge_query`).

#### F17: La IA usa la base de conocimiento
**Criterios de aceptación:**
- [ ] El nodo "Respuesta con IA" (F4) y el paso "Mensaje con IA" (F12) suman el switch "Usar base de conocimiento" y un filtro opcional de etiquetas.
- [ ] Con el switch encendido: se arma la pregunta con el último mensaje del contacto (más los 2 anteriores si son cortos), se buscan los pedazos relevantes (F16) y se agregan al prompt de sistema en un bloque "Información del negocio".
- [ ] Al prompt de sistema se suma siempre esta regla: "Respondé solo con la información del negocio que te paso. Si no está, decí que lo vas a consultar con el equipo. No inventes precios, plazos ni datos." (regla del alcance: "nunca inventa información fuera de la base de conocimiento").
- [ ] Si la búsqueda no devuelve nada por encima del umbral, la IA recibe el bloque vacío y la instrucción de derivar. Opción del nodo: "Si no encuentra información, derivar a humano" (default encendido), que dispara la lógica de "Derivar a humano" (F18).
- [ ] Si Voyage falla, la respuesta se genera sin base de conocimiento **solo si** el switch "Responder igual si falla la búsqueda" está encendido (default apagado). Si está apagado, la sesión se cancela y se notifica.

#### F18: Notificaciones para admins
**Criterios de aceptación:**
- [ ] `admin_notifications` suma `user_id` (destinatario puntual, opcional), `conversation_id`, `contact_id` y `link`. RLS: Owner/Admin ven todas las del workspace; Member solo las que tienen su `user_id`.
- [ ] Tipos de notificación de esta fase:

| Tipo | Cuándo | Para quién | Email |
|---|---|---|---|
| `whatsapp_disconnected` | (existe) WhatsApp se desconecta | Owner/Admin | Sí (existe) |
| `human_handoff` | Un flow ejecuta "Derivar a humano" o la IA deriva | Asignado de la conversación; si no hay, Owner/Admin | Configurable (default sí) |
| `sequence_collision` | F13 | Owner/Admin | No |
| `sequence_failed` | F12 tras 3 reintentos | Owner/Admin | No |
| `ai_key_invalid` | F4, key de IA o Voyage rechazada | Owner/Admin | Configurable (default sí) |
| `knowledge_doc_failed` | F15/F16, documento en `error` | Quien lo subió + Owner/Admin | No |

- [ ] El nodo "Derivar a humano" además de pausar la automatización de la conversación (comportamiento actual) crea la notificación `human_handoff` con el último mensaje del contacto como texto.
- [ ] La campanita del sidebar muestra el contador de no leídas, lista con ícono por tipo, tiempo relativo ("hace 5 min") y click que lleva al `link` y marca como leída. Botón "Marcar todas como leídas".
- [ ] En `/dashboard/settings`, sección nueva "Avisos por email" con switches por tipo (los que dicen "Configurable"). Se guarda en `workspaces.notification_settings` (nuevo, jsonb).
- [ ] Anti-spam: no se repite la misma notificación (mismo tipo + misma conversación o canal) dentro de 30 minutos.
- [ ] Se actualiza en tiempo real (Supabase Realtime, igual que hoy).

### Funcionalidades de fases siguientes (no se construyen ahora)
- Agente IA conversacional con tool calling: Fase 3.
- Toggle de agente IA por conversación: Fase 3.
- Memoria acumulativa por contacto y clasificación automática post-conversación: Fase 3.
- Dashboards de conversaciones, mensajes diarios por canal, patrones y contenido orgánico: Fase 3.
- Pantalla de consumo de IA (lee `ai_usage_logs`): Fase 3.
- Secuencias y automatizaciones por email: Etapa 2.

---

## 6. Flujos principales

### 6.1. Flujo: Lead escribe por WhatsApp y se dispara un flow (F1)
1. El lead manda "Hola, info de precios" por WhatsApp.
2. Evolution API avisa al webhook. El sistema guarda el mensaje, actualiza `last_inbound_at`, vincula o crea el contacto (Fase 1).
3. Si el contacto se creó recién, se evalúan triggers `new_contact` (F6).
4. Se pausan las inscripciones activas del contacto en WhatsApp (F11).
5. Se chequea "no contactar" por frases (Fase 1).
6. Si la conversación no tiene la automatización pausada, `matchTrigger` busca un trigger de keyword que matchee ("precios").
7. Si hay match, `executeFlow` corre el flow. Cada envío pasa por el cartero, que manda por Evolution API.
8. **Si el contacto está marcado "no contactar":** el cartero bloquea los envíos, el resto del flow (tags, campos) corre igual.
9. **Si Evolution está desconectado:** el envío queda `failed` con "WhatsApp está desconectado", la sesión se cancela y la notificación `whatsapp_disconnected` ya existe.

### 6.2. Flujo: Seguimiento por inactividad con IA y base de conocimiento (F8, F4, F17)
1. Nosotros mandamos una propuesta por Instagram a las 10:00. El lead no responde.
2. Hay un flow con trigger "Inactividad: 24 horas" → nodo "Respuesta con IA" con base de conocimiento.
3. Al día siguiente, después de las 10:00, el cron de inactividad detecta la conversación, registra en `trigger_firings` y ejecuta el flow.
4. La IA busca en la base de conocimiento lo relevante a la conversación, arma un seguimiento y el cartero lo manda por Zernio.
5. **Si Instagram rechaza por ventana vencida:** el mensaje queda fallido con la explicación (F9), la sesión se cancela, el equipo lo ve en la bandeja.
6. **Si el lead responde a las 12:00 antes del seguimiento:** `last_inbound_at` > `last_outbound_at`, la conversación deja de ser candidata y no se dispara.

### 6.3. Flujo: Secuencia con auto-pausa y colisión (F10 a F13)
1. Un flow inscribe al contacto en "Nutrición 5 días" por WhatsApp.
2. El sistema ve que ya está activo en "Reactivación" por WhatsApp → crea la inscripción igual, notifica `sequence_collision` y marca el badge.
3. El admin abre el badge y elige "Pausar Reactivación".
4. El cron de secuencias envía el paso 1 (mensaje), espera 1 día, ejecuta el paso 2 (mensaje con IA).
5. El contacto responde algo → la inscripción pasa a `paused_reply`.
6. El vendedor atiende la conversación. Si después quiere que siga, el admin toca "Reanudar".
7. **Si el contacto se marca "no contactar":** pasa a `paused_optout` (Fase 1) y el cartero bloquea cualquier envío pendiente.

### 6.4. Flujo: Carga de un documento a la base de conocimiento (F15, F16)
1. El admin entra a "Conocimiento" y sube `lista-de-precios.pdf` con etiqueta `precios`.
2. El sistema valida tipo y tamaño, guarda el original en Storage, convierte a markdown y crea el documento en `processing`.
3. Un job de indexado parte el texto en pedazos, pide los vectores a Voyage y los guarda. El documento pasa a `ready`.
4. El admin usa "Probar búsqueda" con "¿cuánto sale una landing?" y ve el pedazo correcto arriba.
5. **Si el PDF es escaneado:** estado `error` con la explicación y notificación al que lo subió.
6. **Si no hay key de Voyage:** queda en `processing` con el banner "Conectá Voyage AI". Al conectar, se indexa solo.
7. **Si el admin edita el texto:** se recalcula el hash, y si cambió, se re-indexa.

### 6.5. Flujo: Derivación a humano (F18)
1. Un flow llega al nodo "Derivar a humano" (o la IA no encontró información y deriva, F17).
2. Se pausa la automatización de la conversación (`is_automation_paused = true`, comportamiento actual) y se manda el mensaje de derivación si está configurado.
3. Se crea la notificación `human_handoff` para el asignado (o para Owner/Admin si no hay asignado), con el último mensaje del lead.
4. Si el aviso por email está encendido, se manda por Resend.
5. La persona toca la notificación y cae directo en la conversación de la bandeja.

---

## 7. Modelo de datos

Todas las migraciones nuevas arrancan en **`00040_`**, idempotentes, con RLS y GRANT (`authenticated` y `service_role`, ver `00017` y `00034`).

### 7.1. Tablas nuevas

**`ai_usage_logs`** (registro de cada llamada a IA o Voyage; no se edita ni se borra)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | Sí | PK |
| workspace_id | uuid | Sí | FK `workspaces` |
| provider | text | Sí | `openai`, `anthropic`, `google`, `voyage` |
| model | text | Sí | Ej: `claude-haiku-4-5`, `voyage-4` |
| purpose | text | Sí | `flow_ai_response`, `sequence_ai_message`, `knowledge_embedding`, `knowledge_query` (Fase 3 suma `agent_turn`) |
| input_tokens | int | No | |
| output_tokens | int | No | |
| success | boolean | Sí | |
| error_code | text | No | Ej: `401`, `429`, `timeout` |
| flow_id | uuid | No | FK `flows` on delete set null |
| sequence_id | uuid | No | FK `sequences` on delete set null |
| contact_id | uuid | No | FK `contacts` on delete set null |
| conversation_id | uuid | No | FK `conversations` on delete set null |
| created_at | timestamptz | Sí | default now() |

RLS: SELECT Owner/Admin. INSERT solo service role. Índice `(workspace_id, created_at)`.

**`trigger_firings`** (evita disparar dos veces el mismo trigger de inactividad o de evento de CRM)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | Sí | PK |
| trigger_id | uuid | Sí | FK `triggers` on delete cascade |
| conversation_id | uuid | No | FK `conversations` on delete cascade |
| contact_id | uuid | Sí | FK `contacts` on delete cascade |
| reference_at | timestamptz | Sí | Para inactividad: el `last_outbound_at` que se usó. Para CRM: momento del evento |
| created_at | timestamptz | Sí | default now() |

Único: `(trigger_id, conversation_id, reference_at)`. RLS: SELECT Owner/Admin, INSERT solo service role. Se purga por cron lo de más de 90 días (dato técnico, no de negocio).

**`knowledge_documents`**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | Sí | PK (generado en código, patrón de la Fase 1) |
| workspace_id | uuid | Sí | FK `workspaces` |
| title | text | Sí | Máx 150 |
| tags | text[] | Sí | default `'{}'`. Índice GIN |
| content_md | text | Sí | Contenido markdown editable |
| content_hash | text | Sí | sha256 del contenido, para no re-indexar sin cambios |
| source_type | text | Sí | `manual`, `upload` |
| file_path | text | No | Ruta en Storage del original |
| file_name | text | No | |
| file_mime | text | No | |
| file_size | int | No | Bytes |
| status | text | Sí | `processing`, `ready`, `error` |
| error_message | text | No | En español |
| embedding_model | text | No | Modelo con el que se indexó (ej: `voyage-4`) |
| indexed_at | timestamptz | No | |
| created_by | uuid | Sí | FK `auth.users` |
| updated_by | uuid | No | FK `auth.users` |
| created_at, updated_at | timestamptz | Sí | |
| deleted_at | timestamptz | No | Soft delete (purga a 30 días, incluye el archivo en Storage) |

RLS: SELECT cualquier miembro del workspace (no borrados). INSERT/UPDATE Owner/Admin. Sin DELETE para `authenticated`.

**`knowledge_chunks`** (pedazos indexados; datos derivados)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | Sí | PK |
| document_id | uuid | Sí | FK `knowledge_documents` on delete cascade |
| workspace_id | uuid | Sí | Duplicado a propósito para filtrar rápido en la búsqueda |
| chunk_index | int | Sí | Orden dentro del documento |
| heading | text | No | Título de la sección de donde sale |
| content | text | Sí | Texto del pedazo |
| token_count | int | No | |
| embedding | vector(1024) | Sí | pgvector |
| created_at | timestamptz | Sí | |

Índice HNSW `embedding vector_cosine_ops`. RLS: SELECT cualquier miembro. Escritura solo service role.

**Función SQL `match_knowledge_chunks(p_workspace_id uuid, p_query vector(1024), p_tags text[], p_limit int, p_min_similarity float)`**: devuelve `chunk_id, document_id, title, heading, content, similarity`, uniendo con `knowledge_documents` donde `status = 'ready'` y `deleted_at is null` y (si `p_tags` no está vacío) `tags && p_tags`. `security invoker`, se llama con service role desde el servidor.

### 7.2. Cambios a tablas existentes

| Tabla | Cambio | Para qué |
|---|---|---|
| `conversations` | + `last_inbound_at timestamptz`, + `last_outbound_at timestamptz`. Backfill desde `messages` donde exista. Índice `(workspace_id, last_outbound_at)` | Inactividad (F8), alerta 7 días (F9), auto-pausa |
| `messages` | + `sent_by_sequence_id uuid` (FK `sequences` on delete set null), + `error_code text`, + `error_message text` | Origen del envío y feedback de errores (F1, F9) |
| `triggers` | Check de `type` suma `new_contact`, `crm_event`, `inactivity`. `config` suma `onlyStoryReplies`, `includeCsv`, `event`, `after`, `unit` según tipo | F5 a F8 |
| `sequences` | + `pause_on_reply boolean default true`, + `deleted_at timestamptz`. `steps` (jsonb) suma tipo `ai_message` | F10 a F12 |
| `sequence_enrollments` | + `paused_at`, + `claimed_at`, + `retry_count int default 0`, + `last_error text`, + `collision_ack_at timestamptz`, + `updated_at`. `status` suma `paused_reply`, `paused_manual`, `failed`. RLS: Member solo ve las de contactos que puede ver (`can_see_contact`) | F10 a F13, scope de leads |
| `admin_notifications` | + `user_id uuid`, + `conversation_id uuid`, + `contact_id uuid`, + `link text`. Nueva policy SELECT/UPDATE para Member donde `user_id = auth.uid()` | F18 |
| `workspaces` | + `notification_settings jsonb default '{"email":{"human_handoff":true,"ai_key_invalid":true}}'`. `ai_api_key` y `ai_provider` quedan obsoletas (comentario SQL, no se borran) | F18, F4 |
| `integration_configs` | Check de `type` suma `embedding_provider` | F16 |
| `scheduled_jobs` | `type` suma `knowledge_index` y `rate_limited_send` | F16, F9 |

**Formato de `sequences.steps` (jsonb):**
```json
[
  { "type": "message", "content": "Hola {{contact.display_name}}..." },
  { "type": "delay", "delayMinutes": 1440 },
  { "type": "ai_message", "provider": "anthropic", "model": "claude-haiku-4-5",
    "instruction": "Escribí un seguimiento corto...", "useKnowledge": true, "knowledgeTags": ["precios"] }
]
```

### 7.3. Notas de optimización
- **No se crea tabla de "notificaciones por usuario"**: se agrega `user_id` opcional a `admin_notifications` existente.
- **No se crea tabla de "envíos"**: `messages` ya es el registro de todo lo enviado; se le suman origen y error.
- **La alerta de 7 días de Instagram no se guarda**: se calcula en pantalla con `last_inbound_at`.
- **Colisión de secuencias no se guarda como entidad**: se deriva consultando inscripciones activas del mismo contacto y canal; solo se guarda que el admin la revisó (`collision_ack_at`).
- **`knowledge_chunks.workspace_id` está duplicado a propósito** (excepción a "no duplicar"): evita un join en cada búsqueda vectorial, que es la consulta más frecuente del agente de Fase 3.
- **`knowledge_chunks` se borran en duro al re-indexar** (excepción al soft delete): son datos derivados que se regeneran desde `content_md`, no información del negocio. El documento sí tiene soft delete.
- **Pensado para el futuro:** `ai_usage_logs.purpose` admite valores nuevos (Fase 3, Etapa 3); el registro de nodos (F3) y `emitCrmEvent` (F7) son los puntos donde ventas, agenda, tareas y forms enganchan sus triggers.

### 7.4. Políticas de datos
- **Soft delete:** `sequences`, `knowledge_documents` (nuevo), más lo de Fase 1. Purga a 30 días con el cron existente (se le suman estas tablas y los archivos de Storage).
- **Auditoría (`audit_log`):** crear/editar/publicar/archivar flows, crear/editar/activar/pausar secuencias, cambios de estado de inscripciones (manuales y automáticos), envíos bloqueados por "no contactar", crear/editar/borrar documentos de conocimiento, conectar/desconectar Voyage, cambios en avisos por email.
- **Snapshots:** no aplica en esta fase (no hay precios ni transacciones). Lo que sí se "congela": el texto generado por IA queda guardado en `messages` tal como se envió.

---

## 8. Arquitectura del sistema

```
                    ┌──────────────── Supabase ────────────────┐
                    │ Postgres + RLS + Vault + Realtime        │
                    │ pgvector (knowledge_chunks)              │
                    │ pg_cron ──(pg_net, cada 1 min)──┐        │
                    │ Storage (bucket knowledge-files) │        │
                    └───────────────▲──────────────────┼────────┘
                                    │                  │ HTTPS + CRON_SECRET
 Instagram ─ Zernio ─webhook─┐      │                  ▼
                              ├──> App Next.js en Vercel ──> /api/cron/jobs, /sequences, /inactivity
 WhatsApp ─ Evolution API ───┘     │  (webhooks, Server Actions, motor de flows)
   (Railway, URL pública +          │
    API key + secreto por canal)    ├── lib/messaging/send.ts (cartero) ──> Zernio | Evolution API
                                    ├── lib/ai/generate.ts ──> OpenAI | Anthropic | Google (BYOK)
                                    ├── lib/knowledge/* ──> Voyage AI (BYOK)
                                    └── Resend (avisos por email)
```

- **Frontend y backend:** Next.js 16 (App Router), Server Components por defecto, Server Actions para mutaciones, API Routes para webhooks y crons.
- **Hosting (corrige el alcance):** app en **Vercel**, Evolution API en **Railway** como servicio aparte con URL pública protegida por API key y secreto por canal en el webhook (decisión tomada en Fase 1).
- **Reloj:** pg_cron dentro de Supabase llama a la app (decisión de esta fase).
- **Autenticación:** Supabase Auth SSR con cookies httpOnly (sin cambios).

### 8b. Storage de archivos

| Tema | Definición |
|---|---|
| Dónde | Supabase Storage, bucket **privado** `knowledge-files` (nuevo, creado por migración idempotente) |
| Acceso | Solo por servidor. Descarga con URL firmada de 5 minutos para miembros del workspace. Política de Storage: lectura/escritura solo service role |
| Estructura | `{workspace_id}/{document_id}/{file_name}` |
| Límites | 10 MB por archivo, hasta 10 archivos por carga. MIME permitidos: `text/markdown`, `text/plain`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Validación por magic bytes en el servidor |
| Temporales | La conversión se hace en memoria en la Server Action o el job; no se escriben archivos temporales en disco |
| Plan | Supabase Pro (100 GB) alcanza de sobra: una base de conocimiento típica es menos de 100 MB |
| Borrado | El archivo se borra de Storage cuando el cron de purga elimina el documento (30 días después del soft delete) |
| CDN | No aplica (archivos privados, de uso interno) |
| Futuro | Media de contenido (Etapa 3) usará otro bucket; si supera 100 GB, migrar a Cloudflare R2 |

---

## 9. Stack y decisiones técnicas

| Componente | Tecnología | Justificación |
|---|---|---|
| App | Next.js 16 + React 19 + TypeScript 5 + Tailwind v4 (fork de ZernFlow) | Base existente |
| Hosting app | Vercel | Decidido en Fase 1 |
| WhatsApp | Evolution API (Baileys) en Railway | Decidido en Fase 1 |
| Instagram | Zernio (`@zernio/node`) | Base existente |
| Base de datos | Supabase Postgres + RLS + Vault + Realtime | Base existente |
| Reloj (cron) | **pg_cron + pg_net de Supabase** | Gratis, ya está en el stack, cada 1 minuto, queda en una migración. Vercel gratis solo permite 1 vez por día |
| IA de texto | Vercel AI SDK v6 + `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, conexión directa BYOK | Decisiones #3 y #4 del alcance. Se saca AI Gateway |
| Búsqueda en conocimiento | **Voyage AI `voyage-4`** (1024 dim) + **pgvector** con índice HNSW | Elegido por el usuario. Multilingüe, barato (200M tokens gratis), y pgvector evita sumar otra base de datos |
| Conversión de documentos | `mammoth` + `turndown` (docx), `unpdf` (pdf) | Livianos, sin binarios nativos (funcionan en Vercel) |
| Email | Resend (existente, `lib/email/send-email.ts`) | Base de Fase 1 |
| Tests | Vitest | Base existente |

**Dependencias nuevas:** `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `mammoth`, `turndown`, `unpdf`. Voyage se llama con `fetch` (sin SDK, mismo criterio que Resend en Fase 1).

---

## 10. Pantallas principales

### 10.1. Convenciones globales (sin cambios respecto a Fase 1)
- **Navegación:** sidebar existente. Se suma el ítem **"Conocimiento"** (ícono de libro) debajo de "Secuencias".
- **Componentes:** dropdowns con `components/ui/select-field.tsx`, fechas con `DateField` en formato `dd/mm/yyyy`, confirmaciones con `ConfirmDialog` + toast de "Deshacer" (Sonner) en borrados.
- **Estados:** vacío con explicación + botón de acción, skeleton al cargar, error en español con qué hacer, toast de éxito.
- **Textos:** español rioplatense, sin jerga técnica (ej: "Pausar si el contacto responde", no "auto-pause on inbound").
- **Responsive:** las pantallas nuevas funcionan en mobile (≥ 360px). El flow builder (canvas) es solo escritorio; en mobile muestra "Abrí el editor de flows desde una computadora" con la lista de flows igual navegable.

### 10.2. Bloque 1

#### Pantalla: Editor de flow (`/dashboard/flows/[flowId]`, existente)
- **Cambios:** palette armado desde el registro (F3) y agrupado por categoría con nombres en español. Avisos amarillos de compatibilidad por canal en los nodos.
- **Panel "Respuesta con IA":** Proveedor (select, solo conectados), Modelo (select + "Otro..."), Prompt de sistema (textarea), Temperatura (slider 0-1), Largo máximo (número), Mensajes de contexto (número), Enviar directo (switch). En Bloque 4 se suman los controles de base de conocimiento (F17).
- **Estado sin proveedor conectado:** el panel muestra "Para usar IA, conectá OpenAI, Anthropic o Google en Integraciones" con botón.
- **Permisos:** Member ve el editor en solo lectura (sin palette, sin guardar ni publicar).

#### Pantalla: Settings (`/dashboard/settings`, existente)
- **Cambio:** se elimina la sección "AI Gateway".

### 10.3. Bloque 2

#### Pantalla: Panel de trigger (dentro del editor de flow)
- **Selector de tipo** con: Palabra clave, Botón, Respuesta rápida, Bienvenida, Por defecto, Palabra clave en comentario, **Nuevo contacto**, **Evento de CRM**, **Inactividad**.
- **Palabra clave:** se suma el switch "Solo respuestas a historias (Instagram)".
- **Nuevo contacto:** canal de origen (select), switch "Incluir contactos importados por CSV" con texto de advertencia.
- **Evento de CRM:** select de evento; según el evento: select de tag, select de campo + valor opcional, select de temperatura.
- **Inactividad:** número + unidad (horas/días), canal, y la explicación en simple.
- **Validaciones:** inactividad entre 1 hora y 30 días; evento de tag requiere elegir tag.

#### Pantalla: Bandeja (`/dashboard/inbox`, existente)
- **Mensaje fallido:** burbuja con borde rojo e ícono; tooltip (o toque en mobile) con el error en español.
- **Banner de 7 días:** amarillo, arriba del hilo, solo Instagram.
- **Origen del mensaje:** las burbujas salientes muestran una etiqueta chica: "Flow: [nombre]", "Secuencia: [nombre]" o el nombre de la persona.

### 10.4. Bloque 3

#### Pantalla: Lista de secuencias (`/dashboard/sequences`)
- **Layout:** tabla con nombre, estado (badge), cantidad de pasos, inscriptos activos, pausados, completados, y badge naranja si hay colisiones sin revisar.
- **Acciones:** Nueva secuencia, Activar/Pausar, Editar, Eliminar (soft, Owner/Admin).
- **Vacío:** "Todavía no tenés secuencias. Una secuencia manda mensajes de seguimiento solos, con esperas entre cada uno." + botón "Crear secuencia".

#### Pantalla: Editor de secuencia (`/dashboard/sequences/[sequenceId]`)
- **Layout:** columna izquierda con los pasos en línea vertical (tarjetas reordenables con arrastrar); derecha con la configuración del paso elegido. Arriba: nombre, descripción, estado, switch "Pausar si el contacto responde".
- **Paso Mensaje:** textarea con botones de variables (igual que templates de Fase 1).
- **Paso Mensaje con IA:** proveedor, modelo, instrucción, switch base de conocimiento + etiquetas.
- **Paso Esperar:** número + unidad.
- **Pestaña "Inscripciones":** tabla filtrable por estado con contacto (link a la ficha), canal, paso actual ("2 de 5"), próximo envío, estado, badge de colisión, acciones (Pausar, Reanudar, Sacar).
- **Reglas:** no se puede activar una secuencia sin pasos o que empiece con "Esperar" sin ningún mensaje después. Editar pasos de una secuencia activa aplica a los próximos pasos de los inscriptos (no reenvía lo ya enviado); si se borran pasos y un inscripto queda con índice fuera de rango, se completa.
- **Mobile:** pasos en lista, configuración en sheet desde abajo.

#### Componente: Badge y modal de colisión
- Texto: "Este contacto está en 2 secuencias activas por WhatsApp: [A] y [B]." Botones: "Pausar [A]", "Pausar [B]", "Dejar las dos", "Sacar de [A]"...

#### Pantalla: Ficha de contacto (`/dashboard/contacts/[contactId]`, existente)
- **Sección nueva "Secuencias":** lista de inscripciones del contacto con estado y acciones, y botón "Inscribir en secuencia".

#### Panel: Condición (editor de flow)
- Campo nuevo "Secuencia" con operadores y select de secuencia (F14).

### 10.5. Bloque 4

#### Pantalla: Conocimiento (`/dashboard/knowledge`, nueva)
- **Propósito:** cargar y mantener la información con la que responde la IA.
- **Layout:** header con "Nuevo documento" (menú: Escribir / Subir archivos) y "Probar búsqueda". Barra de búsqueda por título y filtro por etiquetas. Lista en tarjetas o tabla: título, etiquetas, estado (Listo / Procesando / Error), origen (ícono de archivo o de lápiz), última edición.
- **Banner** si falta Voyage: "Conectá Voyage AI para que la IA pueda usar estos documentos" + botón a Integraciones.
- **Vacío:** "Cargá acá lo que la IA tiene que saber de tu negocio: servicios, precios, preguntas frecuentes, políticas." + botones.
- **Error de un documento:** badge rojo con el motivo y botón "Reintentar" (re-encola el indexado).
- **Permisos:** Member ve la lista y los documentos en solo lectura.

#### Pantalla: Documento (`/dashboard/knowledge/[documentId]`, nueva)
- **Layout:** título editable, etiquetas (input con chips y autocompletado), editor markdown a la izquierda y vista previa a la derecha (en mobile, pestañas "Editar" / "Vista previa"). Si viene de archivo: link "Descargar original".
- **Guardar:** valida título, guarda, cambia estado a "Procesando" y muestra toast "Guardado. Actualizando la búsqueda...".
- **Eliminar:** `ConfirmDialog` + toast con "Deshacer".

#### Modal: Subir archivos
- Zona de arrastrar o elegir archivos, lista con nombre, tamaño, validación en vivo (tipo y tamaño), etiquetas para todos. Botón "Subir". Muestra progreso y resultado por archivo.

#### Modal: Probar búsqueda
- Input de pregunta, filtro de etiquetas, botón "Buscar". Resultados: hasta 5 tarjetas con título del documento, sección, extracto y "Coincidencia: 82%". Vacío: "No encontré nada parecido. Probá con otras palabras o cargá un documento sobre esto."

#### Pantalla: Integraciones (`/dashboard/settings/integrations`, existente)
- Tarjeta nueva en sección IA: "Voyage AI", con texto "Se usa para que la IA encuentre la información correcta en tu base de conocimiento.", input de key, botón Conectar, estado y Desconectar. Link a "Cómo conseguir la key".

#### Componente: Campanita de notificaciones (sidebar, existente)
- Lista con ícono por tipo, título, texto corto, tiempo relativo, punto azul si no leída. Click lleva al link. "Marcar todas como leídas". Vacío: "Todo al día".

#### Pantalla: Settings (`/dashboard/settings`)
- Sección nueva "Avisos por email" con switches: "Cuando un flow o la IA deriva a una persona", "Cuando una key de IA deja de funcionar". (WhatsApp desconectado ya avisa siempre.)

---

## 11. Guías de UI

- Diseño neutro y profesional, el mismo sistema visual de la Fase 1 (dark mode heredado de ZernFlow incluido).
- Colores de estado: verde = activo/listo, amarillo = advertencia (7 días, compatibilidad de canal), naranja = colisión, rojo = error/fallido, gris = pausado/borrador.
- Toda configuración técnica lleva una línea de ayuda en simple debajo del campo.
- No mostrar IDs, códigos HTTP ni nombres de tablas al usuario.

---

## 12. Fuera del alcance de esta fase

### Para fases siguientes de esta etapa (Fase 3)
| Funcionalidad | Nota |
|---|---|
| Agente IA conversacional con tool calling | Reutiliza cartero, `generateAiText` y `searchKnowledge` de esta fase |
| Toggle de agente por conversación, delays de respuesta y ráfaga | Fase 3 |
| Memoria acumulativa y clasificación post-conversación | Fase 3 |
| Dashboards y pantalla de consumo de IA | Fase 3, leen `messages` y `ai_usage_logs` |
| Opción "Agente IA" en el filtro de asignación de la bandeja | Fase 3 (decidido en Fase 1) |

### Para etapas futuras
| Funcionalidad | Etapa | Nota |
|---|---|---|
| Secuencias y flows por email (Resend inbound/outbound) | Etapa 2 | El cartero ya tiene el punto de extensión |
| Roles custom (ej: Member que edita flows) | Etapa 2 | |
| Aviso al dueño por WhatsApp/Telegram | Etapa 3 | Agente integral |
| Triggers de agenda, ventas, llamadas, forms | Etapa 3/4, Extra C | Se enganchan al registro (F3) y a `emitCrmEvent` (F7) |
| Lectura de URLs en la base de conocimiento, reranking | Fase 3 o Etapa 3, si hace falta | |
| Análisis de video como fuente de conocimiento | Extra G | |

### Fuera del proyecto (por ahora)
| Funcionalidad | Motivo |
|---|---|
| OCR de PDFs escaneados | Costo y complejidad; se pega el texto a mano |
| Lógica proactiva de ventana 24h/7d de Instagram | Decisión #16 del alcance |
| Fallback automático entre proveedores de IA | Cambia el tono y el costo sin que el negocio lo decida; se notifica y se corta |
| Envío en horario hábil / zona horaria del contacto | No pedido; posible mejora futura |
| Ramificaciones y A/B dentro de secuencias | Para eso están los flows |
| Botón "reintentar envío" de mensajes fallidos | El error suele ser la ventana de Instagram; reintentar no sirve |
| Broadcasts | Decisión #10 del alcance (siguen existiendo en el código heredado, no se tocan ni se promocionan) |
| Push notifications | No hay app móvil |
| Sincronizar conocimiento con Google Drive o Notion | No pedido |

---

## 13. Decisiones transversales

| Decisión | Definición para esta fase |
|---|---|
| Historial y auditoría | `audit_log` en todo lo listado en 7.4. `ai_usage_logs` como registro aparte de IA |
| Soft delete | `sequences` y `knowledge_documents` con `deleted_at`. Excepción: `knowledge_chunks` (derivados) y `trigger_firings` (técnicos) se borran en duro |
| Deduplicación de contactos | Sin cambios (Fase 1: teléfono > email > username). El trigger "Nuevo contacto" solo dispara cuando de verdad se crea uno, no cuando se vincula a uno existente |
| Snapshot de precios | No aplica en esta fase. El texto generado por IA queda guardado tal cual se envió |
| Estados y ciclo de vida | Secuencia: `draft → active ⇄ paused`, soft delete desde cualquiera. Inscripción: `active → paused_reply / paused_manual / paused_optout → active` (reanudar), `active → completed / failed / cancelled` (finales). Documento: `processing → ready / error`, `ready → processing` al editar, `error → processing` al reintentar |
| Casos borde | Corridas superpuestas del cron: claim con `claimed_at`. Flow que dispara su propio evento de CRM: corte por bucle (F7). Secuencia editada con inscriptos: aplica a pasos futuros. Contacto borrado (soft) con inscripciones: el cron las cancela. Canal desconectado: envío `failed` y sesión cancelada. Dos admins editando el mismo documento: gana el último guardado (se muestra "Editado por X hace 1 min" al abrir) |
| Zona horaria e idioma | Todo se guarda en UTC. Se muestra en la zona del navegador. Los delays son relativos, no dependen de la zona. Idioma: español rioplatense |
| Motor de automatización | Flow engine de ZernFlow + registro extensible (F3) + reloj pg_cron (F2) + cartero único (F1) |
| Precios variables | No aplica |
| Modelo de asignación | Sin cambios (setter/vendedor/asignado de Fase 1). La derivación a humano notifica al asignado de la conversación, o a Owner/Admin si no hay |
| Contacto cross-canal | Sin cambios. Auto-pausa y colisión de secuencias se evalúan **por canal** (respuesta por Instagram no pausa una secuencia de WhatsApp) |
| BYOK y secrets | Keys de OpenAI, Anthropic, Google y Voyage en Vault. Key inválida: notificación + corte, sin romper el resto. Sin fallback. Rotación manual desde Integraciones |
| Capa de abstracción de IA | `generateAiText()` para texto, `embedTexts()` / `searchKnowledge()` para conocimiento. Agregar un proveedor = sumar un caso en la capa, no tocar flows ni secuencias |
| Patrón de webhooks | Sin cambios: ack rápido, idempotencia con `webhook_events`, secreto por canal. El procesamiento de flows en el webhook de WhatsApp sigue el mismo patrón que el de Instagram |
| Broadcasts y rate limiting | 200 mensajes automatizados por hora por canal de Instagram (F9). WhatsApp: espaciado mínimo de 1 segundo entre envíos automáticos del mismo canal, para reducir riesgo de bloqueo del número (Baileys) |

---

## 13b. Seguridad

| Área | Definición |
|---|---|
| Autenticación | Sin cambios (Supabase Auth SSR, cookies httpOnly) |
| RLS | Tablas nuevas con RLS + GRANT. `ai_usage_logs`: SELECT Owner/Admin, INSERT service role. `trigger_firings`: SELECT Owner/Admin, escritura service role. `knowledge_documents`: SELECT miembros, INSERT/UPDATE Owner/Admin, sin DELETE. `knowledge_chunks`: SELECT miembros, escritura service role. `sequence_enrollments`: Member solo filas de contactos que ve (`can_see_contact`). `admin_notifications`: Member solo las propias. Storage `knowledge-files`: solo service role |
| Validación | Todo en servidor (Server Actions con Zod): rangos de triggers, pasos de secuencias, tamaño/tipo de archivos (magic bytes), largo de títulos y prompts (prompt de sistema máx 8.000 caracteres) |
| Protección de API | Endpoints de cron exigen `CRON_SECRET` (header o query, comparación en tiempo constante). Webhooks sin cambios |
| Datos sensibles | Keys en Vault. `CRON_SECRET` y URL de la app para pg_cron en Vault, nunca en migraciones. Logs sin keys, sin prompts de sistema completos y sin contenido de documentos |
| Prompt injection | El contenido de documentos y mensajes del lead va a la IA como datos, en bloques separados del prompt de sistema. La IA de esta fase no tiene herramientas (no puede ejecutar acciones), así que el riesgo se limita al texto que responde |
| Ataques comunes | Markdown de la base de conocimiento se renderiza sanitizado (sin HTML crudo, sin `javascript:` en links). Resto sin cambios respecto a Fase 1 |
| Comunicaciones | HTTPS en todo. pg_net llama a la app por HTTPS |

### Checklist de seguridad para la IA constructora
- [ ] RLS habilitado en todas las tablas nuevas
- [ ] Políticas RLS escritas y testeadas para cada tabla nueva o modificada (incluido Member)
- [ ] GRANT para `authenticated` y `service_role` en cada tabla nueva
- [ ] Endpoints de cron validan `CRON_SECRET`
- [ ] Validación de inputs en servidor (no solo cliente)
- [ ] Archivos validados por contenido real, no por extensión
- [ ] Secrets en Vault o variables de entorno, nunca en código ni migraciones
- [ ] Markdown renderizado sanitizado
- [ ] Logs sin keys, prompts completos ni contenido de documentos
- [ ] HTTPS en producción

---

## 13c. Base técnica heredada

- **Proyecto base:** ZernFlow (https://github.com/zernio/zernflow, MIT) + Fase 1 construida (repo `Jafeth22/multichat-agente-ia`).
- **Versiones:** Next.js 16, React 19, TypeScript 5, Tailwind v4, AI SDK `ai@^6`.
- **Migraciones existentes:** `00001` a `00039`. La siguiente libre es **`00040_`**.
- **Ya implementado, NO reconstruir:** motor de flows (`lib/flow-engine/engine.ts`, 18 tipos de nodo, profundidad 50, flow stack, interpolación), simulador y versiones de flows, trigger matcher, secuencias base (`sequences`, `sequence_enrollments`, `lib/sequence-processor.ts`, pantallas), `scheduled_jobs` con `claimed_at`, `admin_notifications` + campanita, opt-out y `paused_optout`, Vault (`lib/vault.ts`, `readChannelSecret`), BYOK en Integraciones (`lib/ai-providers.ts`, `lib/actions/integrations.ts`), Resend (`lib/email/*`), audit log (`lib/audit.ts`), adaptador de plataformas (`lib/flow-engine/platform-adapter.ts`), cliente Evolution (`lib/evolution-client.ts`).
- **Patterns a seguir:** Server Actions en `lib/actions/`, API Routes para webhooks/crons, service role solo en servidor, ids generados en código antes de insertar (sin `.select()` después del insert, ver bug 2 de Fase 1), componentes `select-field` y `DateField`.

## 13d. Proyecto como template clonable

Se mantiene lo definido en Fase 1. Para esta fase:
- Migraciones `00040+` idempotentes, incluida la de pg_cron (`cron.unschedule` antes de `cron.schedule`) y la del bucket de Storage (`insert ... on conflict do nothing`).
- `.env.example`: se quita `AI_GATEWAY_API_KEY`. Se documenta que `CRON_SECRET` y `NEXT_PUBLIC_APP_URL` también deben cargarse en Supabase Vault (`cron_secret`, `app_base_url`) para que funcione el reloj.
- README: paso nuevo "Activar el reloj del sistema" con el SQL para cargar esos dos secretos, y "Conectar Voyage AI" (opcional, para la base de conocimiento).
- El sistema funciona con base vacía: sin flows, sin secuencias, sin documentos y sin Voyage, todas las pantallas muestran su estado vacío.

---

## 14. Notas y pendientes

**Decisiones tomadas para esta fase (con el usuario, 3/10/2026):**
1. WhatsApp entra en flows y secuencias en esta fase (cartero único, Bloque 1).
2. Reloj con pg_cron de Supabase (no Vercel Pro ni servicio externo).
3. Base de conocimiento acepta texto, `.md`, `.txt`, `.pdf` y `.docx`.
4. Búsqueda inteligente con Voyage AI (RAG con pgvector) desde esta fase.

**Decisiones por defecto a confirmar en el testing:**
- Member solo lee flows, secuencias y conocimiento (sección 3).
- Trigger "Nuevo contacto" no dispara por CSV salvo que se active.
- Pausar una secuencia ya no cancela las inscripciones.
- Sin fallback entre proveedores de IA.

**Pendientes y dependencias:**
- [Pendiente: crear cuenta en Voyage AI y obtener la API key, antes del Bloque 4.]
- [Pendiente: confirmar que pg_cron y pg_net están habilitables en el proyecto de Supabase (Database > Extensions), antes del Bloque 1.]
- [Pendiente: testing de fase de la Fase 1 (figura como pendiente en `docs/progreso.md`). Recomendado hacerlo antes o junto con el Bloque 1, porque esta fase toca webhooks y bandeja.]
- [Pendiente: nombre del cliente y del negocio.]

**Cambios que deberían reflejarse en documentos anteriores:**
- Alcance, nota de hosting y decisión de arquitectura: la app está en Vercel, no Railway.
- Alcance, Fase 2 Bloque 2: "Auto-pausa en respuesta: ya existe en ZernFlow" es incorrecto; se construye en esta fase.
- Alcance, Fase 2: la duración pasa de ~1 semana (3-4 bloques) a ~6-7 días medio tiempo (4 bloques + testing), por WhatsApp en automatizaciones, el reloj y RAG con Voyage.
- Alcance, decisión de base de conocimiento: se suma Voyage AI al stack (BYOK, costo según uso, 200M tokens gratis).
- Alcance, sección de costos: sumar Voyage AI (~US$0 en volumen normal por los tokens gratis).
