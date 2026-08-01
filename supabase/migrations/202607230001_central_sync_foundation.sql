begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

DO $$ BEGIN
  create type public.workspace_role as enum ('admin', 'warehouse', 'technician', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members(user_id, workspace_id)
  where active;

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members membership
      where membership.workspace_id = target_workspace
        and membership.user_id = (select auth.uid())
        and membership.active
    );
$$;

create or replace function private.has_workspace_role(
  target_workspace uuid,
  accepted_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members membership
      where membership.workspace_id = target_workspace
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = any(accepted_roles)
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

create table if not exists public.technicians (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  code text not null,
  nfc_uid text,
  barcode_value text,
  name text not null,
  specialty text not null,
  job_role text,
  phone text,
  extension text,
  previous_phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, id),
  unique (workspace_id, code),
  unique nulls not distinct (workspace_id, barcode_value),
  unique nulls not distinct (workspace_id, nfc_uid)
);

alter table public.workspace_members
  add column if not exists technician_id text;

DO $$ BEGIN
  alter table public.workspace_members
    add constraint workspace_members_technician_fk
    foreign key (workspace_id, technician_id)
    references public.technicians(workspace_id, id)
    on delete set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

create table if not exists public.tools (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  code text not null,
  qr_code text not null,
  nfc_uid text,
  name text not null,
  category text not null,
  brand text,
  model text,
  serial_number text,
  location text not null,
  status text not null check (status in ('available', 'loaned', 'review', 'damaged', 'retired')),
  service_status text check (service_status is null or service_status in ('none', 'reserved', 'repair', 'waiting_parts', 'calibration', 'out_of_service', 'lost')),
  reserved_technician_id text,
  holder_technician_id text,
  loaned_at timestamptz,
  notes text,
  photo_uri text,
  thumbnail_uri text,
  image_updated_at timestamptz,
  purchase_date date,
  purchase_cost numeric(12,2) check (purchase_cost is null or purchase_cost >= 0),
  supplier text,
  next_review_date date,
  next_calibration_date date,
  max_loan_days integer check (max_loan_days is null or max_loan_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, id),
  unique (workspace_id, code),
  unique (workspace_id, qr_code),
  unique nulls not distinct (workspace_id, nfc_uid),
  foreign key (workspace_id, reserved_technician_id)
    references public.technicians(workspace_id, id) on delete set null,
  foreign key (workspace_id, holder_technician_id)
    references public.technicians(workspace_id, id) on delete set null
);

create index if not exists tools_workspace_status_idx
  on public.tools(workspace_id, status, active);
create index if not exists tools_holder_idx
  on public.tools(workspace_id, holder_technician_id)
  where holder_technician_id is not null;

create table if not exists public.accessories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  tool_id text not null,
  name text not null,
  required boolean not null default false,
  active boolean not null default true,
  condition text check (condition is null or condition in ('ok', 'missing', 'damaged', 'not_checked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, id),
  foreign key (workspace_id, tool_id)
    references public.tools(workspace_id, id) on delete cascade
);

create index if not exists accessories_tool_idx
  on public.accessories(workspace_id, tool_id, active);

create table if not exists public.devices (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  platform text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, id)
);

create table if not exists public.movements (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  operation_id text not null,
  sequence_number integer,
  type text not null check (type in ('delivery', 'return', 'incident', 'adjustment')),
  tool_id text not null,
  technician_id text,
  operator_name text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  device_id text,
  occurred_at timestamptz not null,
  previous_status text not null check (previous_status in ('available', 'loaned', 'review', 'damaged', 'retired')),
  next_status text not null check (next_status in ('available', 'loaned', 'review', 'damaged', 'retired')),
  condition text check (condition is null or condition in ('ok', 'review', 'damaged')),
  notes text,
  expected_return_at timestamptz,
  work_order text,
  work_location text,
  reversed_movement_id text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, operation_id, tool_id, type),
  foreign key (workspace_id, tool_id)
    references public.tools(workspace_id, id) on delete restrict,
  foreign key (workspace_id, technician_id)
    references public.technicians(workspace_id, id) on delete set null,
  foreign key (workspace_id, reversed_movement_id)
    references public.movements(workspace_id, id) on delete restrict,
  foreign key (workspace_id, device_id)
    references public.devices(workspace_id, id) on delete set null
);

