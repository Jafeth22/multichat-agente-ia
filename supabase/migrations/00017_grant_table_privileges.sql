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
