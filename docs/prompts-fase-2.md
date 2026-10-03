# Prompts para Claude Code: Etapa 1, Fase 2

Cómo usar este archivo: un bloque por sesión. Copiá el prompt del bloque, pegalo en Claude Code, revisá el plan que te propone y recién ahí decile "dale, arrancá". Al terminar: probar, commit, `/clear`.

El plano completo está en el repo (`docs/requerimientos-etapa1-fase2.md`), así que no hace falta pegarlo: el prompt le dice a Claude Code que lo lea.

Orden recomendado: Bloque 1 → 2 → 3 → 4 → Testing. El Bloque 1 es la base de todo lo demás (sin el "cartero único" y el reloj, los triggers y las secuencias no se pueden probar en WhatsApp ni a tiempo).

---

## Bloque 1: Motor multicanal, reloj y BYOK (días 1 y 2)

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow): un sistema para un negocio de servicios digitales que junta los mensajes de Instagram y WhatsApp en una sola bandeja, con CRM, automatizaciones y agente de IA.

La Fase 1 de la Etapa 1 está terminada y testeada (ver docs/progreso.md).
Ahora arrancamos la Fase 2 de la Etapa 1: Comunicación y Automatizaciones.
Estamos en el Bloque 1 de 4: Motor multicanal, reloj y BYOK.

El documento de requerimientos completo de la fase está en docs/requerimientos-etapa1-fase2.md. Leelo entero (necesitás el contexto general, sobre todo la sección 2 "Hallazgos del código", la 7 de modelo de datos y la 13c de base heredada). Vos vas a construir F1, F2, F3 y F4.

Estado actual (verificalo, no lo des por hecho):
- App desplegada en Vercel, Evolution API en Railway (URL pública + API key + secreto por canal en el webhook).
- Migraciones 00001 a 00039 corridas. La siguiente libre es 00040_.
- Las extensiones pg_cron y pg_net ya están habilitadas en Supabase.
- Las keys BYOK de IA (OpenAI, Anthropic, Google) se cargan en /dashboard/settings/integrations y viven en Vault, pero hoy no las usa nadie: el nodo AI Response sigue usando AI Gateway.
- El webhook de WhatsApp no dispara flows, y el motor de flows y el de secuencias solo envían por Zernio.
- vercel.json tiene los crons en 1 vez por día.

Funcionalidades de este bloque (criterios de aceptación completos en la sección 5 del documento):
- F1: cartero único (lib/messaging/send.ts) que envía por Zernio o Evolution según el canal, bloquea "no contactar", guarda todo en messages con su origen y error, y actualiza last_inbound_at / last_outbound_at. El webhook de WhatsApp pasa a disparar flows igual que el de Instagram. Botones y quick replies en WhatsApp se convierten a opciones numeradas y la respuesta "1" se interpreta como el botón 1.
- F2: reloj con pg_cron + pg_net cada minuto (jobs, secuencias, inactividad cada 5 min, purga diaria), con la URL de la app y el CRON_SECRET leídos de Supabase Vault, nunca escritos en la migración. Sacar los crons de vercel.json. Claim con claimed_at para que dos corridas no procesen lo mismo.
- F3: registro extensible de nodos/triggers/condiciones (lib/flow-engine/registry.ts), palette armado desde el registro con nombres en español, avisos de compatibilidad por canal (Responder comentario y Respuesta privada son solo Instagram), y checklist de verificación de los 18 nodos en los dos canales en docs/progreso.md.
- F4: BYOK en el nodo "Respuesta con IA" con una capa propia (lib/ai/generate.ts, AI SDK v6 + @ai-sdk/openai, anthropic y google), selector de proveedor y modelo, compatibilidad con los nodos viejos tipo "openai/gpt-4o-mini", registro de cada llamada en ai_usage_logs, manejo de key inválida (notificación + cortar sin mandar nada al lead) y reintentos ante 429/5xx. Quitar AI Gateway del código y de Settings (las columnas viejas quedan en la base).

