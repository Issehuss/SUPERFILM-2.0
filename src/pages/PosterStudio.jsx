// src/pages/PosterStudio.jsx
import React, { useEffect, useState, useRef } from 'react';
import 'polotno/css/polotno.css';


export default function PosterStudio() {
  const [polotno, setPolotno] = useState(null);
  const [store, setStore] = useState(null);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Safe, runtime imports to avoid build crashes
        const [{ createStore }, mod] = await Promise.all([
          import('polotno/model/store'),
          import('polotno'),
        ]);
        if (!alive) return;

        const s = createStore({});
        s.setSize(900, 1200);              // 3:4 poster
        if (s.pages.length === 0) s.addPage();

        setStore(s);
        setPolotno(mod);
      } catch (e) {
        console.error('[PosterStudio] failed to load:', e);
        if (!alive) return;
        setErr(e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Handlers for the icon rail
  const undo = () => store?.history?.undo?.();
  const redo = () => store?.history?.redo?.();

  const addText = () => {
    const page = store?.activePage;
    if (!page) return;
    page.addElement({
      type: 'text',
      text: 'Double-click to edit',
      x: 120,
      y: 140,
      width: 660,
      fontSize: 64,
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial',
      align: 'center',
      fill: '#ffffff',
      shadowEnabled: true,
      shadowBlur: 16,
      shadowColor: 'rgba(0,0,0,.55)',
      shadowOffsetY: 4,
    });
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file || !store?.activePage) return;
    const reader = new FileReader();
    reader.onload = () => {
      store.activePage.addElement({
        type: 'image',
        src: reader.result,
        x: 0,
        y: 0,
        width: 900, // start full width; user can resize
      });
      // reset input so selecting same file again re-triggers change
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const clearPage = () => {
    const page = store?.activePage;
    if (!page) return;
    // remove all elements on active page
    [...page.children].forEach((el) => page.removeElement(el));
  };

  if (err) {
    return (
      <div style={{ padding: 16, color: '#fca5a5' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Poster Studio failed to load</div>
        <div>{String(err.message || err)}</div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Open DevTools → Console for details.
        </div>
      </div>
    );
  }
  if (!polotno || !store) {
    return <div style={{ padding: 16, color: '#a1a1aa' }}>Loading editor…</div>;
  }

  const { PolotnoContainer, SidePanelWrap, WorkspaceWrap } = polotno;

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <strong>Poster Studio</strong>
      </header>

      <div style={styles.body}>
        <PolotnoContainer className="polotno-app" style={{ height: '100%', minHeight: 0 }}>
          {/* Side panel */}
          <SidePanelWrap store={store} />

          {/* Center with icon rail + canvas */}
          <div style={styles.center}>
            {/* Compact icon rail pinned to the left of the canvas */}
            <div style={styles.rail}>
              <IconBtn title="Undo" onClick={undo}>
                {/* undo arrow */}
                <svg viewBox="0 0 24 24"><path d="M12 5l-7 7 7 7M5 12h10a4 4 0 1 1 0 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </IconBtn>
              <IconBtn title="Redo" onClick={redo}>
                {/* redo arrow */}
                <svg viewBox="0 0 24 24"><path d="M12 5l7 7-7 7M19 12H9a4 4 0 1 0 0 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </IconBtn>
              <div style={styles.railSep} />
              <IconBtn title="Add text" onClick={addText}>
                {/* T */}
                <svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </IconBtn>
              <IconBtn title="Add image" onClick={() => fileRef.current?.click()}>
                {/* image icon */}
                <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="10.5" r="1.5" /><path d="M21 16l-5-5-7 7" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
              </IconBtn>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
              <div style={styles.railSep} />
              <IconBtn title="Clear page" onClick={clearPage}>
                {/* trash */}
                <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </IconBtn>
            </div>

            {/* Canvas */}
            <div style={styles.canvasWrap}>
              <WorkspaceWrap store={store} />
            </div>
          </div>
        </PolotnoContainer>
      </div>
    </div>
  );
}

/* Small icon button */
function IconBtn({ title, onClick, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={iconStyles.btn}
      type="button"
    >
      <span style={iconStyles.svg}>{children}</span>
    </button>
  );
}

const styles = {
  wrap: {
    height: 'calc(100vh - 96px)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '12px 8px',
    borderBottom: '1px solid #26262b',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  center: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    minWidth: 0,
  },
  rail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 8,
    borderRight: '1px solid #26262b',
    background: '#0c0d10',
    minWidth: 48,
    alignItems: 'center',
  },
  railSep: {
    height: 1,
    width: '100%',
    background: '#1f2026',
    margin: '4px 0',
  },
  canvasWrap: {
    minWidth: 0,
    minHeight: 0,
  },
};

const iconStyles = {
  btn: {
    width: 36,
    height: 36,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 8,
    border: '1px solid #2a2b31',
    background: '#111215',
    color: '#e5e7eb',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,.25)',
  },
  svg: {
    width: 18,
    height: 18,
    display: 'inline-block',
  },
};