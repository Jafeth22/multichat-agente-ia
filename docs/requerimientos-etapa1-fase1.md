# Requerimientos: Etapa 1, Fase 1 (Foundation, Canales y CRM)

> Copia del documento de requerimientos del Proyecto (fuente Notion: https://app.notion.com/p/fd8c03e853758303ae3a01f2c529f424).
>
> **Correcciones aplicadas al construir (mandan sobre el texto de abajo):**
> 1. **Numeración de migraciones:** el repo ya tiene `00017_grant_table_privileges.sql`. Las migraciones nuevas de esta fase arrancan en **`00018_`** (no en `00017_`). Orden sugerido: `00018_extend_contacts`, `00019_vault_setup`, `00020_crm_tables`, `00021_crm_indexes`, `00022_crm_rls`, `00023_soft_delete_cron`.
> 2. **Ruta de la pantalla de integraciones:** se usa **`/settings/integrations`** (la sección 10.2 dice `/settings/channels`; es la misma pantalla).
> 3. **Tablas nuevas y GRANTs:** toda tabla nueva necesita sus `GRANT` para `authenticated` además de RLS (ver lo que resolvió la migración `00017`).

---

## 1. Mapa de ruta de fases

| Etapa | Fase | Duración estimada | Estado |
|---|---|---|---|
| **Etapa 1:** Sistema Operativo Base | **Fase 1: Foundation, Canales y CRM** | ~1 semana (4 bloques) | **← ACTUAL** |
|  | Fase 2: Comunicación y Automatizaciones | ~1 semana (3-4 bloques) | Siguiente |
|  | Fase 3: Agente IA, Analytics y Pulido | 3-5 días (2-3 bloques + testing integral) | Pendiente |
| **Etapa 2:** Publicación + Email + Roles + Ads | Fases 1-3 | Por definir | Futura |
| **Etapa 3:** Agente IA Integral + Fathom + MCP | Fases 1-3 | Por definir | Futura |
| **Etapa 4 (opcional):** Agendamiento + Ventas + Pipeline | Fases 1-3 | Por definir | Futura |

**Qué NO se construye ahora pero SÍ está contemplado en el diseño:**
- El modelo de datos ya incluye campos y relaciones preparados para: roles custom con permisos granulares (Etapa 2), email bidireccional (Etapa 2), publicación de contenido (Etapa 2), YouTube y LinkedIn (Etapa 2), agendamiento con Google Calendar (Etapa 4), ventas y pagos (Etapa 4), sistema de tareas (Extra A), form builder (Extra C).
- La tabla `contacts` incluye `ai_conversation_summary` (para la memoria acumulativa del agente IA de Fase 3) y `next_followup_date` (para seguimientos, base del agendamiento de Etapa 4).
- La tabla `channels` abstrae la fuente de conexión (Zernio vs API directa) para que el inbox unificado de Fase 2 no dependa del mecanismo de conexión.
- La tabla `integration_configs` es genérica y extensible: soporta canales, proveedores de IA, email, y cualquier integración futura sin necesidad de nuevas tablas.
- El flow builder mantiene su arquitectura extensible para que módulos futuros registren triggers/acciones/condiciones.

---
## 2. Objetivo de esta fase y mapa de bloques
**Objetivo:** Levantar el sistema desde el fork de ZernFlow, conectar los 2 canales de mensajería de Etapa 1 (Instagram vía Zernio + WhatsApp vía Evolution API), configurar el email saliente (Resend, transaccional), y construir un CRM completo con modelo de contacto extendido, detección cross-canal, scope de leads, herramientas de gestión y audit log. Todo single-tenant.

**Por qué esta fase va primero:** Sin infraestructura base, canales de mensajería conectados y un CRM funcional, no hay sobre qué construir automatizaciones (Fase 2) ni agente de IA (Fase 3).

**Qué problema resuelve:** El negocio de servicios digitales necesita un lugar central para recibir mensajes de todas las redes que tienen chat/inbox, identificar que el mismo contacto escribe por distintos canales, asignar leads al equipo y tener un historial completo de cada contacto.

**Nota:** YouTube (comentarios) y LinkedIn (publicación) no son canales de mensajería/chat, se incorporan en Etapa 2.

### Bloques de ejecución de esta fase

| Bloque | Día | Qué se construye | Contexto compartido |
|---|---|---|---|
| Bloque 1: Fork, deploy y foundation | 1 | Fork de ZernFlow, deploy en Railway, Supabase Vault, verificación de roles/workspaces + scope de leads, conexión Instagram (Zernio), WhatsApp (Evolution API) | Tablas `workspaces`, `workspace_members`, `channels`, `contacts`, `contact_channels`. Supabase Vault. Config de Railway |
| Bloque 2: Email, configuración de integraciones y BYOK IA | 2 | Resend (email saliente), pantalla de configuración de integraciones + BYOK IA | Tablas `channels`, `integration_configs` (nueva). Pantalla `/settings/integrations`. Supabase Vault para API keys |
| Bloque 3: Modelo de contacto y CRM | 3-4 | Extensión del modelo de contacto (incluyendo atribución como JSONB), setter/vendedor, detección cross-canal, notas, ficha de contacto, soft delete | Tablas `contacts` (extendida), `contact_notes` (nueva), `audit_log` (nueva) |
| Bloque 4: Bandeja, filtros y herramientas CRM | 4-5 | Filtros de inbox, templates de respuesta, marca "no contactar", importación CSV, audit log | Tablas `response_templates` (nueva), `csv_imports` (nueva), `audit_log`. Pantallas de inbox y contactos |
| Testing de fase | 5 (medio día) | Testing funcional + correcciones + colchón | — |

---
## 3. Usuarios y roles

| Rol | Descripción | Puede hacer | No puede hacer |
|---|---|---|---|
| Owner | Dueño del workspace. Se asigna automáticamente al primer usuario que se registra | Todo: gestionar workspace, canales, equipo, contactos, conversaciones, configuración, billing, eliminar workspace | — |
| Admin | Administrador con permisos amplios | Todo excepto eliminar workspace y gestionar billing | Eliminar workspace, cambiar plan/billing |
| Member | Operador del equipo (setter/closer) | Ver y responder **solo sus** conversaciones y gestionar **solo sus** contactos asignados (donde figura como setter, vendedor o agente), usar templates, importar CSV | Ver leads/conversaciones de otros, configurar canales, invitar/remover miembros, cambiar configuración del workspace, acceder a settings de IA/Vault |

- **Rol por defecto del primer usuario:** Owner (se crea automáticamente con el workspace al registrarse).
- **Cómo se invitan nuevos usuarios:** El Owner o Admin envía una invitación desde `/settings/team`. ZernFlow ya trae `workspace_invites` con invitaciones que expiran en 7 días. El invitado recibe un email (vía Resend) con un link para unirse. Al aceptar, se le asigna el rol "Member" por defecto.
- **Scope de leads (Etapa 1, restricción dura):** Un Member solo lee/edita los contactos y conversaciones donde es `setter_id`, `vendedor_id` o `assigned_to`. Se aplica por RLS, no solo por filtro de UI. Owner y Admin ven y editan todo. Configurable por workspace: si un lead está sin asignar, el workspace decide si lo ven todos los Members o solo Owner/Admin (default: solo Owner/Admin).
- **Single-tenant:** un solo workspace (un negocio). No se construye gestión multi-workspace.
- **Nota para Etapa 2:** roles custom con permisos granulares. La tabla de roles actual (`workspace_members.role`) se migrará a un modelo más flexible.

---
## 4. Alcance específico de esta fase
### 4.1. Fork y deploy de ZernFlow
- **Qué hace**: Forkear ZernFlow, ejecutar las migraciones SQL existentes en Supabase, desplegar la app en Railway y verificar que todo funcione.
- **Hasta dónde llega**: App corriendo en Railway con HTTPS, base de datos en Supabase con las 23 tablas existentes, autenticación funcional, pantallas existentes cargando.
- **Qué NO hace**: No se modifican las pantallas existentes (eso es de los bloques siguientes). No se hacen optimizaciones de performance.
### 4.2. Supabase Vault
- **Qué hace**: Habilitar la extensión Vault para almacenar API keys de terceros con encriptación AES-256. Crear funciones helper para guardar y leer secrets.
- **Hasta dónde llega**: Vault configurado. Funciones RPC `store_secret`, `read_secret`, `delete_secret` disponibles. Acceso restringido a Owner/Admin del workspace.
- **Qué NO hace**: No hay rotación automática de keys ni UI de Vault directa (la UI es la pantalla de integraciones del Bloque 2).
### 4.3. Roles, workspaces y scope de leads
- **Qué hace**: Verificar roles (Owner, Admin, Member) y workspaces de ZernFlow. **Agregar scope duro de leads** por RLS. Single-tenant.
- **Hasta dónde llega**: Roles funcionales. Workspace creado al registrarse con el usuario como Owner. Invitaciones con expiración de 7 días. RLS de scope aplicada en `contacts` y `conversations`.
- **Qué NO hace**: Roles custom, gestión multi-workspace (Etapa 2).
### 4.4. Instagram vía Zernio
- **Qué hace**: Verificar la integración existente con Zernio para Instagram: DMs, comentarios y story replies. 1 de las 2 cuentas free.
- **Hasta dónde llega**: Mensajes llegan, se pueden responder, se vinculan a contactos y conversaciones.
- **Qué NO hace**: Detección de nuevos seguidores (limitación de API). Lógica proactiva de ventana 24h/7d.
### 4.5. TikTok: FUERA de Etapa 1
Zernio no entrega DMs ni comentarios de TikTok (verificado en `@zernio/node`). TikTok entra en Etapa 2 solo como publicación y métricas.
### 4.6. WhatsApp vía Evolution API
- **Qué hace**: Desplegar Evolution API en Railway (mismo proyecto, red privada). Conexión por QR desde la UI. Webhook para recibir mensajes.
- **Hasta dónde llega**: Instancia conectada por QR, mensajes entrantes guardados, respuestas desde la app, detección de desconexión con notificación a admins.
- **Qué NO hace**: WhatsApp Business API, broadcasts.
### 4.7. Email saliente vía Resend
- **Qué hace**: API de Resend para emails transaccionales (invitaciones, notificaciones), infraestructura lista para secuencias de Fase 2.
- **Qué NO hace**: Recibir emails (Etapa 2).
### 4.8. Pantalla de configuración de integraciones
- **Qué hace**: UI unificada para conectar canales, email saliente y proveedores de IA (BYOK). Zernio (API key), WhatsApp (QR), Resend (API key), IA (API key). Usa la tabla genérica `integration_configs`.
- **Hasta dónde llega**: Estado de conexión por integración, conectar/desconectar, sección de IA, estructura extensible.
- **Qué NO hace**: Test de conexión automático para todas; YouTube/LinkedIn (Etapa 2).
### 4.9. Modelo de contacto extendido
- **Qué hace**: Extender `contacts` (hoy solo `display_name`, `email`, `avatar_url`, `is_subscribed`, `metadata`) con teléfono, redes, país, setter, vendedor, atribución, seguimiento, resumen IA, "no contactar".
- **Qué NO hace**: Merge automático de duplicados (solo detección y alerta).
### 4.10. Detección cross-canal
- **Qué hace**: Si un contacto escribe por un canal nuevo, detectar si ya existe (teléfono, email o handle) y vincularlo. Conversaciones separadas por canal.
- **Hasta dónde llega**: Automático por teléfono y email. Por username cuando esté disponible. Vinculación automática con match exacto, sugerencia manual con match parcial.
- **Qué NO hace**: Merge destructivo.
### 4.11. Soft delete
- **Qué hace**: Borrado lógico con 30 días de retención para contactos, conversaciones, notas y templates. Luego purga por cron.
- **Qué NO hace**: UI de papelera (restauración solo vía base de datos).
### 4.12. Filtros de inbox
- **Qué hace**: Filtros por tags, asignación (setter, vendedor, agente IA, sin asignar, todas), fecha de último mensaje, canal. Combinables y en la URL.
- **Qué NO hace**: Vistas guardadas.
### 4.13. Templates de respuesta rápida
- **Qué hace**: CRUD por workspace, selector en la bandeja, interpolación de variables (`{{contact.display_name}}`).
- **Qué NO hace**: Templates con media.
### 4.14. Marca "no contactar"
- **Qué hace**: Detección automática de frases de opt-out + marcado manual. Visible en bandeja y ficha. Pausa secuencias activas. Un admin puede revertir.
- **Qué NO hace**: NLP avanzado (solo matching de frases).
### 4.15. Importación CSV
- **Qué hace**: Import con mapeo de columnas, validación y deduplicación por email o teléfono (actualiza en vez de duplicar). Resumen y registro en audit log.
- **Qué NO hace**: Exportación CSV.
### 4.16. Audit log global
- **Qué hace**: Tabla central: entidad, campos, valor anterior y nuevo, quién, cuándo.
- **Qué NO hace**: UI de exploración (se ve desde la ficha del contacto y vía base de datos).

---
## 5. Funcionalidades y criterios de aceptación (por bloque)
### Bloque 1: Fork, deploy y foundation
#### F1: Fork y deploy de ZernFlow
- [ ] Repositorio forkeado y clonado
- [ ] Proyecto Railway creado con servicio de app Next.js corriendo
- [ ] Evolution API desplegada como servicio separado en el mismo proyecto Railway, comunicándose por red privada interna
- [ ] Proyecto Supabase creado con plan Pro ($25/mes)
- [ ] Las migraciones SQL ejecutadas sin errores, 23 tablas creadas
- [ ] Variables de entorno configuradas: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `APP_URL`
- [ ] La app carga en el navegador y permite registrarse
- [ ] Al registrarse, se crea un workspace automáticamente con el usuario como Owner
- [ ] Las pantallas existentes cargan sin errores (dashboard, inbox, contacts, flows, sequences, settings)
#### F2: Supabase Vault
- [ ] Extensión `vault` habilitada: `CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault`
- [ ] Función RPC `store_secret(secret_name text, secret_value text, workspace_id uuid)`
- [ ] Función RPC `read_secret(secret_name text, workspace_id uuid)`
- [ ] Función RPC `delete_secret(secret_name text, workspace_id uuid)`
- [ ] Secrets aislados por `workspace_id`
- [ ] Solo Owner o Admin pueden crear/leer/eliminar secrets
- [ ] Un secret guardado se lee y devuelve el valor original
- [ ] Un secret eliminado ya no es accesible
- [ ] Los secrets no aparecen en logs ni en respuestas de API (excepto la lectura explícita)
#### F3: Roles y workspaces
- [ ] El primer usuario que se registra recibe el rol Owner
- [ ] Owner puede invitar desde `/settings/team`
- [ ] Invitaciones por email (placeholder hasta Resend en Bloque 2)
- [ ] Las invitaciones expiran en 7 días
- [ ] Un invitado se registra con rol Member por defecto
- [ ] Owner y Admin pueden cambiar el rol de un miembro (a Admin o Member)
- [ ] Solo Owner puede remover miembros
- [ ] Member no puede acceder a Settings del workspace ni gestionar canales ni equipo
- [ ] Cada usuario puede pertenecer a múltiples workspaces
- [ ] Los datos de un workspace son invisibles para otros workspaces (verificar RLS)
- [ ] **Scope de leads por RLS:** Member solo ve contactos/conversaciones donde es setter, vendedor o `assigned_to` (función helper `can_see_contact`). Config del workspace para leads sin asignar (default: solo Owner/Admin)
#### F4: Instagram vía Zernio
- [ ] Conectar una cuenta de Instagram desde la UI con la API key de Zernio
- [ ] DMs entrantes en tiempo real (webhook de Zernio)
- [ ] Comentarios se reciben y se pueden responder
- [ ] Story replies llegan a la bandeja
- [ ] Mensajes vinculados al contacto correcto (por username)
- [ ] Respuestas desde la bandeja
- [ ] Estado de conexión visible (conectado/desconectado)
- [ ] Mensajes en `messages` con referencia correcta a `conversation` y `channel`
#### F5: TikTok, ELIMINADO de Fase 1 (Etapa 2)
#### F6: WhatsApp vía Evolution API
- [ ] Evolution API en Railway, accesible solo por red privada interna
- [ ] Desde la UI: crear una instancia de WhatsApp
- [ ] Se muestra un QR para vincular (Baileys)
- [ ] Al escanear, la instancia queda conectada
- [ ] Mensajes entrantes vía webhook interno
- [ ] Mensajes en `messages` con referencia a conversación y canal
- [ ] Respuestas desde la bandeja
- [ ] Se detecta la desconexión
- [ ] Notificación a los admins cuando WhatsApp se desconecta
- [ ] Reconectar escaneando QR nuevamente desde la UI
- [ ] `EVOLUTION_API_URL` apunta a la URL interna de Railway (no pública)

### Bloque 2: Email, configuración de integraciones y BYOK IA
#### F7: Email saliente vía Resend
- [ ] API key de Resend se guarda en Vault desde la pantalla de integraciones
- [ ] Emails transaccionales (invitaciones, notificación de desconexión de WhatsApp)
- [ ] El email sale con el remitente configurado (dominio verificado en Resend)
- [ ] Si falla, se registra el error y se reintenta hasta 3 veces
- [ ] Los emails enviados quedan registrados
- [ ] Infraestructura lista para secuencias y flows de Fase 2
#### F8: Pantalla de configuración de integraciones y BYOK IA (`/settings/integrations`)
- [ ] Accesible desde el sidebar, solo Owner y Admin
- [ ] Sección "Canales de mensajería":
	- Instagram (Zernio): API key, estado, conectar/desconectar
	- WhatsApp (Evolution API): "Crear instancia", QR, estado
	- Facebook (Zernio, opcional): API key, nota "$6/mes extra"
	- Twitter (Zernio, opcional): API key, nota "$6/mes extra"
	- (TikTok, YouTube y LinkedIn en Etapa 2, estructura extensible)
- [ ] Sección "Email": Resend (API key, dominio verificado, estado)
- [ ] Sección "Proveedores de IA (BYOK)": OpenAI, Anthropic, Google (Gemini), cada uno con API key y modelo por defecto
- [ ] Todas las API keys en Supabase Vault (nunca texto plano)
- [ ] Validación de formato de key (longitud mínima, prefijo cuando aplica)
- [ ] Cada integración es un registro en `integration_configs` con `type` ('channel', 'email_provider', 'ai_provider')
- [ ] Estado de cada integración en tiempo real
- [ ] Solo Owner y Admin ven y modifican
- [ ] Agregar integraciones nuevas no requiere cambios en la tabla

### Bloque 3: Modelo de contacto y CRM
#### F9: Modelo de contacto extendido
- [ ] Migración que agrega a `contacts`: `phone`, `secondary_email`, `country`, `instagram_username`, `tiktok_username`, `youtube_channel_id`, `linkedin_profile_url`, `whatsapp_phone`, `twitter_username`, `facebook_id` (text, nullable); `setter_id`, `vendedor_id` (uuid FK → auth.users, nullable); `next_followup_date` (timestamptz); `do_not_contact` (boolean default false); `do_not_contact_reason` (text); `do_not_contact_at` (timestamptz); `ai_conversation_summary` (text); `lead_temperature` (text CHECK IN ('cold','warm','hot')); `deleted_at` (timestamptz)
- [ ] Índices en: `phone`, `email`, `instagram_username`, `tiktok_username`, `whatsapp_phone`, `setter_id`, `vendedor_id`, `deleted_at`
- [ ] RLS actualizadas (scoped por workspace + scope de leads)
- [ ] Custom fields existentes (6 tipos: text, number, boolean, date, url, email) se conservan sin modificar
#### F10: Datos de atribución
- [ ] Campo `attribution` (jsonb, default '{}') en `contacts` con estructura:
```json
{
  "first_click": {
    "utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_term": "", "utm_content": "",
    "fbclid": "", "gclid": "", "ad_id": "", "campaign_id": "", "adset_id": "",
    "referrer_url": "", "landing_page": "", "captured_at": ""
  },
  "last_click": { "...mismos campos..." : "" }
}
```
- [ ] `first_click` se guarda la primera vez y no se modifica
- [ ] `last_click` se actualiza en cada nueva interacción con tracking
- [ ] Solo se incluyen los campos con valor
#### F11: Asignación setter y vendedor
- [ ] `setter_id` y `vendedor_id` en la ficha del contacto
- [ ] Dropdown con los miembros del workspace
- [ ] Ambos opcionales e independientes
- [ ] Cambios de asignación en el audit log
- [ ] Filtrar la lista de contactos por setter y por vendedor
#### F12: Detección cross-canal
- [ ] Al recibir un mensaje de un canal nuevo, buscar contacto por: mismo teléfono, mismo email, mismo username de red social
- [ ] Match exacto por teléfono o email → vincular automáticamente
- [ ] Nueva entrada en `contact_channels` vinculando el canal al contacto existente
- [ ] Conversación separada por canal
- [ ] Match solo por username → sugerir al operador (no automático)
- [ ] La ficha muestra todas las conversaciones agrupadas por canal
- [ ] El audit log registra las vinculaciones automáticas y manuales
#### F13: Notas en el contacto
- [ ] Tabla `contact_notes` (id, contact_id, workspace_id, content no vacío, created_by, created_at, updated_at, deleted_at)
- [ ] Sección "Notas" en la ficha con lista cronológica
- [ ] Cualquier miembro (con acceso al contacto) puede crear notas
- [ ] Solo el autor o Admin/Owner edita/elimina
- [ ] RLS scoped por workspace
#### F14: Ficha de contacto completa (`/contacts/[id]`)
- [ ] Todos los datos: nombre, email, teléfono, redes, país, setter, vendedor, temperatura, fecha de seguimiento
- [ ] "Conversaciones": por canal con preview del último mensaje
- [ ] "Notas": cronológica, con alta
- [ ] "Tags": agregar/quitar
- [ ] "Custom Fields": editables
- [ ] "Historial de cambios": últimos registros del audit log
- [ ] "Atribución": first click y last click
- [ ] Badge "no contactar"
- [ ] Botón editar
- [ ] Clic en una conversación → abre ese hilo en la bandeja
#### F15: Soft delete
- [ ] `deleted_at` en `contacts`, `contact_notes`, `conversations`, `response_templates`
- [ ] "Eliminar" = `deleted_at = now()`, nunca DELETE
- [ ] Listados filtran `deleted_at IS NULL`
- [ ] RLS excluyen registros con `deleted_at IS NOT NULL`
- [ ] Cron diario `/api/cron/purge-deleted` que borra definitivo lo que tiene `deleted_at < now() - interval '30 days'`
- [ ] La purga es en cascada (contacto → notas, conversaciones, etc.)

### Bloque 4: Bandeja, filtros y herramientas CRM
#### F16: Filtros de inbox
- [ ] Por tags (multi-select, al menos uno)
- [ ] Por asignación: "Todas", "Sin asignar", "Agente IA", miembros del equipo (como setter o vendedor)
- [ ] Por canal (Instagram, WhatsApp)
- [ ] Por fecha de último mensaje: hoy, 7 días, 30 días + rango personalizado
- [ ] Combinables (AND entre categorías)
- [ ] Reflejados en la URL (query params)
- [ ] Badge con la cantidad de filtros activos
- [ ] Botón "Limpiar filtros"
#### F17: Templates de respuesta rápida
- [ ] Tabla `response_templates` (id, workspace_id, name, content, shortcut, created_by, created_at, updated_at, deleted_at)
- [ ] Pantalla `/settings/templates` (CRUD)
- [ ] En la bandeja, "/" abre el selector de templates
- [ ] Búsqueda por nombre o shortcut
- [ ] Interpolación: `{{contact.display_name}}`, `{{contact.email}}`, `{{contact.phone}}`, `{{workspace.name}}`
- [ ] Variable sin valor → queda vacía
- [ ] RLS por workspace (crear/editar/eliminar solo Owner/Admin; Member ve y usa)
#### F18: Marca "no contactar"
- [ ] Frases de opt-out configurables por workspace: "no me escribas más", "dejá de mandar mensajes", "no quiero recibir mensajes", "stop", "unsubscribe", "basta", "no me contactes"
- [ ] Al detectar una frase en un mensaje entrante: `do_not_contact = true`, `do_not_contact_reason = 'auto: [frase]'`, `do_not_contact_at = now()`, se pausan las secuencias activas, se registra en audit log
- [ ] Badge rojo "No contactar" en bandeja y ficha
- [ ] Admin/Owner puede revertir (con audit log)
- [ ] Enviar a un contacto marcado muestra advertencia y pide confirmación (no bloquea)
#### F19: Importación CSV
- [ ] Botón "Importar CSV" en contactos
- [ ] Máximo 10MB y 10.000 filas
- [ ] Preview de 5 filas con mapeo sugerido
- [ ] Mapeo ajustable (incluye setter, vendedor, tags, custom fields)
- [ ] Validación: email válido; teléfono solo dígitos y "+" (normalizado); al menos email o teléfono
- [ ] Deduplicación por email o teléfono: actualiza en vez de duplicar (sin pisar datos con vacíos)
- [ ] Barra de progreso
- [ ] Resumen: importados, actualizados, errores (con detalle)
- [ ] Audit log (evento "csv_import")
- [ ] Tabla `csv_imports` (id, workspace_id, file_name, total_rows, imported, updated, errors, error_details jsonb, imported_by, created_at)
#### F20: Audit log global
- [ ] Tabla `audit_log` (id, workspace_id, entity_type, entity_id, action, changes jsonb `{campo:{old,new}}`, metadata jsonb, performed_by nullable, performed_at default now())
- [ ] Índices: `workspace_id`, `(entity_type, entity_id)`, `performed_at`
- [ ] Eventos: contacto (creado, editado, eliminado, restaurado, asignado, no contactar); canal (conectado, desconectado, error); configuración del workspace; importación CSV; equipo (invitado, rol cambiado, removido)
- [ ] RLS: Admin/Owner leen todo; Member solo sus propias acciones; inserción solo por el sistema
- [ ] Nunca se elimina

### Funcionalidades de fases siguientes (NO construir ahora)
Flow builder y triggers extendidos, BYOK en nodo AI Response, secuencias con IA y colisión, base de conocimiento (Fase 2). Agente IA con tool calling, memoria acumulativa, clasificación automática, dashboards (Fase 3). Publicación de contenido, roles custom, email bidireccional (Etapa 2). Agendamiento, ventas y pipeline (Etapa 4).

---
## 6. Flujos principales
### Flujo 1: Primer setup del sistema
1. Usuario entra y se registra (email + contraseña, Supabase Auth).
2. El trigger `on_auth_user_created` crea el workspace con el usuario como Owner.
3. Llega al dashboard vacío con un wizard de onboarding: a) nombre del negocio; b) conectar canales (WhatsApp por QR, Instagram con API key de Zernio); c) email saliente (Resend); d) IA BYOK (opcional).
4. Al terminar, el sistema está listo para recibir mensajes.
- **Errores:** si falla la creación del workspace → error y reintentar. Si falla un canal → saltar y conectar después desde Settings.
### Flujo 2: Mensaje entrante de Instagram
1. Zernio envía el webhook. 2. Validar firma HMAC. 3. Idempotencia vía `webhook_events`. 4. Buscar contacto por `instagram_username`. 5. Si no existe: crear contacto, `contact_channels` y conversación. 6. Si existe: vincular y usar/crear su conversación de Instagram. 7. Guardar el mensaje en `messages`. 8. Actualizar `last_message_at`, `last_message_preview`, `unread_count` de la conversación y `last_interaction_at` del contacto. 9. El operador lo ve y responde.
- **Errores:** webhook duplicado → ignorar. Falla de API de Zernio → registrar y reintentar. Contacto no creado → registrar error y mensaje huérfano.
### Flujo 3: Mensaje entrante de WhatsApp
1. Evolution API envía el webhook interno. 2. Validación e idempotencia. 3. Buscar contacto por `whatsapp_phone` o `phone`. 4. Si no existe: crear con `display_name`, `whatsapp_phone` y `phone`. 5. Si existe: vincular; si ya tiene conversaciones por otro canal, crear conversación separada de WhatsApp. 6. Guardar mensaje, actualizar conversación y contacto.
- **Errores:** WhatsApp desconectado → notificación a admins (el mensaje se pierde). Error de webhook → log y retry.
### Flujo 4: Detección cross-canal
El mismo lead escribe por Instagram y luego por WhatsApp con un número nuevo → se crean dos contactos. Si después aparece el mismo teléfono o email en ambos, el sistema sugiere vincularlos; si el operador acepta, se mueven los `contact_channels` al contacto principal y las conversaciones quedan separadas por canal bajo el mismo contacto. Al crear un contacto, si el teléfono o email ya existe en el workspace, se vincula automáticamente en vez de duplicar.
### Flujo 5: Importación CSV
1. `/contacts` → "Importar CSV". 2. Sube el archivo. 3. Preview de 5 filas. 4. Mapeo sugerido por nombre de columna. 5. Ajusta el mapeo. 6. Asigna setter/vendedor para todos (opcional). 7. Tags para todos (opcional). 8. "Importar". 9. Fila por fila: valida, busca por email o teléfono, actualiza los campos no vacíos o crea. 10. Barra de progreso. 11. Resumen.
- **Errores:** archivo muy grande → error con el límite. Filas inválidas → errores con detalle. CSV malformado → se aborta.
### Flujo 6: Operador gestiona la bandeja
1. `/inbox`, conversaciones por `last_message_at` desc. 2. Filtros. 3. Hilo completo, burbujas diferenciadas (lead izquierda, operador/sistema derecha). 4. Panel derecho: datos del contacto, tags, notas, custom fields, asignaciones. 5. Responder con texto o "/" para templates. 6. Se envía por el canal de la conversación. 7. Al responder, el operador se asigna automáticamente la conversación. 8. Todos los cambios al audit log.
- **Errores:** falla de envío → error visible con reintentar. Canal desconectado → error claro indicando reconectar.

