// src/pages/Events.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Link } from "react-router-dom";
import "./Events.css";

/** ---- Demo club data ---- */
const CLUBS = [
  { id: "1", name: "Cinephiles United", image: "/club-images/Club1-PFP.jpeg" },
  { id: "2", name: "Frame by Frame", image: "/club-images/Club2-PFP.jpeg" },
  { id: "3", name: "The Reel Critics", image: "/club-images/Club3-PFP.jpeg" },
  { id: "4", name: "Indie Icons", image: "/club-images/Club4-PFP.jpeg" },
  { id: "5", name: "Hollywood Nights", image: "/club-images/Club5-PFP.jpeg" },
  { id: "6", name: "Foreign Film Society", image: "/club-images/Club6-PFP.jpeg" },
  { id: "7", name: "Late Night Screenings", image: "/club-images/Club7-PFP.jpeg" },
  { id: "8", name: "Couch Critics", image: "/club-images/Club8-PFP.jpeg" },
  { id: "9", name: "Cinema Underground", image: "/club-images/Club9-PFP.jpeg" },
  { id: "10", name: "Projector Club", image: "/club-images/Club10-PFP.jpeg" },
];

/** ---- Seed fake events ---- */
function seedEvents() {
  const now = new Date();
  const addDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };
  const picks = [
    { title: "Thriller Night Double Bill", tags: ["Thriller", "Neo-Noir"] },
    { title: "Animation & Storytelling", tags: ["Animation"] },
    { title: "Indie Gems Watch Party", tags: ["Indie"] },
    { title: "Horror After Dark", tags: ["Horror"] },
    { title: "Comedy & Romance", tags: ["Comedy", "Romance"] },
  ];
  const out = [];
  CLUBS.forEach((club, i) => {
    const p = picks[i % picks.length];
    out.push({
      id: `seed-${i}`,
      clubId: club.id,
      clubName: club.name,
      date: addDays((i * 3) % 20).toISOString(),
      title: p.title,
      venue: ["Online", "Campus Theatre", "Studio 2", "Community Hall"][i % 4],
      posterUrl: club.image,
      tags: p.tags,
      summary: "Join us for a screening + discussion. Open to all.",
    });
  });
  return out;
}

