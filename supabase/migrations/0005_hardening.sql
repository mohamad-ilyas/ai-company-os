-- Production hardening (reviews by William Davies EMP-009 and James Whitaker EMP-006).
-- Backward compatible: dashboards built before this migration keep working (new parameters have defaults),
-- and dashboards built after it fall back to the old calls if it has not been applied yet.
--
-- 1. Report outcomes are saved in the same transaction as the company state, so a report can never be
--    marked "applied" while its changes are lost (another device saved first, the tab closed).
-- 2. Claims are reclaimed by the server's clock after 10 minutes, in bounded batches.
-- 3. A leaked agent key can't fill the free-tier database: 256 KB per report, 60 reports or 5 MB per hour,
--    200 unprocessed reports at most; parallel requests are serialized per owner.
-- 4. reportId must be a string of 8–100 characters; re-sending a reportId with different content is refused
--    instead of silently dropped.
-- 5. The company row can only change through save_company_state (no direct revision tampering);
--    delete/truncate are not granted.
-- 6. Anonymous users (if ever enabled) get nothing.

-- ---------------------------------------------------------------- 1. save state + outcomes atomically

drop function if exists public.save_company_state(jsonb, bigint);

create or replace function public.save_company_state(p_state jsonb, p_base_revision bigint, p_outcomes jsonb default '[]'::jsonb)
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
  if jsonb_typeof(coalesce(p_outcomes, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_outcomes, '[]'::jsonb)) > 200 then
    raise exception 'p_outcomes must be an array of at most 200 items' using errcode = '22023';
  end if;

  perform set_config('aicos.via_save', 'on', true);
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
  perform set_config('aicos.via_save', 'off', true);

  if v_revision is null then
    raise exception 'revision conflict' using errcode = '40001';
  end if;

  update public.agent_reports r
     set outcome = o.outcome, outcome_detail = left(o.detail, 4000)
    from jsonb_to_recordset(coalesce(p_outcomes, '[]'::jsonb)) as o(id bigint, outcome text, detail text)
   where r.id = o.id
     and r.owner = auth.uid()
     and r.outcome is null
     and o.outcome in ('applied', 'partial', 'rejected');
  return v_revision;
end;
$$;

revoke execute on function public.save_company_state(jsonb, bigint, jsonb) from public, anon;
grant execute on function public.save_company_state(jsonb, bigint, jsonb) to authenticated;

-- The update above runs as the signed-in user (security invoker): allow exactly these columns.
grant update (outcome, outcome_detail) on public.agent_reports to authenticated;

-- ---------------------------------------------------------------- 2. server-side, bounded claims

drop function if exists public.claim_agent_reports();

create or replace function public.claim_agent_reports(p_limit int default 20)
returns setof public.agent_reports
language sql
security invoker
set search_path = ''
as $$
  -- Materialized, so the LIMIT is applied once (an IN (...) subquery can be re-run and claim more rows).
  with picked as materialized (
    select id from public.agent_reports
     where owner = auth.uid()
       and outcome is null
       and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     order by id
     limit least(greatest(coalesce(p_limit, 20), 1), 50)
     for update skip locked
  )
  update public.agent_reports r
     set claimed_at = now()
    from picked
   where r.id = picked.id
  returning r.*;
$$;

revoke execute on function public.claim_agent_reports(int) from public, anon;
grant execute on function public.claim_agent_reports(int) to authenticated;

-- ---------------------------------------------------------------- 3 + 4. submission limits and reportId rules

create index if not exists agent_reports_owner_received on public.agent_reports (owner, received_at);

create or replace function public.submit_agent_report(p_payload jsonb, p_key text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_owner uuid;
  v_recent int;
  v_bytes bigint;
  v_id bigint;
  v_existing jsonb;
begin
  v_key := coalesce(
    nullif(p_key, ''),
    nullif(current_setting('request.headers', true)::json ->> 'x-aicos-agent-key', '')
  );
  if v_key is null or length(v_key) < 40 then
    raise exception 'invalid agent key' using errcode = '28000';
  end if;
  select owner into v_owner from public.agent_keys
   where key_hash = encode(extensions.digest(v_key, 'sha256'), 'hex');
  if v_owner is null then
    raise exception 'invalid agent key' using errcode = '28000';
  end if;
  -- One submission at a time per owner, so the limits below can't be raced past.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));

  if coalesce(p_payload ->> 'schema', '') <> 'aicos.report/v1' then
    raise exception 'unknown report schema' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'reportId') is distinct from 'string'
     or length(p_payload ->> 'reportId') not between 8 and 100 then
    raise exception 'reportId must be a string of 8-100 characters' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 262144 then
    raise exception 'report too large (max 256 KB)' using errcode = '22023';
  end if;

  -- Already received: return the existing id (idempotent delivery) — but only for the same content.
  select id, payload into v_id, v_existing from public.agent_reports
   where owner = v_owner and payload ->> 'reportId' = p_payload ->> 'reportId';
  if v_id is not null then
    if v_existing <> p_payload then
      raise exception 'reportId already used with different content: use a new reportId' using errcode = '23505';
    end if;
    return v_id;
  end if;

  select count(*), coalesce(sum(pg_column_size(payload)), 0) into v_recent, v_bytes
    from public.agent_reports
   where owner = v_owner and received_at > now() - interval '1 hour';
  if v_recent >= 60 or v_bytes > 5000000 then
    raise exception 'rate limit: 60 reports or 5 MB per hour' using errcode = '53400';
  end if;
  if (select count(*) from public.agent_reports where owner = v_owner and outcome is null) >= 200 then
    raise exception 'inbox full: 200 reports are waiting for the dashboard to apply them' using errcode = '53400';
  end if;

  insert into public.agent_reports (owner, payload) values (v_owner, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_agent_report(jsonb, text) from public;
grant execute on function public.submit_agent_report(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------- 5. the company row changes only through save_company_state

revoke delete, truncate, references, trigger on public.company_state from authenticated;

create or replace function public.company_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('aicos.via_save', true), 'off') <> 'on' then
    raise exception 'company state can only be saved with save_company_state' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists company_state_guard on public.company_state;
create trigger company_state_guard
  before insert or update on public.company_state
  for each row execute function public.company_state_guard();

-- ---------------------------------------------------------------- 6. anonymous users get nothing

drop policy if exists "no anonymous users" on public.company_state;
create policy "no anonymous users" on public.company_state as restrictive to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "no anonymous users" on public.agent_keys;
create policy "no anonymous users" on public.agent_keys as restrictive to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "no anonymous users" on public.agent_reports;
create policy "no anonymous users" on public.agent_reports as restrictive to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

notify pgrst, 'reload schema';
