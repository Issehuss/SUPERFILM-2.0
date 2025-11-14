// src/pages/EventDetails.jsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// minimal mock fallback if someone opens a seed event route manually
const fallback = {
  title: "Event",
  posterUrl: "https://via.placeholder.com/800x1000?text=Event+Poster",
  summary: "",
  venue: "Venue",
  clubName: "Club",
  date: new Date().toISOString(),
  tags: [],
};

function mapRowToEvent(row) {
  const club = row.clubs || row.club || {};
  const dateIso =
    row.datetime ?? row.date_time ?? row.date ?? row.starts_at ?? row.start_time ?? new Date().toISOString();
  return {
    id: String(row.id),
    title: row.title ?? "Untitled Event",
    posterUrl: row.poster_url ?? row.image_url ?? fallback.posterUrl,
    summary: row.summary ?? row.description ?? "",
    venue: row.venue ?? row.location ?? "Venue",
    clubName: row.club_name ?? club.name ?? "Club",
    date: new Date(dateIso).toISOString(),
    tags: Array.isArray(row.tags)
      ? row.tags
      : (typeof row.tags === "string" ? row.tags.split(",").map((s) => s.trim()) : []),
  };
}

export default function EventDetails() {
  const { eventId } = useParams();
  const [evt, setEvt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (eventId?.startsWith("seed-")) {
          if (mounted) {
            setEvt({ id: eventId, ...fallback, title: `Demo ${eventId}` });
          }
          return;
        }
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .single();
        if (error) throw error;
        const mapped = mapRowToEvent(data);
        if (mounted) setEvt(mapped);
      } catch {
        if (mounted) setEvt({ id: eventId, ...fallback });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [eventId]);

  if (loading) return <div className="p-6 text-zinc-400">Loading…</div>;
  if (!evt) return <div className="p-6 text-zinc-400">Event not found.</div>;

  const d = new Date(evt.date);
  const dateStr = d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link to="/events" className="text-sm text-zinc-400 hover:text-zinc-200">← Back to Events</Link>
      <div className="grid md:grid-cols-[320px_minmax(0,1fr)] gap-6 mt-4">
        <div className="w-full aspect-[4/5] bg-zinc-800 overflow-hidden rounded-lg">
          <img src={evt.posterUrl} alt={evt.title} className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{evt.title}</h1>
          <div className="text-zinc-400 mt-1">
            {evt.clubName} • {evt.venue}
          </div>
          <div className="mt-2 text-zinc-300">{dateStr}</div>

          {evt.tags?.length ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {evt.tags.map((t) => (
                <span key={t} className="px-3 py-1 rounded-full border border-zinc-700 text-sm">{t}</span>
              ))}
            </div>
          ) : null}

          {evt.summary && <p className="mt-4 text-zinc-200 leading-relaxed">{evt.summary}</p>}
        </div>
      </div>
    </div>
  );
}