---
## 7. Modelo de datos
### 7.1 Tablas existentes de ZernFlow (se conservan)

| Tabla | Campos principales | Notas |
|---|---|---|
| `workspaces` | id, name, slug, late_api_key_encrypted, global_keywords, ai_api_key, ai_provider | `ai_api_key` y `ai_provider` se deprecan a favor de Vault |
| `workspace_members` | workspace_id, user_id, role | Roles: owner, admin, member |
| `channels` | id, workspace_id, platform, late_account_id, username, display_name, webhook_id, webhook_secret, is_active, comment_rules, last_comment_cursor | 'instagram' y 'whatsapp' ya están en el CHECK (migración 16). No cambiar constraint en Etapa 1 |
| `contacts` | id, workspace_id, display_name, email, avatar_url, is_subscribed, last_interaction_at, metadata | **Se extiende** |
| `contact_channels` | id, contact_id, channel_id, platform_sender_id, platform_username | — |
| `tags`, `contact_tags` | — | — |
| `custom_field_definitions`, `contact_custom_fields` | 6 tipos | — |
| `flows`, `triggers`, `flow_sessions`, `flow_versions` | — | Se extienden en Fase 2 |
| `conversations` | id, workspace_id, channel_id, contact_id, late_conversation_id, platform, status, assigned_to, last_message_at, last_message_preview, unread_count, is_automation_paused | Suma `deleted_at` |
| `messages` | id, conversation_id, direction, text, attachments, platform_message_id, sent_by_flow_id, sent_by_node_id, sent_by_user_id, status | — |
| `broadcasts`, `broadcast_recipients` | — | No se usan en Etapa 1 |
| `scheduled_jobs`, `analytics_events`, `comment_logs`, `sequences`, `sequence_enrollments`, `workspace_invites`, `webhook_events` | — | Se conservan |

