-- Enable signed-in users to read every club's member list via Supabase RLS.
-- Run this in the Supabase SQL editor (or via `supabase db query`).

alter table public.club_members enable row level security;

drop policy if exists "must be authenticated to read club members" on public.club_members;

create policy "authenticated members list is public" on public.club_members
  for select
  to authenticated
  using (true);

comment on policy "authenticated members list is public" on public.club_members is
  'Allows any signed-in user to read club member rows for transparency while leaving other operations unchanged.';
