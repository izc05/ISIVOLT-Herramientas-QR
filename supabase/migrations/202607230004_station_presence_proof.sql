begin;

alter table public.movements
  add column if not exists station_id text,
  add column if not exists station_nonce text,
  add column if not exists station_verified_at timestamptz;

DO $$ BEGIN
  alter table public.movements
    add constraint movements_station_proof_complete
    check (
      (station_id is null and station_nonce is null and station_verified_at is null)
      or
      (station_id is not null and station_nonce is not null and station_verified_at is not null)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

create table if not exists public.station_redemptions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  station_id text not null,
  nonce text not null,
  operation_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, station_id, nonce)
);

create index if not exists station_redemptions_operation_idx
  on public.station_redemptions(workspace_id, operation_id, verified_at desc);

alter table public.station_redemptions enable row level security;

drop policy if exists station_redemptions_select_staff on public.station_redemptions;
create policy station_redemptions_select_staff on public.station_redemptions
  for select to authenticated
  using ((select private.has_workspace_role(
    workspace_id,
    array['admin', 'warehouse']::public.workspace_role[]
  )));

grant select on public.station_redemptions to authenticated;
revoke insert, update, delete on public.station_redemptions from authenticated;

-- La envoltura conserva el bloqueo asesor de RC37 y pasa la prueba presencial
-- al trigger mediante variables locales de la transacción. La función interna
-- sigue siendo la única que modifica herramienta, movimiento y accesorios.
create or replace function public.apply_tool_movement(
  p_workspace_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  operation_key text := concat_ws(
    ':',
    p_workspace_id::text,
    coalesce(nullif(trim(p_payload ->> 'operationId'), ''), nullif(trim(p_payload ->> 'id'), '')),
    nullif(trim(p_payload ->> 'toolId'), ''),
    nullif(trim(p_payload ->> 'type'), '')
  );
  station_id_value text := nullif(trim(p_payload ->> 'stationId'), '');
  station_nonce_value text := nullif(trim(p_payload ->> 'stationNonce'), '');
  station_verified_value text := nullif(trim(p_payload ->> 'stationVerifiedAt'), '');
  proof_count integer;
begin
  if operation_key is null or length(operation_key) < 10 then
    raise exception 'No se puede calcular la clave idempotente del movimiento.' using errcode = '22023';
  end if;

  proof_count :=
    (case when station_id_value is not null then 1 else 0 end)
    + (case when station_nonce_value is not null then 1 else 0 end)
    + (case when station_verified_value is not null then 1 else 0 end);

  if proof_count not in (0, 3) then
    raise exception 'La prueba presencial debe incluir estación, nonce y fecha de verificación.' using errcode = '22023';
  end if;

  if station_id_value is not null then
    if length(station_id_value) > 64 or length(station_nonce_value) > 180 then
      raise exception 'La prueba presencial supera la longitud permitida.' using errcode = '22023';
    end if;
    perform station_verified_value::timestamptz;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(operation_key, 0));
  perform set_config('isivolt.station_id', coalesce(station_id_value, ''), true);
  perform set_config('isivolt.station_nonce', coalesce(station_nonce_value, ''), true);
  perform set_config('isivolt.station_verified_at', coalesce(station_verified_value, ''), true);

  return public.apply_tool_movement_unlocked(p_workspace_id, p_payload);
end;
$$;

revoke all on function public.apply_tool_movement(uuid, jsonb) from public;
grant execute on function public.apply_tool_movement(uuid, jsonb) to authenticated;

create or replace function private.attach_station_proof()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  station_id_value text := nullif(current_setting('isivolt.station_id', true), '');
  station_nonce_value text := nullif(current_setting('isivolt.station_nonce', true), '');
  station_verified_value timestamptz := nullif(current_setting('isivolt.station_verified_at', true), '')::timestamptz;
  existing_operation_id text;
begin
  if new.type not in ('delivery', 'return', 'incident') then
    return new;
  end if;

  if station_id_value is null and station_nonce_value is null and station_verified_value is null then
    return new;
  end if;

  if station_id_value is null or station_nonce_value is null or station_verified_value is null then
    raise exception 'La prueba presencial recibida por el servidor está incompleta.' using errcode = '23514';
  end if;

  new.station_id := station_id_value;
  new.station_nonce := station_nonce_value;
  new.station_verified_at := station_verified_value;

  insert into public.station_redemptions(
    workspace_id,
    station_id,
    nonce,
    operation_id,
    actor_user_id,
    verified_at
  ) values (
    new.workspace_id,
    station_id_value,
    station_nonce_value,
    new.operation_id,
    new.actor_user_id,
    station_verified_value
  )
  on conflict (workspace_id, station_id, nonce) do nothing;

  select redemption.operation_id
  into existing_operation_id
  from public.station_redemptions redemption
  where redemption.workspace_id = new.workspace_id
    and redemption.station_id = station_id_value
    and redemption.nonce = station_nonce_value;

  if existing_operation_id is distinct from new.operation_id then
    raise exception 'El nonce presencial ya está vinculado a otra operación.' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.attach_station_proof() from public;

DO $$ BEGIN
  drop trigger if exists movements_attach_station_proof on public.movements;
  create trigger movements_attach_station_proof
    before insert on public.movements
    for each row execute function private.attach_station_proof();
END $$;

commit;
