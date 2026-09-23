# Prompts para Claude Code: Etapa 1, Fase 1

Cómo usar este archivo: un bloque por sesión. Copiá el prompt del bloque, pegalo en Claude Code, revisá el plan que te propone y recién ahí decile "dale, arrancá". Al terminar: probar, commit, `/clear`.

El plano completo ya está en el repo (`docs/requerimientos-etapa1-fase1.md`) y el `CLAUDE.md` le dice a Claude Code que lo lea, así que no hace falta pegarlo.

---

## Bloque 1: Fork, deploy y foundation (día 1)

```
Voy a construir Multichat Agente IA: un sistema para un negocio de servicios digitales que junta los mensajes de Instagram y WhatsApp en una sola bandeja, con CRM, automatizaciones y agente de IA. Es un fork de ZernFlow.

Esta es la Fase 1 de la Etapa 1: Foundation, Canales y CRM.
Estamos en el Bloque 1 de 4: Fork, deploy y foundation.

El documento de requerimientos completo de la fase está en docs/requerimientos-etapa1-fase1.md (leé también las correcciones del principio). Vos vas a construir las funcionalidades del Bloque 1: F1, F2, F3, F4 y F6.

Estado actual (verificalo, no lo des por hecho):
- El fork ya está clonado y conectado a mi GitHub (origin). Rama main.
- Hay un .env con las variables de Supabase, CRON_SECRET y NEXT_PUBLIC_APP_URL.
- Existen las migraciones 00001 a 00017 (la 00017 agrega GRANTs que faltaban). No sé con certeza si están todas aplicadas en Supabase.
- Todavía NO está desplegado en Railway ni está Evolution API.
- git status muestra ~150 archivos "modificados" que son solo cambios de fin de línea (CRLF de Windows), no cambios reales.

Instrucciones:
1. Leé el documento de requerimientos completo (necesitás el contexto general) y el CLAUDE.md.
2. Revisá el estado real: que el proyecto instale y compile (npm install, npm run build, npm test), qué migraciones hay y cómo está resuelto hoy lo de roles, invitaciones, Zernio y WhatsApp en el código.
3. Proponeme cómo resolver lo de los fines de línea (por ejemplo un .gitattributes) para que git deje de mostrar esos archivos como modificados.
4. Enfocate en el Bloque 1:
   - F1: dejar la app lista para Railway y guiarme paso a paso (yo hago los clics en Railway y Supabase) para desplegar la app y Evolution API en el mismo proyecto con red privada. Verificar registro, creación automática del workspace como Owner y que carguen las pantallas existentes.
   - F2: Supabase Vault con las funciones store_secret, read_secret y delete_secret, aisladas por workspace y solo para Owner/Admin.
   - F3: verificar roles e invitaciones, corregir inconsistencias, y agregar el scope de leads por RLS (Member solo ve contactos y conversaciones donde es setter, vendedor o asignado; config del workspace para los sin asignar, default solo Owner/Admin). Como setter_id y vendedor_id se crean en el Bloque 3, decidí si conviene adelantar esas dos columnas en este bloque o dejar el scope listo con assigned_to y completarlo en el Bloque 3; explicame y recomendame.
   - F4: verificar que Instagram vía Zernio recibe DMs, comentarios y story replies, y que se puede responder.
   - F6: WhatsApp vía Evolution API: crear instancia desde la UI, QR, webhook interno, detección de desconexión con notificación a admins (en este bloque la notificación puede ser dentro de la app; el email llega con Resend en el Bloque 2) y reconexión.
5. Haceme un plan de implementación para ESTE BLOQUE: qué vas a construir, en qué orden, y por qué. Separá claramente lo que hacés vos en el código y lo que tengo que hacer yo a mano (Railway, Supabase, Zernio, escanear el QR).
6. Esperá mi confirmación antes de empezar a escribir código.
7. Cuando termines el bloque, haceme un resumen de lo construido, la lista de criterios de aceptación con cuáles se cumplen, y cómo probarlo. Actualizá docs/progreso.md.

Reglas de calidad para el código:
- Cada cambio de base de datos va en una migración SQL separada, numerada secuencialmente desde 00018_, idempotente (IF NOT EXISTS, checks previos), con sus GRANT y RLS.
- Secrets y API keys NUNCA hardcodeados: siempre variables de entorno o Supabase Vault.
- Mantené actualizado el .env.example con cada variable nueva que agregues (con comentario de qué es y dónde obtenerla), por ejemplo EVOLUTION_API_URL y EVOLUTION_API_KEY.
- El sistema tiene que funcionar con la base de datos vacía (empty states en todas las pantallas).
- No corras migraciones contra la base real ni hagas commit/push sin preguntarme.
```