### 7.2 Extensiones a `contacts`
Ver F9 y F10. `phone` normalizado a formato internacional (+XX...). `instagram_username` sin "@".

### 7.3 Tablas nuevas
- **`contact_notes`**: ver F13.
- **`response_templates`**: ver F17.
- **`csv_imports`**: ver F19.
- **`audit_log`**: ver F20.
- **`integration_configs`**:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | — |
| workspace_id | uuid | Sí | FK → workspaces |
| type | text | Sí | CHECK ('channel', 'ai_provider', 'email_provider') |
| provider | text | Sí | 'whatsapp_evolution', 'instagram_zernio', 'resend', 'openai', 'anthropic', 'google_ai', etc. |
| display_name | text | No | Nombre para la UI |
| vault_secret_name | text | No | Nombre del secret en Vault |
| oauth_data | jsonb | No | Datos OAuth si aplica |
| config | jsonb | No | Config específica (modelos, parámetros) |
| is_active | boolean | Sí (default false) | — |
| connected_at | timestamptz | No | — |
| last_error | text | No | — |
| created_at / updated_at | timestamptz | Sí | default now() |

(`contact_attributions` NO existe: la atribución es el JSONB `attribution` en `contacts`.)

### 7.4 Notas de optimización
- Roles como campo en `workspace_members` (tabla de roles aparte recién en Etapa 2).
- `workspace_id` desnormalizado en `contact_notes` para simplificar RLS.
- `attribution` como JSONB (relación 1:1).
- `integration_configs` genérica en vez de una tabla por tipo.

