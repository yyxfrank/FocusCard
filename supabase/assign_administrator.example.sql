-- Run after owner@example.com has registered or been invited.
-- This account owns the legacy decks; RLS still isolates other users.
begin;
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users
  where lower(email) = lower('owner@example.com');
  if owner_id is null then
    raise exception 'Create owner@example.com in Authentication > Users first';
  end if;

  update auth.users set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"administrator"}'::jsonb
  where id = owner_id;

  update public.decks set user_id = owner_id where user_id is null;
  update public.check_ins c set user_id = owner_id
  where c.id in (
    select distinct on (legacy.check_in_date) legacy.id
    from public.check_ins legacy
    where legacy.user_id is null and not exists (
      select 1 from public.check_ins owned
      where owned.user_id = owner_id and owned.check_in_date = legacy.check_in_date
    )
    order by legacy.check_in_date, legacy.id
  );
end $$;
commit;

select d.id, d.name, u.email as owner_email
from public.decks d left join auth.users u on u.id = d.user_id
order by d.created_at;