/* ---------------- Polotno: embedded studio with real tools ---------------- */
const PolotnoPoster = forwardRef(function PolotnoPoster({ initialImage }, ref) {
  const [mod, setMod] = useState(null);
  const [store, setStore] = useState(null);

  // rail refs
  const stickerInputRef = useRef(null);
  const bgInputRef = useRef(null);

  // draw/erase overlay
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [tool, setTool] = useState("none"); // 'none' | 'draw' | 'erase'
  const [brushType, setBrushType] = useState("pen"); // 'pen' | 'marker' | 'highlighter'
  const [brushSize, setBrushSize] = useState(6);
  const [brushColor, setBrushColor] = useState("#f1b707");
  const [eraserSize, setEraserSize] = useState(24);
  const [eraserShape, setEraserShape] = useState("circle"); // 'circle' | 'square'
  const [cursorPos, setCursorPos] = useState(null);
  const drawingRef = useRef(false);

  // selection reaction (for text controls)
  const [, forceTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ createStore }, polotno] = await Promise.all([
        import("polotno/model/store"),
        import("polotno"),
      ]);
      if (!alive) return;
      const s = createStore({});
      s.setSize(900, 1200);
      if (s.pages.length === 0) s.addPage();

      if (initialImage) {
        s.activePage.addElement({
          type: "image",
          src: initialImage,
          x: 0,
          y: 0,
          width: 900,
        });
      }

      s.on("change", () => forceTick((v) => v + 1));

      // Delete / Backspace removes selected elements (unless typing)
      const onKey = (e) => {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        const typing =
          tag === "input" ||
          tag === "textarea" ||
          document.activeElement?.contentEditable === "true";
        if (!typing && (e.key === "Backspace" || e.key === "Delete")) {
          s.selectedElements?.forEach((el) => el.remove && el.remove());
        }
      };
      window.addEventListener("keydown", onKey);

      setStore(s);
      setMod(polotno);

      return () => {
        window.removeEventListener("keydown", onKey);
      };
    })();
    return () => {
      alive = false;
    };
  }, [initialImage]);

  // expose PNG export to parent
  useImperativeHandle(ref, () => ({
    async getPNG() {
      if (!store) return null;
      if (tool !== "none") await commitOverlayToCanvas(); // apply drawing
      if (typeof store.toDataURL === "function") {
        return await store.toDataURL({ pixelRatio: 2 });
      }
      if (store.activePage?.toDataURL) {
        return await store.activePage.toDataURL({ pixelRatio: 2 });
      }
      return null;
    },
  }));

  // overlay sizing
  useEffect(() => {
    if (!overlayRef.current) return;
    const ro = new ResizeObserver(() => {
      const el = overlayRef.current;
      const w = Math.max(200, el.clientWidth);
      const h = Math.max(200, el.clientHeight);
      const c = canvasRef.current;
      if (!c) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, w, h);
    });
    ro.observe(overlayRef.current);
    return () => ro.disconnect();
  }, [overlayRef]);

  if (!mod || !store) {
    return <div className="studio-loading">Loading editor…</div>;
  }

  const { PolotnoContainer, SidePanelWrap, WorkspaceWrap } = mod;

  /* ------------- rail actions ------------- */

  const undo = () => store.history?.undo?.();
  const redo = () => store.history?.redo?.();

  const addText = () => {
    const page = store.activePage;
    page.addElement({
      type: "text",
      text: "Double-click to edit",
      x: 120,
      y: 120,
      width: 660,
      fontSize: 64,
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      align: "center",
      fill: "#ffffff",
      shadowEnabled: true,
      shadowBlur: 16,
      shadowColor: "rgba(0,0,0,.55)",
      shadowOffsetY: 4,
    });
  };

  const addStickerFromFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const page = store.activePage;
      page.addElement({
        type: "image",
        src: reader.result,
        x: 40,
        y: 40,
        width: 260,
      });
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const uploadBackground = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const page = store.activePage;
      page.addElement({
        type: "image",
        src: reader.result,
        x: 0,
        y: 0,
        width: 900,
        height: 1200,
      });
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const duplicate = () => {
    const page = store.activePage;
    const sels = store.selectedElements || [];
    if (!sels.length) return;
    const newOnes = [];
    sels.forEach((el) => {
      const json = el.toJSON ? el.toJSON() : null;
      if (!json) return;
      json.x = (json.x || 0) + 24;
      json.y = (json.y || 0) + 24;
      const created = page.addElement(json);
      if (created) newOnes.push(created);
    });
    if (newOnes.length) store.selectElements(newOnes);
  };

  // bring forward/back (fallback implementation)
  const bringFront = () => {
    try {
      const page = store.activePage;
      (store.selectedElements || []).forEach((el) => {
        const json = el.toJSON?.();
        if (!json) return;
        el.remove?.();
        page.addElement(json); // append to top
      });
    } catch {}
  };
  const sendBack = () => {
    try {
      const page = store.activePage;
      const children = page.children?.slice() || [];
      const selected = new Set(store.selectedElements || []);
      const selJson = [];
      children.forEach((el) => {
        if (selected.has(el)) {
          selJson.push(el.toJSON?.());
          el.remove?.();
        }
      });
      // re-add selected first (at back)
      selJson.forEach((j) => j && page.addElement(j));
      // then others to restore order
      children
        .filter((el) => !selected.has(el))
        .forEach((el) => page.addElement(el.toJSON?.()));
    } catch {}
  };

  const removeSelected = () => {
    store.selectedElements?.forEach((el) => el.remove?.());
  };

  /* ------------- text controls ------------- */

  const selectedText = () =>
    (store.selectedElements || []).find((e) => e.type === "text");

  const applyToSelectedText = (partial) => {
    (store.selectedElements || [])
      .filter((e) => e.type === "text")
      .forEach((t) => t.set?.(partial));
  };

  const toggleStyle = (style) => {
    const t = selectedText();
    if (!t) return;
    const prev = t.fontStyle || "normal";
    let next = prev;
    const hasBold = prev.includes("bold");
    const hasItalic = prev.includes("italic");

    if (style === "bold") {
      next = `${hasBold ? "" : "bold"} ${hasItalic ? "italic" : ""}`.trim() || "normal";
    } else if (style === "italic") {
      next = `${hasBold ? "bold" : ""} ${hasItalic ? "" : "italic"}`.trim() || "normal";
    } else if (style === "underline") {
      t.set?.({ underline: !t.underline });
      return;
    }
    t.set?.({ fontStyle: next });
  };

  /* ------------- draw / erase overlay ------------- */

  const inOverlay = tool === "draw" || tool === "erase";

  const pointer = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y };
  };

  const onOverlayDown = (e) => {
    if (!inOverlay) return;
    drawingRef.current = true;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const { x, y } = pointer(e);

    if (tool === "draw") {
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.globalCompositeOperation = "destination-out";
      eraseDot(ctx, x, y);
    }
    e.preventDefault();
  };

  const onOverlayMove = (e) => {
    if (!inOverlay) return;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const { x, y } = pointer(e);
    setCursorPos({ x, y });

    if (!drawingRef.current) return;

    if (tool === "draw") {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.globalAlpha = brushType === "highlighter" ? 0.35 : 1;
      if (brushType === "marker") ctx.lineWidth = brushSize * 1.6;

      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === "erase") {
      eraseDot(ctx, x, y);
    }
  };

  const onOverlayUp = () => {
    if (!inOverlay) return;
    drawingRef.current = false;
  };

  const eraseDot = (ctx, x, y) => {
    if (eraserShape === "circle") {
      ctx.beginPath();
      ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
    }
  };

  const clearOverlay = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const commitOverlayToCanvas = async () => {
    const c = canvasRef.current;
    if (!c) return;

    // detect blank overlay
    const blank = document.createElement("canvas");
    blank.width = c.width;
    blank.height = c.height;
    if (c.toDataURL() === blank.toDataURL()) return;

    // scale to 900x1200 and place as image element
    const out = document.createElement("canvas");
    out.width = 900;
    out.height = 1200;
    const ctx = out.getContext("2d");
    ctx.drawImage(c, 0, 0, out.width, out.height);

    store.activePage.addElement({
      type: "image",
      src: out.toDataURL("image/png"),
      x: 0,
      y: 0,
      width: 900,
      height: 1200,
    });

    clearOverlay();
    setTool("none");
  };

  /* ------------- bottom actions ------------- */

  const downloadPNG = async () => {
    const data = await ref.current?.getPNG?.();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data;
    a.download = "poster.png";
    a.click();
  };

  const sharePNG = async () => {
    const data = await ref.current?.getPNG?.();
    if (!data) return;
    if (navigator.canShare && navigator.canShare()) {
      const res = await fetch(data);
      const blob = await res.blob();
      const file = new File([blob], "poster.png", { type: "image/png" });
      try {
        await navigator.share({ files: [file], title: "SuperFilm Poster" });
      } catch (_) {}
    } else {
      await navigator.clipboard.writeText(data);
      alert("Poster PNG copied to clipboard (data URL).");
    }
  };

  /* ------------- UI ------------- */

  const t = selectedText();

  return (
    <div className="studio-wrap">
      <PolotnoContainer className="polotno-app" style={{ height: "100%" }}>
        <SidePanelWrap store={store} />
        <div className="studio-center">
          {/* Icon rail */}
          <div className="studio-rail">
            <IconBtn title="Undo" onClick={undo}>
              <ArrowLeftIcon />
            </IconBtn>
            <IconBtn title="Redo" onClick={redo}>
              <ArrowRightIcon />
            </IconBtn>

            <div className="studio-rail-sep" />

            <IconBtn title="Add text" onClick={addText}>
              <TIcon />
            </IconBtn>

            <IconBtn
              title="Add sticker"
              onClick={() => stickerInputRef.current?.click()}
            >
              <StickerIcon />
            </IconBtn>
            <input
              ref={stickerInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={addStickerFromFile}
            />

            <div className="studio-rail-sep" />

            <IconBtn
              title="Draw"
              onClick={() => setTool((v) => (v === "draw" ? "none" : "draw"))}
            >
              <PenIcon active={tool === "draw"} />
            </IconBtn>

            <IconBtn
              title="Eraser"
              onClick={() => setTool((v) => (v === "erase" ? "none" : "erase"))}
            >
              <EraserIcon active={tool === "erase"} />
            </IconBtn>

            <div className="studio-rail-sep" />

            <IconBtn title="Duplicate" onClick={duplicate}>
              <DuplicateIcon />
            </IconBtn>
            <IconBtn title="Bring front" onClick={bringFront}>
              <BringFrontIcon />
            </IconBtn>
            <IconBtn title="Send back" onClick={sendBack}>
              <SendBackIcon />
            </IconBtn>
            <IconBtn title="Delete" onClick={removeSelected}>
              <TrashIcon />
            </IconBtn>
          </div>

          {/* Canvas + overlay drawer */}
          <div className="studio-canvas" ref={overlayRef}>
            <WorkspaceWrap store={store} />

            {/* drawing overlay */}
            { (tool === "draw" || tool === "erase") && (
              <>
                <canvas
                  ref={canvasRef}
                  className="poster-editor-canvas"
                  onMouseDown={onOverlayDown}
                  onMouseMove={onOverlayMove}
                  onMouseUp={onOverlayUp}
                  onMouseLeave={onOverlayUp}
                  onTouchStart={onOverlayDown}
                  onTouchMove={onOverlayMove}
                  onTouchEnd={onOverlayUp}
                />
                {/* eraser outline cursor */}
                {tool === "erase" && cursorPos && (
                  <div
                    className={`eraser-cursor ${eraserShape === "square" ? "square" : ""}`}
                    style={{
                      width: eraserSize,
                      height: eraserSize,
                      left: (cursorPos.x || 0) - eraserSize / 2,
                      top: (cursorPos.y || 0) - eraserSize / 2,
                      position: "absolute",
                    }}
                  />
                )}

                {/* mini flyout for draw/erase options */}
                <div
                  style={{
                    position: "absolute",
                    right: 12,
                    bottom: 12,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    background: "rgba(15,16,20,.8)",
                    border: "1px solid #2b2c34",
                    borderRadius: 12,
                    padding: 8,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  {tool === "draw" ? (
                    <>
                      <select
                        className="input compact"
                        value={brushType}
                        onChange={(e) => setBrushType(e.target.value)}
                      >
                        <option value="pen">Pen</option>
                        <option value="marker">Marker</option>
                        <option value="highlighter">Highlighter</option>
                      </select>
                      <div className="color-swatch">
                        <input
                          type="color"
                          value={brushColor}
                          onChange={(e) => setBrushColor(e.target.value)}
                        />
                        <span className="swatch" style={{ background: brushColor }} />
                      </div>
                      <input
                        className="input compact w-20"
                        type="number"
                        min={1}
                        max={96}
                        value={brushSize}
                        onChange={(e) => setBrushSize(+e.target.value || 1)}
                      />
                    </>
                  ) : (
                    <>
                      <button
                        className={`tool-toggle ${eraserShape === "circle" ? "on" : ""}`}
                        onClick={() => setEraserShape("circle")}
                      >
                        ○
                      </button>
                      <button
                        className={`tool-toggle ${eraserShape === "square" ? "on" : ""}`}
                        onClick={() => setEraserShape("square")}
                      >
                        ◻
                      </button>
                      <input
                        className="input compact w-20"
                        type="number"
                        min={6}
                        max={128}
                        value={eraserSize}
                        onChange={(e) => setEraserSize(+e.target.value || 6)}
                      />
                    </>
                  )}

                  <button className="tool-btn" onClick={commitOverlayToCanvas}>
                    Apply
                  </button>
                  <button className="tool-btn danger" onClick={clearOverlay}>
                    Clear
                  </button>
                </div>
              </>
            )}

            {/* text controls (only when a text element is selected) */}
            {t && (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  background: "rgba(15,16,20,.8)",
                  border: "1px solid #2b2c34",
                  borderRadius: 12,
                  padding: 8,
                  backdropFilter: "blur(6px)",
                }}
              >
                <select
                  className="input compact"
                  value={t.fontFamily || "Inter"}
                  onChange={(e) => applyToSelectedText({ fontFamily: e.target.value })}
                >
                  <option>Inter</option>
                  <option>Arial</option>
                  <option>Helvetica</option>
                  <option>Georgia</option>
                  <option>Times New Roman</option>
                  <option>Courier New</option>
                  <option>Futura</option>
                </select>

                <input
                  className="input compact w-20"
                  type="number"
                  min={10}
                  max={160}
                  value={Math.round(t.fontSize || 48)}
                  onChange={(e) => applyToSelectedText({ fontSize: +e.target.value || 10 })}
                />

                <div className="color-swatch">
                  <input
                    type="color"
                    value={t.fill || "#ffffff"}
                    onChange={(e) => applyToSelectedText({ fill: e.target.value })}
                  />
                  <span className="swatch" style={{ background: t.fill || "#ffffff" }} />
                </div>

                <button
                  className={`tool-toggle ${String(t.fontStyle || "").includes("bold") ? "on" : ""}`}
                  onClick={() => toggleStyle("bold")}
                >
                  B
                </button>
                <button
                  className={`tool-toggle ${String(t.fontStyle || "").includes("italic") ? "on" : ""}`}
                  onClick={() => toggleStyle("italic")}
                >
                  I
                </button>
                <button
                  className={`tool-toggle ${t.underline ? "on" : ""}`}
                  onClick={() => toggleStyle("underline")}
                >
                  U
                </button>

                <button className="tool-toggle" onClick={() => applyToSelectedText({ align: "left" })}>
                  ⟸
                </button>
                <button className="tool-toggle" onClick={() => applyToSelectedText({ align: "center" })}>
                  ⊕
                </button>
                <button className="tool-toggle" onClick={() => applyToSelectedText({ align: "right" })}>
                  ⟹
                </button>
              </div>
            )}
          </div>
        </div>
      </PolotnoContainer>

      {/* Bottom icon bar */}
      <div className="poster-actions-icons" style={{ padding: 8 }}>
        <IconBtn title="Upload background" onClick={() => bgInputRef.current?.click()}>
          <UploadIcon />
        </IconBtn>
        <input ref={bgInputRef} type="file" accept="image/*" hidden onChange={uploadBackground} />

        <IconBtn title="Download PNG" onClick={downloadPNG}>
          <DownloadIcon />
        </IconBtn>
        <IconBtn title="Share" onClick={sharePNG}>
          <ShareIcon />
        </IconBtn>
        <IconBtn title="Reset drawing overlay" onClick={clearOverlay}>
          <ResetIcon />
        </IconBtn>

        <div className="spacer" />
      </div>
    </div>
  );
});

