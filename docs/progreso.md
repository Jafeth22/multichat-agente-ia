# Progreso: Etapa 1, Fase 1

| Bloque | Estado | Fecha | Notas |
|---|---|---|---|
| 0. Setup (fork clonado, `.env`, migraciones 00001-00017) | Hecho (verificado en Bloque 1) | 2026-09-23 | Repo en GitHub propio. `00017_grant_table_privileges.sql` agregada |
| 1. Fork, deploy y foundation | Codigo listo, falta deploy manual | 2026-09-23 | Migraciones 00018-00025 escritas (no corridas contra Supabase todavia). Falta: crear proyecto Railway + Supabase Pro, correr migraciones, deploy. Ver detalle abajo |
| 2. Email, integraciones y BYOK IA | Pendiente | | |
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

**Pendiente (accion manual del usuario):**
- Crear los proyectos en Railway (app + Evolution API en red privada) y en Supabase (plan Pro).
- Correr las migraciones 00018-00025 contra Supabase real (no se corrieron todavia).
- Configurar variables de entorno en Railway (incluye `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` nuevas).
- Verificar registro, Owner automatico, conexion de Instagram (Zernio) y escanear el QR de WhatsApp.
- Nota para verificar en Evolution API real: los nombres de campos del payload del webhook (`/api/webhooks/evolution`) estan escritos segun el formato mas comun de Evolution API v2, pero pueden variar segun la version desplegada. Revisar logs del primer mensaje real y ajustar si hace falta.
