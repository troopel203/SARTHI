// SARTHI production backend — real Supabase (PostgreSQL + Auth + Realtime).
//
// This is the drop-in replacement for localDb.js: same exported function
// names/signatures, so every page in src/pages/* works unchanged whichever
// backend is active. db.js picks this file automatically once
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
//
// Strategy: keep an in-memory cache mirroring what THIS signed-in user is
// allowed to see (RLS-scoped), populated by an initial fetch and kept live
// via Supabase Realtime postgres_changes subscriptions — so every page's
// `useSarthiState()` hook (built for a synchronous getState()) keeps working
// exactly as it did against the local store.

import { supabase } from "./supabaseClient";
import { matchHospitals, refineWithRealRouting, getAIExplanation, RESERVATION_WINDOW_MS, isGeminiConfigured } from "./engine";
import { interpolate } from "./geo";

const listeners = new Set();
let cache = { hospitals: [], phcs: [], ambulances: [], referrals: [], users: [], events: [] };
let initialized = false;
let channel = null;

function emit(reason) {
  listeners.forEach((fn) => fn(cache, reason));
}

export function getState() {
  return cache;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Called by AuthContext once a Supabase session + profile is resolved.
// RLS already scopes every query/subscription to what this user is allowed
// to see, so there's no client-side filtering to do here — this just
// triggers the initial fetch (and tears the cache down again on logout).
export async function setCurrentUser(user) {
  if (user && !initialized) await init();
  if (!user) teardown();
}

async function fetchTimelineAndEvents(referralIds) {
  if (!referralIds.length) return { timelines: {}, };
  const { data: rows } = await supabase
    .from("referral_timeline")
    .select("*")
    .in("referral_id", referralIds)
    .order("ts", { ascending: true });
  const timelines = {};
  (rows || []).forEach((row) => {
    (timelines[row.referral_id] ||= []).push({ ts: new Date(row.ts).getTime(), event: row.event, by: row.by });
  });
  return timelines;
}

function mapReferralRow(row, timeline) {
  return {
    id: row.id,
    patientName: row.patient_name,
    age: row.age,
    gender: row.gender,
    condition: row.condition,
    requiredResource: row.required_resource,
    requiredSpecialist: row.required_specialist,
    priority: row.priority,
    notes: row.notes,
    phcId: row.phc_id,
    hospitalId: row.hospital_id,
    ambulanceId: row.ambulance_id,
    status: row.status,
    candidates: row.candidates || [],
    candidateIndex: row.candidate_index,
    rejectedHospitals: row.rejected_hospitals || [],
    aiExplanation: row.ai_explanation,
    reservationExpiresAt: row.reservation_expires_at ? new Date(row.reservation_expires_at).getTime() : null,
    dispatchedAt: row.dispatched_at ? new Date(row.dispatched_at).getTime() : null,
    etaMinutesAtDispatch: row.eta_minutes_at_dispatch,
    progress: row.progress,
    currentPos: { lat: row.current_lat, lng: row.current_lng },
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    timeline: timeline || [],
  };
}

async function loadReferrals() {
  const { data: rows, error } = await supabase.from("referrals").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("SARTHI: failed to load referrals", error.message);
    return [];
  }
  const timelines = await fetchTimelineAndEvents((rows || []).map((r) => r.id));
  return (rows || []).map((r) => mapReferralRow(r, timelines[r.id]));
}

async function init() {
  initialized = true;
  const [{ data: hospitals }, { data: phcs }, { data: ambulances }, { data: events }] = await Promise.all([
    supabase.from("hospitals").select("*"),
    supabase.from("phcs").select("*"),
    supabase.from("ambulances").select("*"),
    supabase.from("referral_events").select("*").order("ts", { ascending: false }).limit(200),
  ]);

  cache.hospitals = (hospitals || []).map((h) => ({ ...h, resources: h.resources || {} }));
  cache.phcs = phcs || [];
  cache.ambulances = (ambulances || []).map((a) => ({ ...a, phcId: a.phc_id, referralId: a.referral_id, currentPos: { lat: a.current_lat, lng: a.current_lng } }));
  cache.events = (events || []).map((e) => ({ id: e.id, referralId: e.referral_id, message: e.message, kind: e.kind, audience: e.audience, ts: new Date(e.ts).getTime() }));
  cache.referrals = await loadReferrals();
  emit("init");

  subscribeRealtime();
}

function teardown() {
  channel?.unsubscribe();
  channel = null;
  initialized = false;
  cache = { hospitals: [], phcs: [], ambulances: [], referrals: [], users: [], events: [] };
}