/* tiny icon button */
function IconBtn({ title, onClick, children }) {
  return (
    <button title={title} onClick={onClick} type="button" className="studio-icon-btn">
      <span className="studio-icon">{children}</span>
    </button>
  );
}

/* --- simple inline icons (kept tiny) --- */
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 5l-7 7 7 7M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);
const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 5l7 7-7 7M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);
const TIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);
const StickerIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M4 7a3 3 0 0 1 3-3h6l7 7v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M14 4v5a3 3 0 0 0 3 3h5" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
);
const PenIcon = ({ active }) => (
  <svg viewBox="0 0 24 24"><path d="M12 20h9" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z" stroke="currentColor" strokeWidth="2" fill={active ? "currentColor" : "none"}/></svg>
);
const EraserIcon = ({ active }) => (
  <svg viewBox="0 0 24 24"><path d="M3 17l7-7 7 7-4 4H7z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"/></svg>
);
const DuplicateIcon = () => (
  <svg viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/><rect x="5" y="5" width="10" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
);
const BringFrontIcon = () => (
  <svg viewBox="0 0 24 24"><rect x="4" y="14" width="8" height="6" stroke="currentColor" strokeWidth="2" fill="none"/><rect x="12" y="4" width="8" height="6" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
);
const SendBackIcon = () => (
  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="8" height="6" stroke="currentColor" strokeWidth="2" fill="none"/><rect x="12" y="14" width="8" height="6" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M20 20H4a2 2 0 0 1-2-2v-3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
);
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M20 20H4" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
);
const ShareIcon = () => (
  <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8.6 13.5l6.8 3M15.4 7.5L8.6 10" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
);
const ResetIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M3 3v6h6" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
);