### 7.5 Políticas de datos
- Soft delete en `contacts`, `contact_notes`, `conversations`, `response_templates`. 30 días. Purga diaria.
- `created_at`/`updated_at` en tablas principales. Cambios significativos al `audit_log`, que nunca se borra.
- Snapshot de precios: no aplica en esta fase.

---
## 8. Arquitectura
- **Frontend:** Next.js 16 + React 19 (App Router), Tailwind v4, @xyflow/react, Supabase SSR. Server Components por defecto.
- **Backend:** API Routes (`app/api/`) para webhooks y endpoints; Server Actions para mutaciones de UI; Service Role solo server-side (cron, webhooks).
- **Base de datos:** Supabase Pro, RLS en todas las tablas, Vault, Realtime en `conversations` y `messages`.
- **Integraciones:** Zernio (webhooks + REST, Instagram), Evolution API (webhooks internos + REST, red privada Railway), Resend (REST).
- **Auth:** Supabase Auth email/password; trigger `on_auth_user_created`; cookies httpOnly.
- **Hosting:** un proyecto Railway con 2 servicios en red privada (App Next.js pública con HTTPS + Evolution API no expuesta). Supabase externo.

## 9. Stack
Next.js 16.x, React 19.x, Tailwind v4, @xyflow/react 12.x, Supabase (PostgreSQL, Auth, Vault, Realtime), @supabase/supabase-js 2.x + @supabase/ssr 0.8, Railway, Evolution API (Baileys), Zernio (`@zernio/node`), Resend, Vercel AI SDK v6, Vitest 3.x, TypeScript 5.x.