function subscribeRealtime() {
  channel = supabase
    .channel("sarthi-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, async (payload) => {
      // Re-fetch the single row's timeline for freshness, then splice it into cache.
      const row = payload.new?.id ? payload.new : payload.old;
      if (payload.eventType === "DELETE") {
        cache.referrals = cache.referrals.filter((r) => r.id !== row.id);
      } else {
        const timelines = await fetchTimelineAndEvents([row.id]);
        const mapped = mapReferralRow(payload.new, timelines[row.id]);
        const idx = cache.referrals.findIndex((r) => r.id === mapped.id);
        if (idx >= 0) cache.referrals[idx] = mapped;
        else cache.referrals.unshift(mapped);
      }
      emit("referrals-realtime");
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "hospitals" }, (payload) => {
      const idx = cache.hospitals.findIndex((h) => h.id === payload.new.id);
      const mapped = { ...payload.new, resources: payload.new.resources || {} };
      if (idx >= 0) cache.hospitals[idx] = mapped;
      emit("hospitals-realtime");
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "ambulances" }, (payload) => {
      const idx = cache.ambulances.findIndex((a) => a.id === payload.new.id);
      const mapped = { ...payload.new, phcId: payload.new.phc_id, referralId: payload.new.referral_id, currentPos: { lat: payload.new.current_lat, lng: payload.new.current_lng } };
      if (idx >= 0) cache.ambulances[idx] = mapped;
      emit("ambulances-realtime");
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "referral_events" }, (payload) => {
      const e = payload.new;
      cache.events.unshift({ id: e.id, referralId: e.referral_id, message: e.message, kind: e.kind, audience: e.audience, ts: new Date(e.ts).getTime() });
      cache.events = cache.events.slice(0, 200);
      emit("events-realtime");
    })
    .subscribe();
}

async function insertTimeline(referralId, event, by) {
  await supabase.from("referral_timeline").insert({ referral_id: referralId, event, by });
}

async function insertEvent(referralId, message, kind = "info", audience = {}) {
  await supabase.from("referral_events").insert({ referral_id: referralId, message, kind, audience });
}

export function getReferral(id) {
  return cache.referrals.find((r) => r.id === id);
}

// --- Referrals -------------------------------------------------------------

export async function createReferral(input) {
  const phc = cache.phcs.find((p) => p.id === input.phcId);
  const origin = { lat: phc.lat, lng: phc.lng };

  let ranked = matchHospitals({ ...input, rejectedHospitals: [] }, cache.hospitals, origin);
  // Refine top candidates with real road routing before we commit to anything.
  ranked = await refineWithRealRouting(ranked, origin);

  const candidates = ranked.map((c) => ({ hospitalId: c.hospitalId, score: c.score, eta: c.eta, distanceKm: c.distanceKm, reasons: c.reasons }));
  const status = ranked.length ? "awaiting_hospital" : "no_hospital_found";

  const { data: row, error } = await supabase
    .from("referrals")
    .insert({
      patient_name: input.patientName,
      age: input.age,
      gender: input.gender,
      condition: input.condition,
      required_resource: input.requiredResource,
      required_specialist: input.requiredSpecialist || null,
      priority: input.priority,
      notes: input.notes || null,
      phc_id: input.phcId,
      hospital_id: ranked[0]?.hospitalId ?? null,
      status,
      candidates,
      candidate_index: 0,
      reservation_expires_at: ranked.length ? new Date(Date.now() + RESERVATION_WINDOW_MS).toISOString() : null,
      progress: 0,
      current_lat: origin.lat,
      current_lng: origin.lng,
    })
    .select()
    .single();

  if (error) {
    console.error("SARTHI: createReferral failed", error.message);
    throw error;
  }

  await insertTimeline(row.id, "Referral created at PHC", "phc");
  if (ranked.length) {
    await reserveResource(ranked[0].hospitalId, input.requiredResource);
    await insertTimeline(row.id, `Matched to ${ranked[0].hospital.name} — resource reserved`, "system");
    await insertEvent(row.id, `New referral matched to ${ranked[0].hospital.name}`, "match");
  } else {
    await insertTimeline(row.id, "No eligible hospital found with current resources", "system");
    await insertEvent(row.id, "No eligible hospital found for referral", "warning");
  }

  // Fire-and-forget: ask Gemini for a plain-language rationale, then attach
  // it once ready. Never blocks referral creation — matches "AI never gates
  // the clinical decision" from the design.
  if (isGeminiConfigured && ranked.length) {
    getAIExplanation(input, ranked).then((text) => {
      if (text) supabase.from("referrals").update({ ai_explanation: text }).eq("id", row.id).then(() => {});
    });
  }

  const timelines = await fetchTimelineAndEvents([row.id]);
  const mapped = mapReferralRow(row, timelines[row.id]);
  cache.referrals.unshift(mapped);
  emit("referral-created");
  return mapped;
}

