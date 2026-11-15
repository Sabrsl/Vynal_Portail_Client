-- Suivi des messages non lus par destinataire.
alter table client_messages add column if not exists admin_read_at timestamptz;
alter table client_messages add column if not exists client_read_at timestamptz;

update client_messages
set admin_read_at = coalesce(read_at, admin_read_at)
where sender = 'client' and admin_read_at is null;

update client_messages
set client_read_at = coalesce(read_at, client_read_at)
where sender = 'admin' and client_read_at is null;

drop policy if exists cm_upd on client_messages;
create policy cm_upd on client_messages for update
  using (client_id = my_client() or is_admin())
  with check (client_id = my_client() or is_admin());
