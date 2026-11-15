-- Migration additive : n'écrase aucune donnée existante.
-- 1) Autorise le nouveau type d'enregistrement "strategies" dans records.
alter table records drop constraint if exists records_kind_check;
alter table records add constraint records_kind_check check (kind in ('months','audience','depenses','actions','strategies','comptes'));

-- 2) Messagerie interne client <-> agence.
create table if not exists client_messages(
  id bigint generated always as identity primary key,
  client_id uuid not null references clients on delete cascade,
  author_id uuid references auth.users on delete set null,
  sender text not null default 'client' check (sender in ('client','admin')),
  channel text not null default 'internal' check (channel in ('internal','email','whatsapp')),
  subject text not null,
  message text not null,
  contact_email text,
  read_at timestamptz,
  admin_read_at timestamptz,
  client_read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table client_messages enable row level security;

drop policy if exists cm_sel on client_messages;
create policy cm_sel on client_messages for select using (client_id=my_client() or is_admin());

drop policy if exists cm_ins on client_messages;
create policy cm_ins on client_messages for insert with check (
  (client_id=my_client() and sender='client' and channel='internal' and (author_id is null or author_id=auth.uid()))
  or is_admin()
);

drop policy if exists cm_adm on client_messages;
create policy cm_adm on client_messages for all using (is_admin()) with check (is_admin());

create index if not exists client_messages_client_idx on client_messages(client_id, created_at desc);
grant select, insert, update, delete on client_messages to authenticated;
