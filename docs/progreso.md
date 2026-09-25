# Progreso: Etapa 1, Fase 1

| Bloque | Estado | Fecha | Notas |
|---|---|---|---|
| 0. Setup (fork clonado, `.env`, migraciones 00001-00017) | Hecho (verificado en Bloque 1) | 2026-09-23 | Repo en GitHub propio. `00017_grant_table_privileges.sql` agregada |
| 1. Fork, deploy y foundation | Hecho, deploy en Vercel confirmado | 2026-09-24 | Migraciones 00018-00025 corridas contra Supabase. App desplegada en Vercel, Evolution API en Railway. Ver detalle abajo |
| 2. Email, integraciones y BYOK IA | Hecho, deploy en Vercel confirmado | 2026-09-24 | Migraciones 00018 (actualizada), 00026-00028 corridas. Zernio, WhatsApp y Resend conectados y probados, deploy hecho y confirmado por el usuario. Ver detalle abajo |
| 3. Modelo de contacto y CRM | Hecho, verificado contra Supabase real | 2026-09-25 | Migraciones 00029-00034 corridas. Bugs de RLS/permisos encontrados en la verificacion, corregidos. Ver detalle abajo |
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

**Pendiente (actualizado 2026-09-24): ninguno.** Todo lo de este bloque quedo hecho y verificado (ver cierre en Bloque 2).

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

**Deploy a Vercel confirmado por el usuario (2026-09-24).** Bloque 1 y Bloque 2 quedan cerrados.

**Pendiente para mas adelante (no bloquea el Bloque 3):**
- Decidir la frecuencia real de los cron jobs en `vercel.json` (hoy 1 vez por dia, el motor de flows necesita mucho mas seguido — ver nota arriba).
- Confirmar en los logs de Vercel que el webhook de WhatsApp (`/api/webhooks/evolution`) le esta llegando solo a la app en produccion (sin depender del chequeo de respaldo agregado en el debugging de este bloque).
- Punto de enganche para el Bloque 3 (ya anotado en el codigo): cuando exista `audit_log`, registrar ahi cada conexion/desconexion de una integracion (`integration_configs`) y cada email enviado (`email_logs`). **Nota: quedo pendiente, no se engancho en este bloque** (`integration_configs`/`email_logs` siguen sin loguear en `audit_log`; se puede sumar mas adelante sin romper nada).

## Detalle Bloque 3 (2026-09-24)

**Hecho (codigo):**
- Migraciones `00029` a `00032` (idempotentes, con GRANT):
  - `00029_contacts_extended_fields.sql`: F9 (telefono, redes, pais, seguimiento, no-contactar, resumen IA, temperatura, `deleted_at`) + F10 (`attribution` jsonb) en `contacts`, con todos los indices pedidos.
  - `00030_audit_log.sql`: F20, tabla `audit_log` (Admin/Owner ven todo, Member solo sus propias acciones, insert solo por service role, nunca se edita ni se borra).
  - `00031_contact_notes.sql`: F13, tabla `contact_notes` (autor o Admin/Owner edita/borra, scope por `can_see_contact`).
  - `00032_soft_delete.sql`: F15, `deleted_at` en `conversations`, RLS de `contacts`/`conversations` actualizada para ocultar lo borrado, y se sacaron las policies de `DELETE` para `authenticated` (el "Eliminar" de la UI es siempre `deleted_at = now()`, nunca un DELETE real; el borrado definitivo solo lo hace el cron con el service role).
