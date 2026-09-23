# Comunicacion

- Explica todo en lenguaje simple. Si usas un termino tecnico, agrega una explicacion breve entre parentesis.
- Cuando propongas algo, da tu recomendacion y explica por que. No listes opciones sin recomendar.
- Si algo sale mal, explica que paso, por que, y como lo vas a resolver. No tires el error tecnico solo.
- Antes de hacer cambios grandes, explica que vas a hacer y espera confirmacion.
- Antes de borrar, mover, renombrar o sobrescribir archivos, hacer commit/push o correr migraciones contra la base real, pedi confirmacion.
- Usa espanol rioplatense (vos/tenes, no tu/tienes). Nada de guiones largos.
- Al terminar cada bloque: resumen de lo construido, que falta, y como probarlo paso a paso.

# Proyecto

Nombre: Multichat Agente IA (Sistema Operativo para Negocios de Servicios Digitales)
Cliente: [Pendiente: nombre del cliente y del negocio]
Descripcion: Sistema propio para un negocio de servicios digitales que junta los mensajes de Instagram y WhatsApp en una sola bandeja, con CRM, automatizaciones y un agente de IA.

Documento de requerimientos de la fase actual (el plano, leelo antes de construir):
- `docs/requerimientos-etapa1-fase1.md`

## Etapas
- Etapa 1: Sistema Operativo Base (fases: 1 Foundation, Canales y CRM ← ACTUAL; 2 Comunicacion y Automatizaciones; 3 Agente IA, Analytics y Pulido)
- Etapa 2: Publicacion + Email bidireccional + Roles custom + Meta Ads (fases 1-3)
- Etapa 3: Agente IA integral + Fathom + Conector MCP (fases 1-3)
- Etapa 4 (opcional): Agendamiento + Ventas + Pipeline (fases 1-3)

## Bloques de la Fase 1 (Etapa 1)
1. Fork, deploy y foundation (Railway, Vault, roles + scope de leads, Instagram/Zernio, WhatsApp/Evolution API)
2. Email (Resend) + pantalla `/settings/integrations` + BYOK IA
3. Modelo de contacto extendido y CRM (atribucion, setter/vendedor, cross-canal, notas, ficha, soft delete)
4. Bandeja, filtros y herramientas CRM (filtros, templates, "no contactar", CSV, audit log)

Estado: ver `docs/progreso.md` (actualizalo al cerrar cada bloque).

# Stack

- Base de datos: Supabase (PostgreSQL + Auth + Vault + Realtime), plan Pro
- Frontend y backend: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4
- Hosting: Railway (un proyecto, 2 servicios en red privada: app Next.js publica + Evolution API no expuesta)
- Versionado: GitHub (`origin` = https://github.com/Jafeth22/multichat-agente-ia)
- Integraciones: Zernio (`@zernio/node`, Instagram), Evolution API (WhatsApp/Baileys), Resend (email saliente), Vercel AI SDK v6 (IA BYOK: OpenAI, Anthropic, Google)
- Tests: Vitest

# Base del proyecto

Fork de: ZernFlow (https://github.com/zernio/zernflow, MIT)
Framework: Next.js 16
Patterns a seguir:
- Auth con Supabase SSR y cookies httpOnly (`lib/supabase/`).
- Server Components por defecto; Client Components solo donde hay interactividad. Sin store global.
- Webhooks y endpoints en API Routes (`app/api/`); mutaciones de UI en Server Actions (`lib/actions/`).
- Cliente de Supabase con RLS; Service Role solo en servidor (cron, webhooks).
- Estilos con utilidades de Tailwind v4, sin CSS modules.
- Motor de flows en `lib/flow-engine/`; plataformas en `lib/platforms.ts`; webhook de Zernio en `lib/zernio-webhook.ts`.
NO reescribir: auth + trigger de creacion de workspace, flow builder (17 nodos), inbox base, tags y custom fields (6 tipos), secuencias, team management e invitaciones, broadcasts, `webhook_events`, `flow_versions`, Realtime. Se extienden, no se rehacen.

# Comandos

- Instalar dependencias: npm install
- Correr en desarrollo: npm run dev
- Build: npm run build
- Tests: npm test
- Lint: npm run lint

# Reglas

- Siempre soft delete (marcar `deleted_at`, nunca borrar de verdad). Purga a los 30 dias por cron.
- Historial y auditoria en entidades principales (tabla `audit_log`, nunca se borra).
- RLS habilitado en todas las tablas de Supabase, y ademas los GRANT para `authenticated` en cada tabla nueva (ver migracion 00017).
- Scope de leads por RLS: un Member solo ve/edita contactos y conversaciones donde es setter, vendedor o asignado. Owner/Admin ven todo.
- Validacion en servidor, no solo en cliente.
- Secrets en variables de entorno o Supabase Vault, nunca hardcodeados. API keys de canales e IA van a Vault desde la UI.
- Si se usa IA: patron BYOK (el usuario conecta sus propias API keys).
- Deduplicacion de contactos por telefono o email (nunca solo por nombre). Username de red social solo sugiere.
- Snapshot de precios al momento de la transaccion (aplica desde Etapa 4).
- Single-tenant: un solo workspace. No construir gestion multi-workspace.
- Pantalla de integraciones en `/settings/integrations`.
- No construir nada que el documento de requerimientos marque como fuera de alcance o de fases siguientes.

# Calidad de codigo (template-ready)

- Cada cambio de base de datos va en una migracion SQL separada en `supabase/migrations/`, numerada (la siguiente libre es `00018_`), idempotente (IF NOT EXISTS, DO $$ ... $$).
- Mantener .env.example actualizado: cada variable nueva se agrega con comentario explicativo.
- El sistema debe funcionar con base de datos vacia (empty states claros en todas las pantallas).
- No commitear .env con valores reales, solo .env.example.
- Datos de demo/ejemplo van en seeds separados de las migraciones de estructura.
- Textos de la UI en espanol rioplatense, sin jerga tecnica.
- Correr `npm run build` y `npm test` antes de dar un bloque por terminado.