---
## 10. Pantallas principales
### 10.1 Convenciones globales
- **Navegación:** sidebar colapsable (Dashboard, Inbox, Contacts, Flows, Sequences, Growth, Settings). Mobile: bottom navigation con las 5 principales. Breadcrumbs.
- **Visual:** Inter; paleta neutra heredada de ZernFlow con acento azul; botones primary/secondary/ghost/destructive, inputs con validación, cards, tablas con sorting y paginación, modales, dropdowns, toasts.
- **Estados:** vacío (ícono + texto + CTA), cargando (skeletons / spinner), error (banner rojo + acción sugerida), éxito (toast verde, 4 segundos).
- **Responsive:** mobile < 768px, tablet 768-1024px, desktop > 1024px. Tablas → cards en mobile. Paneles laterales → pantalla completa. Inbox mobile: lista y hilo en pantallas separadas con "volver".

### 10.2 Pantallas por bloque
**Bloque 1**
- **Dashboard (`/dashboard`)**: wizard de onboarding si no hay canales; cards (contactos, conversaciones abiertas, canales activos) + actividad reciente si los hay. Estados: sin canales / con canales sin datos ("Esperando mensajes") / con datos.
- **Inbox (`/inbox`, existente)**: 3 columnas (lista, hilo, panel del contacto). Lista con avatar, nombre, preview, ícono de canal, hora, no leídos, badge "no contactar". Burbujas diferenciadas con estado del mensaje. Campo de respuesta con "/" para templates. Toggle de agente IA visible pero sin funcionar (Fase 3). Reglas: scope de leads; al responder se auto-asigna; advertencia en contactos "no contactar". Empty state: "Conectá un canal para empezar a recibir mensajes".

