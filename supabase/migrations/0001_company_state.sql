-- AI Company OS — cloud sync schema (Supabase free tier).
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- One private row per signed-in user holds the whole company state as JSON.
-- Row Level Security: a user can only ever read or write their own row.
-- There is no delete policy: the dashboard cannot delete the cloud copy.

create table if not exists public.company_state (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.company_state enable row level security;

drop policy if exists "owner reads own state" on public.company_state;
create policy "owner reads own state" on public.company_state
  for select to authenticated using (owner = (select auth.uid()));

drop policy if exists "owner inserts own state" on public.company_state;
create policy "owner inserts own state" on public.company_state
  for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "owner updates own state" on public.company_state;
create policy "owner updates own state" on public.company_state
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

revoke all on public.company_state from anon;
grant select, insert, update on public.company_state to authenticated;

-- Atomic save with optimistic concurrency: the write succeeds only if the caller
-- saw the latest revision, so one device can never silently overwrite another.
-- p_base_revision = 0 means "first upload". Returns the new revision.
create or replace function public.save_company_state(p_state jsonb, p_base_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if octet_length(p_state::text) > 5000000 then
    raise exception 'state too large' using errcode = '22023';
  end if;

  if p_base_revision = 0 then
    insert into public.company_state (owner, state, revision)
    values (auth.uid(), p_state, 1)
    on conflict (owner) do nothing
    returning revision into v_revision;
  else
    update public.company_state
       set state = p_state, revision = revision + 1, updated_at = now()
     where owner = auth.uid() and revision = p_base_revision
    returning revision into v_revision;
  end if;

  if v_revision is null then
    raise exception 'revision conflict' using errcode = '40001';
  end if;
  return v_revision;
end;
$$;

revoke execute on function public.save_company_state(jsonb, bigint) from public, anon;
grant execute on function public.save_company_state(jsonb, bigint) to authenticated;
