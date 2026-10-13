-- Apply after the ownership and username migrations. Read-only account summary.
begin;

create or replace function public.get_account_overview(p_tomorrow_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare overview jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view your account'; end if;
  if p_tomorrow_end is null then raise exception 'A review cutoff is required'; end if;

  select jsonb_build_object(
    'username', (select u.username from public.account_usernames u where u.user_id = auth.uid()),
    'decks', coalesce((
      select jsonb_agg(to_jsonb(stats) order by stats.created_at desc, stats.id)
      from (
        select d.id, d.name, d.created_at, d.daily_review_limit,
          count(c.id) as card_count,
          count(c.id) filter (where c.next_review <= now()) as due_count,
          count(c.id) filter (where c.next_review < p_tomorrow_end) as tomorrow_due_count
        from public.decks d left join public.cards c on c.deck_id = d.id
        where d.user_id = auth.uid()
        group by d.id
      ) stats
    ), '[]'::jsonb),
    'check_in_dates', coalesce((
      select jsonb_agg(jsonb_build_object('check_in_date', c.check_in_date) order by c.check_in_date desc)
      from public.check_ins c where c.user_id = auth.uid()
    ), '[]'::jsonb)
  ) into overview;
  return overview;
end $$;

revoke all on function public.get_account_overview(timestamptz) from public, anon;
grant execute on function public.get_account_overview(timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
