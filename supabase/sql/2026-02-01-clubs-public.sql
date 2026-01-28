-- Define a richer public-facing view for clubs so the client can render the
-- “club cards” without hitting repeated 400s when extra metadata is requested.
--
-- This view assumes there is a base `public.clubs` table and a `public.club_members`
-- table with a `club_id` FK and an `accepted` flag (both already present in the
-- app). Adjust the column names/expressions below if your actual schema differs.

create or replace view public.clubs_public
as
with member_counts as (
  select
    club_id,
    count(*) filter (where accepted is true) as member_count
  from public.club_members
  group by club_id
)
select
  c.id,
  c.slug,
  c.name,
  c.tagline,
  c.about,
  c.location,
  c.visibility,
  c.privacy_mode,
  c.type,
  c.created_at,
  c.profile_image_url,
  c.banner_url,
  c.summary,
  c.is_new,
  c.active_this_week,
  c.live_soon,
  c.join_policy,
  c.is_private,
  c.featured_posters,
  to_jsonb(c.genres) as genres,
  to_jsonb(c.genre_focus) as genre_focus,
  coalesce(mem.member_count, 0) as members,
  jsonb_build_object(
    'genres', to_jsonb(c.genres),
    'genre_focus', to_jsonb(c.genre_focus),
    'members', coalesce(mem.member_count, 0),
    'summary', c.summary,
    'location', c.location,
    'visibility', c.visibility,
    'privacy_mode', c.privacy_mode,
    'type', c.type,
    'join_policy', c.join_policy,
    'is_new', c.is_new,
    'active_this_week', c.active_this_week,
    'live_soon', c.live_soon
  ) as meta
from public.clubs c
left join member_counts mem on mem.club_id = c.id
where c.visibility = 'public'
  and (c.deleted_at is null or c.deleted_at is not true);
