# Progreso: Etapa 1, Fase 1

| Bloque | Estado | Fecha | Notas |
|---|---|---|---|
| 0. Setup (fork clonado, `.env`, migraciones 00001-00017) | Hecho (verificado en Bloque 1) | 2026-09-23 | Repo en GitHub propio. `00017_grant_table_privileges.sql` agregada |
| 1. Fork, deploy y foundation | Codigo listo, falta deploy manual | 2026-09-23 | Migraciones 00018-00025 escritas (no corridas contra Supabase todavia). Falta: crear proyecto Railway + Supabase Pro, correr migraciones, deploy. Ver detalle abajo |
| 2. Email, integraciones y BYOK IA | Verificado en local, falta deploy a Vercel | 2026-09-24 | Migraciones 00018 (actualizada), 00026-00028 corridas contra Supabase. Zernio, WhatsApp y Resend conectados y probados en local. Ver detalle abajo |
| 3. Modelo de contacto y CRM | Pendiente | | |
| 4. Bandeja, filtros y herramientas CRM | Pendiente | | |
| Testing de fase | Pendiente | | |

## Detalle Bloque 1 (2026-09-23)

**Hecho (codigo):**
- `.gitattributes` (fin de linea LF, arregla el test de `ALL_MIGRATIONS.sql` y evita el problema de CRLF a futuro).
- Migraciones `00018` a `00025`: Vault (F2), `setter_id`/`vendedor_id` adelantados a `contacts`, scope de leads por RLS con `can_see_contact`/`can_see_conversation` (F3), campos de WhatsApp en `channels`, tabla `admin_notifications`, RLS de Owner/Admin para cambiar roles, gestionar canales y editar el workspace.
- Roles: Admin ahora puede invitar/cambiar roles/revocar invitaciones (antes solo Owner). Member bloqueado de Settings/Team/Channels en UI (redirect) y en RLS (server-side).
- Instagram/Zernio: story replies ahora se detectan y se muestran en la bandeja con un indicador ("Respondio a tu historia").
- WhatsApp/Evolution API completo: cliente REST (`lib/evolution-client.ts`), acciones de servidor (crear instancia, refrescar QR, desconectar), webhook interno (`/api/webhooks/evolution`) que guarda mensajes localmente y detecta desconexion, UI de conexion con modal de QR en `/dashboard/channels`, notificacion in-app a Owner/Admin cuando se desconecta (campanita en el sidebar).
- `npm run build`, `npm test` (60/60) y `npm run lint` (0 errores) pasan.

**Decision de arquitectura (2026-09-23, se aparta del documento de requerimientos):** la app se despliega en Vercel (no Railway) y Evolution API se mantiene en Railway como servicio aparte. Como no comparten red privada, el webhook de Evolution ya no confia en la red interna: lleva un secreto por canal en la URL (`/api/webhooks/evolution/[secret]`, guardado en `channels.webhook_secret`, mismo patron que ya usaba Zernio) para que nadie mas pueda mandarle eventos falsos. Por esto, el criterio F6 "`EVOLUTION_API_URL` apunta a la URL interna de Railway (no publica)" ya no aplica tal cual: ahora apunta a la URL **publica** de Evolution API en Railway, protegida por su API key.

**Pendiente (actualizado 2026-09-24):**
- ~~Correr las migraciones 00018-00025 contra Supabase real~~ — hecho (ver Bloque 2, ya corridas junto con 00026-00028).
- ~~Verificar conexion de Instagram (Zernio) y WhatsApp~~ — hecho en local (ver verificacion en Bloque 2).
- Sigue pendiente: crear el proyecto Evolution API en Railway si todavia no existe (el usuario ya tiene `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` reales cargados, asi que probablemente ya este creado) y el deploy de la app en Vercel (ver Bloque 2).
- Nota sobre el webhook de Evolution API: en local no se pudo confirmar que el webhook le llegue solo a la app (no puede, ver Bloque 2), asi que los nombres de campos del payload (`/api/webhooks/evolution`) siguen sin verificar contra un caso real. Se agrego un chequeo de respaldo que no depende del webhook, pero conviene revisar los logs de ese endpoint ni bien este desplegado.