**Bloque 2**
- **Integraciones (`/settings/integrations`)**: secciones colapsables (Canales, Email, IA BYOK). Card por integración con ícono, nombre, badge Conectado/Desconectado, cuenta, acción Conectar/Desconectar/Reconectar. QR en modal para WhatsApp. Estados: no configurado, conectado, error (badge rojo + "Reconectar"), guardando (spinner, campos deshabilitados). Desconectar pide confirmación. Solo Owner/Admin.

**Bloque 3**
- **Lista de contactos (`/contacts`)**: búsqueda (nombre, email, teléfono, username); filtros (tags, setter, vendedor, temperatura, canal); tabla (avatar, nombre, email, teléfono, tags, setter, vendedor, temperatura, último contacto, acciones); "Importar CSV"; "Nuevo contacto". 25 por página. Sort por columna. Empty state: "Importá contactos o conectá un canal". Eliminar (soft) solo Admin/Owner.
- **Ficha (`/contacts/[id]`)**: header (avatar, nombre, email, teléfono, temperatura, badge no contactar, Editar), sidebar de datos (setter, vendedor, seguimiento, país, redes), secciones Conversaciones, Notas (Enter guarda), Tags, Custom Fields (edición inline), Historial, Atribución. Mobile: accordion.
- **Modal de importación CSV**: 4 pasos (upload drag & drop, preview/mapeo, opciones setter/vendedor/tags, progreso → resumen). Descarga de errores. Full-screen en mobile.

