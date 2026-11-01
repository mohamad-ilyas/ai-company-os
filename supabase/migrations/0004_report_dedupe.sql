-- Reports can now be delivered more than once (directly by a session, and again by the
-- GitHub delivery workflow that scans committed report files). Each report is stored once
-- per owner + reportId; re-sending returns the existing id instead of creating a duplicate.

create unique index if not exists agent_reports_owner_report_id
  on public.agent_reports (owner, (payload ->> 'reportId'));

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
  v_id bigint;
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
  if coalesce(p_payload ->> 'schema', '') <> 'aicos.report/v1' then
    raise exception 'unknown report schema' using errcode = '22023';
  end if;
  if coalesce(length(p_payload ->> 'reportId'), 0) < 8 then
    raise exception 'reportId required (8+ characters)' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 1000000 then
    raise exception 'report too large (max 1 MB)' using errcode = '22023';
  end if;

  -- Already received: return the existing id (idempotent delivery).
  select id into v_id from public.agent_reports
   where owner = v_owner and payload ->> 'reportId' = p_payload ->> 'reportId';
  if v_id is not null then
    return v_id;
  end if;

  select count(*) into v_recent from public.agent_reports
   where owner = v_owner and received_at > now() - interval '1 hour';
  if v_recent >= 120 then
    raise exception 'rate limit: 120 reports per hour' using errcode = '53400';
  end if;
  insert into public.agent_reports (owner, payload) values (v_owner, p_payload)
  on conflict (owner, (payload ->> 'reportId')) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.agent_reports
     where owner = v_owner and payload ->> 'reportId' = p_payload ->> 'reportId';
  end if;
  return v_id;
end;
$$;

revoke execute on function public.submit_agent_report(jsonb, text) from public;
grant execute on function public.submit_agent_report(jsonb, text) to anon, authenticated;
notify pgrst, 'reload schema';