## Detalle Bloque 2 (2026-09-24)

**Hecho (codigo):**
- Migracion `00026_integration_configs.sql`: tabla generica `integration_configs` (type: channel/ai_provider/email_provider), RLS y GRANT solo Owner/Admin.
- Migracion `00027_email_logs.sql`: registro de emails enviados (para/asunto/estado/intentos/error), RLS y GRANT Owner/Admin.
- Cambios a `00018_vault_setup.sql` en el lugar:
  - Las 3 funciones (`store_secret`, `read_secret`, `delete_secret`) ahora tambien aceptan al service role (helper nuevo `is_service_role()`), para que los webhooks y crons puedan usarlas.
  - Funcion nueva `read_channel_secret`: variante de `read_secret` para secrets que necesita **cualquier Member** en tiempo de ejecucion (hoy, solo `zernio_api_key`), no solo Owner/Admin. Lista blanca de nombres a proposito, no es un passthrough generico.
  - Como `00018` ya estaba corrida contra Supabase antes de este cambio (Supabase CLI controla que migraciones corrieron por nombre de archivo, no por contenido), el cambio real llego a la base via una migracion nueva, `00028_vault_service_role_and_channel_secret.sql`, que aplica lo mismo con `create or replace function` (idempotente). El archivo `00018` tambien quedo actualizado para que un clon nuevo del repo arranque directo con la version final.
- `lib/vault.ts`: conector TypeScript a las 3 funciones de Vault + `readChannelSecret` (no existia ningun wrapper hasta ahora).
- `lib/permissions.ts`: `isOwnerOrAdmin()` centralizado (antes repetido en 4 lugares).
- **Migracion de la API key de Zernio de texto plano a Vault**: se encontro que `workspaces.late_api_key_encrypted` se leia en 10 lugares (no solo en las pantallas de conexion): la bandeja (`/api/v1/messages`), el motor de flows (`lib/flow-engine/engine.ts`, 3 nodos, mas el nodo `ai-response.ts`), el procesador de secuencias, el de comentarios, y los broadcasts (cron). Se migraron los 10 usando `readChannelSecret` (Member) o `readSecret`/`storeSecret`/`deleteSecret` (Owner/Admin, en las pantallas de conexion). La columna vieja sigue existiendo en la base pero ya no la usa el codigo.
- `lib/email/resend-client.ts` + `lib/email/send-email.ts` (F7): envio via fetch a la API de Resend (sin agregar el SDK como dependencia nueva), 3 reintentos con espera creciente, registro en `email_logs` de cada intento final.
- Enganchado el envio real de la invitacion de equipo (`lib/actions/team.ts`, antes solo creaba la fila sin mandar nada) y el aviso por email a Owner/Admin cuando WhatsApp se desconecta (ademas de la notificacion in-app que ya existia).
- `lib/actions/integrations.ts`: Server Actions para conectar/desconectar Zernio, Resend y los 3 proveedores de IA BYOK (OpenAI, Anthropic, Google), con validacion de formato de key.
- Pantalla nueva `/dashboard/settings/integrations` (3 secciones colapsables: Canales, Email, IA BYOK), con estado en tiempo real via Supabase Realtime. La seccion Canales reutiliza el componente de canales del Bloque 1 (Instagram/Zernio + WhatsApp/Evolution), no se reescribio.
- `/dashboard/channels` ahora redirige a `/dashboard/settings/integrations` (decision de consolidar en una sola pantalla, confirmada con el usuario). Se elimino el endpoint viejo `/api/v1/channels/test-key`, reemplazado por el Server Action `saveZernioApiKey`.
- La pantalla general de Settings perdio la seccion de Zernio (se mudo a Integraciones) y ahora linkea ahi. La seccion de AI Gateway (para el nodo "AI Response" del flow builder) queda igual: es una key distinta a las de BYOK IA, esa integracion queda para Fase 2.
- `npm run build`, `npm test` (65/65) y `npm run lint` (0 errores) pasan.

