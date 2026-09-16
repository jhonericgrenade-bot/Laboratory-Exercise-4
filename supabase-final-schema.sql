-- FINAL COMPLETE SCHEMA
-- Warning: This resets the lab database tables/types below.
-- Use this for a clean one-paste setup in Supabase SQL Editor.

drop trigger if exists audit_service_requests on service_requests;
drop trigger if exists audit_facilities on facilities;
drop trigger if exists audit_reservations on reservations;
drop trigger if exists reservations_validate_before_write on reservations;
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists audit_logs;
drop table if exists service_requests;
drop table if exists reservations;
drop table if exists facilities;
drop table if exists profiles;

drop function if exists public.write_audit_log();
drop function if exists public.validate_reservation();
drop function if exists public.handle_new_user();
drop function if exists public.is_staff();
drop function if exists public.is_admin();
drop function if exists public.my_role();

drop type if exists service_status;
drop type if exists reservation_status;
drop type if exists facility_status;
drop type if exists account_status;
drop type if exists user_role;

create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'staff', 'requester');
create type account_status as enum ('Active', 'Inactive');
create type facility_status as enum ('Active', 'Maintenance', 'Inactive');
create type reservation_status as enum ('Pending', 'Approved', 'Rejected', 'Scheduled', 'In Use', 'Completed', 'Cancelled');
create type service_status as enum ('Open', 'In Progress', 'Resolved');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'requester',
  status account_status not null default 'Active',
  created_at timestamptz not null default now()
);

create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text not null,
  status facility_status not null default 'Active',
  condition text not null default 'Good',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  requester_id uuid not null references profiles(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  purpose text not null,
  status reservation_status not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  staff_id uuid not null references profiles(id),
  concern text not null,
  status service_status not null default 'Open',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table facilities enable row level security;
alter table reservations enable row level security;
alter table service_requests enable row level security;
alter table audit_logs enable row level security;

create or replace function public.my_role()
returns user_role
language sql
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(my_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(my_role() in ('admin', 'staff'), false);
$$;

create policy "profiles select own staff admin"
on profiles for select
using (id = auth.uid() or is_staff());

create policy "profiles admin manage"
on profiles for all
using (is_admin())
with check (is_admin());

create policy "profiles insert own fallback"
on profiles for insert
with check (id = auth.uid());

create policy "facilities authenticated select"
on facilities for select
using (auth.uid() is not null);

create policy "facilities admin insert"
on facilities for insert
with check (is_admin());

create policy "facilities admin staff update"
on facilities for update
using (is_staff())
with check (is_staff());

create policy "facilities admin delete"
on facilities for delete
using (is_admin());

create policy "reservations select permitted"
on reservations for select
using (requester_id = auth.uid() or is_staff());

create policy "reservations requester insert own"
on reservations for insert
with check (requester_id = auth.uid() and status = 'Pending');

create policy "reservations update permitted"
on reservations for update
using (requester_id = auth.uid() or is_staff())
with check (requester_id = auth.uid() or is_staff());

create policy "service staff manage"
on service_requests for all
using (is_staff())
with check (is_staff());

create policy "audit admin select"
on audit_logs for select
using (is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'requester')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    role = excluded.role;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.validate_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_facility facilities;
  actor_role user_role;
begin
  select * into selected_facility from facilities where id = new.facility_id;
  actor_role := my_role();

  if selected_facility.id is null then
    raise exception 'Facility does not exist.';
  end if;

  if new.start_time >= new.end_time then
    raise exception 'Reservation start must precede end time.';
  end if;

  if selected_facility.status <> 'Active' then
    raise exception 'Only active facilities may be reserved.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'Completed' then
    raise exception 'Completed reservations cannot be edited.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'Rejected' and new.status = 'Scheduled' then
    raise exception 'Rejected reservations cannot become Scheduled.';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'Pending'
    and new.status in ('Approved', 'Rejected', 'Scheduled')
    and actor_role <> 'admin' then
    raise exception 'Only Administrator may approve reservations.';
  end if;

  if tg_op = 'UPDATE' and actor_role = 'requester' then
    if old.requester_id <> auth.uid()
      or old.status <> 'Pending'
      or new.status not in ('Pending', 'Cancelled') then
      raise exception 'Requesters may modify only their own Pending requests.';
    end if;
  end if;

  if new.status in ('Approved', 'Scheduled', 'In Use') and exists (
    select 1
    from reservations r
    where r.id <> new.id
      and r.facility_id = new.facility_id
      and r.status in ('Approved', 'Scheduled', 'In Use')
      and new.start_time < r.end_time
      and new.end_time > r.start_time
  ) then
    raise exception 'Overlapping approved schedules are prohibited.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger reservations_validate_before_write
before insert or update on reservations
for each row execute function public.validate_reservation();

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_id uuid;
begin
  changed_id := coalesce(new.id, old.id);

  insert into audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    changed_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_reservations
after insert or update or delete on reservations
for each row execute function public.write_audit_log();

create trigger audit_facilities
after insert or update or delete on facilities
for each row execute function public.write_audit_log();

create trigger audit_service_requests
after insert or update or delete on service_requests
for each row execute function public.write_audit_log();

insert into profiles (id, full_name, role)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  coalesce((raw_user_meta_data->>'role')::user_role, 'requester')
from auth.users
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role;

insert into facilities (name, location, status, condition)
values
  ('Computer Laboratory', 'Building A', 'Active', 'Good'),
  ('Audio Visual Room', 'Building B', 'Maintenance', 'Projector repair'),
  ('Covered Court', 'Grounds', 'Active', 'Good');