async function reserveResource(hospitalId, resourceKey) {
  if (!resourceKey) return;
  const h = cache.hospitals.find((x) => x.id === hospitalId);
  if (!h || !(h.resources[resourceKey] > 0)) return;
  const next = { ...h.resources, [resourceKey]: h.resources[resourceKey] - 1 };
  h.resources = next;
  await supabase.from("hospitals").update({ resources: next }).eq("id", hospitalId);
}

async function releaseResource(hospitalId, resourceKey) {
  if (!resourceKey) return;
  const h = cache.hospitals.find((x) => x.id === hospitalId);
  if (!h) return;
  const next = { ...h.resources, [resourceKey]: (h.resources[resourceKey] || 0) + 1 };
  h.resources = next;
  await supabase.from("hospitals").update({ resources: next }).eq("id", hospitalId);
}

export async function escalateReferral(referralId, reason = "Response window elapsed") {
  const referral = getReferral(referralId);
  if (!referral || referral.status !== "awaiting_hospital") return;

  await releaseResource(referral.hospitalId, referral.requiredResource);
  const rejectedHospitals = [...referral.rejectedHospitals, referral.hospitalId];
  const nextIndex = referral.candidateIndex + 1;
  const next = referral.candidates[nextIndex];

  if (next) {
    await reserveResource(next.hospitalId, referral.requiredResource);
    const h = cache.hospitals.find((x) => x.id === next.hospitalId);
    await supabase
      .from("referrals")
      .update({
        hospital_id: next.hospitalId,
        candidate_index: nextIndex,
        rejected_hospitals: rejectedHospitals,
        reservation_expires_at: new Date(Date.now() + RESERVATION_WINDOW_MS).toISOString(),
      })
      .eq("id", referralId);
    await insertTimeline(referralId, `${reason} — escalated to ${h.name}`, "system");
    await insertEvent(referralId, `Referral escalated to ${h.name}`, "warning");
  } else {
    await supabase.from("referrals").update({ status: "no_hospital_found", hospital_id: null, rejected_hospitals: rejectedHospitals }).eq("id", referralId);
    await insertTimeline(referralId, `${reason} — no further eligible hospitals nearby`, "system");
    await insertEvent(referralId, "Referral has no remaining eligible hospitals", "error");
  }
}

export async function respondToReferral(referralId, hospitalId, accept, note) {
  const referral = getReferral(referralId);
  if (!referral || referral.hospitalId !== hospitalId) return;

  if (accept) {
    const ambulance = cache.ambulances.find((a) => a.phcId === referral.phcId && a.status === "available");
    const eta = referral.candidates.find((c) => c.hospitalId === hospitalId)?.eta ?? referral.etaMinutesAtDispatch;
    await supabase
      .from("referrals")
      .update({
        status: "accepted",
        reservation_expires_at: null,
        ambulance_id: ambulance?.id ?? null,
        dispatched_at: new Date().toISOString(),
        eta_minutes_at_dispatch: eta,
      })
      .eq("id", referralId);
    if (ambulance) {
      await supabase.from("ambulances").update({ status: "dispatched", referral_id: referralId }).eq("id", ambulance.id);
    }
    const h = cache.hospitals.find((x) => x.id === hospitalId);
    await insertTimeline(referralId, `${h.name} accepted the referral. Ambulance dispatched.`, "hospital");
    await insertEvent(referralId, `${h.name} accepted — ambulance en route`, "success");
  } else {
    const h = cache.hospitals.find((x) => x.id === hospitalId);
    await insertTimeline(referralId, `${h.name} rejected: ${note || "no reason given"}`, "hospital");
    await escalateReferral(referralId, `${h.name} rejected the referral`);
  }
}

export async function simulateResourceLoss(referralId) {
  const referral = getReferral(referralId);
  if (!referral || referral.status !== "accepted") return;
  const h = cache.hospitals.find((x) => x.id === referral.hospitalId);
  await insertTimeline(referralId, `${h.name} reported resource unavailable mid-transit — rerouting from ambulance's live position`, "system");
  await insertEvent(referralId, `Rerouting: ${h.name} can no longer accept`, "error", { ambulanceId: referral.ambulanceId });

  if (referral.ambulanceId) {
    await supabase.from("ambulances").update({ status: "available", referral_id: null }).eq("id", referral.ambulanceId);
  }
  await releaseResource(referral.hospitalId, referral.requiredResource);
  const rejectedHospitals = [...referral.rejectedHospitals, referral.hospitalId];

  const origin = referral.currentPos;
  let ranked = matchHospitals({ ...referral, rejectedHospitals }, cache.hospitals, origin);
  ranked = await refineWithRealRouting(ranked, origin);

  if (ranked.length) {
    await reserveResource(ranked[0].hospitalId, referral.requiredResource);
    await supabase
      .from("referrals")
      .update({
        candidates: ranked.map((c) => ({ hospitalId: c.hospitalId, score: c.score, eta: c.eta, distanceKm: c.distanceKm, reasons: c.reasons })),
        candidate_index: 0,
        hospital_id: ranked[0].hospitalId,
        status: "awaiting_hospital",
        reservation_expires_at: new Date(Date.now() + RESERVATION_WINDOW_MS).toISOString(),
        progress: 0,
        dispatched_at: null,
        ambulance_id: null,
        rejected_hospitals: rejectedHospitals,
      })
      .eq("id", referralId);
    await insertTimeline(referralId, `Recommended forward to ${ranked[0].hospital.name} (${ranked[0].eta} min from current location)`, "system");
  } else {
    await supabase.from("referrals").update({ status: "no_hospital_found", hospital_id: null, ambulance_id: null, rejected_hospitals: rejectedHospitals }).eq("id", referralId);
  }
}

