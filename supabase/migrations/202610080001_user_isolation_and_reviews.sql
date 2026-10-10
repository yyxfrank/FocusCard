begin;

-- Existing installations already contain these tables. Fresh installations
-- can also apply this migration. Legacy rows remain unassigned until an
-- administrator explicitly assigns them to an auth user.
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  daily_review_limit integer not null default 50,
  created_at timestamptz not null default now()
);
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  front text not null,
  back text not null,
  interval_days integer not null default 0,
  ease_factor double precision not null default 2.5,
  next_review timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  check_in_date date not null,
  created_at timestamptz not null default now()
);
alter table public.decks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.decks alter column user_id set default auth.uid();
alter table public.check_ins add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.check_ins alter column user_id set default auth.uid();

-- Old single-user schemas sometimes impose a global date uniqueness rule.
-- Replace only unique constraints/indexes on check_in_date alone.
do $$
declare item record;
begin
  for item in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attname = 'check_in_date'
    where c.conrelid = 'public.check_ins'::regclass and c.contype = 'u'
      and c.conkey = array[a.attnum]::smallint[]
  loop
    execute format('alter table public.check_ins drop constraint %I', item.conname);
  end loop;
  for item in
    select i.indexrelid::regclass as index_name from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attname = 'check_in_date'
    where i.indrelid = 'public.check_ins'::regclass and i.indisunique
      and not i.indisprimary and i.indnatts = 1 and i.indkey[0] = a.attnum
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
  loop
    execute format('drop index %s', item.index_name);
  end loop;
end $$;
create unique index if not exists check_ins_user_day on public.check_ins(user_id, check_in_date);
create index if not exists decks_user_id on public.decks(user_id);
create index if not exists cards_deck_due on public.cards(deck_id, next_review);

create table if not exists public.review_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  review_date date not null default ((now() at time zone 'UTC')::date),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id, review_date)
);
create index if not exists review_events_daily on public.review_events(user_id, deck_id, review_date);

-- Permissive policies combine with OR, so old public-access policies must
-- be removed rather than left alongside the ownership policies.
do $$
declare item record;
begin
  for item in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('decks', 'cards', 'check_ins', 'review_events')
  loop
    execute format('drop policy %I on public.%I', item.policyname, item.tablename);
  end loop;
end $$;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.check_ins enable row level security;
alter table public.review_events enable row level security;
revoke all on public.decks, public.cards, public.check_ins, public.review_events from anon;
grant select, insert, update, delete on public.decks, public.cards, public.check_ins to authenticated;
revoke all on public.review_events from authenticated;
grant select on public.review_events to authenticated;

create policy decks_owner on public.decks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cards_owner on public.cards for all to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));
create policy check_ins_owner on public.check_ins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy review_events_owner on public.review_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Lock the deck before counting so concurrent devices cannot both consume
-- the last available daily slot. Progress and the event commit together.
create or replace function public.record_review(
  p_card_id uuid, p_interval_days integer, p_ease_factor double precision,
  p_next_review timestamptz
) returns public.cards
language plpgsql security definer set search_path = '' as $$
declare
  card public.cards;
  daily_limit integer;
  reviewed integer;
  review_day date := (now() at time zone 'UTC')::date;
begin
  if auth.uid() is null then raise exception 'Sign in to review cards'; end if;
  select c.* into card from public.cards c join public.decks d on d.id = c.deck_id
    where c.id = p_card_id and d.user_id = auth.uid();
  if not found then raise exception 'Card not found'; end if;
  select d.daily_review_limit into daily_limit from public.decks d
    where d.id = card.deck_id and d.user_id = auth.uid() for update;
  if not found then raise exception 'Deck not found'; end if;
  -- Recheck after the deck lock, including concurrent card deletion/movement.
  select c.* into card from public.cards c
    where c.id = p_card_id and c.deck_id = card.deck_id for update;
  if not found then raise exception 'Card changed; reload the session'; end if;
  if exists (select 1 from public.review_events r where r.user_id = auth.uid()
    and r.card_id = p_card_id and r.review_date = review_day) then
    return card;
  end if;
  select count(*) into reviewed from public.review_events r
    where r.user_id = auth.uid() and r.deck_id = card.deck_id and r.review_date = review_day;
  if reviewed >= daily_limit then raise exception 'Daily review limit reached. Return home and start again tomorrow.'; end if;
  if p_interval_days < 1 or p_interval_days is null or p_ease_factor < 1.3
    or p_ease_factor is null or p_next_review is null or p_next_review <= now() then
    raise exception 'Invalid review state';
  end if;
  insert into public.review_events(user_id, card_id, deck_id, review_date)
    values (auth.uid(), card.id, card.deck_id, review_day);
  update public.cards set interval_days = p_interval_days, ease_factor = p_ease_factor,
    next_review = p_next_review where id = card.id returning * into card;
  return card;
end $$;
revoke all on function public.record_review(uuid, integer, double precision, timestamptz) from public;
grant execute on function public.record_review(uuid, integer, double precision, timestamptz) to authenticated;

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['decks', 'cards', 'check_ins'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.get_due_counts()
returns table(deck_id uuid, due_count bigint)
language sql stable security invoker set search_path = '' as $$
  select c.deck_id, count(*) from public.cards c
  join public.decks d on d.id = c.deck_id
  where d.user_id = auth.uid() and c.next_review <= now()
  group by c.deck_id
$$;
revoke all on function public.get_due_counts() from public;
grant execute on function public.get_due_counts() to authenticated;

create or replace function public.get_daily_review_count(p_deck_id uuid)
returns bigint language sql stable security invoker set search_path = '' as $$
  select count(*) from public.review_events r where r.deck_id = p_deck_id
    and r.user_id = auth.uid() and r.review_date = (now() at time zone 'UTC')::date
$$;
revoke all on function public.get_daily_review_count(uuid) from public;
grant execute on function public.get_daily_review_count(uuid) to authenticated;
commit;