Instrucciones:
1. Leé el documento de requerimientos completo y el CLAUDE.md.
2. Explorá el código actual de lib/flow-engine/, lib/sequence-processor.ts, los dos webhooks, app/api/v1/messages/route.ts y lib/ai-providers.ts para entender cómo integrarte sin reescribir lo que funciona.
3. Haceme un plan de implementación para ESTE BLOQUE: qué vas a construir, en qué orden, y por qué. Separá lo que hacés vos en el código y lo que tengo que hacer yo a mano (por ejemplo, cargar cron_secret y app_base_url en Vault con SQL, correr migraciones, instalar dependencias en Vercel).
4. Si encontrás algo en el código que contradiga el documento, avisame antes de decidir.
5. Esperá mi confirmación antes de empezar a escribir código.
6. Cuando termines, haceme un resumen de lo construido, la lista de criterios de aceptación de F1 a F4 con cuáles se cumplen, y cómo probarlo paso a paso. Actualizá docs/progreso.md (sección nueva "Etapa 1, Fase 2").

Reglas de calidad para el código:
- Cada cambio de base de datos va en una migración SQL separada, numerada desde 00040_, idempotente (IF NOT EXISTS, DO $$ ... $$, cron.unschedule antes de cron.schedule), con RLS y GRANT para authenticated y service_role.
- Secrets y API keys NUNCA hardcodeados: siempre variables de entorno o Supabase Vault.
- Mantené actualizado el .env.example (sacar AI_GATEWAY_API_KEY, documentar que CRON_SECRET y la URL de la app también van en Vault).
- El sistema tiene que funcionar con la base de datos vacía y sin ningún proveedor de IA conectado.
- Tests con Vitest para el ruteo por canal, el bloqueo por "no contactar" y la conversión de botones a números.
- npm run build, npm test y npm run lint tienen que pasar.
- No corras migraciones contra la base real ni hagas commit/push sin preguntarme.
```

---

## Bloque 2: Triggers nuevos y feedback de Instagram (día 3)

Arrancá sesión nueva después de `/clear`.

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow). Ya está construido el Bloque 1 de la Fase 2, Etapa 1 (ver docs/progreso.md): el cartero único, el reloj con pg_cron, el registro de nodos y BYOK en el nodo de IA.

Ahora vamos con el Bloque 2 de la Fase 2, Etapa 1: Triggers nuevos y feedback de Instagram.

El documento de requerimientos de la fase está en docs/requerimientos-etapa1-fase2.md. Enfocate en F5 a F9 (sección 5, Bloque 2) y en las pantallas de la sección 10.3:
- F5: switch "Solo respuestas a historias (Instagram)" en el trigger de palabra clave.
- F6: trigger "Nuevo contacto" (no dispara por CSV salvo que se active, filtro por canal, convivencia con el trigger de keyword).
- F7: trigger "Evento de CRM" con un único punto de emisión (lib/crm-events.ts, emitCrmEvent) llamado desde las Server Actions de contacto, tags, custom fields, asignación, opt-out y desde los nodos que cambian tags o campos. Protección contra bucles: mismo flow + mismo contacto no se repite en 10 minutos, profundidad máxima 5.
- F8: trigger "Inactividad" (nosotros escribimos último y pasó X tiempo), revisado por /api/cron/inactivity cada 5 minutos, dispara una sola vez por "último mensaje sin respuesta" usando la tabla trigger_firings.
- F9: mensajes fallidos de Instagram con explicación en español en la bandeja, sesión del flow cancelada si un envío falla, banner amarillo a los 7 días sin que el lead escriba, y límite de 200 mensajes automatizados por hora por canal de Instagram (lo que se pasa se reprograma, no se pierde).

Antes de escribir código:
1. Leé el documento y explorá lo que ya existe (trigger-matcher, el registro del Bloque 1, el cartero, lib/actions/contacts.ts, lib/opt-out.ts, la bandeja).
2. Haceme un plan de implementación que se integre con lo que ya existe. Los triggers nuevos tienen que entrar por el registro del Bloque 1, no como casos especiales en el motor.
3. Esperá mi confirmación antes de empezar.
4. Al terminar: resumen, criterios de F5 a F9 con cuáles se cumplen, cómo probarlo paso a paso, y actualizá docs/progreso.md.

Recordatorio: migraciones idempotentes desde la siguiente libre, RLS + GRANT, secrets en env o Vault, .env.example al día, empty states, build/test/lint pasando, y no correr migraciones ni hacer commit sin preguntarme.
```

