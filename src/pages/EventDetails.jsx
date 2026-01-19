// src/pages/EventDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

const FALLBACK_EVENT_IMAGE = "https://placehold.co/600x800?text=Event";

const EVENT_CACHE_KEY = "cache:event:";
function readEventCache(slug) {
  if (!slug) return null;
  try {
    const raw = sessionStorage.getItem(`${EVENT_CACHE_KEY}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.data) return null;
    // 5 minute ttl
    if (Date.now() - parsed.at > 5 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
function writeEventCache(slug, data) {
  if (!slug || !data) return;
  try {
    sessionStorage.setItem(`${EVENT_CACHE_KEY}${slug}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
}

export default function EventDetails() {
  const { slug } = useParams();
  const location = useLocation();
  const { user, profile, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const initialEvent = location.state?.event || null;
  const cachedEvent = readEventCache(slug);

  const [event, setEvent] = useState(initialEvent || cachedEvent || null);
  const [loading, setLoading] = useState(!initialEvent && !cachedEvent);

  // Manage menu + unpublish modal
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // RSVP state
  const [rsvps, setRsvps] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(true);
  const [isClubMember, setIsClubMember] = useState(null);
  const [rsvpError, setRsvpError] = useState("");

  /* ===================== Load Event ===================== */
  useEffect(() => {
    async function load() {
      if (!slug) return;

      // If we already have event with this slug, still refresh but don't flash loading
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, slug, title, date, poster_url, image_url, club_id, club_name, venue, summary, tags, details, created_by")
          .eq("slug", slug)
          .maybeSingle();

        if (error) console.error("[EventDetails] Fetch error", error);
        if (data) {
          setEvent(data);
          writeEventCache(slug, data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const isCreator = !!(user?.id && event?.created_by === user.id);

  const eventId = event?.id || event?.event_id || null;
  const clubId = event?.club_id || event?.clubId || null;

  const isMissingClubColumn = (err) => {
    const msg = err?.message || err?.hint || err?.details || "";
    return /club_id/.test(msg) && /(column|field|does not exist)/i.test(msg);
  };

  function logSupabaseError(label, payload) {
    const err = payload?.error || payload;
    const msg = err?.message || err?.hint || err?.details || err?.code || "Unknown error";
    setRsvpError(msg);
    console.error(label, {
      status: payload?.status,
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
    });
  }

  /* ===================== Membership check ===================== */
  useEffect(() => {
    let on = true;
    let retryTimer;
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId || !clubId) {
        on && setIsClubMember(null);
        if (!resolvedUserId) retryTimer = setTimeout(run, 500);
        return;
      }
      try {
        const { count, error } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("user_id", resolvedUserId);
        if (error) throw error;
        on && setIsClubMember((count || 0) > 0);
        on && setRsvpError("");
      } catch (e) {
        logSupabaseError("[EventDetails] membership check error", { error: e });
        on && setIsClubMember(null); // don't block if check fails
      }
    };
    run();
    return () => {
      on = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, clubId]);

  /* ===================== Load RSVPs ===================== */
  useEffect(() => {
    if (userLoading) return;

    let cancelled = false;
    let retryTimer;

    async function loadRsvps() {
      setRsvpLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!eventId) {
        setRsvps([]);
        setRsvpLoading(false);
        setRsvpError("Event is missing an ID.");
        return;
      }
      if (!resolvedUserId) {
        setRsvps([]);
        setRsvpLoading(true);
        setRsvpError("Sign in to see RSVPs.");
        retryTimer = setTimeout(loadRsvps, 500);
        return;
      }
      setRsvpError("");
      try {
        const loadWithClub = async (withClub) => {
          let q = supabase
            .from("event_rsvps")
            .select("id, user_id, status, created_at")
            .eq("event_id", eventId);
          if (withClub && clubId) q = q.eq("club_id", clubId);
          const { data, error, status } = await q;
          return { data, error, status, usedClub: withClub };
        };

        let attempt = await loadWithClub(Boolean(clubId));
        if (attempt.error && isMissingClubColumn(attempt.error)) {
          attempt = await loadWithClub(false);
        }

        if (attempt.error) {
          logSupabaseError("[EventDetails] RSVP load error", {
            status: attempt.status,
            error: attempt.error,
          });
          if (!cancelled) setRsvps([]);
          return;
        }
        if (cancelled) return;

        const rows = attempt.data || [];
        setRsvpError("");

        // Always store base RSVPs
        if (!isCreator || rows.length === 0) {
          const formatted = rows.map((r) => ({
            ...r,
            name: "Member",
            avatar_url: null,
            role: null,
            status: r.status || "going",
          }));
          setRsvps(formatted);
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
            .select("club_id, user_id, role, joined_at, accepted")
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
            ...r,
            name: p.display_name || "Member",
            avatar_url: p.avatar_url || null,
            role: rolesByUser[r.user_id] || null,
            status: r.status || "going",
          };
        });

        setRsvps(enriched);
      } catch (err) {
        logSupabaseError("[EventDetails] RSVP load error", { error: err });
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
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [event, eventId, clubId, isCreator, user?.id, userLoading, isClubMember]);

  const myRsvp = useMemo(
    () => rsvps.find((r) => r.user_id === user?.id),
    [rsvps, user?.id]
  );
  const isGoing = myRsvp?.status === "going";

  /* ===================== Unpublish Logic ===================== */
  async function handleUnpublish() {
    if (!clubId) {
      alert("This event is missing a club. Please contact the organiser.");
      return;
    }
    if (!eventId) {
      alert("Event is missing an ID. Please refresh.");
      return;
    }

    try {
      const { error, data, status } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .select("id");

      if (error) {
        logSupabaseError("[Unpublish Event Error]", { error, status });
        alert("Could not unpublish event. Please try again.");
        return;
      }

      if (!data || data.length === 0) {
        logSupabaseError("[Unpublish Event Error]", {
          error: { message: "No rows deleted — likely blocked by permissions." },
          status,
        });
        alert("Could not unpublish event (permission issue). Please check your access.");
        return;
      }

      // Clear cached events so the list doesn’t show stale data
      try {
        sessionStorage.removeItem("cache:events:v1");
      } catch {}

      setConfirmOpen(false);
      navigate("/events", {
        replace: true,
        state: { removedEventId: String(eventId) },
      });
    } catch (e) {
      logSupabaseError("[Unpublish Event Error]", { error: e });
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

    if (!eventId) {
      alert("Event is missing an ID. Please refresh.");
      return;
    }

    try {
      setRsvpError("");
      const checkExisting = async (withClub) => {
        let q = supabase
          .from("event_rsvps")
          .select("id, status")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .limit(1);
        if (withClub && clubId) q = q.eq("club_id", clubId);
        const { data, error, status } = await q;
        return { data, error, status, usedClub: withClub };
      };

      let existingRes = await checkExisting(Boolean(clubId));
      if (existingRes.error && isMissingClubColumn(existingRes.error)) {
        existingRes = await checkExisting(false);
      }

      const existing = existingRes.data?.[0] || null;

      if (existingRes.error) {
        logSupabaseError("[EventDetails] RSVP check error", {
          status: existingRes.status,
          error: existingRes.error,
        });
        throw existingRes.error;
      }

      if (existing) {
        // Cancel RSVP
        const deleteRsvp = async (withClub) => {
          let q = supabase
            .from("event_rsvps")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", user.id);
          if (withClub && clubId) q = q.eq("club_id", clubId);
          const { error, status, details } = await q;
          return { error, status, details, usedClub: withClub };
        };

        let delRes = await deleteRsvp(true);
        if (delRes.error && isMissingClubColumn(delRes.error)) {
          delRes = await deleteRsvp(false);
        }

        if (delRes.error) {
          logSupabaseError("[EventDetails] RSVP toggle delete error", {
            status: delRes.status,
            error: delRes.error,
            details: delRes.details,
          });
          throw delRes.error;
        }

        if (isCreator) {
          setRsvps((prev) => prev.filter((r) => r.user_id !== user.id));
        } else {
          setRsvps((prev) => prev.filter((r) => r.user_id !== user.id));
        }
      } else {
        // Mark as going
        const payload = {
          event_id: eventId,
          club_id: clubId,
          user_id: user.id,
          status: "going",
        };

        const insertRsvp = async (withClub) => {
          const body = { ...payload };
          if (!withClub) delete body.club_id;
          const { data, error, status, details } = await supabase
            .from("event_rsvps")
            .insert(body)
            .select("id, user_id, status, created_at");
          return { data, error, status, details, usedClub: withClub };
        };

        let insRes = await insertRsvp(true);
        if (insRes.error && isMissingClubColumn(insRes.error)) {
          insRes = await insertRsvp(false);
        }

        if (insRes.error) {
          logSupabaseError("[EventDetails] RSVP toggle insert error", {
            status: insRes.status,
            error: insRes.error,
            details: insRes.details,
          });
          throw insRes.error;
        }

        // If creator is viewing their own event, add themselves to the list
        if (isCreator) {
          setRsvps((prev) => {
            if (prev.some((r) => r.user_id === user.id)) return prev;
            const inserted = Array.isArray(insRes.data) ? insRes.data[0] : null;
            const fallback = {
              id: crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`,
              user_id: user.id,
              created_at: new Date().toISOString(),
              status: "going",
            };
            return [...prev, inserted || fallback];
          });
        } else {
          const inserted = Array.isArray(insRes.data) ? insRes.data[0] : null;
          const fallback = {
            id: crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`,
            user_id: user.id,
            created_at: new Date().toISOString(),
            status: "going",
          };
          setRsvps((prev) => [...prev, inserted || fallback]);
        }

        // Notify the event creator if someone RSVPs (and they are not the creator)
        if (event.created_by && event.created_by !== user.id) {
          try {
            await supabase.from("notifications").insert({
              user_id: event.created_by, // who receives it
              actor_id: user.id, // who RSVPed
              type: "event_rsvp",
              club_id: event.club_id || null,
              data: {
                event_id: eventId,
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
      logSupabaseError("[EventDetails] RSVP toggle error", { error: err });
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
  const posterSrc = event.poster_url || FALLBACK_EVENT_IMAGE;

  /* ===================== MAIN PAGE ===================== */
  return (
    <div className="relative min-h-screen w-full text-white">
      {/* ===== Cinematic Backdrop ===== */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${posterSrc})`,
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
            src={posterSrc}
            alt={event.title}
            className="w-64 h-auto rounded-xl shadow-2xl"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_EVENT_IMAGE;
            }}
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
                  {rsvpLoading ? "Working…" : isGoing ? "Not going" : "RSVP: Going?"}
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-4 py-2 rounded-full border border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/10 transition inline-block"
                >
                  Sign in to RSVP
                </Link>
              )}
              {rsvpError && (
                <div className="mt-2 text-sm text-red-400">
                  {rsvpError}
                </div>
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

        {/* ===== Attendance (signed-in only) ===== */}
        {user && (
          <div className="mt-10 bg-black/40 border border-white/10 backdrop-blur rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-3">Attendance</h2>

            {rsvpLoading ? (
              <div className="text-zinc-400 text-sm">Loading RSVPs…</div>
            ) : (
              <div className="text-zinc-300">
                <span className="text-3xl font-bold text-yellow-400">
                  {rsvps.filter((r) => (r.status || "going") === "going").length}
                </span>{" "}
                people are going
                <div className="text-sm text-zinc-400 mt-1">
                  Join them and make this event even better.
                </div>
              </div>
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
