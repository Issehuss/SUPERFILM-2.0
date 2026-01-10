// src/pages/EventAttendance.jsx
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Users, ArrowLeft } from "lucide-react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

const AVATAR_FALLBACK = "/avatar_placeholder.png";

function fmt(dt) {
  try {
    return new Date(dt).toLocaleString([], { dateStyle: "full", timeStyle: "short" });
  } catch {
    return dt;
  }
}

export default function EventAttendance() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clubId: pathClubId } = useParams();
  const { user } = useUser();

  const state = location.state || {};
  const clubName = state.clubName || "Unknown Club";
  const clubId = state.clubId || pathClubId || null;

  const initialEvent = state.event || null;
  const [event, setEvent] = useState(initialEvent);
  const [screeningId, setScreeningId] = useState(
    initialEvent?.screening_id || initialEvent?.event_id || null
  );

  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [attendees, setAttendees] = useState([]); // [{id,name,avatar,slug}]
  const [isGoing, setIsGoing] = useState(false);
  const [busy, setBusy] = useState(false);

  const eventDateISO = event?.date || event?.starts_at || null;

  // Permission check (pres/VP/admin/mod/partner)
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        if (!user?.id || !clubId) { on && setCanCreate(false); return; }
        const allow = (r) =>
          ["president", "vice_president", "vice", "admin", "moderator", "partner"].includes(
            String(r || "").toLowerCase()
          );

        let ok = false;

        const { data: staffRow } = await supabase
          .from("club_staff")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (allow(staffRow?.role)) ok = true;

        if (!ok) {
          const { data: pr } = await supabase
            .from("profile_roles")
            .select("roles")
            .eq("club_id", clubId)
            .eq("user_id", user.id)
            .maybeSingle();

          let roles = [];
          const raw = pr?.roles;
          if (Array.isArray(raw)) roles = raw;
          else if (raw && typeof raw === "object" && Array.isArray(raw.roles)) roles = raw.roles;
          else if (typeof raw === "string") roles = raw.split(/[, ]+/).filter(Boolean);

          ok = roles.some(allow);
        }

        on && setCanCreate(ok);
      } catch {
        on && setCanCreate(false);
      }
    })();
    return () => { on = false; };
  }, [user?.id, clubId]);

  // Resolve screening_id (from time or next upcoming)
  useEffect(() => {
    let on = true;
    (async () => {
      if (!clubId) { setLoading(false); return; }
      setLoading(true);

      try {
        if (screeningId) { setLoading(false); return; }

        let resolved = null;

        // Try RPC by time
        if (eventDateISO) {
          try {
            const { data: byTime } = await supabase.rpc("find_screening_by_time", {
              p_club_id: clubId,
              p_target: new Date(eventDateISO).toISOString(),
              p_window_minutes: 180
            });
            if (Array.isArray(byTime) && byTime.length) resolved = byTime[0].id;
          } catch { /* ignore */ }
        }

        // Fallback to next upcoming screening
        if (!resolved) {
          const { data: next } = await supabase
            .from("screenings")
            .select("id, title, starts_at, location")
            .eq("club_id", clubId)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(1);
          if (next?.[0]) {
            resolved = next[0].id;
            if (!event) {
              setEvent({
                title: next[0].title || "Screening",
                date: next[0].starts_at,
                location: next[0].location || ""
              });
            }
          }
        }

        on && setScreeningId(resolved);
      } finally {
        on && setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, eventDateISO]);


  async function ensureScreening() {
    if (screeningId) return screeningId;
    if (!canCreate) return null;

    const { data: c } = await supabase
      .from("clubs")
      .select("next_screening_title, next_screening_at, next_screening_location")
      .eq("id", clubId)
      .maybeSingle();

    if (!c?.next_screening_title || !c?.next_screening_at) return null;

    const payload = {
      club_id: clubId,
      title: c.next_screening_title,
      starts_at: c.next_screening_at,
      location: c.next_screening_location || null
    };

    const { data: ins, error } = await supabase
      .from("screenings")
      .insert(payload)
      .select("id, title, starts_at, location")
      .single();
    if (error) throw error;

    setEvent((prev) => prev || {
      title: ins.title,
      date: ins.starts_at,
      location: ins.location || ""
    });
    setScreeningId(ins.id);
    return ins.id;
  }

  // Load attendees (2-step: attendance → profiles)
  useEffect(() => {
    let on = true;

    async function load() {
      if (!clubId || !screeningId) return;

      const { data: rows, error } = await supabase
        .from("event_attendance")
        .select("user_id")
        .eq("club_id", clubId)
        .eq("screening_id", screeningId);

      if (error) { if (on) setAttendees([]); return; }

      const ids = Array.from(new Set((rows || []).map(r => r.user_id))).filter(Boolean);
      if (ids.length === 0) { if (on) { setAttendees([]); setIsGoing(false); } return; }

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, slug")
        .in("id", ids);

      const mapped = ids.map((id) => {
        const p = (profs || []).find(pr => pr.id === id);
        return {
          id,
          name: p?.display_name || "Member",
          avatar: p?.avatar_url || AVATAR_FALLBACK,
          slug: p?.slug || null
        };
      });

      if (on) {
        setAttendees(mapped);
        setIsGoing(ids.includes(user?.id || "__"));
      }
    }

    load();

    // (Optional) live updates
    const ch = (clubId && screeningId)
      ? supabase
          .channel(`attend:${clubId}:${screeningId}`)
          .on("postgres_changes",
            { event: "*", schema: "public", table: "event_attendance",
              filter: `club_id=eq.${clubId},screening_id=eq.${screeningId}` },
            load
          )
          .subscribe()
      : null;

    return () => {
      on = false;
      if (ch) supabase.removeChannel(ch);
    };
  }, [clubId, screeningId, user?.id]);

  // Toggle RSVP using screening_id and show real avatar for current user
  async function toggleAttendance() {
    if (!user?.id) { navigate("/auth"); return; }
    setBusy(true);
    try {
      let sid = screeningId;
      if (!sid) {
        sid = await ensureScreening();
        if (!sid) {
          return;
        }
      }

      if (!isGoing) {
        const { error } = await supabase
          .from("event_attendance")
          .insert({ club_id: clubId, screening_id: sid, user_id: user.id });
        if (error && error.code !== "23505") throw error;

        // Fetch your profile so the correct avatar shows immediately
        const { data: me } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, slug")
          .eq("id", user.id)
          .maybeSingle();

        setIsGoing(true);
        setAttendees(prev => {
          const already = prev.some(p => p.id === user.id);
          if (already) return prev;
          return [
            ...prev,
            {
              id: user.id,
              name: me?.display_name || "You",
              avatar: me?.avatar_url || AVATAR_FALLBACK,
              slug: me?.slug || null
            }
          ];
        });
      } else {
        const { error } = await supabase
          .from("event_attendance")
          .delete()
          .eq("club_id", clubId)
          .eq("screening_id", sid)
          .eq("user_id", user.id);
        if (error) throw error;

        setIsGoing(false);
        setAttendees(prev => prev.filter(p => p.id !== user.id));
      }
    } catch (e) {
      alert(e.message || "Couldn’t update attendance.");
    } finally {
      setBusy(false);
    }
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-yellow-400 hover:text-yellow-300 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <p className="text-red-400 font-semibold mb-4">Event details not available.</p>
        {clubId && (
          <a href={`/clubs/${clubId}`} className="text-yellow-400 underline hover:text-yellow-300">
            Go back to {clubName}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-yellow-400 hover:text-yellow-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Club
      </button>

      <h1 className="text-3xl font-bold mb-2">{event.title || "Screening"}</h1>
      <p className="text-zinc-400">
        {clubName} — {fmt(event.date)}
        {event.location ? ` — ${event.location}` : ""}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Users className="w-5 h-5 text-yellow-400" />
        <span>{attendees.length} member{attendees.length === 1 ? "" : "s"} attending</span>
      </div>

      <button
        onClick={toggleAttendance}
        disabled={busy || loading || (!screeningId && !canCreate)}
        className={`mt-4 px-4 py-2 rounded-lg font-semibold ${
          isGoing ? "bg-red-500 hover:bg-red-400" : "bg-yellow-500 hover:bg-yellow-400"
        } disabled:opacity-60`}
      >
        {isGoing ? "Leave Attendance" : "Join Attendance"}
      </button>

      {!loading && !screeningId && (
        <p className="mt-3 text-sm text-zinc-400">
          Attendance opens once a screening is scheduled.
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {attendees.map((person) => {
          const href = person.slug ? `/u/${person.slug}` : person.id ? `/profile/${person.id}` : "#";
          return (
            <a key={person.id} href={href} className="text-center">
              <img
                src={person.avatar || AVATAR_FALLBACK}
                alt={person.name}
                className="w-16 h-16 rounded-full mx-auto border-2 border-yellow-500 object-cover"
                onError={(e) => { e.currentTarget.src = AVATAR_FALLBACK; }}
              />
              <p className="mt-2 text-sm truncate">{person.name}</p>
            </a>
          );
        })}
      </div>

      {clubId && (
        <div className="mt-6">
          <a
            href={`/clubs/${clubId}`}
            className="text-zinc-400 text-xs underline hover:text-yellow-400"
          >
            Go to club page
          </a>
        </div>
      )}
    </div>
  );
}
