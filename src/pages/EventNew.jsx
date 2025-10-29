// src/pages/EventNew.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stage,
  Layer,
  Rect,
  Image as KImage,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import "./Events.css";

/* ---------- poster output size (3:4) ---------- */
const CANVAS_W = 900;
const CANVAS_H = 1200;

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const splitCsv = (s) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/* ---------- Small Google Maps preview ---------- */
function MapPreview({ query }) {
  const q = (query || "").trim();
  const embedSrc = q
    ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
    : "";
  const dirHref = q
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
    : "";

  return (
    <div
      className="map-preview"
      style={{
        border: "1px solid #2b2c34",
        borderRadius: 12,
        background: "var(--panel, #0e0f13)",
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h3 className="text-base font-semibold">Location preview</h3>
        {q && (
          <a
            className="btn ghost sm"
            href={dirHref}
            target="_blank"
            rel="noreferrer"
            title="Open in Google Maps"
          >
            Open in Google Maps
          </a>
        )}
      </div>

      {q ? (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            width: "100%",
            height: 220,
          }}
        >
          <iframe
            title="Map preview"
            src={embedSrc}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div
          style={{
            height: 220,
            display: "grid",
            placeItems: "center",
            border: "1px dashed #2b2c34",
            borderRadius: 10,
            color: "#a1a1aa",
            background: "#0f1014",
          }}
        >
          Enter a venue/address to preview the map
        </div>
      )}

      {q && (
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <a
            className="btn primary"
            href={dirHref}
            target="_blank"
            rel="noreferrer"
            title="Get directions"
          >
            Get directions
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------- Cropping UI (left) ---------- */
function Cropper({
  fileUrl,
  onCropChange, // ({x,y,width,height} in image pixels)
  posterAspect = CANVAS_W / CANVAS_H, // 0.75
}) {
  const VIEW_W = 560;
  const VIEW_H = 420;

  const [imgEl] = useImage(fileUrl || "", "anonymous");
  const rectRef = useRef(null);
  const trRef = useRef(null);

  const [crop, setCrop] = useState(null); // crop rect in image px
  const [scale, setScale] = useState(1); // display scale
  const [lockAspect, setLockAspect] = useState(true);

  useEffect(() => {
    if (!imgEl) return;
    const s = Math.min(VIEW_W / imgEl.width, VIEW_H / imgEl.height);
    setScale(s);

    // center crop with poster AR
    const ar = posterAspect;
    const iw = imgEl.width,
      ih = imgEl.height;
    let cw, ch;
    if (iw / ih > ar) {
      ch = ih * 0.9;
      cw = ch * ar;
    } else {
      cw = iw * 0.9;
      ch = cw / ar;
    }
    const cx = (iw - cw) / 2;
    const cy = (ih - ch) / 2;
    const next = { x: cx, y: cy, width: cw, height: ch };
    setCrop(next);
    onCropChange?.(next);
  }, [imgEl, posterAspect, onCropChange]);

  useEffect(() => {
    if (crop) onCropChange?.(crop);
  }, [crop, onCropChange]);

  const clamp = (nx, ny, nw, nh) => {
    if (!imgEl) return { x: nx, y: ny, width: nw, height: nh };
    const maxX = imgEl.width - nw;
    const maxY = imgEl.height - nh;
    return {
      x: Math.max(0, Math.min(nx, maxX)),
      y: Math.max(0, Math.min(ny, maxY)),
      width: Math.max(10, Math.min(nw, imgEl.width)),
      height: Math.max(10, Math.min(nh, imgEl.height)),
    };
  };

  useEffect(() => {
    if (!trRef.current || !rectRef.current) return;
    trRef.current.nodes([rectRef.current]);
    trRef.current.getLayer()?.batchDraw();
  }, [crop, imgEl]);

  if (!fileUrl) {
    return (
      <div
        style={{
          width: VIEW_W,
          height: VIEW_H,
          display: "grid",
          placeItems: "center",
          border: "1px dashed #2b2c34",
          borderRadius: 12,
          background: "#0f1014",
          color: "#a1a1aa",
        }}
      >
        Upload an image to begin
      </div>
    );
  }

  return (
    <div>
      <Stage
        width={VIEW_W}
        height={VIEW_H}
        style={{ border: "1px solid #2b2c34", borderRadius: 12, background: "#0a0b0e" }}
      >
        <Layer>
          {/* image */}
          <KImage
            image={imgEl}
            x={0}
            y={0}
            width={imgEl ? imgEl.width * scale : 0}
            height={imgEl ? imgEl.height * scale : 0}
            listening={false}
          />

          {/* dim overlay outside crop */}
          {crop && (
            <>
              <Rect x={0} y={0} width={VIEW_W} height={crop.y * scale} fill="rgba(0,0,0,0.45)" listening={false} />
              <Rect x={0} y={crop.y * scale} width={crop.x * scale} height={crop.height * scale} fill="rgba(0,0,0,0.45)" listening={false} />
              <Rect
                x={(crop.x + crop.width) * scale}
                y={crop.y * scale}
                width={VIEW_W - (crop.x + crop.width) * scale}
                height={crop.height * scale}
                fill="rgba(0,0,0,0.45)"
                listening={false}
              />
              <Rect
                x={0}
                y={(crop.y + crop.height) * scale}
                width={VIEW_W}
                height={VIEW_H - (crop.y + crop.height) * scale}
                fill="rgba(0,0,0,0.45)"
                listening={false}
              />
            </>
          )}

          {/* crop rect */}
          {crop && (
            <Rect
              ref={rectRef}
              x={crop.x * scale}
              y={crop.y * scale}
              width={crop.width * scale}
              height={crop.height * scale}
              stroke="#ffd166"
              strokeWidth={2}
              draggable
              onDragMove={(e) => {
                const nx = e.target.x() / scale;
                const ny = e.target.y() / scale;
                const next = clamp(nx, ny, crop.width, crop.height);
                e.target.position({ x: next.x * scale, y: next.y * scale });
                setCrop(next);
              }}
              onTransformEnd={() => {
                const node = rectRef.current;
                const sx = node.scaleX();
                const sy = node.scaleY();
                let vw = node.width() * sx;
                let vh = node.height() * sy;
                node.scaleX(1);
                node.scaleY(1);

                let nw = vw / scale;
                let nh = vh / scale;
                if (lockAspect) {
                  const ar = posterAspect;
                  nw = Math.max(nw, 10);
                  nh = nw / ar;
                }
                let nx = node.x() / scale;
                let ny = node.y() / scale;
                const next = clamp(nx, ny, nw, nh);
                node.position({ x: next.x * scale, y: next.y * scale });
                node.size({ width: next.width * scale, height: next.height * scale });
                setCrop(next);
              }}
            />
          )}

          {/* handles */}
          {crop && (
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              keepRatio={lockAspect}
              borderStroke="#ffd166"
              anchorFill="#fff"
              anchorSize={8}
            />
          )}
        </Layer>
      </Stage>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <button
          className="btn ghost sm"
          onClick={() => setLockAspect((v) => !v)}
          title="Toggle aspect ratio lock"
        >
          {lockAspect ? "Aspect: 3:4 (locked)" : "Aspect: Free"}
        </button>
        {imgEl && (
          <button
            className="btn ghost sm"
            onClick={() => {
              const ar = lockAspect ? posterAspect : crop.width / crop.height;
              const iw = imgEl.width,
                ih = imgEl.height;
              let cw, ch;
              if (iw / ih > ar) {
                ch = ih * 0.9;
                cw = ch * ar;
              } else {
                cw = iw * 0.9;
                ch = cw / ar;
              }
              const cx = (iw - cw) / 2,
                cy = (ih - ch) / 2;
              setCrop({ x: cx, y: cy, width: cw, height: ch });
            }}
          >
            Center crop
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Generate posterUrl (data URL) when crop changes ---------- */
function usePosterDataURL(fileUrl, crop) {
  const [posterUrl, setPosterUrl] = useState("");
  const [imgEl] = useImage(fileUrl || "", "anonymous");

  useEffect(() => {
    if (!imgEl || !crop) return setPosterUrl("");
    const c = document.createElement("canvas");
    c.width = CANVAS_W;
    c.height = CANVAS_H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(
      imgEl,
      Math.round(crop.x),
      Math.round(crop.y),
      Math.round(crop.width),
      Math.round(crop.height),
      0,
      0,
      CANVAS_W,
      CANVAS_H
    );
    setPosterUrl(c.toDataURL("image/png"));
  }, [imgEl, crop]);

  return posterUrl;
}

// --- Card preview (text below image only) ---
function CardPreview({ evt }) {
  const d = evt.date ? new Date(evt.date) : null;
  const month = d ? d.toLocaleString(undefined, { month: "short" }) : null;
  const day = d ? d.getDate() : null;

  return (
    <div style={{ width: 360, maxWidth: "100%" }}>
      <article className="poster-card">
        <div className="poster-media">
          <img
            src={evt.posterUrl || "https://via.placeholder.com/600x800?text=Poster"}
            alt={evt.title || "Poster"}
            className="w-full h-full object-cover"
          />
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
            <span className="dot" />
            {(evt.clubName || "Club")} • {(evt.venue || "TBA")}
          </div>
          {evt.tags?.length ? (
            <div className="tags">
              {evt.tags.slice(0, 3).map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          ) : null}
          {evt.summary && <p className="summary">{evt.summary}</p>}
        </div>
      </article>
      <div className="hint" style={{ color: "#a1a1aa", marginTop: 6 }}>
        Live preview of how this event will appear in the grid
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function EventNew() {
  const navigate = useNavigate();

  // --- Card fields (what appears on the Events grid) ---
  const [title, setTitle] = useState("Untitled Screening");
  const [clubName, setClubName] = useState("Projector Club");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [summary, setSummary] = useState("");

  // image + crop
  const [fileUrl, setFileUrl] = useState("");
  const [crop, setCrop] = useState(null);
  const posterUrl = usePosterDataURL(fileUrl, crop);

  // --- Event page–only fields (details page) ---
  const [capacity, setCapacity] = useState("");
  const [waitlist, setWaitlist] = useState(false);

  const [hostsInput, setHostsInput] = useState(""); // CSV
  const [price, setPrice] = useState(""); // e.g. "£5" or "Free"
  const [rsvpRequired, setRsvpRequired] = useState(true);
  const [rsvpLink, setRsvpLink] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accessibility, setAccessibility] = useState(""); // wheelchair access, subtitles, etc.
  const [ageRating, setAgeRating] = useState("");
  const [dressCode, setDressCode] = useState("");

  // Agenda rows
  const [agendaRows, setAgendaRows] = useState([
    { id: uid(), time: "19:00", text: "Doors open & welcome" },
    { id: uid(), time: "19:15", text: "Feature screening" },
    { id: uid(), time: "21:05", text: "Q&A + discussion" },
  ]);

  const addAgendaRow = () =>
    setAgendaRows((rows) => [...rows, { id: uid(), time: "", text: "" }]);
  const removeAgendaRow = (id) =>
    setAgendaRows((rows) => rows.filter((r) => r.id !== id));
  const updateAgendaRow = (id, key, value) =>
    setAgendaRows((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const handleUpload = (f) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setFileUrl(url);
  };

  const handleSave = () => {
    if (!posterUrl || !date) return;

    const mapQuery = venue?.trim() || "";
    const directionsUrl = mapQuery
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`
      : "";

    const evt = {
      id: "evt-" + uid(),
      clubId: "10",
      clubName,
      date: new Date(`${date}T${time || "19:00"}`).toISOString(),
      title: title || "Untitled Screening",
      venue: venue || "TBA",
      posterUrl,
      tags: splitCsv(tagsInput),
      summary: summary || "",
      details: {
        capacity: capacity ? Number(capacity) : null,
        waitlist,
        hosts: splitCsv(hostsInput),
        agenda: agendaRows
          .filter((r) => r.time || r.text)
          .map((r) => ({ time: r.time.trim(), text: r.text.trim() })),
        price: price || "Free",
        rsvpRequired,
        rsvpLink: rsvpLink || "",
        contactEmail: contactEmail || "",
        accessibility: accessibility || "",
        ageRating: ageRating || "",
        dressCode: dressCode || "",
        mapQuery,
        directionsUrl,
      },
    };

    navigate("/events", { replace: true, state: { newEvent: evt } });
  };

  const liveEvt = {
    title,
    clubName,
    venue,
    summary,
    tags: splitCsv(tagsInput),
    date: date ? new Date(`${date}T${time || "12:00"}`).toISOString() : null,
    posterUrl,
  };

  return (
    <div className="events-page" style={{ paddingTop: 10 }}>
      <header className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="text-3xl font-bold">List Event</h1>
          <p className="text-zinc-400 mt-1">
            Upload a poster, crop it, and fill in card info. Then add full event details for the event page.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn ghost" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button className="btn primary" onClick={handleSave} disabled={!posterUrl || !date}>
            Save & List Event
          </button>
        </div>
      </header>

      {/* CARD INFO (what shows on the Events grid) */}
      <section className="events-modal__body" style={{ padding: 10 }}>
        <h2 className="text-xl font-semibold mb-3">Event Card (shown on Events page)</h2>

        <div className="grid md:grid-cols-2 gap-4" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">Event title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Club</label>
            <input className="input" value={clubName} onChange={(e) => setClubName(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Venue / Link</label>
            <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Summary</label>
            <input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Tags (comma-separated)</label>
            <input className="input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
        </div>

        {/* crop + preview */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "start" }}>
          <div>
            <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
              <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                Upload Image
                <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
              </label>
            </div>
            <Cropper fileUrl={fileUrl} onCropChange={setCrop} />
          </div>
          <CardPreview evt={liveEvt} />
        </div>

        {/* Map preview tied to the Venue field */}
        <div style={{ marginTop: 16 }}>
          <MapPreview query={venue} />
        </div>
      </section>

      {/* EVENT PAGE DETAILS (not shown on card) */}
      <section className="events-modal__body" style={{ padding: 10, marginTop: 4 }}>
        <h2 className="text-xl font-semibold mb-3">Event Page Details (shown on the event detail page)</h2>

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
            <label className="checkbox" style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)} />
              Enable waitlist when full
            </label>
          </div>

        <div>
            <label className="label">Ticket Price</label>
            <input
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. Free / £5 / Pay-what-you-want"
            />
          </div>

          <div>
            <label className="label">Hosts (comma-separated)</label>
            <input
              className="input"
              value={hostsInput}
              onChange={(e) => setHostsInput(e.target.value)}
              placeholder="e.g. Emma, Jake"
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
            <label className="label">Accessibility Notes</label>
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
              placeholder="e.g. 12A / 15 / 18"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Dress Code</label>
            <input
              className="input"
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              placeholder="Optional, e.g. ‘90s noir vibes’"
            />
          </div>
        </div>

        {/* AGENDA (structured rows) */}
        <div style={{ marginTop: 16 }}>
          <h3 className="text-lg font-semibold mb-2">Agenda</h3>

          <div
            className="agenda-box"
            style={{
              background: "var(--panel, #0e0f13)",
              border: "1px solid #2b2c34",
              borderRadius: 12,
              padding: 12,
            }}
          >
            {agendaRows.map((row) => (
              <div
                key={row.id}
                className="agenda-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr auto",
                  gap: 8,
                  alignItems: "center",
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  marginBottom: 8,
                }}
              >
                <input
                  type="time"
                  className="input"
                  value={row.time}
                  onChange={(e) => updateAgendaRow(row.id, "time", e.target.value)}
                  placeholder="19:00"
                />
                <input
                  className="input"
                  value={row.text}
                  onChange={(e) => updateAgendaRow(row.id, "text", e.target.value)}
                  placeholder="Doors open & welcome"
                />
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => removeAgendaRow(row.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" type="button" onClick={addAgendaRow}>
                + Add agenda item
              </button>
            </div>
          </div>
        </div>

        {/* RSVP / Links */}
        <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 16 }}>
          <div>
            <label className="label">RSVP Link</label>
            <input
              className="input"
              value={rsvpLink}
              onChange={(e) => setRsvpLink(e.target.value)}
              placeholder="https://…"
            />
            <label className="checkbox" style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={rsvpRequired}
                onChange={(e) => setRsvpRequired(e.target.checked)}
              />
              RSVP required
            </label>
          </div>

          <div />
        </div>
      </section>
    </div>
  );
}