- `lib/phone.ts`: normalizacion de telefono a formato internacional con `libphonenumber-js` (dependencia nueva, se evaluo hacerlo con un regex a mano y se descarto: la numeracion varia demasiado por pais). Incluye `normalizeWhatsAppJidPhone` para el numero que manda Baileys (E.164 sin el "+").
- `lib/audit.ts`: helper unico `logAuditEvent` + `diffFields` para loguear en `audit_log` (siempre con el service role, la tabla no deja insertar a `authenticated`).
- `lib/attribution.ts`: F10, `buildAttributionClick`/`applyAttribution` (`first_click` se graba una sola vez, `last_click` se pisa). **Importante:** ni el webhook de Zernio ni el de Evolution API mandan hoy datos de UTM/fbclid/gclid, asi que en la practica el campo va a quedar vacio hasta que exista una fuente real de esos datos (CSV del Bloque 4, o un link de captura propio mas adelante). La logica ya esta lista para ese momento.
- `lib/cross-channel.ts` (F12): `findContactMatch` busca un contacto existente por telefono, email o username de Instagram (en ese orden, exacto). Se engancho en `upsertContactForSender` (`lib/inbox-sync.ts`): un remitente nuevo que matchea se vincula automatico (nuevo `contact_channels` + audit log "linked"); si no matchea, se crea el contacto nuevo (audit log "created"). Los dos webhooks (`app/api/webhooks/late/route.ts` para Instagram, `app/api/webhooks/evolution/[secret]/route.ts` para WhatsApp) ahora pasan el telefono/username normalizado.
- **Decision sobre el caso mas dificil de F12** (dos contactos que ya existian cada uno por separado y despues resultan tener el mismo telefono/email): en vez de fusionarlos automaticamente (el documento pide "sin merge automatico/destructivo"), el sistema detecta el choque al crear o editar un contacto y lo bloquea con un mensaje claro (`lib/actions/contacts.ts:findDuplicate`, corre con el service role para detectar duplicados en todo el workspace aunque el que esta editando no tenga scope para verlos), y se agrego una accion manual explicita para Owner/Admin (`linkContactChannel` + pantalla "Vincular con otro contacto" en la ficha) que mueve canales/notas/conversaciones al contacto elegido y deja el duplicado soft-deleted, con audit log de los dos lados.
- `lib/actions/contacts.ts`: `createContact`, `updateContact`, `assignContact` (F11, solo Owner/Admin), `softDeleteContact` (F15, solo Owner/Admin), `linkContactChannel`, `searchContactsForLinking`.
- `lib/actions/contact-notes.ts` (F13): crear/editar/borrar (soft) notas, con audit log.
- `lib/actions/contact-tags.ts` y `lib/actions/custom-fields.ts`: agregar/quitar tags y editar valores de custom fields desde la ficha (no existia ninguna UI para esto en todo el proyecto, se construyo nueva; la definicion de tags/custom fields en si no se toco).
- `lib/members.ts`: `listWorkspaceMembers`, mismo patron que ya usaba `/settings/team` para resolver nombre/email via `auth.admin` (RLS no deja leer `auth.users`).
- `/dashboard/contacts`: reescrita con busqueda, filtros (tags, setter, vendedor, temperatura, canal) y paginacion de 25, todo en la URL (`searchParams`, no mas carga de 100 sin paginar). Boton "Nuevo contacto" y borrado (soft) solo para Admin/Owner.
- `/dashboard/contacts/[contactId]`: reconstruida entera (F14): header con badge "no contactar" y temperatura, asignacion de setter/vendedor, seguimiento, redes, atribucion, conversaciones agrupadas por canal (con link que abre el hilo puntual en la bandeja), notas, tags, custom fields (edicion inline), historial (ultimos eventos del audit log) y boton Editar. De paso se corrigio un bug que ya estaba en el codigo viejo: la pantalla pedia una columna `field_type` que no existe en `custom_field_definitions` (la columna real es `type`).
- `/dashboard/inbox`: ahora soporta `?conversation=<id>` para abrir un hilo puntual desde la ficha (no existia antes).
- `/api/cron/purge-deleted` (F15): cron nuevo (mismo patron de auth que los otros, `CRON_SECRET`), agregado a `vercel.json` (una vez por dia). Borra en cascada lo que tiene `deleted_at` de mas de 30 dias: alcanza con borrar `contacts` de verdad (las FK `ON DELETE CASCADE` ya existentes se llevan notas, canales, conversaciones, mensajes, tags y custom fields) mas `conversations`/`contact_notes` borrados sueltos (sin borrar el contacto entero).
- Tests nuevos: `lib/phone.test.ts`, `lib/attribution.test.ts`, `lib/cross-channel.test.ts`, mas casos nuevos en `lib/inbox-sync.test.ts` para el matching cross-canal.
- `npm run build`, `npm test` (84/84) y `npm run lint` (0 errores) pasan.

**Fuera de este bloque, a proposito:**
- Filtros de inbox, templates de respuesta, deteccion automatica de "no contactar" e importacion CSV: eso es el Bloque 4 (F16-F19). El campo `do_not_contact` esta listo en la base y el badge se muestra si esta en `true`, pero el marcado automatico y el boton manual de marcar/revertir se construyen en el Bloque 4.
- No se construyo pantalla para crear/editar las *definiciones* de custom fields (que campos existen y de que tipo): F14 pide editar los *valores*, no definir campos nuevos, y esa pantalla no existia en ningun lado del proyecto antes de este bloque. Si el workspace no definio ningun custom field, esa seccion de la ficha queda con su empty state.

