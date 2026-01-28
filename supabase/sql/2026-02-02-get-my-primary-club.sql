-- Recreate get_my_primary_club to avoid joins inside a SECURITY DEFINER RPC.
create or replace function public.get_my_primary_club()
returns public.clubs_public
language sql security definer
as
$$
  select c.*
  from public.clubs_public c
  where c.id = (
    select club_id
    from public.club_members
    where user_id = auth.uid()
      and accepted is true
    order by joined_at desc
    limit 1
  )
  limit 1;
$$;
