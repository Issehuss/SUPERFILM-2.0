-- Enforce moodboard tile limits server-side (mirrors frontend entitlements)
-- Free: 6 tiles, Directors Cut: 120 tiles

create or replace function public.enforce_moodboard_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_premium boolean;
  tile_count integer;
  limit_count integer;
begin
  -- Only enforce on moodboard updates
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  -- If moodboard unchanged, skip
  if NEW.moodboard is null then
    return NEW;
  end if;

  is_premium := coalesce(NEW.is_premium, false) or lower(coalesce(NEW.plan, '')) = 'directors_cut';

  if jsonb_typeof(NEW.moodboard) = 'array' then
    tile_count := jsonb_array_length(NEW.moodboard);
  else
    tile_count := 0;
  end if;

  limit_count := case when is_premium then 120 else 6 end;

  if tile_count > limit_count then
    raise exception 'Moodboard tile limit exceeded (limit %, got %)', limit_count, tile_count
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_moodboard_limit on public.profiles;

create trigger trg_enforce_moodboard_limit
before update of moodboard on public.profiles
for each row
execute function public.enforce_moodboard_limit();
