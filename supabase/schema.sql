create table profiles(id uuid primary key references auth.users on delete cascade, role text not null default 'client' check (role in ('admin','client')), client_id uuid);
create table clients(id uuid primary key default gen_random_uuid(), name text not null, email text, connection_email text, access_created_at timestamptz, password_reset_at timestamptz, created_at timestamptz default now());
create table records(id bigint generated always as identity primary key, client_id uuid not null references clients on delete cascade, kind text not null check (kind in ('months','audience','depenses','actions','strategies','comptes')), data jsonb not null, created_at timestamptz default now());
create table client_messages(id bigint generated always as identity primary key, client_id uuid not null references clients on delete cascade, author_id uuid references auth.users on delete set null, sender text not null default 'client' check (sender in ('client','admin')), channel text not null default 'internal' check (channel in ('internal','email','whatsapp')), subject text not null, message text not null, contact_email text, read_at timestamptz, admin_read_at timestamptz, client_read_at timestamptz, created_at timestamptz not null default now());
alter table profiles enable row level security; alter table clients enable row level security; alter table records enable row level security; alter table client_messages enable row level security;
create function is_admin() returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create function my_client() returns uuid language sql security definer stable set search_path=public as $$ select client_id from profiles where id=auth.uid() $$;
create policy p_sel on profiles for select using (id=auth.uid() or is_admin());
create policy c_adm on clients for all using (is_admin()) with check (is_admin());
create policy c_sel on clients for select using (id=my_client());
create policy r_adm on records for all using (is_admin()) with check (is_admin());
create policy r_sel on records for select using (client_id=my_client());
create policy cm_sel on client_messages for select using (client_id=my_client() or is_admin());
create policy cm_ins on client_messages for insert with check ((client_id=my_client() and sender='client' and channel='internal' and (author_id is null or author_id=auth.uid())) or is_admin());
create policy cm_upd on client_messages for update using (client_id=my_client() or is_admin()) with check (client_id=my_client() or is_admin());
create policy cm_adm on client_messages for all using (is_admin()) with check (is_admin());
create index if not exists client_messages_client_idx on client_messages(client_id, created_at desc);
-- Premier administrateur : créez l'utilisateur dans Authentication > Users, puis :
-- insert into profiles(id,role) select id,'admin' from auth.users where email='VOTRE_EMAIL';
