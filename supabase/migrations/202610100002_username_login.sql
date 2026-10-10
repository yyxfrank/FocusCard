begin;

create table if not exists public.account_usernames (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,32}$')
);
alter table public.account_usernames enable row level security;
revoke all on public.account_usernames from anon, authenticated;
grant select on public.account_usernames to authenticated;
grant all on public.account_usernames to service_role;
drop policy if exists read_own_username on public.account_usernames;
create policy read_own_username on public.account_usernames for select to authenticated
  using (user_id = auth.uid());

-- Existing accounts receive stable temporary names; operators can rename them.
insert into public.account_usernames(user_id, username)
select id, 'user_' || substr(replace(id::text, '-', ''), 1, 27) from auth.users
on conflict (user_id) do nothing;

create or replace function public.register_account_username()
returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen text;
begin
  chosen := lower(trim(new.raw_user_meta_data ->> 'username'));
  if chosen is null or chosen !~ '^[a-z0-9_]{3,32}$' or chosen like 'user\_%' escape '\' then
    raise exception 'Username must be 3-32 letters, digits or underscores; user_ is reserved';
  end if;
  insert into public.account_usernames(user_id, username) values (new.id, chosen);
  return new;
end $$;
revoke all on function public.register_account_username() from public, anon, authenticated;
drop trigger if exists register_account_username on auth.users;
create trigger register_account_username after insert on auth.users
  for each row execute function public.register_account_username();

create table if not exists public.username_login_attempts (
  username text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table public.username_login_attempts enable row level security;
revoke all on public.username_login_attempts from anon, authenticated;

create or replace function public.consume_username_login_attempt(p_username text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  -- Bound storage to active rate-limit windows, including unknown usernames.
  delete from public.username_login_attempts where window_start < now() - interval '5 minutes';
  insert into public.username_login_attempts(username, window_start, attempts)
  values (p_username, now(), 1)
  on conflict (username) do update set attempts = public.username_login_attempts.attempts + 1
  returning attempts into used;
  return used <= 10;
end $$;
revoke all on function public.consume_username_login_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_username_login_attempt(text) to service_role;

notify pgrst, 'reload schema';
commit;
