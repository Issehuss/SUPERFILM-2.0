import { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
import { useUser } from '../context/UserContext';

export default function useMyClubs() {
  const { user } = useUser();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id) { setClubs([]); setLoading(false); return; }
      setLoading(true);
      setError(null);

      // Join memberships -> clubs; alias nested select as "club"
      const { data, error } = await supabase
        .from('club_members')
        .select(`
          role,
          club:clubs (
            id, slug, name, profile_image_url, banner_url,
            next_screening_at, next_screening_title, next_screening_location
          )
        `)
        .eq('user_id', user.id);

      if (!active) return;
      if (error) { setError(error); setLoading(false); return; }

      // Flatten and filter out null joins (shouldn’t happen but safe)
      setClubs((data || [])
        .map(row => ({ role: row.role, ...(row.club || {}) }))
        .filter(c => c.id));
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [user?.id]);

  return { clubs, loading, error };
}
