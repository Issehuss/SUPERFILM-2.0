import supabase from '../supabaseClient.js';


/**
 * Nominate a movie as "next screening" for a club.
 * Returns { ok: true } if inserted or already existed.
 */
export async function nominateMovie({ clubId, userId, movie }) {
  // Fallback to local storage if missing pieces
  if (!supabase || !clubId || !userId) {
    const key = `nominations:${clubId || 'no-club'}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    if (!current.find(n => String(n.movie_id) === String(movie.id))) {
      current.unshift({
        movie_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(current));
    }
    return { ok: true, fallback: true };
  }

  // Try insert; ignore if duplicate (unique constraint)
  const { error } = await supabase
    .from('event_nominations')
    .upsert(
      [{
        club_id: clubId,
        user_id: userId,
        movie_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
      }],
      { onConflict: 'club_id,movie_id', ignoreDuplicates: true }
    );

  if (error) return { ok: false, error };
  return { ok: true };
}
