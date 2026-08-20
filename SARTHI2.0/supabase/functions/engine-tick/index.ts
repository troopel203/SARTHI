// supabase/functions/engine-tick/index.ts
//
// Deploy: supabase functions deploy engine-tick
// Schedule: Supabase Dashboard → Edge Functions → engine-tick → Add Cron
//           (e.g. every 15-30 seconds), OR any external scheduler
//           (cron-job.org, Vercel Cron) hitting this function's URL with
//           the service-role key as a Bearer token.
//
// This is the production version of the client-side tick in supabaseDb.js's
// startEngine(). The client-side tick keeps things responsive when a tab is
// open; THIS is what keeps escalation timeouts and ambulance tracking
// running correctly even when nobody has the app open — required for a
// real always-on deployment, not just a live demo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESERVATION_WINDOW_MS = 45_000;

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role bypasses RLS — this function runs as trusted server code
  );

  const now = new Date();

  // 1) Escalate any referral whose hospital response window has elapsed.
  const { data: expired } = await supabase
    .from("referrals")
    .select("id, hospital_id, required_resource, candidates, candidate_index, rejected_hospitals")
    .eq("status", "awaiting_hospital")
    .lt("reservation_expires_at", now.toISOString());

  for (const referral of expired || []) {
    const rejected = [...(referral.rejected_hospitals || []), referral.hospital_id];
    const nextIndex = referral.candidate_index + 1;
    const next = referral.candidates?.[nextIndex];

    if (referral.hospital_id && referral.required_resource) {
      const { data: h } = await supabase.from("hospitals").select("resources").eq("id", referral.hospital_id).single();
      if (h) {
        const resources = { ...h.resources, [referral.required_resource]: (h.resources[referral.required_resource] || 0) + 1 };
        await supabase.from("hospitals").update({ resources }).eq("id", referral.hospital_id);
      }
    }

    if (next) {
      if (referral.required_resource) {
        const { data: h } = await supabase.from("hospitals").select("resources").eq("id", next.hospitalId).single();
        if (h && h.resources[referral.required_resource] > 0) {
          const resources = { ...h.resources, [referral.required_resource]: h.resources[referral.required_resource] - 1 };
          await supabase.from("hospitals").update({ resources }).eq("id", next.hospitalId);
        }
      }
      await supabase
        .from("referrals")
        .update({
          hospital_id: next.hospitalId,
          candidate_index: nextIndex,
          rejected_hospitals: rejected,
          reservation_expires_at: new Date(Date.now() + RESERVATION_WINDOW_MS).toISOString(),
        })
        .eq("id", referral.id);
      await supabase.from("referral_timeline").insert({ referral_id: referral.id, event: "No response from hospital — auto-escalated to next match", by: "system" });
      await supabase.from("referral_events").insert({ referral_id: referral.id, message: "Referral auto-escalated after no response", kind: "warning" });
    } else {
      await supabase.from("referrals").update({ status: "no_hospital_found", hospital_id: null, rejected_hospitals: rejected }).eq("id", referral.id);
      await supabase.from("referral_timeline").insert({ referral_id: referral.id, event: "No further eligible hospitals nearby", by: "system" });
    }
  }

  // 2) Advance ambulance position for every referral currently en route.
  const { data: active } = await supabase
    .from("referrals")
    .select("id, phc_id, hospital_id, ambulance_id, dispatched_at, eta_minutes_at_dispatch")
    .eq("status", "accepted");

  for (const referral of active || []) {
    if (!referral.dispatched_at) continue;
    const [{ data: phc }, { data: hospital }] = await Promise.all([
      supabase.from("phcs").select("lat,lng").eq("id", referral.phc_id).single(),
      supabase.from("hospitals").select("lat,lng").eq("id", referral.hospital_id).single(),
    ]);
    if (!phc || !hospital) continue;

    const totalMs = (referral.eta_minutes_at_dispatch || 10) * 60 * 1000;
    const elapsed = now.getTime() - new Date(referral.dispatched_at).getTime();
    const progress = Math.min(1, elapsed / totalMs);
    const lat = phc.lat + (hospital.lat - phc.lat) * progress;
    const lng = phc.lng + (hospital.lng - phc.lng) * progress;

    await supabase.from("referrals").update({ progress, current_lat: lat, current_lng: lng }).eq("id", referral.id);
    if (referral.ambulance_id) {
      await supabase.from("ambulances").update({ current_lat: lat, current_lng: lng }).eq("id", referral.ambulance_id);
    }
    if (progress >= 1) {
      await supabase.from("referrals").update({ status: "arrived" }).eq("id", referral.id);
      await supabase.from("referral_timeline").insert({ referral_id: referral.id, event: "Ambulance arrived at destination hospital", by: "ambulance" });
      await supabase.from("referral_events").insert({ referral_id: referral.id, message: "Ambulance arrived — patient handover in progress", kind: "success" });
    }
  }

  return new Response(JSON.stringify({ escalated: expired?.length || 0, advanced: active?.length || 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
