// src/components/ReviewCards.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import useEntitlements from "../hooks/useEntitlements";
import { awardPointsForAction } from "../lib/points";
import RatingInput from "./RatingInput";
import RatingTagChip from "./RatingTagChip";

/**
 * Helper: basic UUID check (loose but safe for our case)
 */
function looksLikeUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/**
 * ReviewCards
 * Props:
 *  - open, onClose
 *  - clubId: UUID
 *  - filmId: EITHER a UUID (film_id) OR a TMDB numeric id (movie_id)
 *  - movieTitle?: string (title of the next screening film)
 *  - posterPath?: string (poster of the next screening film)
 *
 * We auto-detect which column to use to avoid uuid=int errors.
 * User-level takes are mirrored into film_takes with movie title & poster.
 */
export default function ReviewCards({
  open,
  onClose,
  clubId,
  filmId,
  movieTitle,
  posterPath,
}) {
  const { user, profile } = useUser();
  const uid = user?.id;
  const { limits } = useEntitlements();
  const isPremium = limits?.isPremium || false;

  // panel state
  const [loading, setLoading] = useState(true);
  const [avg, setAvg] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [saving, setSaving] = useState(false);

  // premium & scheme
  const [defaultMode, setDefaultMode] = useState("stars"); // 'tags' | 'stars'
  const [scheme, setScheme] = useState(null);

  // my input state (object that can hold either stars or tag selection)
  const [myInput, setMyInput] = useState({ rating_5: 0 });
  const [myReview, setMyReview] = useState("");

  // decide which column to query on for film identity
  // We always use TMDB numeric IDs for Next Screening
const useUuidFilm = false;
const filmColumn = "movie_id";
const filmValue = Number(filmId) || null;

  const canSubmit = useMemo(
    () =>
      !!uid &&
      !!clubId &&
      !!filmValue &&
      (Number(myInput?.rating_5) || 0) > 0,
    [uid, clubId, filmValue, myInput?.rating_5]
  );

  // --- load helpers ---
  async function loadPremiumAndScheme() {
    if (!uid) {
      setScheme(null);
      setDefaultMode("stars");
      return;
    }

    setDefaultMode(profile?.default_rating_input === "tags" ? "tags" : "stars");

    if (isPremium) {
      const { data: sch } = await supabase
        .from("profile_rating_schemes")
        .select("id, profile_id, name, is_active, tags, updated_at, created_at")
        .eq("profile_id", uid)
        .eq("is_active", true)
        .maybeSingle();
      setScheme(sch || null);
    } else {
      setScheme(null);
    }
  }

  async function load() {
    if (!open || !clubId || !filmValue) return;
    setLoading(true);

    // Build the shared filter for this film in this club
    const filter = (q) =>
      q.eq("club_id", clubId).eq(filmColumn, filmValue);

    const [{ data: list }, { data: mine }, { data: avgRows }] =
      await Promise.all([
        filter(
          supabase
            .from("film_ratings")
            .select(`
            id, rating_5, review, created_at, tag_label, tag_desc, tag_emoji,
            profiles:user_id (display_name, avatar_url, slug)
          `)
            .order("created_at", { ascending: false })
        ),
        uid
          ? filter(
              supabase
                .from("film_ratings")
                .select(
                  "id, rating_5, review, tag_id, tag_label, tag_desc, tag_emoji, custom_weight"
                )
                .eq("user_id", uid)
                .maybeSingle()
            )
          : Promise.resolve({ data: null }),
        filter(
          supabase.from("film_ratings").select("rating_5")
        ),
      ]);

    setReviews(list || []);

    if (mine?.rating_5) {
      // prefill my input with whatever I previously used (tags or stars)
      setMyInput({
        rating_5: Number(mine.rating_5) || 0,
        tag_id: mine.tag_id ?? null,
        tag_label: mine.tag_label ?? null,
        tag_desc: mine.tag_desc ?? null,
        tag_emoji: mine.tag_emoji ?? null,
        custom_weight: mine.custom_weight ?? null,
      });
      setMyReview(mine.review || "");
    } else {
      setMyInput({ rating_5: 0 });
      setMyReview("");
    }

    if (Array.isArray(avgRows)) {
      const arr = avgRows
        .map((r) => Number(r.rating_5) || 0)
        .filter(Boolean);
      setAvg(
        arr.length
          ? (
              arr.reduce((a, b) => a + b, 0) / arr.length
            ).toFixed(1)
          : null
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPremiumAndScheme();
  }, [uid, isPremium, profile?.default_rating_input]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clubId, filmId, uid]);

  // --- save (club rating + mirrored user take) ---
  async function save() {
    if (!canSubmit || saving) return;
    setSaving(true);

    try {
      const base = {
        club_id: clubId,
        user_id: uid,
        review: myReview || null,
        updated_at: new Date().toISOString(),
      };

      // Tag path if both id & custom weight present
      const isTagPath =
        !!myInput?.tag_id && !!myInput?.custom_weight;

      const payload = {
        ...base,
        [filmColumn]: filmValue, // film_id (uuid) OR movie_id (number)
        rating_5: Number(myInput?.rating_5) || null,
        custom_weight: isTagPath
          ? Number(myInput.custom_weight)
          : null,
        tag_id: isTagPath ? myInput.tag_id : null,
        tag_label: isTagPath ? myInput.tag_label : null,
        tag_desc: isTagPath ? myInput.tag_desc ?? null : null,
        tag_emoji: isTagPath ? myInput.tag_emoji ?? null : null,
      };

      // Pick the right conflict target (must exist as a unique constraint or PK on your table)
      const onConflictCols = useUuidFilm
        ? "club_id,user_id,film_id"
        : "club_id,user_id,movie_id";

      // 1️⃣ SAVE TO CLUB TABLE (film_ratings)
      const { data, error } = await supabase
        .from("film_ratings")
        .upsert(payload, { onConflict: onConflictCols })
        .select("id")
        .maybeSingle();

      if (error) {
        console.warn("save rating error:", error.message);
        toast.error(error.message || "Could not save your rating.");
        return;
      }

      // 2️⃣ MIRROR TO USER FILM TAKES TABLE (film_takes)
      //    For this panel, we expect a TMDB numeric id on movie_id.
      if (!useUuidFilm && filmValue) {
        // keep originals for consistency with existing UI
        const titleForTake =
          (movieTitle && String(movieTitle).trim()) || null;
        const posterForTake =
          (posterPath && String(posterPath).trim()) || null;

        const { error: takeErr } = await supabase
          .from("film_takes")
          .upsert(
            {
              user_id: uid,
              movie_id: useUuidFilm ? null : filmValue,
              movie_title: titleForTake,
              poster_path: posterForTake,
              rating: Number(myInput?.rating_5) || null,
              blurb: myReview || null,
              created_at: new Date().toISOString(),
            },
            { onConflict: "user_id,movie_id" }
          );

        if (takeErr) {
          console.warn("film_takes error:", takeErr.message || takeErr);
        }
      }

      // 3️⃣ AWARD POINTS + REFRESH CLUB REVIEWS
      await awardPointsForAction({
        clubId,
        userId: uid,
        action: "RATE_FILM",
        subjectId: data?.id,
        reason: "Rated the film",
      });

      await load();
      toast.success("Saved to the club review.");
    } catch (err) {
      console.warn("save rating failed:", err?.message || err);
      toast.error("Could not save your rating.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[640px] rounded-t-2xl sm:rounded-2xl border border-zinc-800 bg-black/90">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="text-white font-semibold">
            Reviews &amp; Ratings
          </div>
          <button
            className="text-zinc-400 hover:text-zinc-200 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-4">
          {/* average */}
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              Club Average
            </div>
            <div className="text-2xl font-bold text-white">
              {loading ? "—" : avg ?? "—"}
            </div>
          </div>

          {/* my rating input */}
          {uid ? (
            <div className="mb-5 rounded-xl border border-zinc-800 bg-black/40 p-3">
              <div className="text-sm text-zinc-300 mb-2">
                Your rating
              </div>

              <RatingInput
                isPremium={isPremium}
                scheme={scheme}
                defaultMode={defaultMode}
                value={myInput}
                onChange={setMyInput}
              />

              <textarea
                className="mt-3 w-full rounded-lg border border-zinc-700 bg-black/60 p-2 text-sm text-white"
                rows={3}
                placeholder="Share a quick thought (optional)"
                value={myReview}
                onChange={(e) =>
                  setMyReview(e.target.value)
                }
              />

              <div className="mt-3 flex justify-end">
                <button
                  onClick={save}
                  disabled={!canSubmit || saving}
                  className="rounded-lg bg-yellow-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-yellow-400 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : null}

          {/* list of reviews */}
          <div className="space-y-3 max-h-[40vh] overflow-auto">
            {loading ? (
              <div className="h-10 w-full animate-pulse rounded bg-zinc-900" />
            ) : reviews.length === 0 ? (
              <div className="text-sm text-zinc-400">
                No reviews yet.
              </div>
            ) : (
              reviews.map((r) => {
                const showTag = !!r.tag_label;
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-zinc-800 bg-black/40 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800">
                        {r.profiles?.avatar_url && (
                          <img
                            src={r.profiles.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-white">
                          {r.profiles?.display_name ||
                            "Member"}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {new Date(
                            r.created_at
                          ).toLocaleString()}
                        </div>
                      </div>

                      {showTag ? (
                        <RatingTagChip
                          tag={{
                            label: r.tag_label,
                            emoji: r.tag_emoji,
                            description: r.tag_desc,
                            weight: r.rating_5,
                          }}
                        />
                      ) : (
                        <div className="text-white font-semibold">
                          {r.rating_5}/5
                        </div>
                      )}
                    </div>
                    {r.review ? (
                      <div className="mt-2 text-sm text-zinc-300">
                        {r.review}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
