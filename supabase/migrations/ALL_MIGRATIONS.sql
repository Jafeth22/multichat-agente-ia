-- ============================================================
-- MIGRATION 1: INITIAL SCHEMA
-- ============================================================
-- ============================================================
-- WORKSPACES
-- ============================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  late_api_key_encrypted text,
  global_keywords jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user on workspace_members(user_id);

-- ============================================================
-- CHANNELS
-- ============================================================
create table channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'twitter', 'telegram', 'bluesky', 'reddit')),
  late_account_id text not null,
  username text,
  display_name text,
  profile_picture text,
  webhook_id text,
  webhook_secret text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, late_account_id)
);

create index idx_channels_workspace on channels(workspace_id);

-- ============================================================
-- CONTACTS (CRM)
-- ============================================================
create table contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  is_subscribed boolean not null default true,
  last_interaction_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_workspace on contacts(workspace_id);
create index idx_contacts_last_interaction on contacts(workspace_id, last_interaction_at desc);

create table contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  platform_sender_id text not null,
  platform_username text,
  created_at timestamptz not null default now(),
  unique (channel_id, platform_sender_id)
);

create index idx_contact_channels_contact on contact_channels(contact_id);

create table tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

create table custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null default 'text' check (type in ('text', 'number', 'boolean', 'date', 'url', 'email')),
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table contact_custom_fields (
  contact_id uuid not null references contacts(id) on delete cascade,
  field_id uuid not null references custom_field_definitions(id) on delete cascade,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (contact_id, field_id)
);

-- ============================================================
-- FLOWS
-- ============================================================
create table flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flows_workspace on flows(workspace_id);
create index idx_flows_status on flows(workspace_id, status);

create table triggers (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  type text not null check (type in ('keyword', 'postback', 'quick_reply', 'welcome', 'default', 'comment_keyword')),
  config jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_triggers_channel_type on triggers(channel_id, type, is_active);
create index idx_triggers_flow on triggers(flow_id);

create table flow_sessions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  flow_id uuid not null references flows(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  current_node_id text,
  variables jsonb not null default '{}'::jsonb,
  flow_stack jsonb not null default '[]'::jsonb,
  waiting_until timestamptz,
  waiting_for_input boolean not null default false,
  human_takeover_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flow_sessions_contact_active on flow_sessions(contact_id, channel_id) where status = 'active';

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  late_conversation_id text,
  platform text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'snoozed')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer not null default 0,
  is_automation_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, contact_id)
);

create index idx_conversations_workspace on conversations(workspace_id, last_message_at desc);
create index idx_conversations_status on conversations(workspace_id, status);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  text text,
  attachments jsonb,
  quick_reply_payload text,
  postback_payload text,
  callback_data text,
  platform_message_id text,
  sent_by_flow_id uuid references flows(id) on delete set null,
  sent_by_node_id text,
  sent_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'sent' check (status in ('pending', 'sent', 'delivered', 'failed')),
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- ============================================================
-- BROADCASTS
-- ============================================================
create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  message_content jsonb not null default '{}'::jsonb,
  segment_filter jsonb,
  scheduled_for timestamptz,
  total_recipients integer not null default 0,
  sent integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_broadcasts_workspace on broadcasts(workspace_id);

create table broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text
);

create index idx_broadcast_recipients_broadcast on broadcast_recipients(broadcast_id, status);

