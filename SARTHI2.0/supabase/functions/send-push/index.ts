// supabase/functions/send-push/index.ts
//
// Deploy: supabase functions deploy send-push
// Wire it up: Supabase Dashboard → Database → Webhooks → "Create a new hook"
//   Table: referral_events   Events: Insert   Type: Supabase Edge Function
//   Function: send-push
// From then on, every row inserted into referral_events automatically
// triggers this function, which looks up who should be notified and pushes
// a real notification to their device(s) — including when the app is
// closed. This is what makes notifications "real" instead of in-tab only.
//
// Requires two secrets (Dashboard → Edge Functions → send-push → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  — generate free & forever with:
//     npx web-push generate-vapid-keys

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

webpush.setVapidDetails(
  "mailto:admin@sarthi.example",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = await req.json();
  const event = payload.record; // { referral_id, message, kind, audience }

  if (!event) return new Response("ok");

  const { data: referral } = await supabase.from("referrals").select("*").eq("id", event.referral_id).single();
  if (!referral) return new Response("ok");

  // Figure out which profiles should be notified for this event, mirroring
  // the RLS visibility rules: the PHC that created it, the hospital it's
  // currently routed to, and the assigned ambulance.
  const entityIds = [referral.phc_id, referral.hospital_id, referral.ambulance_id, event.audience?.ambulanceId].filter(Boolean);
  const { data: profiles } = await supabase.from("profiles").select("id").in("entity_id", entityIds);
  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  const targetUserIds = [...new Set([...(profiles || []), ...(admins || [])].map((p) => p.id))];

  if (!targetUserIds.length) return new Response("ok");

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", targetUserIds);

  await Promise.all(
    (subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify({ title: "SARTHI", body: event.message, url: "/" }));
      } catch (err) {
        // Subscription expired/revoked — clean it up so we stop retrying it.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );

  return new Response("ok");
});