**Decisiones tomadas con el usuario durante este bloque:**
- Consolidar la conexion de canales dentro de Integraciones en vez de mantener dos pantallas separadas.
- Migrar la key de Zernio a Vault a pesar de que Vault solo dejaba leer a Owner/Admin: se agrego `read_channel_secret` (lista blanca) para que cualquier Member pueda seguir enviando/recibiendo mensajes sin exponer las otras keys (Resend, IA) a nadie que no sea Owner/Admin.
- Confirmado con el usuario: la app se despliega en **Vercel** (la nota anterior que decia Railway estaba mal / desactualizada, corregida abajo).

**Nota sobre `vercel.json`:** los crons (`/api/cron/jobs` y `/api/cron/sequences`) estan en `0 3 * * *` (una vez al dia), a pedido del usuario en un momento donde se penso que el deploy iba a ser en Railway. Como el deploy final es en Vercel, `vercel.json` **si** va a disparar esos crons en produccion, pero una vez al dia es mucho mas lento de lo que el motor de flows necesita (los comentarios del codigo piden cada 10-30s y 30-60s respectivamente) para avanzar los delays de los flows, el envio de broadcasts y las secuencias. Queda pendiente decidir la frecuencia real con el usuario antes o al hacer el deploy (el plan gratuito de Vercel Cron tiene un minimo de 1 vez por dia; una frecuencia mas alta necesita plan pago o un servicio externo pegandole a esos endpoints con `CRON_SECRET`).

**Verificacion en local (2026-09-24), con varias vueltas de debugging:**
- Zernio (Instagram): conectado, cuenta sincronizada y visible en la grilla de canales.
- WhatsApp: conectado, QR escaneado y confirmado.
- Resend: conectado (key + remitente).
- Bugs encontrados y arreglados durante esta verificacion:
  1. **WhatsApp no confirmaba la conexion en local:** el webhook de Evolution API no le puede avisar a un `localhost` (Evolution corre en Railway, en internet, no puede "tocarle la puerta" a una maquina detras de un router hogareño). Se agrego `checkWhatsappConnectionState` (`lib/actions/whatsapp.ts`), que ademas del webhook, consulta directo el estado en Evolution API cada 3s mientras el modal del QR esta abierto. Sirve tanto para desarrollo local como de respaldo en produccion por si algun webhook se pierde.
  2. Esa consulta nueva fallaba en silencio si habia un error (por ejemplo, variables de entorno mal cargadas): se corrigio para mostrar el error en el modal.
  3. **La lista de canales no se actualizaba sola al conectar Zernio:** `ChannelsView` guardaba los canales en un estado local que solo se cargaba una vez al entrar a la pantalla; conectar Zernio sincronizaba las cuentas en la base pero la grilla se quedaba con la lista vieja (vacia). Se agrego un `useEffect` que sincroniza el estado cuando cambian los canales, y `ZernioCard` ahora pide un `router.refresh()` al conectar con exito.
  4. El campo "remitente" de Resend pedia un email completo (`notificaciones@tudominio.com`), no el dominio solo (`tudominio.com`) — la confusion vino de que el "dominio verificado" es un concepto de Resend, pero el campo de esta pantalla necesita una casilla que use ese dominio.
- `npm run build`, `npm test` (65/65) y `npm run lint` (0 errores) pasan despues de estos fixes.

**Pendiente (accion manual del usuario):**
- Deploy a Vercel: cargar todas las variables de entorno ahi (Vercel no lee el `.env` local) — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, y `NEXT_PUBLIC_APP_URL` (con la URL real de Vercel, corregida despues del primer deploy).
- Confirmar que el webhook de WhatsApp funciona solo (sin el chequeo de respaldo) una vez desplegado, y decidir la frecuencia real de los cron jobs en `vercel.json`.
- Punto de enganche para el Bloque 3 (ya anotado en el codigo): cuando exista `audit_log`, registrar ahi cada conexion/desconexion de una integracion (`integration_configs`) y cada email enviado (`email_logs`).
