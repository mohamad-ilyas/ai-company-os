-- AI Company OS — secure agent channel.
--
-- Lets Claude sessions (on your Mac, in Claude Code on the web, or anywhere) report
-- the team's work into your dashboard WITHOUT giving them access to your data:
--   * The CEO (signed in) creates an agent key. Only its SHA-256 hash is stored;
--     the key itself is shown once.
--   * A session holding the key can only call submit_agent_report(): append one
--     report to the CEO's inbox. It cannot read, change, or delete anything.
--   * The signed-in dashboard claims new reports, validates them against the same
--     rules as manual imports, and applies them. CEO approvals still apply.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.agent_keys (
  owner uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  key_hint text not null,
  created_at timestamptz not null default now()
);
alter table public.agent_keys enable row level security;
drop policy if exists "owner sees own key metadata" on public.agent_keys;
create policy "owner sees own key metadata" on public.agent_keys
  for select to authenticated using (owner = (select auth.uid()));
revoke all on public.agent_keys from anon, authenticated;
-- The hash itself is never readable from the browser.
grant select (owner, key_hint, created_at) on public.agent_keys to authenticated;

create table if not exists public.agent_reports (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  claimed_at timestamptz,
  outcome text check (outcome in ('applied', 'partial', 'rejected')),
  outcome_detail text
);
create index if not exists agent_reports_owner_pending on public.agent_reports (owner, claimed_at);
alter table public.agent_reports enable row level security;
drop policy if exists "owner reads own reports" on public.agent_reports;
create policy "owner reads own reports" on public.agent_reports
  for select to authenticated using (owner = (select auth.uid()));
drop policy if exists "owner records outcome" on public.agent_reports;
create policy "owner records outcome" on public.agent_reports
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
revoke all on public.agent_reports from anon, authenticated;
grant select on public.agent_reports to authenticated;
grant update (outcome, outcome_detail) on public.agent_reports to authenticated;

-- CEO: create (or replace) the agent key. Returns the plaintext key ONCE.
create or replace function public.create_agent_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_key := 'aicos_agent_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.agent_keys (owner, key_hash, key_hint)
  values (auth.uid(), encode(extensions.digest(v_key, 'sha256'), 'hex'), right(v_key, 4))
  on conflict (owner) do update
    set key_hash = excluded.key_hash, key_hint = excluded.key_hint, created_at = now();
  return v_key;
end;
$$;

-- CEO: revoke the agent key. Sessions using it stop working immediately.
create or replace function public.revoke_agent_key()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.agent_keys where owner = auth.uid();
$$;

-- Agent: append one report. Needs only the agent key (plus the public API key).
create or replace function public.submit_agent_report(p_key text, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_recent int;
  v_id bigint;
begin
  if p_key is null or length(p_key) < 40 then
    raise exception 'invalid agent key' using errcode = '28000';
  end if;
  select owner into v_owner from public.agent_keys
   where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  if v_owner is null then
    raise exception 'invalid agent key' using errcode = '28000';
  end if;
  if coalesce(p_payload ->> 'schema', '') <> 'aicos.report/v1' then
    raise exception 'unknown report schema' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 1000000 then
    raise exception 'report too large (max 1 MB)' using errcode = '22023';
  end if;
  select count(*) into v_recent from public.agent_reports
   where owner = v_owner and received_at > now() - interval '1 hour';
  if v_recent >= 120 then
    raise exception 'rate limit: 120 reports per hour' using errcode = '53400';
  end if;
  insert into public.agent_reports (owner, payload) values (v_owner, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

-- Dashboard: atomically claim unprocessed reports so two devices never apply the same one.
create or replace function public.claim_agent_reports()
returns setof public.agent_reports
language sql
security invoker
set search_path = ''
as $$
  update public.agent_reports
     set claimed_at = now()
   where owner = auth.uid() and claimed_at is null
  returning *;
$$;
-- Needed by claim_agent_reports (security invoker); RLS limits it to the owner's own rows.
grant update (claimed_at) on public.agent_reports to authenticated;

revoke execute on function public.create_agent_key() from public, anon;
revoke execute on function public.revoke_agent_key() from public, anon;
revoke execute on function public.claim_agent_reports() from public, anon;
revoke execute on function public.submit_agent_report(text, jsonb) from public;
grant execute on function public.create_agent_key() to authenticated;
grant execute on function public.revoke_agent_key() to authenticated;
grant execute on function public.claim_agent_reports() to authenticated;
grant execute on function public.submit_agent_report(text, jsonb) to anon, authenticated;