-- ============================================================
-- JOBS & ANALYTICS
-- ============================================================
create table scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index idx_scheduled_jobs_pending on scheduled_jobs(run_at) where status = 'pending';

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  flow_id uuid references flows(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_analytics_workspace on analytics_events(workspace_id, created_at desc);
create index idx_analytics_flow on analytics_events(flow_id, created_at desc);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on workspaces for each row execute function update_updated_at();
create trigger set_updated_at before update on channels for each row execute function update_updated_at();
create trigger set_updated_at before update on contacts for each row execute function update_updated_at();
create trigger set_updated_at before update on flows for each row execute function update_updated_at();
create trigger set_updated_at before update on flow_sessions for each row execute function update_updated_at();
create trigger set_updated_at before update on conversations for each row execute function update_updated_at();
create trigger set_updated_at before update on broadcasts for each row execute function update_updated_at();

-- ============================================================
-- AUTO-CREATE WORKSPACE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  ws_id uuid;
  user_name text;
  workspace_slug text;
begin
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  workspace_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(new.id::text, 1, 8);

  insert into public.workspaces (name, slug)
  values (user_name || '''s Workspace', workspace_slug)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
exception when others then
  raise log 'handle_new_user error: % %', sqlerrm, sqlstate;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- MIGRATION 2: RLS POLICIES
-- ============================================================
-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
-- All tables are filtered by workspace_id.
-- Users can only access rows in workspaces they belong to.
-- Service role key bypasses RLS (used in webhook handler).
-- ============================================================

-- Helper function: check if user belongs to workspace
create or replace function is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- ============================================================
-- WORKSPACES
-- ============================================================
alter table workspaces enable row level security;

create policy "Users can view their workspaces"
  on workspaces for select
  using (is_workspace_member(id));

create policy "Users can update their workspaces"
  on workspaces for update
  using (is_workspace_member(id));

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
alter table workspace_members enable row level security;

-- SELECT uses direct user_id check to avoid infinite recursion
-- (is_workspace_member queries workspace_members, which would trigger RLS again)
create policy "Members can view their workspace memberships"
  on workspace_members for select
  using (user_id = auth.uid());

create policy "Owners can insert members"
  on workspace_members for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Owners can update members"
  on workspace_members for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Owners can delete members"
  on workspace_members for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- ============================================================
-- CHANNELS
-- ============================================================
alter table channels enable row level security;

create policy "Users can view channels in their workspaces"
  on channels for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage channels in their workspaces"
  on channels for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACTS
-- ============================================================
alter table contacts enable row level security;

create policy "Users can view contacts in their workspaces"
  on contacts for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage contacts in their workspaces"
  on contacts for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACT CHANNELS
-- ============================================================
alter table contact_channels enable row level security;

create policy "Users can view contact channels via contact"
  on contact_channels for select
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_channels.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "Users can manage contact channels"
  on contact_channels for all
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_channels.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- TAGS
-- ============================================================
alter table tags enable row level security;

create policy "Users can view tags in their workspaces"
  on tags for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage tags in their workspaces"
  on tags for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACT TAGS
-- ============================================================
alter table contact_tags enable row level security;

create policy "Users can view contact tags"
  on contact_tags for select
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_tags.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "Users can manage contact tags"
  on contact_tags for all
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_tags.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
alter table custom_field_definitions enable row level security;

create policy "Users can view custom fields in their workspaces"
  on custom_field_definitions for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage custom fields in their workspaces"
  on custom_field_definitions for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACT CUSTOM FIELDS
-- ============================================================
alter table contact_custom_fields enable row level security;

create policy "Users can view contact custom fields"
  on contact_custom_fields for select
  using (
    exists (
      select 1 from contacts c
      join contact_custom_fields ccf on ccf.contact_id = c.id
      where c.id = contact_custom_fields.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "Users can manage contact custom fields"
  on contact_custom_fields for all
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_custom_fields.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- FLOWS
-- ============================================================
alter table flows enable row level security;

create policy "Users can view flows in their workspaces"
  on flows for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage flows in their workspaces"
  on flows for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- TRIGGERS
-- ============================================================
alter table triggers enable row level security;

create policy "Users can view triggers via flow"
  on triggers for select
  using (
    exists (
      select 1 from flows f
      where f.id = triggers.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

create policy "Users can manage triggers via flow"
  on triggers for all
  using (
    exists (
      select 1 from flows f
      where f.id = triggers.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

-- ============================================================
-- FLOW SESSIONS
-- ============================================================
alter table flow_sessions enable row level security;

create policy "Users can view flow sessions via flow"
  on flow_sessions for select
  using (
    exists (
      select 1 from flows f
      where f.id = flow_sessions.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

-- ============================================================
-- CONVERSATIONS
-- ============================================================
alter table conversations enable row level security;

create policy "Users can view conversations in their workspaces"
  on conversations for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage conversations in their workspaces"
  on conversations for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- MESSAGES
-- ============================================================
alter table messages enable row level security;

create policy "Users can view messages via conversation"
  on messages for select
  using (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and is_workspace_member(conv.workspace_id)
    )
  );

create policy "Users can insert messages via conversation"
  on messages for insert
  with check (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and is_workspace_member(conv.workspace_id)
    )
  );

-- ============================================================
-- BROADCASTS
-- ============================================================
alter table broadcasts enable row level security;

create policy "Users can view broadcasts in their workspaces"
  on broadcasts for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage broadcasts in their workspaces"
  on broadcasts for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- BROADCAST RECIPIENTS
-- ============================================================
alter table broadcast_recipients enable row level security;

create policy "Users can view broadcast recipients"
  on broadcast_recipients for select
  using (
    exists (
      select 1 from broadcasts b
      where b.id = broadcast_recipients.broadcast_id
        and is_workspace_member(b.workspace_id)
    )
  );

-- ============================================================
-- SCHEDULED JOBS (service role only, no user RLS needed)
-- ============================================================
alter table scheduled_jobs enable row level security;

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
alter table analytics_events enable row level security;

create policy "Users can view analytics in their workspaces"
  on analytics_events for select
  using (is_workspace_member(workspace_id));

create policy "Users can insert analytics in their workspaces"
  on analytics_events for insert
  with check (is_workspace_member(workspace_id));

-- ============================================================
-- MIGRATION 3: RPC FUNCTIONS
-- ============================================================
-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Increment unread count and update conversation preview
create or replace function increment_unread(conv_id uuid, preview text)
returns void as $$
begin
  update conversations
  set unread_count = unread_count + 1,
      last_message_at = now(),
      last_message_preview = preview,
      status = 'open'
  where id = conv_id;
end;
$$ language plpgsql security definer;

-- Increment broadcast sent counter
create or replace function increment_broadcast_sent(b_id uuid)
returns void as $$
begin
  update broadcasts
  set sent = sent + 1,
      delivered = delivered + 1
  where id = b_id;
end;
$$ language plpgsql security definer;

-- Increment broadcast failed counter
create or replace function increment_broadcast_failed(b_id uuid)
returns void as $$
begin
  update broadcasts
  set failed = failed + 1
  where id = b_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- MIGRATION 4: COMMENT AUTOMATION
-- ============================================================
-- ============================================================
-- COMMENT AUTOMATION
-- ============================================================

-- Add comment polling cursor to channels
alter table channels
  add column if not exists last_comment_cursor text,
  add column if not exists comment_rules jsonb default '[]'::jsonb;

-- Comment processing log
create table if not exists comment_logs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  post_id text, -- Late post ID the comment belongs to
  platform_comment_id text not null,
  author_id text,
  author_name text,
  author_username text,
  comment_text text not null,
  matched_trigger_id uuid references triggers(id) on delete set null,
  dm_sent boolean not null default false,
  reply_sent boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

-- Indexes for efficient lookups
create index if not exists idx_comment_logs_channel_id on comment_logs(channel_id);
create index if not exists idx_comment_logs_workspace_id on comment_logs(workspace_id);
create index if not exists idx_comment_logs_platform_comment_id on comment_logs(platform_comment_id);
create index if not exists idx_comment_logs_created_at on comment_logs(created_at desc);

-- Unique constraint to avoid processing the same comment twice
create unique index if not exists idx_comment_logs_unique_comment
  on comment_logs(channel_id, platform_comment_id);

-- RLS policies for comment_logs
alter table comment_logs enable row level security;

create policy "Users can view comment logs in their workspace"
  on comment_logs for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- ============================================================
-- MIGRATION 5: SEQUENCES
-- ============================================================
-- Sequences: drip campaigns
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequences_workspace" ON sequences
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id),
  current_step_index INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_via_sequence" ON sequence_enrollments
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- MIGRATION 6: WORKSPACE INVITES
-- ============================================================
-- ============================================================
-- WORKSPACE INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Members of the workspace can view invites
CREATE POLICY "workspace_invites_select" ON workspace_invites
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only workspace owners can create invites
CREATE POLICY "workspace_invites_insert" ON workspace_invites
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Only workspace owners can delete invites
CREATE POLICY "workspace_invites_delete" ON workspace_invites
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Only workspace owners can update invite status
CREATE POLICY "workspace_invites_update" ON workspace_invites
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR
    -- Allow the invited user to accept their own invite
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- MIGRATION 7: OPENAI API KEY
-- ============================================================
-- Add OpenAI API key column to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

-- ============================================================
-- MIGRATION 8: AI PROVIDER
-- ============================================================
-- Rename openai_api_key to ai_api_key and add ai_provider column
ALTER TABLE workspaces RENAME COLUMN openai_api_key TO ai_api_key;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'openai';

-- ============================================================
-- MIGRATION 9: FIX BROADCAST RLS
-- ============================================================
-- Fix broadcast_recipients: add INSERT/UPDATE/DELETE policies
CREATE POLICY "Users can insert broadcast recipients" ON broadcast_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Users can update broadcast recipients" ON broadcast_recipients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND is_workspace_member(b.workspace_id)
    )
  );

-- Fix scheduled_jobs: add full CRUD policies for workspace members
-- Jobs are workspace-agnostic (system-level), so allow authenticated users
CREATE POLICY "Authenticated users can insert jobs" ON scheduled_jobs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read jobs" ON scheduled_jobs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update jobs" ON scheduled_jobs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- MIGRATION 10: FLOW VERSIONS
-- ============================================================
-- Flow version history: stores a snapshot of nodes/edges on each publish
create table flow_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  version integer not null,
  nodes jsonb not null,
  edges jsonb not null,
  viewport jsonb,
  name text not null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (flow_id, version)
);

create index idx_flow_versions_flow on flow_versions(flow_id, version desc);

-- RLS
alter table flow_versions enable row level security;

create policy "flow_versions_select" on flow_versions for select
  using (exists (
    select 1 from flows f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = flow_versions.flow_id
      and wm.user_id = auth.uid()
  ));

create policy "flow_versions_insert" on flow_versions for insert
  with check (exists (
    select 1 from flows f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = flow_versions.flow_id
      and wm.user_id = auth.uid()
  ));

-- ============================================================
-- MIGRATION 11: WORKSPACE WEBHOOK SECRET
-- ============================================================
-- Add workspace-level webhook secret for Zernio HMAC signature verification.
-- Zernio exposes a single webhook per profile/API key, so the secret lives at the
-- workspace level (not per-channel). Used by /api/webhooks/late to verify signatures.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- ============================================================
-- MIGRATION 12: WEBHOOK EVENTS
-- ============================================================
-- Idempotency ledger for inbound Zernio webhook deliveries. Zernio retries a
-- delivery with the same event id whenever our 200 doesn't arrive within its 5s
-- timeout; /api/webhooks/late claims the id here before processing so retries
-- and redeliveries never re-run a flow (which was double-sending DMs).
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rows are only needed for the retry window (hours); allow cheap pruning.
CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON webhook_events (received_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MIGRATION 13: SEQUENCE ENROLLMENTS CHANNEL CASCADE
-- ============================================================
-- sequence_enrollments.channel_id was declared without an ON DELETE action
-- (00005_sequences.sql), so deleting a channel with enrollments failed with a
-- 23503 FK violation. Every other channel FK cascades (or sets null); align
-- this one so channel deletion works.
ALTER TABLE sequence_enrollments
  DROP CONSTRAINT sequence_enrollments_channel_id_fkey,
  ADD CONSTRAINT sequence_enrollments_channel_id_fkey
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- ============================================================
-- MIGRATION 14: SCHEDULED JOBS CLAIMED AT
-- ============================================================
-- The cron claims a job by flipping status to 'processing'. If that UPDATE
-- commits but the response is lost, the job is stranded: the fetch only read
-- 'pending' rows. claimed_at lets the cron reclaim 'processing' jobs whose
-- claim is older than a few minutes.
ALTER TABLE scheduled_jobs ADD COLUMN claimed_at timestamptz;

CREATE INDEX idx_scheduled_jobs_processing ON scheduled_jobs(claimed_at)
  WHERE status = 'processing';

-- ============================================================
-- MIGRATION 15: BACKFILL CLAIMED AT
-- ============================================================
-- 00014 added claimed_at but did not backfill rows already stuck in
-- 'processing', and old-code invocations claim without stamping it. Stamp
-- existing NULL claims so the cron's staleness clock (claimed_at older than
-- 5 minutes) applies to them; genuinely stranded rows become reclaimable
-- shortly after this runs, while a claim still live at migration time gets
-- the full window to finish before being reclaimed.
UPDATE scheduled_jobs
SET claimed_at = now()
WHERE status = 'processing' AND claimed_at IS NULL;

-- ============================================================
-- MIGRATION 16: WHATSAPP CHANNEL PLATFORM
-- ============================================================
-- WhatsApp was advertised on the site, offered in the channel picker and
-- already handled by the flow engine, but 00001's platform check constraint
-- never listed it, so the channel row could not be stored (issue #16).
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_platform_check;

ALTER TABLE channels ADD CONSTRAINT channels_platform_check
  CHECK (platform IN ('facebook', 'instagram', 'twitter', 'telegram', 'bluesky', 'reddit', 'whatsapp'));

-- ============================================================
-- MIGRATION 17: GRANT TABLE PRIVILEGES
-- ============================================================
-- RLS policies only filter rows; Postgres still requires a table-level GRANT
-- before those policies are even evaluated. These grants were missing on
-- this project, causing "permission denied for table X" (42501) for the
-- anon/authenticated roles despite correct RLS policies.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant usage, select
  on all sequences in schema public
  to anon, authenticated;

-- Apply the same grants automatically to tables created by future migrations.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- ============================================================
-- MIGRATION 18: VAULT SETUP
-- ============================================================
-- ============================================================
-- SUPABASE VAULT: almacenamiento cifrado de API keys (F2)
-- ============================================================
-- Habilita la extension Vault (cifrado AES-256 para secrets) y agrega
-- 3 funciones RPC para guardar, leer y eliminar secrets aislados por
-- workspace. Solo Owner/Admin del workspace pueden usarlas.
--
-- No hay UI directa de Vault: la UI es la pantalla de integraciones
-- del Bloque 2 (/settings/integrations), que va a llamar a estas
-- funciones via supabase.rpc(...).
-- ============================================================

-- El nombre real de la extension en Supabase es "supabase_vault" (no
-- "vault"): ella misma crea y controla el schema "vault", no se elige
-- con WITH SCHEMA. En la mayoria de los proyectos Supabase ya viene
-- habilitada por defecto, por eso el IF NOT EXISTS.
create extension if not exists supabase_vault;

-- Helper: rol owner/admin en el workspace. Se reutiliza en bloques
-- siguientes (integration_configs, audit_log, etc).
create or replace function is_workspace_admin(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

-- Helper: la llamada viene del service role (cron, webhooks), no de un
-- usuario logueado. Bloque 2 lo necesita: el webhook de Evolution API
-- corre con el service role (no hay auth.uid()) y tiene que poder leer
-- la API key de Resend para avisar por email que WhatsApp se desconecto.
create or replace function is_service_role()
returns boolean as $$
  select auth.role() = 'service_role';
$$ language sql security definer stable;

-- Mapea un nombre logico de secret (ej: "zernio_api_key") al id real
-- del secret en vault.secrets, por workspace. Esta tabla no se
-- consulta directo desde el cliente: solo la usan las funciones de
-- abajo (security definer), por eso no tiene politicas RLS permisivas.
create table if not exists workspace_secrets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  secret_name text not null,
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, secret_name)
);

create index if not exists idx_workspace_secrets_workspace on workspace_secrets(workspace_id);

alter table workspace_secrets enable row level security;
-- A proposito: no se agregan policies. Con RLS habilitada y sin
-- policies, authenticated no puede leer/escribir esta tabla en forma
-- directa (ni siquiera Owner/Admin): el unico camino es via las
-- funciones store_secret/read_secret/delete_secret, que corren como
-- el dueno de la funcion (bypassea RLS) y validan el rol a mano.

grant select, insert, update, delete on workspace_secrets to authenticated;

-- ------------------------------------------------------------
-- store_secret: crea o actualiza un secret
-- ------------------------------------------------------------
create or replace function store_secret(
  p_secret_name text,
  p_secret_value text,
  p_workspace_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is not null then
    perform vault.update_secret(v_vault_id, p_secret_value);
    update workspace_secrets
      set updated_at = now()
      where workspace_id = p_workspace_id and secret_name = p_secret_name;
  else
    v_vault_id := vault.create_secret(
      p_secret_value,
      p_workspace_id::text || ':' || p_secret_name,
      'Secret de integracion, workspace ' || p_workspace_id::text
    );
    insert into workspace_secrets (workspace_id, secret_name, vault_secret_id)
    values (p_workspace_id, p_secret_name, v_vault_id);
  end if;

  return v_vault_id;
end;
$$;

-- ------------------------------------------------------------
-- read_secret: devuelve el valor original, o null si no existe
-- ------------------------------------------------------------
create or replace function read_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_value text;
begin
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return null;
  end if;

  select decrypted_secret into v_value
  from vault.decrypted_secrets
  where id = v_vault_id;

  return v_value;
end;
$$;

-- ------------------------------------------------------------
-- delete_secret: borra el secret. Devuelve false si no existia.
-- ------------------------------------------------------------
create or replace function delete_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return false;
  end if;

  delete from vault.secrets where id = v_vault_id;
  delete from workspace_secrets
    where workspace_id = p_workspace_id and secret_name = p_secret_name;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- read_channel_secret: variante de read_secret para secrets que hacen
-- falta en tiempo de ejecucion para cualquier miembro del workspace,
-- no solo Owner/Admin (Bloque 2: la key de Zernio la necesita
-- cualquier Member para enviar/recibir mensajes desde la bandeja, los
-- flows, las secuencias, los comentarios y los broadcasts).
--
-- Whitelist explicita de p_secret_name a proposito: este camino es mas
-- permisivo que read_secret (cualquier miembro, no solo admin), asi
-- que solo puede servir los secrets "operativos" que estan pensados
-- para eso. Si se agrega otro secret de este tipo, hay que sumarlo
-- aca a mano; no es un passthrough generico.
-- ------------------------------------------------------------
create or replace function read_channel_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_value text;
begin
  if p_secret_name <> 'zernio_api_key' then
    raise exception 'read_channel_secret no puede leer "%"', p_secret_name;
  end if;

  if not is_workspace_member(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere ser miembro del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return null;
  end if;

  select decrypted_secret into v_value
  from vault.decrypted_secrets
  where id = v_vault_id;

  return v_value;
end;
$$;

revoke all on function store_secret(text, text, uuid) from public;
revoke all on function read_secret(text, uuid) from public;
revoke all on function delete_secret(text, uuid) from public;
revoke all on function read_channel_secret(text, uuid) from public;
revoke all on function is_workspace_admin(uuid) from public;
revoke all on function is_service_role() from public;

grant execute on function store_secret(text, text, uuid) to authenticated, service_role;
grant execute on function read_secret(text, uuid) to authenticated, service_role;
grant execute on function delete_secret(text, uuid) to authenticated, service_role;
grant execute on function read_channel_secret(text, uuid) to authenticated, service_role;
grant execute on function is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function is_service_role() to authenticated, service_role;

-- ============================================================
-- MIGRATION 19: CONTACTS SETTER VENDEDOR
-- ============================================================
-- ============================================================
-- CONTACTS: setter_id y vendedor_id, adelantados desde el Bloque 3 (F9/F11)
-- ============================================================
-- El scope de leads por RLS (Bloque 1, F3) tiene que poder filtrar por
-- "es setter, vendedor o asignado". Para eso hacen falta estas dos
-- columnas ahora. El resto del modelo de contacto extendido (telefono,
-- redes, atribucion, etc.) se agrega recien en el Bloque 3.
-- ============================================================

alter table contacts
  add column if not exists setter_id uuid references auth.users(id) on delete set null,
  add column if not exists vendedor_id uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_setter on contacts(setter_id);
create index if not exists idx_contacts_vendedor on contacts(vendedor_id);

-- ============================================================
-- MIGRATION 20: LEADS SCOPE RLS
-- ============================================================
-- ============================================================
-- SCOPE DE LEADS POR RLS (F3)
-- ============================================================
-- Un Member solo ve/edita los contactos y conversaciones donde es
-- setter, vendedor o (en conversaciones) el asignado. Owner y Admin
-- ven todo. Para los leads sin asignar, el workspace decide si los ve
-- cualquier Member o solo Owner/Admin (default: solo Owner/Admin).
-- Se aplica en la base de datos (RLS), no solo en la UI.
-- ============================================================

-- Valida que workspace_members.role sea siempre uno de los 3 roles
-- que soporta el sistema (antes no habia ningun constraint).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_role_check'
  ) then
    alter table workspace_members
      add constraint workspace_members_role_check check (role in ('owner', 'admin', 'member'));
  end if;
end $$;

-- Config del workspace: quien ve los leads sin asignar.
alter table workspaces
  add column if not exists unassigned_leads_visible_to text not null default 'owner_admin';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_unassigned_leads_visible_to_check'
  ) then
    alter table workspaces
      add constraint workspaces_unassigned_leads_visible_to_check
      check (unassigned_leads_visible_to in ('owner_admin', 'everyone'));
  end if;
end $$;

-- ------------------------------------------------------------
-- can_see_contact: helper de scope para la tabla contacts
-- ------------------------------------------------------------
create or replace function can_see_contact(p_contact_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_workspace_id uuid;
  v_setter_id uuid;
  v_vendedor_id uuid;
  v_visibility text;
begin
  select workspace_id, setter_id, vendedor_id
    into v_workspace_id, v_setter_id, v_vendedor_id
  from contacts
  where id = p_contact_id;

  if v_workspace_id is null or not is_workspace_member(v_workspace_id) then
    return false;
  end if;

  if is_workspace_admin(v_workspace_id) then
    return true;
  end if;

  if v_setter_id = auth.uid() or v_vendedor_id = auth.uid() then
    return true;
  end if;

  if v_setter_id is null and v_vendedor_id is null then
    select unassigned_leads_visible_to into v_visibility
    from workspaces where id = v_workspace_id;

    if v_visibility = 'everyone' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- ------------------------------------------------------------
-- can_see_conversation: helper de scope para conversations/messages.
-- Ademas de setter/vendedor del contacto, suma el assigned_to propio
-- de la conversacion.
-- ------------------------------------------------------------
create or replace function can_see_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_workspace_id uuid;
  v_assigned_to uuid;
  v_contact_id uuid;
  v_setter_id uuid;
  v_vendedor_id uuid;
  v_visibility text;
begin
  select conv.workspace_id, conv.assigned_to, conv.contact_id
    into v_workspace_id, v_assigned_to, v_contact_id
  from conversations conv
  where conv.id = p_conversation_id;

  if v_workspace_id is null or not is_workspace_member(v_workspace_id) then
    return false;
  end if;

  if is_workspace_admin(v_workspace_id) then
    return true;
  end if;

  if v_assigned_to = auth.uid() then
    return true;
  end if;

  if v_contact_id is not null then
    select setter_id, vendedor_id into v_setter_id, v_vendedor_id
    from contacts where id = v_contact_id;

    if v_setter_id = auth.uid() or v_vendedor_id = auth.uid() then
      return true;
    end if;
  end if;

  if v_assigned_to is null and v_setter_id is null and v_vendedor_id is null then
    select unassigned_leads_visible_to into v_visibility
    from workspaces where id = v_workspace_id;

    if v_visibility = 'everyone' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function can_see_contact(uuid) from public;
revoke all on function can_see_conversation(uuid) from public;
grant execute on function can_see_contact(uuid) to authenticated;
grant execute on function can_see_conversation(uuid) to authenticated;

-- ------------------------------------------------------------
-- CONTACTS: reemplaza el scope "todo el workspace" por el scope de leads
-- ------------------------------------------------------------
drop policy if exists "Users can view contacts in their workspaces" on contacts;
drop policy if exists "Users can manage contacts in their workspaces" on contacts;

create policy "Scoped select on contacts"
  on contacts for select
  using (can_see_contact(id));

create policy "Workspace members can create contacts"
  on contacts for insert
  with check (is_workspace_member(workspace_id));

create policy "Scoped update on contacts"
  on contacts for update
  using (can_see_contact(id))
  with check (can_see_contact(id));

create policy "Scoped delete on contacts"
  on contacts for delete
  using (can_see_contact(id));

-- ------------------------------------------------------------
-- CONVERSATIONS: idem
-- ------------------------------------------------------------
drop policy if exists "Users can view conversations in their workspaces" on conversations;
drop policy if exists "Users can manage conversations in their workspaces" on conversations;

create policy "Scoped select on conversations"
  on conversations for select
  using (can_see_conversation(id));

create policy "Workspace members can create conversations"
  on conversations for insert
  with check (is_workspace_member(workspace_id));

create policy "Scoped update on conversations"
  on conversations for update
  using (can_see_conversation(id))
  with check (can_see_conversation(id));

create policy "Scoped delete on conversations"
  on conversations for delete
  using (can_see_conversation(id));

-- ------------------------------------------------------------
-- MESSAGES: heredan el scope de su conversation
-- ------------------------------------------------------------
drop policy if exists "Users can view messages via conversation" on messages;
drop policy if exists "Users can insert messages via conversation" on messages;

create policy "Scoped select on messages"
  on messages for select
  using (can_see_conversation(conversation_id));

create policy "Scoped insert on messages"
  on messages for insert
  with check (can_see_conversation(conversation_id));

-- ============================================================
-- MIGRATION 21: WHATSAPP CHANNEL FIELDS
-- ============================================================
-- ============================================================
-- CHANNELS: campos para instancias de WhatsApp (Evolution API) (F6)
-- ============================================================
-- 'whatsapp' ya es una plataforma valida en channels (migracion 00016).
-- Evolution API no usa OAuth como Zernio: conecta por instancia + QR.
-- Se reutiliza la tabla channels existente (no se crea una tabla aparte)
-- sumando los campos que ese flujo necesita.
-- ============================================================

alter table channels
  add column if not exists evolution_instance_name text,
  add column if not exists connection_status text not null default 'disconnected',
  add column if not exists qr_code text,
  add column if not exists last_connected_at timestamptz,
  add column if not exists disconnected_at timestamptz,
  add column if not exists disconnected_notified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'channels_connection_status_check'
  ) then
    alter table channels
      add constraint channels_connection_status_check
      check (connection_status in ('disconnected', 'connecting', 'connected', 'error'));
  end if;
end $$;

create unique index if not exists idx_channels_evolution_instance
  on channels(evolution_instance_name)
  where evolution_instance_name is not null;

-- ============================================================
-- MIGRATION 22: ADMIN NOTIFICATIONS
-- ============================================================
-- ============================================================
-- ADMIN NOTIFICATIONS: aviso dentro de la app (F6)
-- ============================================================
-- Notificacion in-app a Owner/Admin cuando se desconecta un canal
-- (por ahora, WhatsApp). El envio por email (Resend) se agrega en el
-- Bloque 2; esta tabla queda lista para que ese bloque la reutilice
-- con otros tipos de evento.
-- Solo el sistema (service role, desde el webhook) inserta filas.
-- ============================================================

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  channel_id uuid references channels(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_workspace on admin_notifications(workspace_id);
create index if not exists idx_admin_notifications_unread
  on admin_notifications(workspace_id, read_at)
  where read_at is null;

alter table admin_notifications enable row level security;

drop policy if exists "Owner and admin can view notifications" on admin_notifications;
create policy "Owner and admin can view notifications"
  on admin_notifications for select
  using (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can mark notifications as read" on admin_notifications;
create policy "Owner and admin can mark notifications as read"
  on admin_notifications for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

-- Sin policy de insert/delete para authenticated: solo el service role
-- (que bypassea RLS) crea o purga estas filas.
grant select, update on admin_notifications to authenticated;

-- ============================================================
-- MIGRATION 23: TEAM ROLE MANAGEMENT RLS
-- ============================================================
-- ============================================================
-- TEAM: Owner y Admin pueden cambiar el rol de un miembro (F3)
-- ============================================================
-- Antes, solo el Owner podia actualizar workspace_members (por eso
-- Admin no podia cambiar roles). Se amplia a Owner/Admin, pero se
-- bloquea a nivel de base que alguien le cambie el rol al Owner o que
-- se asigne el rol 'owner' por esta via (evita transferencias de
-- ownership accidentales).
-- ============================================================

drop policy if exists "Owners can update members" on workspace_members;

create policy "Owner and admin can update member roles"
  on workspace_members for update
  using (
    is_workspace_admin(workspace_members.workspace_id)
    and workspace_members.role <> 'owner'
  )
  with check (
    is_workspace_admin(workspace_members.workspace_id)
    and role in ('admin', 'member')
  );

-- ============================================================
-- MIGRATION 24: CHANNELS ADMIN RLS
-- ============================================================
-- ============================================================
-- CHANNELS: solo Owner/Admin gestionan canales (F3)
-- ============================================================
-- Antes, cualquier miembro del workspace podia insertar/editar/borrar
-- canales por RLS (la restriccion era solo de UI). "Member no puede...
-- gestionar canales" tiene que valer tambien en la base de datos.
-- Select se mantiene abierto a todo el workspace (la bandeja necesita
-- leer los canales para mostrar el icono de plataforma, etc).
-- ============================================================

drop policy if exists "Users can manage channels in their workspaces" on channels;

create policy "Owner and admin can insert channels"
  on channels for insert
  with check (is_workspace_admin(workspace_id));

create policy "Owner and admin can update channels"
  on channels for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

create policy "Owner and admin can delete channels"
  on channels for delete
  using (is_workspace_admin(workspace_id));

-- ============================================================
-- MIGRATION 25: WORKSPACES ADMIN RLS
-- ============================================================
-- ============================================================
-- WORKSPACES: solo Owner/Admin editan la configuracion (F3)
-- ============================================================
-- Antes, cualquier miembro podia hacer UPDATE sobre su fila en
-- workspaces por RLS, incluyendo campos sensibles (API keys, webhook
-- secret, config de scope de leads). "Member no puede... cambiar
-- configuracion del workspace" tiene que valer en la base, no solo
-- ocultando la pantalla de Settings.
-- ============================================================

drop policy if exists "Users can update their workspaces" on workspaces;

create policy "Owner and admin can update their workspace"
  on workspaces for update
  using (is_workspace_admin(id))
  with check (is_workspace_admin(id));

-- ============================================================
-- MIGRATION 26: INTEGRATION CONFIGS
-- ============================================================
-- ============================================================
-- INTEGRATION CONFIGS: tabla generica de integraciones (F8)
-- ============================================================
-- Un registro por integracion (canal, proveedor de IA o de email) del
-- workspace. El secret real vive en Vault (workspace_secrets +
-- vault.secrets, ver 00018); esta tabla solo guarda el nombre logico
-- del secret y metadata no sensible (estado, config, ultimo error).
-- Generica a proposito: agregar una integracion nueva (ej: LinkedIn en
-- Etapa 2) no requiere cambiar esta tabla, solo insertar una fila con
-- un "provider" nuevo.
-- ============================================================

create table if not exists integration_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null check (type in ('channel', 'ai_provider', 'email_provider')),
  provider text not null,
  display_name text,
  vault_secret_name text,
  oauth_data jsonb,
  config jsonb,
  is_active boolean not null default false,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists idx_integration_configs_workspace on integration_configs(workspace_id);
create index if not exists idx_integration_configs_workspace_type on integration_configs(workspace_id, type);

drop trigger if exists set_updated_at on integration_configs;
create trigger set_updated_at
  before update on integration_configs
  for each row execute function update_updated_at();

alter table integration_configs enable row level security;

-- Solo Owner/Admin ven y gestionan integraciones (F8, 13b). Un Member no
-- deberia ni enterarse de que existen estas filas.
drop policy if exists "Owner and admin can view integrations" on integration_configs;
create policy "Owner and admin can view integrations"
  on integration_configs for select
  using (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can insert integrations" on integration_configs;
create policy "Owner and admin can insert integrations"
  on integration_configs for insert
  with check (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can update integrations" on integration_configs;
create policy "Owner and admin can update integrations"
  on integration_configs for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can delete integrations" on integration_configs;
create policy "Owner and admin can delete integrations"
  on integration_configs for delete
  using (is_workspace_admin(workspace_id));

grant select, insert, update, delete on integration_configs to authenticated;

-- Nota para el Bloque 3: cuando exista audit_log, cada conexion/
-- desconexion/error de una integracion (insert o update de is_active
-- en esta tabla) deberia quedar registrada ahi (evento "channel_*" o
-- "integration_*", entity_type = 'integration_configs').

-- ============================================================
-- MIGRATION 27: EMAIL LOGS
-- ============================================================
-- ============================================================
-- EMAIL LOGS: registro de emails enviados por Resend (F7)
-- ============================================================
-- Un registro por intento final de envio (con la cantidad de intentos
-- que hicieron falta). No guarda el cuerpo del email, solo lo
-- necesario para diagnosticar fallos y para el historial.
-- Queda lista para que Fase 2 la reutilice con las secuencias.
-- ============================================================

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  to_email text not null,
  subject text not null,
  template text,
  status text not null check (status in ('sent', 'failed')),
  attempts integer not null default 1,
  error text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_logs_workspace on email_logs(workspace_id);
create index if not exists idx_email_logs_workspace_created on email_logs(workspace_id, created_at desc);

alter table email_logs enable row level security;

-- Solo Owner/Admin ven el historial de envios (mismo criterio que
-- integration_configs). El service role (webhooks, cron) inserta sin
-- pasar por RLS.
drop policy if exists "Owner and admin can view email logs" on email_logs;
create policy "Owner and admin can view email logs"
  on email_logs for select
  using (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can insert email logs" on email_logs;
create policy "Owner and admin can insert email logs"
  on email_logs for insert
  with check (is_workspace_admin(workspace_id));

-- Nunca se edita ni se borra un log de envio: sin policies de
-- update/delete para authenticated.
grant select, insert on email_logs to authenticated;

-- ============================================================
-- MIGRATION 28: VAULT SERVICE ROLE AND CHANNEL SECRET
-- ============================================================
-- ============================================================
-- VAULT: acceso del service role + read_channel_secret (Bloque 2)
-- ============================================================
-- Parche sobre 00018_vault_setup.sql. Supabase CLI controla que
-- migraciones ya corrieron por nombre de archivo, no por contenido: si
-- 00018 ya se aplico contra esta base antes de estos cambios, editar
-- ese archivo no alcanza para que el cambio llegue. Esta migracion
-- nueva aplica el mismo cambio con create or replace (idempotente),
-- asi corre bien tanto si 00018 ya se aplico como si no.
--
-- Que cambia:
-- 1. store_secret/read_secret/delete_secret ahora tambien aceptan al
--    service role (antes solo Owner/Admin autenticado). Lo necesita el
--    webhook de Evolution API (F7): corre con el service role, sin
--    auth.uid(), y tiene que poder leer la key de Resend para avisar
--    por email que WhatsApp se desconecto.
-- 2. Funcion nueva read_channel_secret: variante mas permisiva de
--    read_secret para secrets que necesita cualquier Member del
--    workspace en tiempo de ejecucion (hoy: la key de Zernio, para
--    mandar/recibir mensajes desde la bandeja, los flows, las
--    secuencias, los comentarios y los broadcasts). Lista blanca de
--    nombres a proposito: nunca deja leer las keys de Resend o de IA
--    (esas siguen siendo solo Owner/Admin, via read_secret).
-- ============================================================

create or replace function is_service_role()
returns boolean as $$
  select auth.role() = 'service_role';
$$ language sql security definer stable;

create or replace function store_secret(
  p_secret_name text,
  p_secret_value text,
  p_workspace_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is not null then
    perform vault.update_secret(v_vault_id, p_secret_value);
    update workspace_secrets
      set updated_at = now()
      where workspace_id = p_workspace_id and secret_name = p_secret_name;
  else
    v_vault_id := vault.create_secret(
      p_secret_value,
      p_workspace_id::text || ':' || p_secret_name,
      'Secret de integracion, workspace ' || p_workspace_id::text
    );
    insert into workspace_secrets (workspace_id, secret_name, vault_secret_id)
    values (p_workspace_id, p_secret_name, v_vault_id);
  end if;

  return v_vault_id;
end;
$$;

create or replace function read_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_value text;
begin
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return null;
  end if;

  select decrypted_secret into v_value
  from vault.decrypted_secrets
  where id = v_vault_id;

  return v_value;
end;
$$;

create or replace function delete_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return false;
  end if;

  delete from vault.secrets where id = v_vault_id;
  delete from workspace_secrets
    where workspace_id = p_workspace_id and secret_name = p_secret_name;

  return true;
end;
$$;

create or replace function read_channel_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_value text;
begin
  if p_secret_name <> 'zernio_api_key' then
    raise exception 'read_channel_secret no puede leer "%"', p_secret_name;
  end if;

  if not is_workspace_member(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere ser miembro del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return null;
  end if;

  select decrypted_secret into v_value
  from vault.decrypted_secrets
  where id = v_vault_id;

  return v_value;
end;
$$;

revoke all on function store_secret(text, text, uuid) from public;
revoke all on function read_secret(text, uuid) from public;
revoke all on function delete_secret(text, uuid) from public;
revoke all on function read_channel_secret(text, uuid) from public;
revoke all on function is_service_role() from public;

grant execute on function store_secret(text, text, uuid) to authenticated, service_role;
grant execute on function read_secret(text, uuid) to authenticated, service_role;
grant execute on function delete_secret(text, uuid) to authenticated, service_role;
grant execute on function read_channel_secret(text, uuid) to authenticated, service_role;
grant execute on function is_service_role() to authenticated, service_role;

-- ============================================================
-- MIGRATION 29: CONTACTS EXTENDED FIELDS
-- ============================================================
-- ============================================================
-- CONTACTS: modelo extendido (F9) + atribucion (F10)
-- ============================================================
-- setter_id y vendedor_id ya se agregaron en el Bloque 1 (00019), los
-- necesitaba el scope de leads por RLS desde ese momento. Este bloque
-- suma el resto: identidad (telefono, redes, pais), seguimiento,
-- "no contactar", resumen de IA, temperatura del lead, soft delete y
-- el JSONB de atribucion (first_click / last_click).
--
-- phone y whatsapp_phone se normalizan a formato internacional
-- (+XX...) desde la app antes de guardarse (lib/phone.ts); esta
-- migracion no valida el formato, solo guarda texto.
-- instagram_username se guarda sin "@".
-- ============================================================

alter table contacts
  add column if not exists phone text,
  add column if not exists secondary_email text,
  add column if not exists country text,
  add column if not exists instagram_username text,
  add column if not exists tiktok_username text,
  add column if not exists youtube_channel_id text,
  add column if not exists linkedin_profile_url text,
  add column if not exists whatsapp_phone text,
  add column if not exists twitter_username text,
  add column if not exists facebook_id text,
  add column if not exists next_followup_date timestamptz,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_reason text,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists ai_conversation_summary text,
  add column if not exists lead_temperature text,
  add column if not exists deleted_at timestamptz,
  add column if not exists attribution jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_lead_temperature_check'
  ) then
    alter table contacts
      add constraint contacts_lead_temperature_check
      check (lead_temperature is null or lead_temperature in ('cold', 'warm', 'hot'));
  end if;
end $$;

create index if not exists idx_contacts_phone on contacts(phone) where phone is not null;
create index if not exists idx_contacts_email on contacts(email) where email is not null;
create index if not exists idx_contacts_instagram_username on contacts(instagram_username) where instagram_username is not null;
create index if not exists idx_contacts_tiktok_username on contacts(tiktok_username) where tiktok_username is not null;
create index if not exists idx_contacts_whatsapp_phone on contacts(whatsapp_phone) where whatsapp_phone is not null;
create index if not exists idx_contacts_deleted_at on contacts(deleted_at);

-- Deduplicacion cross-canal (F12): busquedas exactas por telefono/email
-- dentro del workspace, excluyendo lo borrado.
create index if not exists idx_contacts_workspace_phone on contacts(workspace_id, phone) where phone is not null and deleted_at is null;
create index if not exists idx_contacts_workspace_email on contacts(workspace_id, email) where email is not null and deleted_at is null;

-- ============================================================
-- MIGRATION 30: AUDIT LOG
-- ============================================================
-- ============================================================
-- AUDIT LOG global (F20)
-- ============================================================
-- Tabla central de auditoria: que cambio, quien lo hizo, cuando y
-- (si aplica) el valor anterior/nuevo. Nunca se edita ni se borra.
--
-- Se inserta solo desde el servidor con el service role (lib/audit.ts),
-- nunca directo desde el cliente: por eso la policy de insert exige
-- is_service_role() en vez de is_workspace_member(). Los Server Actions
-- y webhooks ya corren en el servidor, asi que usan el cliente de
-- service role para dejar el registro.
-- ============================================================

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changes jsonb,
  metadata jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now()
);

create index if not exists idx_audit_log_workspace on audit_log(workspace_id, performed_at desc);
create index if not exists idx_audit_log_entity on audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_performed_at on audit_log(performed_at);

alter table audit_log enable row level security;

-- Admin/Owner ven todo el historial del workspace; Member solo sus
-- propias acciones (F20, 13b).
drop policy if exists "Scoped select on audit_log" on audit_log;
create policy "Scoped select on audit_log"
  on audit_log for select
  using (
    is_workspace_member(workspace_id)
    and (is_workspace_admin(workspace_id) or performed_by = auth.uid())
  );

drop policy if exists "Service role inserts audit_log" on audit_log;
create policy "Service role inserts audit_log"
  on audit_log for insert
  with check (is_service_role());

-- Nunca se edita ni se borra: sin policies de update/delete para
-- authenticated. El GRANT de la tabla no incluye update/delete.
grant select, insert on audit_log to authenticated;

-- ============================================================
-- MIGRATION 31: CONTACT NOTES
-- ============================================================
-- ============================================================
-- CONTACT NOTES (F13)
-- ============================================================
-- workspace_id desnormalizado a proposito (7.4 del documento de
-- requerimientos) para simplificar el RLS: evita un join contra
-- contacts solo para saber el workspace.
--
-- Scope: cualquier miembro que pueda ver el contacto (can_see_contact,
-- scope de leads del Bloque 1) puede leer y crear notas. Editar o
-- borrar (soft) una nota es solo del autor o de Admin/Owner.
-- ============================================================

create table if not exists contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_notes_content_not_empty'
  ) then
    alter table contact_notes
      add constraint contact_notes_content_not_empty check (btrim(content) <> '');
  end if;
end $$;

create index if not exists idx_contact_notes_contact on contact_notes(contact_id, created_at desc);
create index if not exists idx_contact_notes_workspace on contact_notes(workspace_id);
create index if not exists idx_contact_notes_deleted_at on contact_notes(deleted_at);

drop trigger if exists set_updated_at on contact_notes;
create trigger set_updated_at
  before update on contact_notes
  for each row execute function update_updated_at();

alter table contact_notes enable row level security;

drop policy if exists "Scoped select on contact_notes" on contact_notes;
create policy "Scoped select on contact_notes"
  on contact_notes for select
  using (can_see_contact(contact_id) and deleted_at is null);

drop policy if exists "Scoped insert on contact_notes" on contact_notes;
create policy "Scoped insert on contact_notes"
  on contact_notes for insert
  with check (can_see_contact(contact_id) and created_by = auth.uid());

-- Update cubre tanto editar el contenido como el soft delete
-- (deleted_at = now()): autor, o Admin/Owner del workspace.
drop policy if exists "Author or admin updates contact_notes" on contact_notes;
create policy "Author or admin updates contact_notes"
  on contact_notes for update
  using (
    deleted_at is null
    and (created_by = auth.uid() or is_workspace_admin(workspace_id))
  )
  with check (created_by = auth.uid() or is_workspace_admin(workspace_id));

-- Sin policy de delete para authenticated: siempre soft delete.
grant select, insert, update on contact_notes to authenticated;

-- ============================================================
-- MIGRATION 32: SOFT DELETE
-- ============================================================
-- ============================================================
-- SOFT DELETE (F15)
-- ============================================================
-- contacts.deleted_at y contact_notes.deleted_at ya se agregaron en
-- 00029 y 00031. Esta migracion:
-- 1. Agrega deleted_at a conversations.
-- 2. Actualiza las policies de SELECT de contacts/conversations para
--    ocultar lo borrado (ademas del filtro que ya hacen las pantallas).
-- 3. Saca las policies de DELETE de contacts/conversations para
--    authenticated: "Eliminar" siempre es deleted_at = now() (UPDATE),
--    nunca un DELETE de verdad. El borrado definitivo solo lo hace el
--    cron de purga (/api/cron/purge-deleted) con el service role, que
--    no pasa por RLS.
--
-- response_templates no existe todavia (llega en el Bloque 4): cuando
-- se cree, su migracion tiene que sumarle deleted_at desde el arranque.
-- ============================================================

alter table conversations
  add column if not exists deleted_at timestamptz;

create index if not exists idx_conversations_deleted_at on conversations(deleted_at);

-- ------------------------------------------------------------
-- CONTACTS
-- ------------------------------------------------------------
drop policy if exists "Scoped select on contacts" on contacts;
create policy "Scoped select on contacts"
  on contacts for select
  using (can_see_contact(id) and deleted_at is null);

-- El UPDATE se mantiene sin el filtro de deleted_at en el USING para
-- una excepcion puntual: la propia accion de "eliminar" es un UPDATE
-- que pone deleted_at = now() sobre una fila que todavia no esta
-- borrada, asi que el USING (evaluado sobre la fila vieja) ya la deja
-- pasar. Una vez borrada, can_see_contact() sigue siendo true pero no
-- hay forma de "reeditarla" desde la UI (no hay boton de restaurar);
-- si mas adelante se quiere bloquear tambien el UPDATE sobre lo ya
-- borrado, se puede sumar "and deleted_at is null" aca.

drop policy if exists "Scoped delete on contacts" on contacts;

-- ------------------------------------------------------------
-- CONVERSATIONS
-- ------------------------------------------------------------
drop policy if exists "Scoped select on conversations" on conversations;
create policy "Scoped select on conversations"
  on conversations for select
  using (can_see_conversation(id) and deleted_at is null);

drop policy if exists "Scoped delete on conversations" on conversations;

-- ------------------------------------------------------------
-- MESSAGES: heredan el scope de su conversation, que ya filtra
-- deleted_at via can_see_conversation -> conversations (no hace falta
-- tocar su policy, can_see_conversation ya solo mira conversaciones
-- vivas indirectamente porque la fila de conversations sigue
-- existiendo con deleted_at set; se deja pasar el mensaje mientras la
-- conversacion no se purgo de verdad, que es el comportamiento
-- esperado durante la ventana de 30 dias).
-- ------------------------------------------------------------

-- ============================================================
-- MIGRATION 33: CONTACTS INSERT POLICY FIX
-- ============================================================
-- ============================================================
-- FIX: "new row violates row-level security policy for table contacts"
-- al crear un contacto nuevo desde /dashboard/contacts.
-- ============================================================
-- La policy de INSERT de contacts ("Workspace members can create
-- contacts", de 00020_leads_scope_rls.sql) no la toco ninguna
-- migracion del Bloque 3, pero se reafirma aca de forma defensiva
-- (drop + create) para garantizar que exista tal cual se espera,
-- sin importar el estado en el que haya quedado la base real.
--
-- De paso, blinda el UPDATE: create_contact no es el unico camino,
-- asignar setter/vendedor o editar datos tambien son UPDATE y
-- necesitan poder pasar el check aunque el contacto todavia no tenga
-- setter/vendedor asignado (won't-fail-open, can_see_contact ya lo
-- cubre, esto solo confirma que la policy exista).
-- ============================================================

drop policy if exists "Workspace members can create contacts" on contacts;
create policy "Workspace members can create contacts"
  on contacts for insert
  with check (is_workspace_member(workspace_id));

drop policy if exists "Scoped update on contacts" on contacts;
create policy "Scoped update on contacts"
  on contacts for update
  using (can_see_contact(id))
  with check (can_see_contact(id));

-- Confirma tambien el GRANT a nivel tabla (00017 ya lo hace para todas,
-- esto es un refuerzo idempotente y gratis).
grant select, insert, update, delete on contacts to authenticated;

-- ============================================================
-- MIGRATION 34: GRANT SERVICE ROLE PRIVILEGES
-- ============================================================
-- ============================================================
-- FIX: "permission denied for table workspace_invites" para service_role
-- ============================================================
-- 00017_grant_table_privileges.sql le dio GRANT a "anon" y "authenticated"
-- (para que las policies de RLS se puedan evaluar), pero se olvido de
-- "service_role". La mayoria de las tablas no lo sufrieron porque su
-- service_role ya tenia privilegios heredados de otro lado, pero
-- workspace_invites no, y la pagina /invite/[inviteId] (que lee con el
-- service role a proposito, porque el usuario todavia puede no estar
-- logueado) fallaba con "permission denied" en vez de encontrar la fila.
--
-- Esto lo cubre para TODAS las tablas de una, no solo workspace_invites,
-- para que ninguna tabla futura (ni las de este proyecto ni las de un
-- fork) pueda pisar el mismo problema.
-- ============================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select
  on all sequences in schema public
  to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
