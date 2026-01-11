// src/pages/ClubAnalytics.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, ShieldCheck } from "lucide-react";

import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import useClubAnalytics from "../hooks/useClubAnalytics";

const isUuid = (s) => /^[0-9a-f-]{16,}$/i.test(String(s || ""));
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);
const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString());

export default function ClubAnalytics() {
  const { clubParam, slug } = useParams(); // supports /clubs/:clubParam/analytics OR /club/:slug/analytics
  const param = clubParam || slug;
  const navigate = useNavigate();
  const { user, profile } = useUser();

  // local club/admin gate
  const [loadingGate, setLoadingGate] = useState(true);
  const [club, setClub] = useState(null); // { id, slug, name }
  const [role, setRole] = useState(null); // president | vice | ...
  const [isPremiumClub, setIsPremiumClub] = useState(false);

  // ---- year state (annual analytics) ----
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const {
    loading: dataLoading,
    error: dataError,
    kpis,
    series,
    funnel,
    heatmap,
    topContent,
  } = useClubAnalytics({ clubParam: param, year });

  // ---------- Gate: resolve club, role, premium ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingGate(true);

      // 1) Resolve club by slug OR id (uuid)
      let clubRow = null;
      if (isUuid(param)) {
        const { data, error } = await supabase
          .from("clubs")
          .select("id, slug, name")
          .eq("id", param)
          .maybeSingle();
        if (!error) clubRow = data;
      } else {
        const { data, error } = await supabase
          .from("clubs")
          .select("id, slug, name")
          .eq("slug", param)
          .maybeSingle();
        if (!error) clubRow = data;
      }
      if (!clubRow) {
        if (!cancelled) setLoadingGate(false);
        return;
      }

      // 2) Premium check via RPC (schema-agnostic)
      let premium = false;
      try {
        const { data: prem } = await supabase.rpc("club_is_premium", {
          p_club: clubRow.id,
        });
        premium = !!prem;
      } catch (_) {
        premium = false;
      }

      // 3) Viewer role (if signed in)
      let viewerRole = null;
      if (user?.id) {
        const { data: mem } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubRow.id)
          .eq("user_id", user.id)
          .maybeSingle();
        viewerRole = mem?.role || null;
      }

      if (!cancelled) {
        setClub(clubRow);
        setIsPremiumClub(premium);
        setRole(viewerRole);
        setLoadingGate(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [param, user?.id]);

  const isAdmin = useMemo(
    () =>
      ["president", "vice", "vice_president"].includes(
        (role || "").toLowerCase()
      ),
    [role]
  );

  // ---------- Gates ----------
  if (!loadingGate && (!isAdmin || !isPremiumClub)) {
    const backHref = club?.slug
      ? `/clubs/${club.slug}`
      : isUuid(param)
      ? `/clubs/${param}`
      : `/clubs/${param || ""}`;

    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-white">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-8">
          <div className="mb-2 flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="h-5 w-5" />
            <span>Club Analytics</span>
          </div>
          <h1 className="mb-3 text-2xl font-semibold">No access</h1>
          <p className="text-zinc-400">
            Club Analytics is available only to club admins of Director’s Cut clubs.
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate(backHref)}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Back to Club
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingGate) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-black/40" />
      </div>
    );
  }

  // ---------- Main Analytics UI ----------
  const clubDisplayName = club?.name || "Club";

  // quick totals from series (keeps UI informative even before charts)
  const totals = (series || []).reduce(
    (acc, d) => {
      acc.posts += d.posts || 0;
      acc.comments += d.comments || 0;
      acc.reactions += d.reactions || 0;
      acc.rsvps += d.rsvps || 0;
      acc.attendees += d.attendees || 0;
      return acc;
    },
    { posts: 0, comments: 0, reactions: 0, rsvps: 0, attendees: 0 }
  );

  // ---- year navigation helpers ----
  const goPrevYear = () => setYear((y) => y - 1);
  const goNextYear = () =>
    setYear((y) => (y < currentYear ? y + 1 : y)); // don’t go into the future

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-zinc-300">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics</span>
          </div>
          <h1 className="text-2xl font-semibold">{clubDisplayName}</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Annual view for <span className="text-yellow-300">{year}</span>
          </p>
        </div>

        {/* Year selector with arrows (B) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevYear}
            className="rounded-full border border-zinc-700 px-2 py-1 text-sm hover:bg-zinc-900"
            aria-label="Previous year"
          >
            ‹
          </button>
          <div className="min-w-[4rem] text-center text-sm font-medium">
            {year}
          </div>
          <button
            type="button"
            onClick={goNextYear}
            disabled={year >= currentYear}
            className={`rounded-full border px-2 py-1 text-sm ${
              year >= currentYear
                ? "border-zinc-800 text-zinc-500 cursor-not-allowed"
                : "border-zinc-700 hover:bg-zinc-900"
            }`}
            aria-label="Next year"
          >
            ›
          </button>
        </div>
      </div>

      {/* Error banner (if RPC failed, e.g. permission) */}
      {dataError && (
        <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          {String(dataError.message || dataError)}
        </div>
      )}

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="text-sm text-zinc-400">Members</div>
          <div className="mt-1 text-2xl font-semibold">
            {fmtNum(kpis?.members_total)}
          </div>
          <div className="text-xs text-zinc-500">
            +{fmtNum(kpis?.members_new)} joined in {year}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="text-sm text-zinc-400">Active %</div>
          <div className="mt-1 text-2xl font-semibold">{fmtPct(kpis?.active_pct)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="text-sm text-zinc-400">Attendance</div>
          <div className="mt-1 text-2xl font-semibold">
            {fmtPct(kpis?.attendance_rate)}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="text-sm text-zinc-400">Engagement</div>
          <div className="mt-1 text-2xl font-semibold">
            {fmtPct(kpis?.engagement_rate)}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="text-sm text-zinc-400">Invite Conv.</div>
          <div className="mt-1 text-2xl font-semibold">
            {fmtPct(kpis?.invite_conversion)}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Engagement Over Time – quick totals row */}
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 lg:col-span-2">
          <div className="mb-2 text-sm text-zinc-400">
            Engagement Over Time <span className="text-xs text-zinc-500">({year})</span>
          </div>
          <div className="text-xs text-zinc-500">
            Days with activity: {series?.length ?? 0}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-sm">
            <div>
              <div className="text-zinc-400">Posts</div>
              <div className="font-semibold">{fmtNum(totals.posts)}</div>
            </div>
            <div>
              <div className="text-zinc-400">Comments</div>
              <div className="font-semibold">{fmtNum(totals.comments)}</div>
            </div>
            <div>
              <div className="text-zinc-400">Reactions</div>
              <div className="font-semibold">{fmtNum(totals.reactions)}</div>
            </div>
            <div>
              <div className="text-zinc-400">RSVPs</div>
              <div className="font-semibold">{fmtNum(totals.rsvps)}</div>
            </div>
            <div>
              <div className="text-zinc-400">Attendees</div>
              <div className="font-semibold">{fmtNum(totals.attendees)}</div>
            </div>
          </div>
          {dataLoading && (
            <div className="mt-4 h-24 animate-pulse rounded-xl border border-zinc-800 bg-black/30" />
          )}
        </div>

        {/* Event Funnel – top 3 events */}
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="mb-2 text-sm text-zinc-400">
            Event Funnel <span className="text-xs text-zinc-500">({year})</span>
          </div>
          <div className="space-y-2">
            {(funnel ?? []).slice(0, 3).map((ev) => (
              <div
                key={ev.event_id}
                className="flex items-center justify-between text-sm"
              >
                <div className="truncate pr-2">
                  <div className="font-medium truncate">
                    {ev.event_title || "Untitled"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {ev.starts_at
                      ? new Date(ev.starts_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded border border-zinc-700 px-2 py-0.5">
                    Inv {fmtNum(ev.invites)}
                  </span>
                  <span className="rounded border border-zinc-700 px-2 py-0.5">
                    RSVP {fmtNum(ev.rsvps)}
                  </span>
                  <span className="rounded border border-zinc-700 px-2 py-0.5">
                    Att {fmtNum(ev.attendees)}
                  </span>
                </div>
              </div>
            ))}
            {(!funnel || funnel.length === 0) && (
              <div className="text-xs text-zinc-500">
                No events in {year}.
              </div>
            )}
          </div>
        </div>

        {/* Attendance Heatmap */}
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="mb-2 text-sm text-zinc-400">
            Attendance Heatmap <span className="text-xs text-zinc-500">({year})</span>
          </div>
          {(!heatmap || heatmap.length === 0) ? (
            <div className="text-xs text-zinc-500">
              No attendance yet for {year}.
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
                const total = heatmap
                  .filter((h) => h.dow === dow)
                  .reduce((a, b) => a + (b.attendees || 0), 0);
                const label = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow - 1];
                return (
                  <div
                    key={dow}
                    className="rounded-lg border border-zinc-800 p-2"
                  >
                    <div className="text-zinc-400">{label}</div>
                    <div className="mt-1 font-semibold">{fmtNum(total)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Content – simple list */}
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 lg:col-span-2">
          <div className="mb-2 text-sm text-zinc-400">
            Top Content <span className="text-xs text-zinc-500">({year})</span>
          </div>
          <div className="space-y-2">
            {(topContent ?? []).slice(0, 5).map((m) => (
              <div
                key={m.message_id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 p-2 text-sm"
              >
                <div className="truncate pr-2">
                  <div className="text-xs text-zinc-500">
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : "—"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Author: {m.author_id || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded border border-zinc-700 px-2 py-0.5">
                    💬 {fmtNum(m.comments)}
                  </span>
                  <span className="rounded border border-zinc-700 px-2 py-0.5">
                    👍 {fmtNum(m.reactions)}
                  </span>
                  <span className="rounded border border-yellow-700 text-yellow-300 px-2 py-0.5">
                    Score {fmtNum(m.score)}
                  </span>
                </div>
              </div>
            ))}
            {(!topContent || topContent.length === 0) && (
              <div className="text-xs text-zinc-500">
                No posts for {year}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
