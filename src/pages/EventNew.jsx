// src/pages/EventNew.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import EventPosterPicker from "../components/EventPosterPicker.jsx";
import "./Events.css";

/* ---------------- Helpers ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9);

const splitCsv = (s) =>
  (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

/* ---------------- Preview Card ---------------- */
function CardPreview({ evt }) {
  const d = evt.date ? new Date(evt.date) : null;
  const month = d ? d.toLocaleString(undefined, { month: "short" }) : null;
  const day = d ? d.getDate() : null;

  return (
    <div style={{ width: 360, maxWidth: "100%" }}>
      <article className="poster-card">
        <div className="poster-media">
          {evt.posterUrl ? (
            <img
              src={evt.posterUrl}
              alt={evt.title || "Poster"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-600 text-sm">
              No poster selected
            </div>
          )}

          {d && (
            <div className="poster-date">
              <div className="m">{month}</div>
              <div className="d">{day}</div>
            </div>
          )}
        </div>

        <div className="poster-info">
          <h3 className="title">{evt.title || "Untitled Screening"}</h3>
          <div className="meta">
            {(evt.clubName || "Club")} • {(evt.venue || "TBA")}
          </div>
          {evt.tags?.length ? (
            <div className="tags">
              {evt.tags.slice(0, 3).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {evt.summary && <p className="summary">{evt.summary}</p>}
        </div>
      </article>
      <div className="text-zinc-500 text-xs mt-1">
        Live preview of the event card
      </div>
    </div>
  );
}

/* ---------------- Main Page ---------------- */
export default function EventNew() {
  const navigate = useNavigate();

  /* ---------- Auth ---------- */
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState(null);

  /* Clubs the user is president of */
  const [presidentClubs, setPresidentClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // More reliable than getUser()
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          navigate("/auth", {
            replace: true,
            state: { from: "/events/new" },
          });
          return;
        }

        const u = session.user;
        setUser(u);

        // Load clubs where user is PRESIDENT
        const { data: clubs, error: clubErr } = await supabase
          .from("club_members")
          .select(
            `
              role,
              club_id,
              clubs:club_id (
                id,
                name
              )
            `
          )
          .eq("user_id", u.id)
          .eq("role", "president");

        if (clubErr) throw clubErr;

        const list = clubs
          ?.filter((row) => row.clubs?.id)
          .map((row) => ({
            id: String(row.clubs.id),   // ⭐ force UUID as plain string
            name: row.clubs.name || "Untitled Club",
          }));
          

        if (!list || list.length === 0) {
          setPresidentClubs([]);
          setRoleError("You must be a club president to list an event.");
          return;
        }

        setPresidentClubs(list);
        setSelectedClubId(String(list[0].id));
      } catch (e) {
        console.error("EventNew auth error:", e);
        setRoleError("Could not verify your permissions.");
      } finally {
        setLoadingAuth(false);
      }
    })();
  }, [navigate]);

  /* ---------- Form State ---------- */
  const [title, setTitle] = useState("Untitled Screening");
  const [clubName, setClubName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [venue, setVenue] = useState("");
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [posterUrl, setPosterUrl] = useState("");

  /* Event details page fields */
  const [capacity, setCapacity] = useState("");
  const [waitlist, setWaitlist] = useState(false);
  const [hostsInput, setHostsInput] = useState("");
  const [price, setPrice] = useState("Free");
  const [rsvpRequired, setRsvpRequired] = useState(true);
  const [contactEmail, setContactEmail] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [ageRating, setAgeRating] = useState("");

  /* Save state */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* Keep clubName synced with dropdown */
  useEffect(() => {
    if (!presidentClubs.length) return;

    const found = presidentClubs.find(
      (c) => String(c.id) === String(selectedClubId)
    );
    if (found) setClubName(found.name);
  }, [selectedClubId, presidentClubs]);

  /* ---------- Save Event ---------- */
  const handleSave = async () => {
    if (saving) return;
    setSaveError("");

    if (!selectedClubId) return setSaveError("Pick a club.");
    if (!posterUrl) return setSaveError("Pick a film poster.");
    if (!date) return setSaveError("Pick a date.");

    try {
      setSaving(true);

      /* Re-fetch user session reliably */
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const u = session?.user || null;
      if (!u) {
        setSaveError("Session expired. Please sign in again.");
        return;
      }

      const baseTitle = title || "Untitled Screening";
      const slug = `${slugify(baseTitle)}-${uid()}`;

      const isoDate = new Date(`${date}T${time}`).toISOString();

      const tags = splitCsv(tagsInput);

      const details = {
        capacity: capacity ? Number(capacity) : null,
        waitlist,
        hosts: splitCsv(hostsInput),
        agenda: [],
        schedule: [],
        price: price || "Free",
        rsvpRequired,
        rsvpLink: "",
        contactEmail: contactEmail || "",
        accessibility: accessibility || "",
        ageRating: ageRating || "",
        dressCode: "",
      };

      console.log("[DEBUG CREATED_BY CHECK]", {
        
        expected: "a173370f-2698-4bfe-95e7-38ba27efebd7",
        selectedClubId,
      });

      const {
        data: { session: debugSession }
      } = await supabase.auth.getSession();
      
      console.log("[DEBUG SESSION]", debugSession);
      

      /* --- FINAL INSERT (RLS safe) --- */
      const { data, error } = await supabase
        .from("events")
        .insert({
          slug,
          title: baseTitle,
          club_id: selectedClubId,
          club_name: clubName,
          poster_url: posterUrl,
          date: isoDate,
          venue: venue || "TBA",
          summary: summary || "",
          tags,
          details,
          created_by: u.id, // ⭐ RLS REQUIRED
        })
        .select("id, slug")
        .maybeSingle();

      if (error) {
        console.error("[EventNew] Insert error:", error);
        setSaveError("Could not save event. Please try again.");
        return;
      }

      /* Optimistic event object */
      navigate("/events", {
        replace: true,
        state: {
          newEvent: {
            id: data?.id,
            slug,
            title: baseTitle,
            clubId: selectedClubId,
            clubName,
            date: isoDate,
            venue: venue || "TBA",
            posterUrl,
            tags,
            summary,
            details,
          },
        },
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Live Preview Data ---------- */
  const liveEvt = {
    title,
    clubName,
    venue,
    summary,
    tags: splitCsv(tagsInput),
    date: date ? new Date(`${date}T${time}`).toISOString() : null,
    posterUrl,
  };

  /* ---------- STATES ---------- */
  if (loadingAuth)
    return (
      <div className="events-page p-4">
        <h1 className="text-xl font-bold mb-2">List Event</h1>
        <div className="text-zinc-400">Loading…</div>
      </div>
    );

  if (!presidentClubs.length)
    return (
      <div className="events-page p-4">
        <h1 className="text-xl font-bold mb-2">List Event</h1>
        <p className="text-red-400">{roleError}</p>
      </div>
    );

  /* ---------- UI ---------- */
  return (
    <div className="events-page p-4">
      <header className="page-head mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">List Event</h1>
          <p className="text-zinc-400 mt-1">
            Choose a film poster, fill the basics, and publish your event.
          </p>
        </div>

        <div className="head-actions flex gap-3">
          <button className="btn ghost" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save and List Event"}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="text-red-400 mb-3 text-sm">{saveError}</div>
      )}

      {/* ---------- FORM ---------- */}
      <section className="events-modal__body mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Event Card (shown on Events page)
        </h2>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Event Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Club</label>
            <select
  className="input"
  value={selectedClubId}
  onChange={(e) => setSelectedClubId(String(e.target.value))}

>

              {presidentClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Time</label>
            <input
              type="time"
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Venue</label>
            <input
              className="input"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Tags (comma separated)</label>
            <input
              className="input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Summary</label>
            <input
              className="input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <EventPosterPicker
            onSelect={({ title: tmdbTitle, posterUrl: pUrl }) => {
              if (!title || title === "Untitled Screening") {
                setTitle(tmdbTitle);
              }
              if (pUrl) setPosterUrl(pUrl);
            }}
          />
          <CardPreview evt={liveEvt} />
        </div>
      </section>

      {/* ---------- EVENT PAGE DETAILS ---------- */}
      <section className="events-modal__body mt-4">
        <h2 className="text-xl font-semibold mb-3">
          Event Page Details
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Capacity</label>
            <input
              className="input"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 80"
            />
            <label className="checkbox flex gap-2 mt-2">
              <input
                type="checkbox"
                checked={waitlist}
                onChange={(e) => setWaitlist(e.target.checked)}
              />
              Enable waitlist
            </label>
          </div>

          <div>
            <label className="label">Ticket Price</label>
            <input
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Hosts</label>
            <input
              className="input"
              value={hostsInput}
              onChange={(e) => setHostsInput(e.target.value)}
              placeholder="e.g. Abdul, Hannah"
            />
          </div>

          <div>
            <label className="label">Contact Email</label>
            <input
              className="input"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@club.org"
            />
          </div>

          <div>
            <label className="label">Accessibility</label>
            <input
              className="input"
              value={accessibility}
              onChange={(e) => setAccessibility(e.target.value)}
              placeholder="Wheelchair access, subtitles, etc."
            />
          </div>

          <div>
            <label className="label">Age Rating</label>
            <input
              className="input"
              value={ageRating}
              onChange={(e) => setAgeRating(e.target.value)}
              placeholder="15 / 18"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label">RSVP Required</label>
            <label className="checkbox flex gap-2 mt-2">
              <input
                type="checkbox"
                checked={rsvpRequired}
                onChange={(e) => setRsvpRequired(e.target.checked)}
              />
              Require RSVP
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
