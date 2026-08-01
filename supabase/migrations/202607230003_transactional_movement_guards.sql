begin;

-- Conservamos la implementación de la migración anterior como función interna y
-- exponemos una envoltura que serializa operaciones equivalentes. El bloqueo se
-- libera automáticamente al terminar la transacción.
alter function public.apply_tool_movement(uuid, jsonb)
  rename to apply_tool_movement_unlocked;

revoke all on function public.apply_tool_movement_unlocked(uuid, jsonb) from public;
revoke all on function public.apply_tool_movement_unlocked(uuid, jsonb) from authenticated;

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
begin
  if operation_key is null or length(operation_key) < 10 then
    raise exception 'No se puede calcular la clave idempotente del movimiento.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(operation_key, 0));
  return public.apply_tool_movement_unlocked(p_workspace_id, p_payload);
end;
$$;

revoke all on function public.apply_tool_movement(uuid, jsonb) from public;
grant execute on function public.apply_tool_movement(uuid, jsonb) to authenticated;

create or replace function private.validate_movement_semantics()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.actor_user_id is null then
    raise exception 'Todo movimiento central necesita un usuario autenticado.' using errcode = '23514';
  end if;

  if new.type = 'delivery' then
    if new.previous_status <> 'available'
       or new.next_status <> 'loaned'
       or new.technician_id is null
       or new.condition is not null then
      raise exception 'La entrega no mantiene una transición de estado válida.' using errcode = '23514';
    end if;

  elsif new.type = 'return' then
    if new.previous_status <> 'loaned'
       or new.next_status <> 'available'
       or new.technician_id is null
       or new.condition is distinct from 'ok' then
      raise exception 'La devolución correcta no mantiene una transición válida.' using errcode = '23514';
    end if;

  elsif new.type = 'incident' then
    if new.previous_status <> 'loaned'
       or new.technician_id is null
       or new.condition not in ('review', 'damaged')
       or new.next_status is distinct from new.condition
       or nullif(trim(new.notes), '') is null then
      raise exception 'La incidencia no mantiene una transición o justificación válida.' using errcode = '23514';
    end if;

  elsif new.type = 'adjustment' then
    if new.previous_status = new.next_status and nullif(trim(new.notes), '') is null then
      raise exception 'El ajuste sin cambio de estado necesita una justificación.' using errcode = '23514';
    end if;
  else
    raise exception 'Tipo de movimiento no admitido.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_movement_semantics() from public;

DO $$ BEGIN
  drop trigger if exists movements_validate_semantics on public.movements;
  create trigger movements_validate_semantics
    before insert on public.movements
    for each row execute function private.validate_movement_semantics();
END $$;

commit;