create index if not exists movements_workspace_occurred_idx
  on public.movements(workspace_id, occurred_at desc);
create index if not exists movements_workspace_operation_idx
  on public.movements(workspace_id, operation_id);
create index if not exists movements_workspace_tool_idx
  on public.movements(workspace_id, tool_id, occurred_at desc);
create index if not exists movements_workspace_technician_idx
  on public.movements(workspace_id, technician_id, occurred_at desc);

create table if not exists public.movement_accessories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  movement_id text not null,
  accessory_id text not null,
  condition text not null check (condition in ('ok', 'missing', 'damaged', 'not_checked')),
  notes text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, movement_id, accessory_id),
  foreign key (workspace_id, movement_id)
    references public.movements(workspace_id, id) on delete restrict,
  foreign key (workspace_id, accessory_id)
    references public.accessories(workspace_id, id) on delete restrict
);

create table if not exists public.maintenance_records (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  tool_id text not null,
  type text not null check (type in ('incident', 'inspection', 'repair', 'calibration', 'status_change')),
  status text not null check (status in ('open', 'in_progress', 'waiting_parts', 'completed', 'cancelled')),
  title text not null,
  description text not null,
  resolution text,
  operator_name text not null,
  assigned_to text,
  opened_at timestamptz not null,
  due_at timestamptz,
  completed_at timestamptz,
  cost numeric(12,2) check (cost is null or cost >= 0),
  parts text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, id),
  foreign key (workspace_id, tool_id)
    references public.tools(workspace_id, id) on delete restrict
);

create index if not exists maintenance_workspace_status_idx
  on public.maintenance_records(workspace_id, status, due_at);

create table if not exists public.sync_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity text not null check (entity in ('tools', 'technicians', 'movements', 'accessories', 'maintenance_records')),
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  payload jsonb not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists sync_events_workspace_cursor_idx
  on public.sync_events(workspace_id, id);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity text not null,
  entity_id text not null,
  action text not null,
  previous_data jsonb,
  next_data jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_workspace_idx
  on public.audit_events(workspace_id, occurred_at desc);

create or replace function private.touch_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function private.bootstrap_workspace_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.workspace_members(workspace_id, user_id, role, display_name)
  values (new.id, new.created_by, 'admin', 'Administrador inicial')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

create or replace function private.record_sync_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  workspace uuid;
  row_id text;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    workspace := old.workspace_id;
    row_id := old.id;
  else
    row_data := to_jsonb(new);
    workspace := new.workspace_id;
    row_id := new.id;
  end if;

  insert into public.sync_events(workspace_id, entity, entity_id, action, payload, actor_user_id)
  values (workspace, tg_argv[0], row_id, lower(tg_op), row_data, (select auth.uid()));

  return coalesce(new, old);
end;
$$;

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace uuid;
  row_id text;
begin
  workspace := coalesce(new.workspace_id, old.workspace_id);
  row_id := coalesce(new.id, old.id);

  insert into public.audit_events(
    workspace_id,
    entity,
    entity_id,
    action,
    previous_data,
    next_data,
    actor_user_id
  ) values (
    workspace,
    tg_argv[0],
    row_id,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    (select auth.uid())
  );

  return coalesce(new, old);
end;
$$;

create or replace function private.prevent_movement_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Los movimientos son inmutables. Registra una rectificación enlazada.'
    using errcode = '55000';
end;
$$;

DO $$
DECLARE
  target_table text;
BEGIN
  foreach target_table in array array[
    'workspaces',
    'workspace_members',
    'technicians',
    'tools',
    'accessories',
    'devices',
    'maintenance_records'
  ] loop
    execute format('drop trigger if exists touch_version on public.%I', target_table);
    execute format(
      'create trigger touch_version before update on public.%I for each row execute function private.touch_version()',
      target_table
    );
  end loop;
