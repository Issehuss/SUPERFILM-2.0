// supabase/functions/event-reminders/index.ts
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service client (bypasses RLS, as intended for backend jobs)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async () => {
  try {
    const now = new Date();

    // Window: events in 24h ± 15 minutes
    const from = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const to = new Date(from.getTime() + 15 * 60 * 1000);

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // 1) Find events starting in that window that haven't had a reminder yet
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("id, title, slug, club_id, created_by, date, reminder_24h_sent")
      .gte("date", fromIso)
      .lt("date", toIso)
      .eq("reminder_24h_sent", false);

    if (eventsErr) throw eventsErr;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, events: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Build notifications payload
    const notifications = events
      .filter((e) => e.created_by) // safety
      .map((e) => ({
        user_id: e.created_by,
        type: "event_24h_reminder",
        actor_id: null,
        club_id: e.club_id ?? null,
        data: {
          event_id: e.id,
          event_slug: e.slug,
          event_title: e.title,
          message: `Your event "${e.title}" is happening in 24 hours (:`,
        },
      }));

    if (notifications.length > 0) {
      const { error: notifErr } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifErr) throw notifErr;
    }

    // 3) Mark events as notified
    const eventIds = events.map((e) => e.id);
    const { error: updateErr } = await supabase
      .from("events")
      .update({ reminder_24h_sent: true })
      .in("id", eventIds);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        ok: true,
        events_notified: events.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[event-reminders] error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