export async function reportConditionDeterioration(referralId) {
  const referral = getReferral(referralId);
  if (!referral || ["completed", "no_hospital_found"].includes(referral.status)) return;
  await supabase.from("referrals").update({ priority: "critical" }).eq("id", referralId);
  await insertTimeline(referralId, "Patient condition deteriorated — marked critical; receiving teams alerted", "phc");
  await insertEvent(referralId, `Urgent: ${referral.patientName}'s condition has deteriorated. Treat as critical.`, "warning");
}

export async function markArrived(referralId) {
  await supabase.from("referrals").update({ status: "arrived", progress: 1 }).eq("id", referralId);
  await insertTimeline(referralId, "Ambulance arrived at destination hospital", "ambulance");
  await insertEvent(referralId, "Ambulance arrived — patient handover in progress", "success");
}

export async function completeReferral(referralId) {
  const referral = getReferral(referralId);
  await supabase.from("referrals").update({ status: "completed" }).eq("id", referralId);
  if (referral?.ambulanceId) {
    await supabase.from("ambulances").update({ status: "available", referral_id: null }).eq("id", referral.ambulanceId);
  }
  await insertTimeline(referralId, "Patient handed over. Referral closed.", "hospital");
  await insertEvent(referralId, "Referral completed", "success");
}

export async function updateHospitalResources(hospitalId, patch) {
  const h = cache.hospitals.find((x) => x.id === hospitalId);
  if (!h) return;
  const next = { ...h.resources, ...patch };
  h.resources = next;
  await supabase.from("hospitals").update({ resources: next }).eq("id", hospitalId);
  emit("resources-updated");
}

export function resetDemo() {
  // Deliberately disabled in production mode — this button would wipe real
  // patient referral records for every user on the network. district admins
  // who need to clear pilot/test data should do it directly in the Supabase
  // dashboard (Table Editor) or via a guarded SQL script, not a UI button.
  console.warn("resetDemo() is disabled in production (Supabase) mode.");
}

// --- Background engine (client-assisted; see supabase/functions/engine-tick) --
// This client-side tick keeps the demo/pilot responsive when a browser tab
// is open. For a real always-on deployment, schedule the bundled
// supabase/functions/engine-tick Edge Function on a 15–30s cron (Supabase
// Cron / pg_cron / an external scheduler hitting its URL) so escalation and
// live tracking keep running even when nobody has a tab open.
let engineStarted = false;
export function startEngine() {
  if (engineStarted) return;
  engineStarted = true;
  setInterval(async () => {
    const now = Date.now();
    for (const referral of [...cache.referrals]) {
      if (referral.status === "awaiting_hospital" && referral.reservationExpiresAt && now > referral.reservationExpiresAt) {
        await escalateReferral(referral.id, "No response from hospital");
      }
      if (referral.status === "accepted" && referral.dispatchedAt) {
        const totalMs = (referral.etaMinutesAtDispatch || 10) * 60 * 1000;
        const progress = Math.min(1, (now - referral.dispatchedAt) / totalMs);
        const phc = cache.phcs.find((p) => p.id === referral.phcId);
        const hospital = cache.hospitals.find((h) => h.id === referral.hospitalId);
        if (phc && hospital) {
          const pos = interpolate({ lat: phc.lat, lng: phc.lng }, { lat: hospital.lat, lng: hospital.lng }, progress);
          referral.progress = progress;
          referral.currentPos = pos;
          await supabase.from("referrals").update({ progress, current_lat: pos.lat, current_lng: pos.lng }).eq("id", referral.id);
          if (referral.ambulanceId) {
            await supabase.from("ambulances").update({ current_lat: pos.lat, current_lng: pos.lng }).eq("id", referral.ambulanceId);
          }
          if (progress >= 1) await markArrived(referral.id);
        }
      }
    }
  }, 3000);
}
