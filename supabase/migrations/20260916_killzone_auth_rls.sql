alter table public.accounts add column if not exists auth_user_id uuid unique;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.current_account_id()
returns text language sql stable security definer
set search_path = pg_catalog, public
as $$
  select a.id from public.accounts a where a.auth_user_id = auth.uid() limit 1
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.accounts a where a.auth_user_id = auth.uid() and a.rank in ('admin','developer','co_owner','owner'))
$$;

revoke all on function private.current_account_id() from public;
revoke all on function private.is_staff() from public;
grant execute on function private.current_account_id() to authenticated;
grant execute on function private.is_staff() to authenticated;

drop view if exists public.public_accounts;
create view public.public_accounts as
select id, username, rank, game, photo, team_status, nickname, bio, social, joined_at, staff_tag
from public.accounts;
grant select on public.public_accounts to anon, authenticated;

revoke all on public.accounts from anon, authenticated;
grant select (id,username,rank,game,photo,team_status,nickname,bio,social,joined_at,staff_tag,auth_user_id) on public.accounts to authenticated;
grant update (username,game,photo,nickname,bio,social,rank,team_status,is_admin,staff_permission,staff_tag,joined_at,auth_user_id) on public.accounts to authenticated;
grant delete on public.accounts to authenticated;

alter table public.accounts enable row level security;
drop policy if exists public_delete on public.accounts;
drop policy if exists public_insert on public.accounts;
drop policy if exists public_read on public.accounts;
drop policy if exists public_update on public.accounts;
drop policy if exists accounts_self_update on public.accounts;
drop policy if exists accounts_staff_delete on public.accounts;
create policy accounts_authenticated_read on public.accounts for select to authenticated using (true);
create policy accounts_self_update on public.accounts for update to authenticated using (auth.uid() = auth_user_id or private.is_staff()) with check (auth.uid() = auth_user_id or private.is_staff());
create policy accounts_staff_delete on public.accounts for delete to authenticated using (private.is_staff() or auth.uid() = auth_user_id);

create or replace function private.protect_account_fields()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is not null and not private.is_staff() then
    new.rank := old.rank; new.team_status := old.team_status; new.is_admin := old.is_admin;
    new.staff_permission := old.staff_permission; new.staff_tag := old.staff_tag;
    new.joined_at := old.joined_at; new.auth_user_id := old.auth_user_id;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_account_fields() from public;
grant execute on function private.protect_account_fields() to authenticated;
drop trigger if exists protect_account_fields on public.accounts;
create trigger protect_account_fields before update on public.accounts for each row execute function private.protect_account_fields();

create or replace function private.force_join_request_fields()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if not private.is_staff() then
    if tg_op = 'INSERT' then
      new.account_id := private.current_account_id(); new.status := 'pending'; new.reviewed_at := null; new.reviewed_by := null;
    else
      new.account_id := old.account_id; new.status := old.status; new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists force_join_request_fields on public.team_join_requests;
create trigger force_join_request_fields before insert or update on public.team_join_requests for each row execute function private.force_join_request_fields();

create or replace function private.set_pending_team_status()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.accounts set team_status='pending' where id=new.account_id and team_status in ('none','rejected');
  return new;
end;
$$;
revoke all on function private.set_pending_team_status() from public;
grant execute on function private.set_pending_team_status() to authenticated;
drop trigger if exists set_pending_team_status on public.team_join_requests;
create trigger set_pending_team_status after insert on public.team_join_requests for each row execute function private.set_pending_team_status();

alter table public.achievements enable row level security;
drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read on public.achievements for select to anon,authenticated using (true);
drop policy if exists achievements_staff_insert on public.achievements;
create policy achievements_staff_insert on public.achievements for insert to authenticated with check (private.is_staff());
drop policy if exists achievements_staff_update on public.achievements;
create policy achievements_staff_update on public.achievements for update to authenticated using (private.is_staff()) with check (private.is_staff());
drop policy if exists achievements_staff_delete on public.achievements;
create policy achievements_staff_delete on public.achievements for delete to authenticated using (private.is_staff());

alter table public.announcements enable row level security;
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements for select to anon,authenticated using (true);
drop policy if exists announcements_staff_insert on public.announcements;
create policy announcements_staff_insert on public.announcements for insert to authenticated with check (private.is_staff());
drop policy if exists announcements_staff_update on public.announcements;
create policy announcements_staff_update on public.announcements for update to authenticated using (private.is_staff()) with check (private.is_staff());
drop policy if exists announcements_staff_delete on public.announcements;
create policy announcements_staff_delete on public.announcements for delete to authenticated using (private.is_staff());

alter table public.game_blocks enable row level security;
drop policy if exists game_blocks_public_read on public.game_blocks;
create policy game_blocks_public_read on public.game_blocks for select to anon,authenticated using (true);
drop policy if exists game_blocks_staff_insert on public.game_blocks;
create policy game_blocks_staff_insert on public.game_blocks for insert to authenticated with check (private.is_staff());
drop policy if exists game_blocks_staff_update on public.game_blocks;
create policy game_blocks_staff_update on public.game_blocks for update to authenticated using (private.is_staff()) with check (private.is_staff());
drop policy if exists game_blocks_staff_delete on public.game_blocks;
create policy game_blocks_staff_delete on public.game_blocks for delete to authenticated using (private.is_staff());

