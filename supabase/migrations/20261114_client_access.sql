alter table clients add column if not exists connection_email text;
alter table clients add column if not exists access_created_at timestamptz;
alter table clients add column if not exists password_reset_at timestamptz;

update clients set connection_email = email where connection_email is null and email is not null;

create unique index if not exists clients_connection_email_key on clients (lower(connection_email)) where connection_email is not null;

alter table clients drop constraint if exists clients_email_not_blank;
alter table clients add constraint clients_email_not_blank check (connection_email is null or length(btrim(connection_email)) > 0);

create or replace function is_admin() returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

revoke all on function is_admin() from public;
revoke all on function my_client() from public;
grant execute on function is_admin() to authenticated;
grant execute on function my_client() to authenticated;
