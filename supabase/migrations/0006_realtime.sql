-- Live dashboard: the moment the company changes on another device, or the AI team delivers a report,
-- every open dashboard of that account is told — over Supabase Realtime (free tier), no polling wait.
--
-- The signal is deliberately tiny (one row per owner: latest state revision and last report time):
-- the dashboard then fetches through the normal, validated sync path. Company data itself never
-- travels through Realtime. Row Level Security: each account only hears about its own row.

create table if not exists public.sync_signals (
  owner uuid primary key references auth.users (id) on delete cascade,
  state_revision bigint not null default 0,
  report_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sync_signals enable row level security;
-- Old values in change events too (tiny rows), so a device can tell its own save from a new report.
alter table public.sync_signals replica identity full;
drop policy if exists "owner hears own signals" on public.sync_signals;
create policy "owner hears own signals" on public.sync_signals
  for select to authenticated using (owner = (select auth.uid()));
revoke all on public.sync_signals from anon, authenticated;
grant select on public.sync_signals to authenticated;

-- Written only by these triggers (security definer), never by clients.
create or replace function public.signal_state_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sync_signals (owner, state_revision, updated_at)
  values (new.owner, new.revision, now())
  on conflict (owner) do update set state_revision = excluded.state_revision, updated_at = now();
  return null;
end;
$$;

create or replace function public.signal_report_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sync_signals (owner, report_at, updated_at)
  values (new.owner, now(), now())
  on conflict (owner) do update set report_at = now(), updated_at = now();
  return null;
end;
$$;

revoke execute on function public.signal_state_saved() from public, anon, authenticated;
revoke execute on function public.signal_report_received() from public, anon, authenticated;

drop trigger if exists signal_state_saved on public.company_state;
create trigger signal_state_saved
  after insert or update of revision on public.company_state
  for each row execute function public.signal_state_saved();

drop trigger if exists signal_report_received on public.agent_reports;
create trigger signal_report_received
  after insert on public.agent_reports
  for each row execute function public.signal_report_received();

-- Publish the signal table to Realtime (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_signals'
  ) then
    alter publication supabase_realtime add table public.sync_signals;
  end if;
end;
$$;

notify pgrst, 'reload schema';
