begin;

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
  actor_id uuid := (select auth.uid());
  actor_role public.workspace_role;
  linked_technician_id text;
  movement_id text := nullif(trim(p_payload ->> 'id'), '');
  operation_id text := coalesce(nullif(trim(p_payload ->> 'operationId'), ''), movement_id);
  movement_type text := nullif(trim(p_payload ->> 'type'), '');
  tool_id text := nullif(trim(p_payload ->> 'toolId'), '');
  technician_id text := nullif(trim(p_payload ->> 'technicianId'), '');
  previous_status text := nullif(trim(p_payload ->> 'previousStatus'), '');
  next_status text := nullif(trim(p_payload ->> 'nextStatus'), '');
  return_condition text := nullif(trim(p_payload ->> 'condition'), '');
  occurred_at timestamptz := coalesce(nullif(p_payload ->> 'occurredAt', '')::timestamptz, now());
  tool_state jsonb := coalesce(p_payload -> 'toolState', '{}'::jsonb);
  accessory_checks jsonb := coalesce(p_payload -> 'accessoryChecks', '[]'::jsonb);
  current_tool public.tools%rowtype;
  existing_movement public.movements%rowtype;
  check_item jsonb;
  effective_service_status text;
  effective_active boolean;
begin
  if actor_id is null then
    raise exception 'Se necesita una sesión autenticada para sincronizar.' using errcode = '42501';
  end if;

  select membership.role, membership.technician_id
  into actor_role, linked_technician_id
  from public.workspace_members membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = actor_id
    and membership.active;

  if not found then
    raise exception 'El usuario no pertenece al espacio de trabajo o está inactivo.' using errcode = '42501';
  end if;

  if actor_role not in ('admin', 'warehouse', 'technician') then
    raise exception 'El perfil de consulta no puede registrar movimientos.' using errcode = '42501';
  end if;

  if movement_id is null or tool_id is null or movement_type is null
     or previous_status is null or next_status is null then
    raise exception 'El movimiento no contiene todos los campos obligatorios.' using errcode = '22023';
  end if;

  if movement_type not in ('delivery', 'return', 'incident', 'adjustment') then
    raise exception 'Tipo de movimiento no permitido: %.', movement_type using errcode = '22023';
  end if;

  if previous_status not in ('available', 'loaned', 'review', 'damaged', 'retired')
     or next_status not in ('available', 'loaned', 'review', 'damaged', 'retired') then
    raise exception 'Estado anterior o nuevo no válido.' using errcode = '22023';
  end if;

  select movement.*
  into existing_movement
  from public.movements movement
  where movement.workspace_id = p_workspace_id
    and (
      movement.id = movement_id
      or (
        movement.operation_id = operation_id
        and movement.tool_id = tool_id
        and movement.type = movement_type
      )
    )
  order by case when movement.id = movement_id then 0 else 1 end
  limit 1;

  if found then
    select tool.* into current_tool
    from public.tools tool
    where tool.workspace_id = p_workspace_id and tool.id = tool_id;

    return jsonb_build_object(
      'duplicate', true,
      'movement', to_jsonb(existing_movement),
      'tool', case when current_tool.id is null then null else to_jsonb(current_tool) end
    );
  end if;

  select tool.*
  into current_tool
  from public.tools tool
  where tool.workspace_id = p_workspace_id
    and tool.id = tool_id
  for update;

  if not found then
    raise exception 'La herramienta % no existe en el espacio de trabajo.', tool_id using errcode = '23503';
  end if;

  if current_tool.status <> previous_status then
    raise exception 'Conflicto de estado: % figura como %, no como %.', current_tool.code, current_tool.status, previous_status
      using errcode = '40001';
  end if;

  if actor_role = 'technician' then
    if linked_technician_id is null then
      raise exception 'El usuario técnico no tiene una ficha técnica vinculada.' using errcode = '42501';
    end if;
    if movement_type = 'adjustment' then
      raise exception 'Un técnico no puede registrar ajustes administrativos.' using errcode = '42501';
    end if;
    if technician_id is distinct from linked_technician_id then
      raise exception 'Un técnico solo puede registrar movimientos a su propio nombre.' using errcode = '42501';
    end if;
  end if;

  if jsonb_typeof(accessory_checks) <> 'array' then
    raise exception 'La comprobación de accesorios debe ser una lista.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.accessories accessory
    where accessory.workspace_id = p_workspace_id
      and accessory.tool_id = tool_id
      and accessory.active
      and accessory.required
      and not exists (
        select 1
        from jsonb_array_elements(accessory_checks) candidate
        where candidate ->> 'accessoryId' = accessory.id
          and candidate ->> 'condition' in ('ok', 'missing', 'damaged')
      )
  ) then
    raise exception 'Falta comprobar al menos un accesorio obligatorio.' using errcode = '23514';
  end if;

  if movement_type = 'delivery' then
    if technician_id is null then
      raise exception 'La entrega necesita un técnico responsable.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.technicians technician
      where technician.workspace_id = p_workspace_id
        and technician.id = technician_id
        and technician.active
    ) then
      raise exception 'El técnico seleccionado no existe o está inactivo.' using errcode = '23503';
    end if;
    if not current_tool.active or current_tool.status <> 'available' then
      raise exception 'La herramienta no está disponible para entregar.' using errcode = '23514';
    end if;
    if coalesce(current_tool.service_status, 'none') not in ('none', 'reserved') then
      raise exception 'La herramienta está bloqueada por su situación de servicio.' using errcode = '23514';
    end if;
    if current_tool.service_status = 'reserved'
       and current_tool.reserved_technician_id is distinct from technician_id then
      raise exception 'La herramienta está reservada para otro técnico.' using errcode = '23514';
    end if;
    if next_status <> 'loaned' then
      raise exception 'Una entrega debe finalizar con estado loaned.' using errcode = '23514';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(accessory_checks) candidate
      where candidate ->> 'condition' in ('missing', 'damaged')
    ) then
      raise exception 'No se puede entregar una herramienta con accesorios ausentes o dañados.' using errcode = '23514';
    end if;

    update public.tools
    set status = 'loaned',
        service_status = 'none',
        reserved_technician_id = null,
        holder_technician_id = technician_id,
        loaned_at = occurred_at,
        updated_at = occurred_at
    where workspace_id = p_workspace_id and id = tool_id;

  elsif movement_type in ('return', 'incident') then
    if current_tool.status <> 'loaned' or current_tool.holder_technician_id is null then
      raise exception 'La herramienta no figura como prestada.' using errcode = '23514';
    end if;
    if technician_id is distinct from current_tool.holder_technician_id then
      raise exception 'La herramienta no está prestada al técnico indicado.' using errcode = '23514';
    end if;

    if movement_type = 'return' then
      if return_condition is distinct from 'ok' or next_status <> 'available' then
        raise exception 'Una devolución correcta debe usar condición ok y estado available.' using errcode = '23514';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(accessory_checks) candidate
        where candidate ->> 'condition' in ('missing', 'damaged')
      ) then
        raise exception 'Una devolución con accesorios incidentados debe registrarse como incidencia.' using errcode = '23514';
      end if;
      effective_service_status := coalesce(current_tool.service_status, 'none');
    else
      if return_condition not in ('review', 'damaged') or next_status <> return_condition then
        raise exception 'La incidencia debe indicar review o damaged de forma coherente.' using errcode = '23514';
      end if;
      if nullif(trim(p_payload ->> 'notes'), '') is null then
        raise exception 'La devolución con incidencia necesita observaciones.' using errcode = '23514';
      end if;
      effective_service_status := 'out_of_service';
    end if;

    update public.tools
    set status = next_status,
        service_status = effective_service_status,
        holder_technician_id = null,
        loaned_at = null,
        notes = coalesce(nullif(trim(p_payload ->> 'notes'), ''), current_tool.notes),
        updated_at = occurred_at
    where workspace_id = p_workspace_id and id = tool_id;

  else
    if actor_role not in ('admin', 'warehouse') then
      raise exception 'Solo administración o almacén pueden registrar ajustes.' using errcode = '42501';
    end if;
    if jsonb_typeof(tool_state) <> 'object'
       or tool_state ->> 'id' is distinct from tool_id
       or tool_state ->> 'status' is distinct from next_status then
      raise exception 'El ajuste no contiene un estado final coherente de la herramienta.' using errcode = '22023';
    end if;

    effective_service_status := case
      when tool_state ? 'serviceStatus' then nullif(tool_state ->> 'serviceStatus', '')
      else current_tool.service_status
    end;
    if effective_service_status is not null
       and effective_service_status not in ('none', 'reserved', 'repair', 'waiting_parts', 'calibration', 'out_of_service', 'lost') then
      raise exception 'Situación de servicio no válida.' using errcode = '22023';
    end if;
    effective_active := case
      when tool_state ? 'active' then coalesce((tool_state ->> 'active')::boolean, current_tool.active)
      else current_tool.active
    end;

    update public.tools
    set status = next_status,
        service_status = effective_service_status,
        reserved_technician_id = case when tool_state ? 'reservedTechnicianId' then nullif(tool_state ->> 'reservedTechnicianId', '') else current_tool.reserved_technician_id end,
        holder_technician_id = case when tool_state ? 'holderTechnicianId' then nullif(tool_state ->> 'holderTechnicianId', '') else current_tool.holder_technician_id end,
        loaned_at = case when tool_state ? 'loanedAt' then nullif(tool_state ->> 'loanedAt', '')::timestamptz else current_tool.loaned_at end,
        notes = case when tool_state ? 'notes' then nullif(tool_state ->> 'notes', '') else current_tool.notes end,
        active = effective_active,
        updated_at = coalesce(nullif(tool_state ->> 'updatedAt', '')::timestamptz, occurred_at)
    where workspace_id = p_workspace_id and id = tool_id;
  end if;

  insert into public.movements (
    workspace_id,
    id,
    operation_id,
    sequence_number,
    type,
    tool_id,
    technician_id,
    operator_name,
    actor_user_id,
    device_id,
    occurred_at,
    previous_status,
    next_status,
    condition,
    notes,
    expected_return_at,
    work_order,
    work_location,
    reversed_movement_id
  ) values (
    p_workspace_id,
    movement_id,
    operation_id,
    nullif(p_payload ->> 'sequenceNumber', '')::integer,
    movement_type,
    tool_id,
    technician_id,
    coalesce(nullif(trim(p_payload ->> 'operatorName'), ''), 'Operador'),
    actor_id,
    nullif(trim(p_payload ->> 'deviceId'), ''),
    occurred_at,
    previous_status,
    next_status,
    return_condition,
    nullif(trim(p_payload ->> 'notes'), ''),
    nullif(p_payload ->> 'expectedReturnAt', '')::timestamptz,
    nullif(trim(p_payload ->> 'workOrder'), ''),
    nullif(trim(p_payload ->> 'workLocation'), ''),
    nullif(trim(p_payload ->> 'reversedMovementId'), '')
  );

  for check_item in select value from jsonb_array_elements(accessory_checks)
  loop
    if check_item ->> 'condition' not in ('ok', 'missing', 'damaged', 'not_checked') then
      raise exception 'Condición de accesorio no válida.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.accessories accessory
      where accessory.workspace_id = p_workspace_id
        and accessory.tool_id = tool_id
        and accessory.id = check_item ->> 'accessoryId'
        and accessory.active
    ) then
      raise exception 'El accesorio indicado no pertenece a la herramienta.' using errcode = '23503';
    end if;

    insert into public.movement_accessories (
      workspace_id,
      movement_id,
      accessory_id,
      condition,
      notes
    ) values (
      p_workspace_id,
      movement_id,
      check_item ->> 'accessoryId',
      check_item ->> 'condition',
      nullif(trim(check_item ->> 'notes'), '')
    );
  end loop;

  select tool.* into current_tool
  from public.tools tool
  where tool.workspace_id = p_workspace_id and tool.id = tool_id;

  select movement.* into existing_movement
  from public.movements movement
  where movement.workspace_id = p_workspace_id and movement.id = movement_id;

  return jsonb_build_object(
    'duplicate', false,
    'movement', to_jsonb(existing_movement),
    'tool', to_jsonb(current_tool)
  );
end;
$$;

revoke all on function public.apply_tool_movement(uuid, jsonb) from public;
grant execute on function public.apply_tool_movement(uuid, jsonb) to authenticated;

-- Los movimientos y sus comprobaciones solo se crean mediante la función
-- transaccional anterior. Así la identidad, el estado y la herramienta se
-- validan en el servidor y no dependen de la interfaz del navegador.
drop policy if exists movements_insert_member on public.movements;
drop policy if exists movement_accessories_insert_member on public.movement_accessories;
revoke insert on public.movements from authenticated;
revoke insert on public.movement_accessories from authenticated;

commit;