/** ---------------- Poster Card ---------------- */
function PosterCard({ evt }) {
  const d = new Date(evt.date);
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();

  return (
    <article className="poster-card">
      <Link to={`/club/${evt.clubId}`} className="block">
        <div className="poster-media">
          <img
            src={evt.posterUrl}
            alt={evt.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src =
                "https://via.placeholder.com/600x800?text=Event+Poster";
            }}
          />
          <div className="poster-date">
            <div className="m">{month}</div>
            <div className="d">{day}</div>
          </div>
        </div>
        <div className="poster-info">
          <h3 className="title">{evt.title}</h3>
          <div className="meta">
            <span className="dot" />
            {evt.clubName} • {evt.venue}
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
      </Link>
    </article>
  );
}

/** ---------------- Events Page ---------------- */
export default function Events() {
  const [events, setEvents] = useState(() => seedEvents());
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.clubName.toLowerCase().includes(q) ||
        e.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [events, query]);

  const addEvent = (evt) => setEvents((prev) => [evt, ...prev]);

  return (
    <div className="events-page">
      <header className="page-head">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-zinc-400 mt-1">
            Find screenings, watch parties and club meetups.
          </p>
        </div>

        <div className="head-actions">
          <input
            className="search"
            placeholder="Search events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary" onClick={() => setModalOpen(true)}>
            List Event
          </button>
        </div>
      </header>

      <section className="poster-grid">
        {filtered.map((evt) => (
          <PosterCard key={evt.id} evt={evt} />
        ))}
        {filtered.length === 0 && (
          <div className="empty">No events match your search.</div>
        )}
      </section>

      <ListEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(evt) => addEvent(evt)}
      />
    </div>
  );
}

