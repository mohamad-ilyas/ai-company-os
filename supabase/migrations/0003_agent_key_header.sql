-- Accept the agent key from the X-Aicos-Agent-Key request header as well as the body.
-- This lets Claude Code on the web store the key as a "network secret": Anthropic's proxy
-- adds the header after the request leaves the session, so the key never enters the VM.

drop function if exists public.submit_agent_report(text, jsonb);

create function public.submit_agent_report(p_payload jsonb, p_key text default null)
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

revoke execute on function public.submit_agent_report(jsonb, text) from public;
grant execute on function public.submit_agent_report(jsonb, text) to anon, authenticated;
