-- Run after the user-isolation migration. Safe to repeat; no card data changes.
begin;

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

notify pgrst, 'reload schema';
commit;