**Bugs encontrados y arreglados en la verificacion contra Supabase real (2026-09-25):**
1. **"permission denied for table workspace_invites" al abrir un link de invitacion:** no era RLS, a `service_role` (el que usan webhooks, crons y paginas como la de aceptar invitacion) le faltaba el GRANT basico sobre esa tabla. La migracion `00017` se lo habia dado a `anon`/`authenticated` pero no a `service_role`. Migracion nueva: `00034_grant_service_role_privileges.sql`, que lo cubre para todas las tablas (presentes y futuras), no solo esa.
2. **"new row violates row-level security policy for table contacts" al crear un contacto, incluso siendo Owner:** el `insert(...).select("id").single()` de `createContact` le pedia a Postgres que devuelva la fila recien creada (`RETURNING`), y esa devolucion vuelve a evaluar la policy de `SELECT` sobre la fila nueva. Esa segunda evaluacion fallaba en la base real por un motivo que no se pudo determinar del todo sin acceso directo (las policies y los GRANT estaban bien, confirmado con `pg_policies`). Se lo esquivo de raiz: el `id` del contacto ahora se genera en el codigo (`randomUUID()`) antes de guardar, y el insert no pide `RETURNING`; si Postgres no tira error, ya sabemos que se guardo bien y ya sabemos el id. Mismo arreglo aplicado a `createContactNote` por las dudas (mismo patron `insert + select`). Confirmado con el usuario que el scope de leads (Member solo ve sus contactos asignados) sigue intacto: esto no toco ninguna policy, solo como se confirma el guardado.
3. Ademas, un Member que crea un contacto sin asignar quedaba, por el scope de leads, sin poder ver el mismo lo que acababa de crear (justo el mismo mecanismo del bug 2, via RETURNING). Se le asigna como setter automatico al crearlo si quien crea es Member (Owner/Admin lo dejan sin asignar).

**UI ajustada durante la verificacion (feedback del usuario):**
- Selector de pais en el formulario de contacto: pasa de un input de 2 letras a un `<select>` con nombres de paises en espanol.
- Campo "Proximo seguimiento": reemplazado el `datetime-local` nativo (no mostraba un calendario visible en todos los navegadores) por un calendario propio con el estilo del sistema (`components/ui/date-time-field.tsx`), mas un selector de hora (manual o de una lista, no el dropdown de hora/minuto por separado que se probo primero).
- Rol del usuario logueado agregado debajo del nombre del workspace en el dropdown de arriba a la izquierda del sidebar, y debajo del nombre del setter/vendedor en la tabla de `/dashboard/contacts`.
- Conversaciones de la ficha agrupadas por canal (Instagram/WhatsApp), antes se listaban todas juntas.
- Mensajes de progreso rotando en el boton de sincronizar conversaciones de la bandeja (antes decia "Syncing..." fijo mientras duraba, y puede tardar bastante).

**Pendiente:**
- Decidir si conviene agregar una fuente real de datos de atribucion (UTM/fbclid) antes de la Fase 3, ya que hoy ningun canal conectado la manda.
- La causa exacta del bug 2 (por que fallaba la revision de RLS sobre el RETURNING) quedo sin resolver del todo; el arreglo la esquiva pero si aparece el mismo error en otro insert nuevo mas adelante (fuera de contacts/contact_notes), aplicar el mismo patron (id generado en el codigo, sin `.select()` despues del insert).

**Como probarlo:**
1. Correr las migraciones nuevas contra Supabase.
2. `/dashboard/contacts`: crear un contacto nuevo con telefono (ej: `+5491123456789`), confirmar que aparece en la lista. Probar los filtros (tag, setter, vendedor, temperatura, canal) y que queden en la URL. Probar que buscar por telefono/email/username funciona.
3. Mandar un mensaje de WhatsApp a un numero conectado con el mismo telefono del contacto que acabas de crear: tiene que vincularse automatico al mismo contacto (no crear uno nuevo), y verse un evento "Canal vinculado" en el Historial de la ficha.
4. Intentar crear un contacto nuevo con un telefono o email que ya usa otro: tiene que bloquear la creacion con un mensaje y (si el que esta probando puede ver ese contacto) un link a el.
5. En la ficha de un contacto: asignar setter y vendedor (con un usuario Owner/Admin), agregar una nota, agregar/quitar un tag, y si el workspace tiene algun custom field definido, editar su valor. Confirmar que "Historial de cambios" va sumando cada accion.
6. Crear dos contactos de prueba con datos distintos y usar "Vincular con otro contacto" (Owner/Admin) para fusionarlos; confirmar que las conversaciones/notas del duplicado terminan bajo el contacto elegido y que el duplicado desaparece de la lista (soft-deleted).
7. Eliminar un contacto (Owner/Admin) y confirmar que desaparece de la lista y de la busqueda.
8. **Probar el scope con un usuario Member:** crear/invitar un segundo usuario como Member, asignarle un contacto como setter en OTRO usuario Owner, y confirmar que: (a) el Member solo ve en `/dashboard/contacts` los contactos donde es setter/vendedor; (b) no puede ver el boton "Eliminar" ni "Vincular con otro contacto" (son solo Owner/Admin); (c) no puede cambiar setter/vendedor (los selects se muestran de solo lectura); (d) si intenta crear un contacto con un telefono que ya usa un contacto que no puede ver, el mensaje de error NO revela cual es (dice que pida a un Admin que lo revise).
9. Pegarle a `/api/cron/purge-deleted?key=<CRON_SECRET>` manualmente y confirmar que no rompe nada con la base vacia (no deberia borrar nada si no hay nada con mas de 30 dias de borrado).