---

## Bloque 3: Secuencias (día 4)

Arrancá sesión nueva después de `/clear`.

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow). Ya están construidos los Bloques 1 y 2 de la Fase 2, Etapa 1 (ver docs/progreso.md).

Ahora vamos con el Bloque 3 de la Fase 2, Etapa 1: Secuencias.

El documento de requerimientos de la fase está en docs/requerimientos-etapa1-fase2.md. Enfocate en F10 a F14 (sección 5, Bloque 3), las pantallas de la sección 10.4 y los estados de inscripción de la sección 13:
- F10: pantallas de secuencias existentes adaptadas (en español, con select-field y DateField), 3 tipos de paso (Mensaje, Mensaje con IA, Esperar), soft delete, pausar la secuencia ya NO cancela las inscripciones, lista de inscripciones con Pausar/Reanudar/Sacar, e "Inscribir en secuencia" desde la ficha del contacto. Member solo ve inscripciones de sus contactos.
- F11: auto-pausa cuando el contacto responde, por canal (respuesta por Instagram no pausa una secuencia de WhatsApp), con el switch "Pausar si el contacto responde" por secuencia. Esto NO existe hoy, hay que construirlo.
- F12: paso "Mensaje con IA" usando lib/ai/generate.ts del Bloque 1, con datos del contacto y últimos 10 mensajes, 3 reintentos y después estado failed con notificación. (El switch de base de conocimiento queda dibujado pero se conecta en el Bloque 4.)
- F13: detección de colisión (más de una inscripción activa en el mismo canal), notificación, badge naranja y modal para pausar una, dejar las dos o sacar de una.
- F14: condición "Secuencia" en el nodo Condición del flow builder, registrada en el registro de condiciones del Bloque 1.

Antes de escribir código:
1. Leé el documento y explorá lo que ya existe (lib/sequence-processor.ts, lib/actions/sequences.ts, components/sequences/, las pantallas de /dashboard/sequences, el nodo enrollSequence en el motor y lib/opt-out.ts).
2. Haceme un plan de implementación que se integre con lo que ya existe. Los envíos tienen que pasar por el cartero del Bloque 1.
3. Esperá mi confirmación antes de empezar.
4. Al terminar: resumen, criterios de F10 a F14 con cuáles se cumplen, cómo probarlo paso a paso, y actualizá docs/progreso.md.