**Bloque 4**
- **Inbox con filtros**: barra de filtros (Canal, Tags, Asignación, Fecha con presets + calendario), badge "N filtros activos", "Limpiar filtros", "/" para templates inline. Mobile: panel de filtros tipo sheet desde abajo.
- **Templates (`/settings/templates`)**: tabla (nombre, shortcut, preview, creado por, acciones), formulario con guía de variables y preview en vivo. Eliminar con confirmación (soft delete). Owner/Admin gestionan, Member ve y usa.

---
## 11. Guías de UI
- Diseño neutro y profesional, acento azul. Inter. h1 2rem, h2 1.5rem, h3 1.25rem, body 14px, small 0.875rem.
- Textos de la UI en español rioplatense (vos), sin jerga técnica, errores claros con acción sugerida.
- Acciones en un clic; modales solo para confirmaciones y formularios cortos; undo de 5 segundos antes del soft delete; atajos: "/" templates, Ctrl+Enter enviar, Escape cerrar modales.

---
## 12. Fuera del alcance de esta fase
- **Fase 2:** flow builder con triggers extendidos, BYOK en nodo AI Response, secuencias con IA y colisión, base de conocimiento, feedback de ventana de Instagram, notificaciones de derivación a humano.
- **Fase 3:** agente IA con tool calling, memoria acumulativa, clasificación automática, toggle de IA funcional, dashboards.
- **Etapas futuras:** TikTok (publicación), YouTube, LinkedIn, LateWiz, email bidireccional, roles custom, Meta Ads, agente integral, Fathom, MCP, agendamiento, ventas.
- **Fuera del proyecto:** detección de seguidores de Instagram, app nativa, CRMs externos, facturación, bot de voz, rotación automática de keys, merge automático de contactos.