/* --------- Modal with Details + Poster (Polotno) --------- */
function ListEventModal({ open, onClose, onCreate }) {
  const [step, setStep] = useState("details");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [clubId, setClubId] = useState(CLUBS[0].id);
  const [tags, setTags] = useState("");
  const posterRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setStep("details");
      setTitle("");
      setSummary("");
      setDate("");
      setTime("");
      setVenue("");
      setClubId(CLUBS[0].id);
      setTags("");
    }
  }, [open]);

  const handleCreate = async () => {
    const posterUrl = (await posterRef.current?.getPNG()) || "";
    const club = CLUBS.find((c) => c.id === clubId);
    onCreate({
      id: "evt-" + Math.random().toString(36).slice(2, 9),
      clubId,
      clubName: club?.name || "Club",
      date: new Date(`${date}T${time || "19:00"}`).toISOString(),
      title: title || "Untitled Screening",
      venue: venue || "TBA",
      posterUrl: posterUrl || club?.image || "",
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      summary: summary || "",
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="events-modal-overlay" role="dialog" aria-modal="true">
      <div className="events-modal">
        <div className="events-modal__header">
          <h3 className="text-lg font-semibold">List Event</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="events-modal__tabs">
          <button
            className={`tab ${step === "details" ? "is-active" : ""}`}
            onClick={() => setStep("details")}
          >
            Details
          </button>
          <button
            className={`tab ${step === "poster" ? "is-active" : ""}`}
            onClick={() => setStep("poster")}
          >
            Poster
          </button>
        </div>

        {step === "details" && (
          <div className="events-modal__body grid gap-4 md:grid-cols-2">
            <div className="col-span-2">
              <label className="label">Club</label>
              <select
                className="input"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
              >
                {CLUBS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="label">Event title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Indie Gems Watch Party"
              />
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
              <label className="label">Venue / Link</label>
              <input
                className="input"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Online / Cinema Hall / Room 204…"
              />
            </div>

            <div>
              <label className="label">Tags (comma-separated)</label>
              <input
                className="input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Horror, Cult, A24"
              />
            </div>

            <div className="col-span-2">
              <label className="label">Summary</label>
              <textarea
                className="input"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What’s the hook? Screening + post-film chat etc."
              />
            </div>

            <div className="col-span-2 flex justify-end gap-3">
              <button className="btn ghost" onClick={() => setStep("poster")}>
                Next: Poster →
              </button>
            </div>
          </div>
        )}

        {step === "poster" && (
          <div className="events-modal__body poster-step">
            <PolotnoPoster
              ref={posterRef}
              initialImage={CLUBS.find((c) => c.id === clubId)?.image}
            />

            <div className="studio-footer">
              <button className="btn ghost" onClick={() => setStep("details")}>
                ← Back
              </button>
              <button className="btn primary" onClick={handleCreate}>
                Save & List Event
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}