alter table public.game_modes enable row level security;
drop policy if exists game_modes_public_read on public.game_modes;
create policy game_modes_public_read on public.game_modes for select to anon,authenticated using (true);
drop policy if exists game_modes_staff_insert on public.game_modes;
create policy game_modes_staff_insert on public.game_modes for insert to authenticated with check (private.is_staff());
drop policy if exists game_modes_staff_update on public.game_modes;
create policy game_modes_staff_update on public.game_modes for update to authenticated using (private.is_staff()) with check (private.is_staff());
drop policy if exists game_modes_staff_delete on public.game_modes;
create policy game_modes_staff_delete on public.game_modes for delete to authenticated using (private.is_staff());

alter table public.chat_messages enable row level security;
drop policy if exists chat_authenticated_read on public.chat_messages;
create policy chat_authenticated_read on public.chat_messages for select to authenticated using (true);
drop policy if exists chat_own_insert on public.chat_messages;
create policy chat_own_insert on public.chat_messages for insert to authenticated with check (author_id = private.current_account_id());
drop policy if exists chat_own_update on public.chat_messages;
create policy chat_own_update on public.chat_messages for update to authenticated using (author_id = private.current_account_id() or private.is_staff()) with check (author_id = private.current_account_id() or private.is_staff());
drop policy if exists chat_own_delete on public.chat_messages;
create policy chat_own_delete on public.chat_messages for delete to authenticated using (author_id = private.current_account_id() or private.is_staff());

alter table public.member_presence enable row level security;
drop policy if exists presence_public_read on public.member_presence;
create policy presence_public_read on public.member_presence for select to anon,authenticated using (true);
drop policy if exists presence_own_insert on public.member_presence;
create policy presence_own_insert on public.member_presence for insert to authenticated with check (account_id = private.current_account_id());
drop policy if exists presence_own_update on public.member_presence;
create policy presence_own_update on public.member_presence for update to authenticated using (account_id = private.current_account_id() or private.is_staff()) with check (account_id = private.current_account_id() or private.is_staff());
drop policy if exists presence_own_delete on public.member_presence;
create policy presence_own_delete on public.member_presence for delete to authenticated using (account_id = private.current_account_id() or private.is_staff());

alter table public.team_join_requests enable row level security;
drop policy if exists join_requests_read_own_or_staff on public.team_join_requests;
create policy join_requests_read_own_or_staff on public.team_join_requests for select to authenticated using (account_id = private.current_account_id() or private.is_staff());
drop policy if exists join_requests_insert_own on public.team_join_requests;
create policy join_requests_insert_own on public.team_join_requests for insert to authenticated with check (account_id = private.current_account_id() and status = 'pending');
drop policy if exists join_requests_update_own_or_staff on public.team_join_requests;
create policy join_requests_update_own_or_staff on public.team_join_requests for update to authenticated using (account_id = private.current_account_id() or private.is_staff()) with check (account_id = private.current_account_id() or private.is_staff());
drop policy if exists join_requests_delete_own_or_staff on public.team_join_requests;
create policy join_requests_delete_own_or_staff on public.team_join_requests for delete to authenticated using (account_id = private.current_account_id() or private.is_staff());

alter table public.team_join_messages enable row level security;
drop policy if exists join_messages_read_own_or_staff on public.team_join_messages;
create policy join_messages_read_own_or_staff on public.team_join_messages for select to authenticated using (account_id = private.current_account_id() or private.is_staff());
drop policy if exists join_messages_insert_own_or_staff on public.team_join_messages;
create policy join_messages_insert_own_or_staff on public.team_join_messages for insert to authenticated with check ((account_id = private.current_account_id() and sender_role='applicant') or (private.is_staff() and sender_role='staff'));
drop policy if exists join_messages_delete_staff on public.team_join_messages;
create policy join_messages_delete_staff on public.team_join_messages for delete to authenticated using (account_id = private.current_account_id() or private.is_staff());

alter table public.zaverk_site_visitors enable row level security;
drop policy if exists visitors_anon_insert on public.zaverk_site_visitors;
create policy visitors_anon_insert on public.zaverk_site_visitors for insert to anon with check (char_length(btrim(name)) between 1 and 80);
drop policy if exists visitors_authenticated_insert on public.zaverk_site_visitors;
create policy visitors_authenticated_insert on public.zaverk_site_visitors for insert to authenticated with check (char_length(btrim(name)) between 1 and 80);

-- Existing public avatar reads remain available; writes are authenticated-only in the application policy.
drop policy if exists avatars_public_insert on storage.objects;
drop policy if exists avatars_public_update on storage.objects;
drop policy if exists avatars_public_delete on storage.objects;
create policy avatars_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id='avatars');
create policy avatars_authenticated_update on storage.objects for update to authenticated using (bucket_id='avatars') with check (bucket_id='avatars');
create policy avatars_authenticated_delete on storage.objects for delete to authenticated using (bucket_id='avatars');