END $$;

DO $$ BEGIN
  drop trigger if exists bootstrap_workspace_admin on public.workspaces;
  create trigger bootstrap_workspace_admin
    after insert on public.workspaces
    for each row execute function private.bootstrap_workspace_admin();
END $$;

DO $$
DECLARE
  item record;
BEGIN
  for item in
    select * from (values
      ('technicians', 'technicians'),
      ('tools', 'tools'),
      ('accessories', 'accessories'),
      ('movements', 'movements'),
      ('maintenance_records', 'maintenance_records')
    ) as values_table(table_name, entity_name)
  loop
    execute format('drop trigger if exists sync_event on public.%I', item.table_name);
    execute format(
      'create trigger sync_event after insert or update or delete on public.%I for each row execute function private.record_sync_event(%L)',
      item.table_name,
      item.entity_name
    );

    execute format('drop trigger if exists audit_event on public.%I', item.table_name);
    execute format(
      'create trigger audit_event after insert or update or delete on public.%I for each row execute function private.record_audit_event(%L)',
      item.table_name,
      item.entity_name
    );
  end loop;
END $$;

DO $$ BEGIN
  drop trigger if exists movements_immutable_update on public.movements;
  create trigger movements_immutable_update
    before update or delete on public.movements
    for each row execute function private.prevent_movement_mutation();
END $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.technicians enable row level security;
alter table public.tools enable row level security;
alter table public.accessories enable row level security;
alter table public.devices enable row level security;
alter table public.movements enable row level security;
alter table public.movement_accessories enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.sync_events enable row level security;
alter table public.audit_events enable row level security;

create policy workspaces_insert_own on public.workspaces
  for insert to authenticated
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using ((select private.is_workspace_member(id)) or created_by = (select auth.uid()));
create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using ((select private.has_workspace_role(id, array['admin']::public.workspace_role[])))
  with check ((select private.has_workspace_role(id, array['admin']::public.workspace_role[])));

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy workspace_members_manage_admin on public.workspace_members
  for all to authenticated
  using ((select private.has_workspace_role(workspace_id, array['admin']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['admin']::public.workspace_role[])));

create policy technicians_select_member on public.technicians
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy technicians_manage_staff on public.technicians
  for all to authenticated
  using ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])));

create policy tools_select_member on public.tools
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy tools_manage_staff on public.tools
  for all to authenticated
  using ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])));

create policy accessories_select_member on public.accessories
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy accessories_manage_staff on public.accessories
  for all to authenticated
  using ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])));

create policy devices_select_member on public.devices
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy devices_insert_own on public.devices
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_workspace_member(workspace_id))
  );
create policy devices_update_own on public.devices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy movements_select_member on public.movements
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy movements_insert_member on public.movements
  for insert to authenticated
  with check (
    (select private.is_workspace_member(workspace_id))
    and actor_user_id = (select auth.uid())
  );

create policy movement_accessories_select_member on public.movement_accessories
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy movement_accessories_insert_member on public.movement_accessories
  for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));

create policy maintenance_select_member on public.maintenance_records
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy maintenance_insert_member on public.maintenance_records
  for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));
create policy maintenance_update_staff on public.maintenance_records
  for update to authenticated
  using ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])));

create policy sync_events_select_member on public.sync_events
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy audit_events_select_staff on public.audit_events
  for select to authenticated
  using ((select private.has_workspace_role(workspace_id, array['admin', 'warehouse']::public.workspace_role[])));

grant usage on schema public to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.technicians to authenticated;
grant select, insert, update, delete on public.tools to authenticated;
grant select, insert, update, delete on public.accessories to authenticated;
grant select, insert, update on public.devices to authenticated;
grant select, insert on public.movements to authenticated;
grant select, insert on public.movement_accessories to authenticated;
grant select, insert, update on public.maintenance_records to authenticated;
grant select on public.sync_events to authenticated;
grant select on public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
