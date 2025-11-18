// src/pages/EventDetails.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function EventDetails() {
  const { slug } = useParams();
  const { user, profile } = useUser();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Manage menu + unpublish modal
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // RSVP state
  const [rsvps, setRsvps] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(true);
  const [isGoing, setIsGoing] = useState(false);

  /* ===================== Load Event ===================== */
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) console.error("[EventDetails] Fetch error", error);
      setEvent(data);
      setLoading(false);
    }
    load();
  }, [slug]);

  const isCreator = !!(user?.id && event?.created_by === user.id);

  /* ===================== Load RSVPs ===================== */
  useEffect(() => {
    if (!event || !user?.id) {
      // If not logged in, we still want isGoing=false and no list
      setIsGoing(false);
      setRsvps([]);
      setRsvpLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRsvps() {
      setRsvpLoading(true);
      try {
        const { data, error } = await supabase
          .from("event_rsvps")
          .select("event_id, user_id, created_at")
          .eq("event_id", event.id);

        if (error) throw error;
        if (cancelled) return;

        const rows = data || [];

        // Is the current user going?
        const going = rows.some((r) => r.user_id === user.id);
        setIsGoing(going);

        // Only build full attendee list if this user created the event
        if (!isCreator || rows.length === 0) {
          setRsvps([]);
          return;
        }

        const ids = rows.map((r) => r.user_id);

        // Profiles
        const { data: profilesData, error: pErr } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ids);

        if (pErr) throw pErr;

        // Roles in this club (if club_id exists)
        let rolesByUser = {};
        if (event.club_id) {
          const { data: rolesData, error: rErr } = await supabase
            .from("club_members")
            .select("user_id, role, club_id")
            .eq("club_id", event.club_id)
            .in("user_id", ids);

          if (!rErr && rolesData) {
            rolesByUser = rolesData.reduce((acc, row) => {
              acc[row.user_id] = row.role;
              return acc;
            }, {});
          }
        }

        const profileById = {};
        (profilesData || []).forEach((p) => {
          profileById[p.id] = p;
        });

        const enriched = rows.map((r) => {
          const p = profileById[r.user_id] || {};
          return {
            user_id: r.user_id,
            created_at: r.created_at,
            name: p.display_name || "Member",
            avatar_url: p.avatar_url || null,
            role: rolesByUser[r.user_id] || null,
          };
        });

        setRsvps(enriched);
      } catch (err) {
        console.error("[EventDetails] RSVP load error", err);
        if (!cancelled) {
          setRsvps([]);
        }
      } finally {
        if (!cancelled) setRsvpLoading(false);
      }
    }

    loadRsvps();
    return () => {
      cancelled = true;
    };
  }, [event, user?.id, isCreator]);

  /* ===================== Unpublish Logic ===================== */
  async function handleUnpublish() {
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;

      setConfirmOpen(false);
      navigate("/events", { replace: true });
    } catch (e) {
      console.error("[Unpublish Event Error]", e);
      alert("Could not unpublish event. Please try again.");
    }
  }

  /* ===================== RSVP Toggle ===================== */
  async function handleToggleRsvp() {
    if (!user?.id) {
      navigate("/auth", {
        replace: true,
        state: { from: `/events/${slug}` },
      });
      return;
    }

    try {
      if (isGoing) {
        // Cancel RSVP
        const { error } = await supabase
          .from("event_rsvps")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", user.id);

        if (error) throw error;

        setIsGoing(false);
        if (isCreator) {
          setRsvps((prev) => prev.filter((r) => r.user_id !== user.id));
        }
      } else {
        // Mark as going
        const { error } = await supabase
          .from("event_rsvps")
          .insert({
            event_id: event.id,
            user_id: user.id,
            status: "going",
          });

        if (error) throw error;

        setIsGoing(true);

        // If creator is viewing their own event, add themselves to the list
        if (isCreator) {
          setRsvps((prev) => {
            if (prev.some((r) => r.user_id === user.id)) return prev;
            return [
              ...prev,
              {
                user_id: user.id,
                created_at: new Date().toISOString(),
                name: profile?.display_name || "You",
                avatar_url: profile?.avatar_url || null,
                role: null,
              },
            ];
          });
        }

// Notify the event creator if someone RSVPs (and they are not the creator)
if (event.created_by && event.created_by !== user.id) {
  try {
    await supabase.from("notifications").insert({
      user_id: event.created_by,   // who receives it
      actor_id: user.id,           // who RSVPed
      type: "event_rsvp",
      club_id: event.club_id || null,
      data: {
        event_id: event.id,
        event_title: event.title,
        event_slug: event.slug,
      },
    });
  } catch (notifyErr) {
    console.warn("[EventDetails] RSVP notify error", notifyErr);
  }
}


      }
    } catch (err) {
      console.error("[EventDetails] RSVP toggle error", err);
      alert("Could not update RSVP. Please try again.");
    }
  }

  /* ===================== UI Loading / Not Found ===================== */
  if (loading) {
    return (
      <div className="p-10 text-zinc-400 text-center">Loading event…</div>
    );
  }

  if (!event) {
    return (
      <div className="p-10 text-zinc-400 text-center">
        Event not found.
        <Link to="/events" className="text-yellow-400 underline ml-2">
          Go back
        </Link>
      </div>
    );
  }

  const dateObj = event.date ? new Date(event.date) : null;

  /* ===================== MAIN PAGE ===================== */
  return (
    <div className="relative min-h-screen w-full text-white">
      {/* ===== Cinematic Backdrop ===== */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${event.poster_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(20px) brightness(0.35)",
        }}
      />

      {/* Film Grain */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
        }}
      />

      {/* ===== CONTENT WRAPPER ===== */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* ===== Poster + Title Section ===== */}
        <div className="flex flex-col md:flex-row gap-10 items-start">
          {/* Poster */}
          <img
            src={event.poster_url}
            alt={event.title}
            className="w-64 h-auto rounded-xl shadow-2xl"
            style={{
              boxShadow:
                "0 0 35px rgba(255, 225, 0, 0.25), 0 0 65px rgba(255, 225, 0, 0.12)",
            }}
          />

          {/* RIGHT SIDE */}
          <div className="flex-1">
            {/* Title + Manage */}
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight mb-3">
                {event.title}
              </h1>

              {/* Manage Menu (creator only) */}
              {isCreator && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="
                      p-2 rounded-xl bg-black/40 border border-white/10
                      hover:bg-black/60 transition shadow-lg backdrop-blur
                    "
                  >
                    ⋮
                  </button>

                  {menuOpen && (
                    <div
                      className="
                        absolute right-0 mt-2 w-48 rounded-xl 
                        bg-black/70 border border-white/10 
                        shadow-xl backdrop-blur-xl z-20
                      "
                    >
                      <div className="px-4 py-2 text-zinc-300 border-b border-white/10">
                        Manage Event
                      </div>

                      <button
                        className="
                          w-full text-left px-4 py-2 text-red-400
                          hover:bg-red-400/10 transition
                        "
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmOpen(true);
                        }}
                      >
                        Unpublish Event?
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="space-y-1 text-zinc-300 text-lg">
              {event.club_name && (
                <div>
                  Hosted by{" "}
                  <span className="text-yellow-400">{event.club_name}</span>
                </div>
              )}

              {dateObj && (
                <div>
                  {dateObj.toLocaleDateString()} •{" "}
                  {dateObj.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}

              {event.venue && (
                <div>
                  Venue: <span className="text-zinc-200">{event.venue}</span>
                </div>
              )}
            </div>

            {/* Summary */}
            {event.summary && (
              <p className="mt-5 text-zinc-300 leading-relaxed max-w-xl">
                {event.summary}
              </p>
            )}

            {/* Tags */}
            {event.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {event.tags.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 bg-zinc-800/70 border border-white/10 rounded-full text-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* RSVP Button */}
            <div className="mt-6">
              {user ? (
                <button
                  onClick={handleToggleRsvp}
                  disabled={rsvpLoading}
                  className={[
                    "px-4 py-2 rounded-full font-semibold transition",
                    isGoing
                      ? "bg-yellow-400 text-black hover:bg-yellow-300"
                      : "bg-black/40 border border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/10",
                  ].join(" ")}
                >
                  {isGoing ? "Going ✓" : "RSVP: Going?"}
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-4 py-2 rounded-full border border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/10 transition inline-block"
                >
                  Sign in to RSVP
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ===== Divider ===== */}
        <div className="my-10 border-t border-white/10" />

        {/* ===== Event Details Box ===== */}
        <div className="bg-black/40 border border-white/10 backdrop-blur rounded-2xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Event Information</h2>

          <div className="grid md:grid-cols-2 gap-6 text-zinc-300">
            {event.details?.capacity && (
              <div>
                <span className="text-zinc-400">Capacity:</span>&nbsp;
                {event.details.capacity}
              </div>
            )}
            {event.details?.price && (
              <div>
                <span className="text-zinc-400">Price:</span>&nbsp;
                {event.details.price}
              </div>
            )}
            {event.details?.hosts?.length > 0 && (
              <div>
                <span className="text-zinc-400">Hosts:</span>&nbsp;
                {event.details.hosts.join(", ")}
              </div>
            )}
            {event.details?.ageRating && (
              <div>
                <span className="text-zinc-400">Age Rating:</span>&nbsp;
                {event.details.ageRating}
              </div>
            )}
            {event.details?.contactEmail && (
              <div>
                <span className="text-zinc-400">Contact:</span>&nbsp;
                {event.details.contactEmail}
              </div>
            )}
            {event.details?.accessibility && (
              <div className="md:col-span-2">
                <span className="text-zinc-400">Accessibility:</span>&nbsp;
                {event.details.accessibility}
              </div>
            )}
          </div>
        </div>

   {/* ===== Attendees (creator only) ===== */}
{isCreator && (
  <div className="mt-10 bg-black/40 border border-white/10 backdrop-blur rounded-2xl p-6 shadow-lg">
    <h2 className="text-2xl font-semibold mb-4">
      Attendees
      {rsvps.length > 0 && (
        <span className="text-sm text-zinc-400 ml-2">
          • {rsvps.length} going
        </span>
      )}
    </h2>

    {rsvpLoading ? (
      <div className="text-zinc-400 text-sm">Loading RSVPs…</div>
    ) : rsvps.length === 0 ? (
      <div className="text-zinc-500 text-sm">
        No one has RSVP’d yet. Once members mark themselves as going,
        you’ll see them here.
      </div>
    ) : (
      <ul className="space-y-3">
        {rsvps.map((r) => (
          <li key={r.user_id}>
            <Link
              to={`/u/${r.user_id}`}
              className="
                flex items-center gap-3 p-2 rounded-xl
                hover:bg-zinc-800/40 transition
              "
            >
              {/* Avatar */}
              <div
                className="
                  h-8 w-8 rounded-full bg-zinc-800 overflow-hidden
                  flex items-center justify-center text-xs text-zinc-300
                "
              >
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt={r.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  r.name?.[0]?.toUpperCase() || "?"
                )}
              </div>

              {/* Name + Role */}
              <div className="flex flex-col">
                <span className="text-sm text-zinc-100">{r.name}</span>
                {r.role && (
                  <span className="text-[11px] uppercase tracking-wide text-yellow-400">
                    {r.role}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
)}



        {/* ===== SAFETY NOTICE ===== */}
        <div className="mt-10 text-sm text-zinc-400 leading-relaxed bg-zinc-900/40 border border-white/10 rounded-xl p-5">
          <p>
            <strong className="text-yellow-400">Safety Notice:</strong>&nbsp;
            SuperFilm encourages safe, respectful and responsible interactions
            at all events. Please meet in public places, avoid sharing personal
            information with strangers, and be cautious when attending events
            with people you do not know. If anything feels uncomfortable, trust
            your instincts and prioritise your wellbeing.
          </p>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <Link to="/events" className="text-yellow-400 underline">
            ← Back to Events
          </Link>
        </div>
      </div>

      {/* ===== UNPUBLISH CONFIRMATION MODAL ===== */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-[90%] max-w-md shadow-2xl text-center">
            <h2 className="text-2xl font-bold mb-4">Unpublish Event?</h2>

            <p className="text-zinc-300 mb-6 leading-relaxed">
              This will remove the event from SuperFilm and it will no longer
              appear to anyone. This action cannot be undone.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleUnpublish}
                className="
                  px-4 py-2 rounded-xl bg-red-500 text-white font-semibold
                  hover:bg-red-600 transition shadow-lg
                "
              >
                Unpublish Event
              </button>

              <button
                onClick={() => setConfirmOpen(false)}
                className="
                  px-4 py-2 rounded-xl bg-zinc-700 text-zinc-200 font-semibold
                  hover:bg-zinc-600 transition
                "
              >
                Keep Published
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
