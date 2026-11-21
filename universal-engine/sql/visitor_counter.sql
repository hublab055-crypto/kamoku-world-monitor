-- Isolated Universal Engine visitor registry. No changes to Kamoku tables.
create schema if not exists ue_internal;
revoke all on schema ue_internal from public;
create table if not exists ue_internal.visitors (
  visitor_id uuid primary key,
  ordinal bigint generated always as identity unique not null,
  device_class text not null default 'unknown',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visit_count integer not null default 1
);
create table if not exists ue_internal.visitor_rate_daily (
  day date not null,
  rate_hash text not null,
  attempts integer not null default 1,
  primary key (day, rate_hash)
);
create index if not exists ue_visitors_first_seen_idx on ue_internal.visitors(first_seen);
alter table ue_internal.visitors enable row level security;
alter table ue_internal.visitor_rate_daily enable row level security;
revoke all on ue_internal.visitors, ue_internal.visitor_rate_daily from public, anon, authenticated;
grant usage on schema ue_internal to service_role;
grant select, insert, update on ue_internal.visitors, ue_internal.visitor_rate_daily to service_role;
grant usage, select on sequence ue_internal.visitors_ordinal_seq to service_role;

-- Service-role-only RPC invoked by the Edge Function, never by browsers.
create or replace function public.ue_register_visit(
  p_visitor_id uuid,
  p_rate_key text default null,
  p_device text default 'unknown'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $body$
declare
  v_number bigint;
  v_new boolean := false;
  v_attempts integer;
  v_device text;
begin
  if p_visitor_id is null then
    raise exception 'visitor_id required' using errcode = '22023';
  end if;
  v_device := case when p_device in ('desktop','mobile','tablet','vr') then p_device else 'unknown' end;
  select ordinal into v_number from ue_internal.visitors where visitor_id = p_visitor_id;
  if v_number is null then
    if p_rate_key is not null and p_rate_key ~ '^[0-9a-f]{64}$' then
      insert into ue_internal.visitor_rate_daily(day, rate_hash, attempts)
      values ((now() at time zone 'UTC')::date, p_rate_key, 1)
      on conflict (day, rate_hash) do update
        set attempts = ue_internal.visitor_rate_daily.attempts + 1
        where ue_internal.visitor_rate_daily.attempts < 100
      returning attempts into v_attempts;
      if v_attempts is null then
        raise exception 'visitor rate limit exceeded' using errcode = 'P0001';
      end if;
    end if;
    insert into ue_internal.visitors(visitor_id, device_class)
    values (p_visitor_id, v_device)
    on conflict (visitor_id) do nothing
    returning ordinal into v_number;
    v_new := v_number is not null;
  end if;
  if not v_new then
    update ue_internal.visitors
      set last_seen = now(),
          visit_count = least(visit_count + 1, 2147483647)
      where visitor_id = p_visitor_id
      returning ordinal into v_number;
  end if;
  if v_number is null then
    raise exception 'could not register visitor';
  end if;
  return jsonb_build_object(
    'number', v_number,
    'total', (select count(*) from ue_internal.visitors),
    'first_visit', v_new
  );
end;
$body$;
revoke all on function public.ue_register_visit(uuid,text,text) from public, anon, authenticated;
grant execute on function public.ue_register_visit(uuid,text,text) to service_role;