Recordatorio: migraciones idempotentes desde la siguiente libre, RLS + GRANT (incluida la RLS de sequence_enrollments con can_see_contact), audit_log en cada cambio de estado, empty states, build/test/lint pasando, y no correr migraciones ni hacer commit sin preguntarme.
```

---

## Bloque 4: Base de conocimiento y notificaciones (días 5 y 6)

Arrancá sesión nueva después de `/clear`. Tené a mano la API key de Voyage AI: en este bloque se construye la tarjeta para cargarla.

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow). Ya están construidos los Bloques 1, 2 y 3 de la Fase 2, Etapa 1 (ver docs/progreso.md).

Ahora vamos con el Bloque 4 de la Fase 2, Etapa 1: Base de conocimiento y notificaciones.

El documento de requerimientos de la fase está en docs/requerimientos-etapa1-fase2.md. Enfocate en F15 a F18 (sección 5, Bloque 4), las pantallas de la sección 10.5, el modelo de datos de knowledge_documents y knowledge_chunks (sección 7.1) y el storage (sección 8b):
- F15: pantalla /dashboard/knowledge para escribir documentos o subir .md, .txt, .pdf y .docx (máx 10 MB, validando el tipo real del archivo), conversión a markdown editable (mammoth + turndown para docx, unpdf para pdf), original guardado en el bucket privado knowledge-files, título, etiquetas, estados processing/ready/error, PDF escaneado con error claro (sin OCR), soft delete y audit_log.
- F16: búsqueda inteligente con Voyage AI (modelo voyage-4, 1024 dimensiones) y pgvector con índice HNSW. Tarjeta de Voyage en Integraciones (key en Vault, integration_configs con type embedding_provider). Pedazos de ~800 tokens con 100 de superposición respetando títulos, indexado en segundo plano con un job knowledge_index, no re-indexar si el hash no cambió, función SQL match_knowledge_chunks, pantalla "Probar búsqueda", y todo funcionando aunque todavía no haya key (los documentos quedan en processing hasta que se conecte). Voyage se llama con fetch, sin SDK.
- F17: switch "Usar base de conocimiento" + filtro de etiquetas en el nodo "Respuesta con IA" y en el paso "Mensaje con IA" de secuencias, con la regla de no inventar información y la opción de derivar a humano si no encuentra nada.
- F18: notificaciones nuevas (human_handoff, sequence_collision, sequence_failed, ai_key_invalid, knowledge_doc_failed) sobre admin_notifications con user_id, link y anti-spam de 30 minutos, campanita mejorada, y sección "Avisos por email" en Settings.

Antes de escribir código:
1. Leé el documento y explorá lo que ya existe (lib/ai/, el cartero, la pantalla de Integraciones, admin_notifications y la campanita, lib/email/, el nodo humanTakeover).
2. Haceme un plan de implementación que se integre con lo que ya existe.
3. Esperá mi confirmación antes de empezar.
4. Al terminar: resumen, criterios de F15 a F18 con cuáles se cumplen, cómo probarlo paso a paso (incluido cargar mi key de Voyage y probar la búsqueda), y actualizá docs/progreso.md.

Recordatorio: migraciones idempotentes desde la siguiente libre (incluida la del bucket de Storage y la extensión vector), RLS + GRANT, markdown renderizado sanitizado, logs sin keys ni contenido de documentos, .env.example y README al día, empty states, build/test/lint pasando, y no correr migraciones ni hacer commit sin preguntarme.
```

---

## Testing de fase (medio día a 1 día)

```
Estoy trabajando en Multichat Agente IA. Ya están construidos los 4 bloques de la Fase 2, Etapa 1 (ver docs/progreso.md y docs/requerimientos-etapa1-fase2.md).

Quiero hacer el testing de la fase completa. Por favor:
1. Recorré todos los criterios de aceptación de F1 a F18 y armá una checklist en docs/testing-fase-2.md marcando cuáles podés verificar vos (código, tests, build, políticas RLS) y cuáles tengo que probar yo a mano.
2. Corré npm run build, npm test y npm run lint, y arreglá lo que falle (explicame cada arreglo).
3. Revisá la seguridad con la checklist de la sección 13b: RLS y GRANT en todas las tablas nuevas o modificadas (probando como Member), endpoints de cron con CRON_SECRET, keys en Vault, validación de archivos, markdown sanitizado, nada sensible en logs.
4. Escribí tests automáticos para lo más crítico: ruteo del cartero por canal, bloqueo por "no contactar", regla de disparo de inactividad (una sola vez), protección contra bucles de eventos de CRM, auto-pausa por canal, detección de colisión, partido de documentos en pedazos.
5. Dame un guion de prueba manual paso a paso para los 5 flujos principales (sección 6), en Instagram y WhatsApp, desktop y mobile, incluyendo estados vacíos y errores (key de IA inválida, WhatsApp desconectado, PDF escaneado, sin key de Voyage).
6. Revisá que el reloj (pg_cron) esté corriendo en producción y que un "Esperar 2 minutos" tarde entre 2 y 3 minutos de verdad.
7. No hagas commit sin preguntarme.
```

---

## Mensajes de commit sugeridos

- `Fase 2 - Bloque 1 completado: motor multicanal, reloj y BYOK`
- `Fase 2 - Bloque 2 completado: triggers nuevos y feedback de Instagram`
- `Fase 2 - Bloque 3 completado: secuencias`
- `Fase 2 - Bloque 4 completado: base de conocimiento y notificaciones`
- `Fase 2 completada - testing OK`