---
## 13. Decisiones transversales

| Decisión | Definición |
|---|---|
| Historial y auditoría | `audit_log` global, nunca se elimina |
| Soft delete | `deleted_at` en contactos, notas, conversaciones, templates. 30 días + purga diaria en cascada |
| Deduplicación | Por teléfono y/o email. Match exacto → vincular. Solo username → sugerir |
| Estados | Conversación: open → closed. Contacto: active → do_not_contact. Enrollment: active → paused → completed. Invitación: pending → accepted → expired |
| Casos borde | WhatsApp desconectado: aviso a admins. Webhook duplicado: `webhook_events`. CSV inválido: abortar. API key inválida: error visible en UI. Dos operadores a la vez: gana el último (Realtime actualiza a ambos) |
| Zona horaria e idioma | Fechas en UTC, el frontend convierte a la zona del navegador. UI en español rioplatense |
| Asignación | Doble: setter y vendedor, manual en Fase 1. Conversaciones se auto-asignan al que responde. La asignación define el scope de visibilidad |
| Cross-canal | Identificador: teléfono > email > username |
| BYOK y secrets | Vault AES-256, RPC store/read/delete, aislado por workspace |
| Webhooks | Idempotencia con `webhook_events`, ack 200 inmediato, procesamiento pesado en `scheduled_jobs`, HMAC para Zernio (Evolution en red interna no lo necesita) |

---
## 13b. Seguridad
- Auth email/password, sesiones httpOnly (access 1h, refresh 7 días), rate limiting de Supabase, reset password nativo.
- **RLS** en todas las tablas; helper `is_workspace_member(ws_id)` ya existe.

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `contact_notes` | Miembros | Miembros | Autor, Admin, Owner | Autor, Admin, Owner |
| `response_templates` | Miembros | Owner, Admin | Owner, Admin | Owner, Admin |
| `csv_imports` | Miembros | Miembros | — | — |
| `audit_log` | Member sus acciones, Admin/Owner todo | Solo sistema (service role) | — | — |
| `integration_configs` | Owner, Admin | Owner, Admin | Owner, Admin | Owner, Admin |

- `contacts` y `conversations`: scope por workspace **+ scope de leads** con helper `can_see_contact(...)` en SELECT/UPDATE/DELETE. Se evalúa en la base, no solo en la UI.
- Validación en cliente y servidor: email, teléfono normalizado, URLs, API keys (longitud y prefijo), CSV (10MB, 10.000 filas), sanitización XSS.
- API routes con verificación de JWT; rate limiting en webhooks; CORS solo al dominio de la app; headers de seguridad (CSP, X-Frame-Options DENY, nosniff, HSTS) en `next.config.ts`.
- Secrets en Vault; service role solo server-side; sin datos sensibles en logs; `.env` en `.gitignore`.
- HTTPS en producción; HMAC en webhooks de Zernio; Evolution API solo por red privada.

---
## 13c. Base técnica heredada (fork de ZernFlow)
- Proyecto base: https://github.com/zernio/zernflow (MIT). Next.js 16, React 19, Tailwind v4, TypeScript 5, Vitest 3.
- **Ya implementado, NO reconstruir:** auth + trigger de workspace, flow builder (17 nodos, motor recursivo), inbox, CRM con tags y custom fields, secuencias con auto-pausa, team management con invitaciones de 7 días, broadcasts (sin uso), `webhook_events`, `flow_versions`, Realtime.
- **Patrones a seguir:** Supabase SSR con cookies httpOnly; Server Components + hooks (sin store global); webhooks en API Routes y mutaciones de UI en Server Actions; RLS en cliente y Service Role en server solo cuando hace falta; Tailwind v4 utility classes; motor de flows en `lib/flow-engine/`.

---
## 13d. Proyecto como template clonable
- Migraciones con formato `000NN_nombre.sql`, idempotentes (`IF NOT EXISTS`, `DO $$ ... $$`). **Nuevas desde `00018_`.**
- `.env.example` actualizado con comentario por variable. Variables esperadas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `RESEND_API_KEY` (opcional si está en Vault). Las keys de canales e IA van por UI a Vault, no en `.env`.
- README de setup: fork → Supabase Pro → habilitar Vault → correr migraciones en orden → `.env` → Evolution API en Railway (misma red) → `npm install` → `npm run dev` → deploy en Railway. Con troubleshooting (RLS, Vault, WhatsApp, API key).
- Personalización sin código: workspace, canales, IA, tags, custom fields, templates, flows y frases de opt-out desde la UI.

---
## 14. Pendientes y dependencias
- Wizard de onboarding: el diseño visual es flexible.
- Resend necesita dominio verificado. Zernio necesita cuenta con las 2 cuentas free activas.
