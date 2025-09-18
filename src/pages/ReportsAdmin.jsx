// src/pages/ReportsAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Filter, BadgeCheck } from "lucide-react";
import { useUser } from "../context/UserContext";
import useReports from "../hooks/useReports";
import supabase from "../supabaseClient";

const CLUB_MOD_ROLES = ["president", "admin", "moderator"]; // ⬅️ includes presidents
const SITE_ROLES = ["admin", "moderator"];

export default function ReportsAdmin({ clubId = null }) {
  const { user } = useUser();
  const { listReports, updateReportStatus } = useReports();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // permissions
  const [isSiteMod, setIsSiteMod] = useState(false);
  const [isClubMod, setIsClubMod] = useState(false);
  const canModerate = useMemo(
    () => isSiteMod || (clubId && isClubMod),
    [isSiteMod, isClubMod, clubId]
  );

  // --- figure out permissions ---
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!user?.id) return;

      // 1) site-level role from profiles.roles
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("roles, display_name")
          .eq("id", user.id)
          .maybeSingle();
        const roles = Array.isArray(prof?.roles) ? prof.roles : [];
        if (!ignore) {
          setIsSiteMod(roles.some((r) => SITE_ROLES.includes(String(r).toLowerCase())));
        }
      } catch {
        if (!ignore) setIsSiteMod(false);
      }

      // 2) club-level role (if clubId provided)
      if (clubId) {
        try {
          const { data: mem } = await supabase
            .from("club_members")
            .select("role")
            .eq("club_id", clubId)
            .eq("user_id", user.id)
            .maybeSingle();
          const role = String(mem?.role || "").toLowerCase();
          if (!ignore) setIsClubMod(CLUB_MOD_ROLES.includes(role));
        } catch {
          if (!ignore) setIsClubMod(false);
        }
      } else {
        if (!ignore) setIsClubMod(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [user?.id, clubId]);

  // --- load reports (RLS will also enforce who can see what) ---
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // If no permission, don't bother hitting DB (prevents flash)
        if (!isSiteMod && !(clubId && isClubMod)) {
          if (!ignore) {
            setItems([]);
            setLoading(false);
          }
          return;
        }

        const rows = await listReports({ status, clubId: clubId || null });
        if (!ignore) setItems(rows || []);
      } catch (e) {
        if (!ignore) setErr(e.message || "Failed to load reports");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [status, clubId, isSiteMod, isClubMod, listReports]);

  const setStatusFor = async (id, newStatus) => {
    try {
      if (!canModerate) return; // UI guard; RLS still enforces
      await updateReportStatus(id, newStatus);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setErr(e.message || "Could not update report.");
    }
  };

  // --- access gate messages
  if (!user?.id) {
    return <div className="max-w-4xl mx-auto p-4 text-zinc-300">Please sign in.</div>;
  }
  if (!canModerate) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-300">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
            <ShieldCheck size={18} /> Reports
          </div>
          <p className="mt-2 text-sm">
            You don’t have permission to view this page.
            {clubId
              ? " Ask a club admin or president to grant you a moderator role."
              : " Site moderators and admins can view all reports."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2 text-zinc-100">
          <ShieldCheck /> Reports {clubId ? "(This Club)" : "(All Clubs)"}
        </h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-300">
            <BadgeCheck size={14} />
            {clubId
              ? isSiteMod
                ? "Site Moderator"
                : isClubMod
                ? "Club Moderator (incl. President)"
                : "Member"
              : "Site Moderator"}
          </span>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm"
            >
              <option value="open">Open</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>
      </header>

      {loading && <p className="text-zinc-400">Loading…</p>}
      {err && <p className="text-red-400">{err}</p>}

      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-800 p-4 bg-zinc-900">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                {new Date(r.created_at).toLocaleString()}
              </div>
              <span className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200">
                {r.target_type} · {r.reason}
              </span>
            </div>

            <div className="mt-2 text-sm text-zinc-200">
              <div>
                <span className="text-zinc-400">Target ID:</span> {r.target_id}
              </div>
              {r.club_id && (
                <div>
                  <span className="text-zinc-400">Club:</span> {r.club_id}
                </div>
              )}
              {r.details && (
                <div className="mt-2 whitespace-pre-wrap text-zinc-300">{r.details}</div>
              )}
            </div>

            {status === "open" && canModerate && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setStatusFor(r.id, "actioned")}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-black font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 size={16} /> Actioned
                </button>
                <button
                  onClick={() => setStatusFor(r.id, "dismissed")}
                  className="px-3 py-2 rounded-lg bg-zinc-700 text-white font-semibold flex items-center gap-1"
                >
                  <XCircle size={16} /> Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-zinc-400">No reports.</p>
        )}
      </div>
    </div>
  );
}