---

## Bloque 2: Email, integraciones y BYOK IA (día 2)

Si seguís en la misma sesión del Bloque 1 (no recomendado), usá la versión corta. Lo normal es arrancar sesión nueva después de `/clear`.

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow). Ya está construido el Bloque 1 de la Fase 1 (ver docs/progreso.md).

Ahora vamos con el Bloque 2 de la Fase 1, Etapa 1: Email, configuración de integraciones y BYOK IA.

El documento de requerimientos de la fase está en docs/requerimientos-etapa1-fase1.md. Enfocate en F7 y F8:
- F7: email saliente con Resend. API key en Vault, invitaciones de equipo y aviso de desconexión de WhatsApp por email, remitente con dominio verificado, 3 reintentos si falla, registro de emails enviados, y dejarlo listo para que la Fase 2 lo use en secuencias.
- F8: pantalla /settings/integrations (solo Owner/Admin, en el sidebar) con 3 secciones: Canales (Instagram/Zernio, WhatsApp/Evolution con QR, Facebook y Twitter opcionales con nota "$6/mes extra"), Email (Resend) e IA BYOK (OpenAI, Anthropic, Google con modelo por defecto). Nueva tabla integration_configs genérica, keys siempre en Vault, validación de formato de key, estado en tiempo real, estructura extensible sin cambiar la tabla.

Antes de escribir código:
1. Leé el documento de requerimientos y enfocate en F7 y F8.
2. Explorá el proyecto actual para entender qué ya está construido: cómo quedaron Vault, WhatsApp y las pantallas de settings existentes (hay que integrarlas, no duplicarlas; decime qué pasa con la configuración de canales y de IA que ya trae ZernFlow, por ejemplo workspaces.ai_api_key).
3. Haceme un plan de implementación que se integre con lo que ya existe.
4. Esperá mi confirmación antes de empezar.
5. Al terminar: resumen, criterios de aceptación cumplidos, cómo probarlo, y actualizá docs/progreso.md.

Recordatorio: migraciones SQL idempotentes y numeradas (seguí la numeración que ya existe), secrets en env vars o Vault (nunca hardcodeados), .env.example actualizado, empty states en pantallas nuevas, audit log de conexión/desconexión cuando exista la tabla (si todavía no existe, dejá el punto de enganche anotado para el Bloque 3).
```

---

## Bloque 3: Modelo de contacto y CRM (días 3 y 4)

Es el bloque más grande. Si la sesión se pone lenta, está bien partirlo en dos: primero base de datos (F9, F10, F15 y audit_log), después pantallas (F11 a F14).

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow). Ya están construidos los Bloques 1 y 2 de la Fase 1 (ver docs/progreso.md).

Ahora vamos con el Bloque 3 de la Fase 1, Etapa 1: Modelo de contacto y CRM.

El documento de requerimientos de la fase está en docs/requerimientos-etapa1-fase1.md. Enfocate en F9 a F15, más la tabla audit_log (F20) porque este bloque ya la necesita:
- F9: extender contacts con los campos nuevos, índices y RLS (con el scope de leads completo usando setter_id y vendedor_id).
- F10: campo attribution JSONB (first_click se escribe una sola vez, last_click se actualiza).
- F11: asignación setter y vendedor con dropdown de miembros, filtros y audit log.
- F12: detección cross-canal en los webhooks de Instagram y WhatsApp (teléfono/email vinculan solos, username solo sugiere), conversaciones separadas por canal, audit log de vinculaciones.
- F13: tabla contact_notes y sección de notas.
- F14: ficha completa /contacts/[id] con todas sus secciones.
- F15: soft delete en contacts, contact_notes, conversations (y response_templates cuando exista), filtros deleted_at IS NULL, RLS, y cron /api/cron/purge-deleted con purga en cascada a los 30 días.
- Además la lista /contacts con búsqueda, filtros (tags, setter, vendedor, temperatura, canal), paginación de 25 y botón "Nuevo contacto".

Antes de escribir código:
1. Leé el documento de requerimientos y enfocate en estas funcionalidades.
2. Explorá el proyecto actual: cómo se crean hoy los contactos desde los webhooks, cómo es la pantalla de contactos existente y qué dejó preparado el Bloque 1 para el scope de leads.
3. Haceme un plan de implementación que se integre con lo que ya existe, separado en parte de base de datos y parte de pantallas.
4. Esperá mi confirmación antes de empezar.
5. Al terminar: resumen, criterios de aceptación cumplidos, cómo probarlo (incluí cómo probar el scope con un usuario Member), y actualizá docs/progreso.md.

Recordatorio: migraciones SQL idempotentes y numeradas, GRANT + RLS en cada tabla nueva, secrets en env vars o Vault, .env.example actualizado, empty states en pantallas nuevas, teléfonos normalizados a formato internacional, nunca deduplicar por nombre.
```

