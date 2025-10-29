import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Film,
  Ticket,
  Share2,
  ChevronLeft,
  Link2,
} from "lucide-react";

/**
 * TEMP DATA:
 * Replace this with a real fetch (by eventId) later, or hydrate via route loader / context.
 */
const MOCK_EVENTS = {
  "evt-123": {
    id: "evt-123",
    title: "Screening: Past Lives + Q&A",
    club: { id: "1", name: "Cinema Club" },
    coverImage:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format",
    date: "2025-08-12",
    startTime: "19:00",
    endTime: "21:30",
    timezone: "Europe/London",
    location: {
      name: "Electric Cinema, Notting Hill",
      address: "191 Portobello Rd, London W11 2ED",
      mapEmbed:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d9916.1168!2d-0.211!3d51.514!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48760f8b3e8d6c01%3A0x... (optional)",
    },
    summary:
      "Join us for a special screening followed by a Q&A on writing intimate relationships for the screen.",
    agenda: [
      { time: "19:00", item: "Doors open & welcome" },
      { time: "19:15", item: "Feature screening" },
      { time: "21:05", item: "Q&A + discussion" },
    ],
    hosts: [
      { id: "u1", name: "Ava R.", role: "Host" },
      { id: "u2", name: "Sam K.", role: "Moderator" },
    ],
    capacity: 85,
    attendingCount: 42,
    price: "£8",
    tags: ["Screening", "Q&A", "Romance", "A24"],
    rsvpStatus: "available", // "available" | "sold_out" | "waitlist" | "closed"
    shareUrl: "https://superfilm.app/events/evt-123",
  },
};

function Section({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`bg-zinc-900/70 border border-zinc-800 rounded-xl ${className}`}>
      <div className="flex items-center gap-2 px-5 pt-4">
        {Icon ? <Icon className="w-5 h-5 text-yellow-400" /> : null}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}

export default function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  // Replace with real data-fetch later
  const event = MOCK_EVENTS[eventId] ?? Object.values(MOCK_EVENTS)[0];

  // Simple helpers
  const dateFmt = new Date(`${event.date}T${event.startTime}:00`);
  const niceDate = dateFmt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: event.timezone || "Europe/London",
  });

  return (
    <div className="mx-auto max-w-6xl w-full p-6 text-white">
      {/* Back / Breadcrumb */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-zinc-300 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <span className="text-zinc-600">•</span>
        <Link to={`/club/${event.club.id}`} className="text-zinc-300 hover:text-white">
          {event.club.name}
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="absolute inset-0">
          <img
            src={event.coverImage}
            alt={event.title}
            className="w-full h-64 md:h-80 object-cover opacity-70"
            onError={(e) => {
              e.currentTarget.src =
                "https://via.placeholder.com/1400x500?text=Event+Cover";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        </div>

        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-2 text-yellow-300 text-sm mb-2">
            <Film className="w-4 h-4" />
            <span>{event.club.name}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold">{event.title}</h1>

          {/* Key facts */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-200">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-yellow-400" />
              <span>{niceDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span>
                {event.startTime}–{event.endTime} ({event.timezone})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-yellow-400" />
              <span>{event.location.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-yellow-400" />
              <span>
                {event.attendingCount}/{event.capacity} going
              </span>
            </div>
          </div>

          {/* CTA bar */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition
              ${
                event.rsvpStatus === "sold_out"
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed"
                  : "bg-yellow-400/10 border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/20"
              }`}
            >
              {event.rsvpStatus === "sold_out" ? "Sold out" : `Get tickets • ${event.price}`}
            </button>
            <button className="px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 border border-zinc-700 hover:bg-zinc-700">
              Add to calendar
            </button>
            <button className="px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 inline-flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <a
              className="px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 inline-flex items-center gap-2"
              href={event.shareUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Link2 className="w-4 h-4" />
              Open link
            </a>
          </div>
        </div>
      </div>

      {/* Two-column content */}
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {/* Left column (main) */}
        <div className="md:col-span-2 space-y-6">
          <Section title="About this event" icon={Ticket}>
            <p className="text-zinc-300 leading-relaxed">{event.summary}</p>
            {event.tags?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tags.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-300"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Agenda" icon={Clock}>
            <ul className="space-y-2">
              {event.agenda.map((row, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 bg-zinc-900/60 rounded-lg p-3 border border-zinc-800"
                >
                  <span className="text-zinc-400 w-16 shrink-0">{row.time}</span>
                  <span className="text-zinc-200">{row.item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Location" icon={MapPin}>
            <div className="space-y-2">
              <div className="text-zinc-200 font-medium">{event.location.name}</div>
              <div className="text-zinc-400 text-sm">{event.location.address}</div>
              {/* Map placeholder; wire up an <iframe> or Map SDK later */}
              <div className="mt-3 h-56 w-full bg-zinc-800/60 border border-zinc-700 rounded-lg grid place-items-center text-zinc-400 text-sm">
                Map preview coming soon
              </div>
            </div>
          </Section>
        </div>

        {/* Right column (sidebar) */}
        <div className="space-y-6">
          <Section title="Hosts" icon={Users}>
            <ul className="space-y-3">
              {event.hosts.map((h) => (
                <li key={h.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 grid place-items-center text-sm">
                    {h.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="font-medium text-zinc-200">{h.name}</div>
                    <div className="text-xs text-zinc-400">{h.role}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Tickets & capacity" icon={Ticket}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">Price</span>
              <span className="font-semibold text-white">{event.price}</span>
            </div>
            <div className="mt-2 h-[1px] bg-zinc-800" />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-zinc-300">Attending</span>
              <span className="font-semibold text-white">
                {event.attendingCount} / {event.capacity}
              </span>
            </div>
          </Section>

          <Section title="Belongs to" icon={Film}>
            <Link
              to={`/club/${event.club.id}`}
              className="block bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-lg p-3 transition"
            >
              <div className="text-zinc-200 font-medium">{event.club.name}</div>
              <div className="text-xs text-zinc-400 mt-1">View club profile →</div>
            </Link>
          </Section>
        </div>
      </div>
    </div>
  );
}