---

## Bloque 4: Bandeja, filtros y herramientas CRM (días 4 y 5)

```
Estoy trabajando en Multichat Agente IA (fork de ZernFlow). Ya están construidos los Bloques 1, 2 y 3 de la Fase 1 (ver docs/progreso.md).

Ahora vamos con el Bloque 4 de la Fase 1, Etapa 1: Bandeja, filtros y herramientas CRM.

El documento de requerimientos de la fase está en docs/requerimientos-etapa1-fase1.md. Enfocate en F16 a F20:
- F16: filtros del inbox (tags, asignación, canal, fecha con presets y rango), combinables, en la URL, badge de filtros activos y "Limpiar filtros". En mobile, panel tipo sheet.
- F17: tabla response_templates, pantalla /settings/templates con preview en vivo, y selector con "/" en el campo de respuesta con interpolación de variables (vacías si no hay valor).
- F18: "no contactar": frases de opt-out configurables por workspace, detección automática en mensajes entrantes (marca, razón, fecha, pausa secuencias, audit log), badge rojo en bandeja y ficha, reversión por Admin/Owner, advertencia con confirmación al enviar.
- F19: importación CSV en 4 pasos (upload, preview y mapeo, opciones setter/vendedor/tags, progreso y resumen), máx. 10MB y 10.000 filas, validación, deduplicación por email o teléfono sin pisar con vacíos, tabla csv_imports, descarga de errores, audit log.
- F20: completar el audit log con todos los eventos listados (contacto, canal, configuración, importación, equipo) y la RLS (Member solo ve sus acciones).
- También: al responder en la bandeja, el operador se auto-asigna la conversación; y el undo de 5 segundos antes del soft delete.

Antes de escribir código:
1. Leé el documento de requerimientos y enfocate en estas funcionalidades.
2. Explorá el proyecto actual: el inbox existente, cómo se envían los mensajes y qué eventos ya escriben en audit_log.
3. Haceme un plan de implementación que se integre con lo que ya existe.
4. Esperá mi confirmación antes de empezar.
5. Al terminar: resumen, criterios de aceptación cumplidos, cómo probarlo, y actualizá docs/progreso.md.

Recordatorio: migraciones SQL idempotentes y numeradas, GRANT + RLS en cada tabla nueva, secrets en env vars o Vault, .env.example actualizado, empty states en pantallas nuevas.
```

---

## Testing de fase (medio día)

```
Estoy trabajando en Multichat Agente IA. Ya están construidos los 4 bloques de la Fase 1, Etapa 1 (ver docs/progreso.md y docs/requerimientos-etapa1-fase1.md).

Quiero hacer el testing de la fase completa. Por favor:
1. Recorré todos los criterios de aceptación de F1 a F20 y armá una checklist en docs/testing-fase-1.md marcando cuáles podés verificar vos (código, tests, build, políticas RLS) y cuáles tengo que probar yo a mano.
2. Corré npm run build, npm test y npm run lint, y arreglá lo que falle (explicame cada arreglo).
3. Revisá la seguridad con la checklist de la sección 13b: RLS y GRANT en todas las tablas nuevas, scope de leads, Vault, service role solo en servidor, headers de seguridad, HMAC de Zernio, nada sensible en logs.
4. Escribí tests automáticos para lo más crítico: deduplicación cross-canal, detección de opt-out, interpolación de templates, validación y deduplicación del CSV.
5. Dame un guion de prueba manual paso a paso para los 6 flujos principales (sección 6), en desktop y mobile, incluyendo estados vacíos y errores.
6. No hagas commit sin preguntarme.
```

---

## Mensajes de commit sugeridos

- `Fase 1 - Bloque 1 completado: fork, deploy y foundation`
- `Fase 1 - Bloque 2 completado: email, integraciones y BYOK IA`
- `Fase 1 - Bloque 3 completado: modelo de contacto y CRM`
- `Fase 1 - Bloque 4 completado: bandeja, filtros y herramientas CRM`
- `Fase 1 completada - testing OK`
