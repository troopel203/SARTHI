// SARTHI local "realtime backend".
//
// This stands in for Supabase (PostgreSQL + Realtime + Auth) described in
// the architecture doc, so the whole multi-role workflow runs as a fully
// working prototype with zero external services. Swapping this module for
// real Supabase client calls (see README) is the only change needed to go
// to production — every page consumes data only through the functions
// exported here, never localStorage directly.
//
// Sync strategy: state lives in localStorage (durable) and every mutation
// is broadcast over a BroadcastChannel so all open tabs / role dashboards
// update instantly, the same way Supabase Realtime pushes changes to every
// connected client.

import { SEED_HOSPITALS, SEED_PHCS, SEED_AMBULANCES, SEED_USERS } from "../data/seed";
import { matchHospitals, RESERVATION_WINDOW_MS } from "./engine";
import { interpolate } from "./geo";

const STORAGE_KEY = "sarthi_state_v1";
const CHANNEL_NAME = "sarthi-bus";

let channel = null;
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
} catch {
  channel = null; // BroadcastChannel unsupported (rare) — falls back to same-tab only
}

const listeners = new Set();

function defaultState() {
  return {
    hospitals: SEED_HOSPITALS.map((h) => ({ ...h, resources: { ...h.resources } })),
    phcs: SEED_PHCS,
    ambulances: SEED_AMBULANCES.map((a) => ({ ...a, status: "available", referralId: null })),
    users: SEED_USERS,
    referrals: [],
    events: [], // audit / notification log
  };
}

let state = null;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit(reason) {
  listeners.forEach((fn) => fn(state, reason));
  channel?.postMessage({ type: "sync" });
}

export function loadState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  } catch {
    state = defaultState();
  }
  if (!state.hospitals?.length) state = defaultState();
  persist();
  return state;
}

export function getState() {
  return state || loadState();
}

export function resetDemo() {
  state = defaultState();
  persist();
  emit("reset");
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (channel) {
  channel.onmessage = (msg) => {
    if (msg?.data?.type === "sync") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) state = JSON.parse(raw);
        listeners.forEach((fn) => fn(state, "remote-sync"));
      } catch {
        /* ignore */
      }
    }
  };
}

function pushEvent(referralId, message, kind = "info", audience = {}) {
  getState().events.unshift({
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    referralId,
    message,
    kind,
    audience,
    ts: Date.now(),
  });
  getState().events = getState().events.slice(0, 200);
}

function addTimeline(referral, event, by) {
  referral.timeline.push({ ts: Date.now(), event, by });
}

// --- Referrals -----------------------------------------------------------

export function getReferral(id) {
  return getState().referrals.find((r) => r.id === id);
}

export function createReferral(input) {
  const s = getState();
  const phc = s.phcs.find((p) => p.id === input.phcId);
  const origin = { lat: phc.lat, lng: phc.lng };
  const ranked = matchHospitals(
    { ...input, rejectedHospitals: [] },
    s.hospitals,
    origin
  );

  const referral = {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...input,
    rejectedHospitals: [],
    status: ranked.length ? "awaiting_hospital" : "no_hospital_found",
    candidates: ranked.map((c) => ({ hospitalId: c.hospitalId, score: c.score, eta: c.eta, distanceKm: c.distanceKm, reasons: c.reasons })),
    candidateIndex: 0,
    hospitalId: ranked[0]?.hospitalId ?? null,
    ambulanceId: null,
    reservationExpiresAt: ranked.length ? Date.now() + RESERVATION_WINDOW_MS : null,
    dispatchedAt: null,
    etaMinutesAtDispatch: ranked[0]?.eta ?? null,
    progress: 0,
    currentPos: origin,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timeline: [],
  };
  addTimeline(referral, "Referral created at PHC", "phc");
  if (ranked.length) {
    reserveResource(s, ranked[0].hospitalId, input.requiredResource);
    addTimeline(referral, `Matched to ${ranked[0].hospital.name} — resource reserved`, "system");
    pushEvent(referral.id, `New referral matched to ${ranked[0].hospital.name}`, "match");
  } else {
    addTimeline(referral, "No eligible hospital found with current resources", "system");
    pushEvent(referral.id, "No eligible hospital found for referral", "warning");
  }

  s.referrals.unshift(referral);
  persist();
  emit("referral-created");
  return referral;
}

function reserveResource(s, hospitalId, resourceKey) {
  if (!resourceKey) return;
  const h = s.hospitals.find((x) => x.id === hospitalId);
  if (h && h.resources[resourceKey] > 0) h.resources[resourceKey] -= 1;
}

function releaseResource(s, hospitalId, resourceKey) {
  if (!resourceKey) return;
  const h = s.hospitals.find((x) => x.id === hospitalId);
  if (h) h.resources[resourceKey] += 1;
}

// Hospital escalates to the next-ranked candidate (auto-timeout or manual reject)
export function escalateReferral(referralId, reason = "Response window elapsed") {
  const s = getState();
  const referral = getReferral(referralId);
  if (!referral || !["awaiting_hospital"].includes(referral.status)) return;

  releaseResource(s, referral.hospitalId, referral.requiredResource);
  referral.rejectedHospitals.push(referral.hospitalId);
  const nextIndex = referral.candidateIndex + 1;
  const next = referral.candidates[nextIndex];

  if (next) {
    referral.candidateIndex = nextIndex;
    referral.hospitalId = next.hospitalId;
    referral.reservationExpiresAt = Date.now() + RESERVATION_WINDOW_MS;
    reserveResource(s, next.hospitalId, referral.requiredResource);
    const h = s.hospitals.find((x) => x.id === next.hospitalId);
    addTimeline(referral, `${reason} — escalated to ${h.name}`, "system");
    pushEvent(referral.id, `Referral escalated to ${h.name}`, "warning");
  } else {
    referral.status = "no_hospital_found";
    referral.hospitalId = null;
    addTimeline(referral, `${reason} — no further eligible hospitals nearby`, "system");
    pushEvent(referral.id, "Referral has no remaining eligible hospitals", "error");
  }
  referral.updatedAt = Date.now();
  persist();
  emit("escalated");
}

export function respondToReferral(referralId, hospitalId, accept, note) {
  const s = getState();
  const referral = getReferral(referralId);
  if (!referral || referral.hospitalId !== hospitalId) return;

  if (accept) {
    referral.status = "accepted";
    referral.reservationExpiresAt = null;
    const ambulance = s.ambulances.find((a) => a.phcId === referral.phcId && a.status === "available");
    if (ambulance) {
      ambulance.status = "dispatched";
      ambulance.referralId = referral.id;
      referral.ambulanceId = ambulance.id;
    }
    referral.dispatchedAt = Date.now();
    // The selected hospital can change after escalation, so use the ETA for
    // the destination that actually accepted this referral.
    referral.etaMinutesAtDispatch = referral.candidates.find(
      (candidate) => candidate.hospitalId === hospitalId
    )?.eta ?? referral.etaMinutesAtDispatch;
    const h = s.hospitals.find((x) => x.id === hospitalId);
    addTimeline(referral, `${h.name} accepted the referral. Ambulance dispatched.`, "hospital");
    pushEvent(referral.id, `${h.name} accepted — ambulance en route`, "success");
  } else {
    const h = s.hospitals.find((x) => x.id === hospitalId);
    addTimeline(referral, `${h.name} rejected: ${note || "no reason given"}`, "hospital");
    escalateReferral(referralId, `${h.name} rejected the referral`);
    return;
  }
  referral.updatedAt = Date.now();
  persist();
  emit("responded");
}

// Simulate a hospital suddenly losing the resource mid-transit — triggers
// the "position-aware dynamic rerouting" behaviour described in the abstract.
export function simulateResourceLoss(referralId) {
  const referral = getReferral(referralId);
  if (!referral || referral.status !== "accepted") return;
  const s = getState();
  const h = s.hospitals.find((x) => x.id === referral.hospitalId);
  addTimeline(referral, `${h.name} reported resource unavailable mid-transit — rerouting from ambulance's live position`, "system");
  pushEvent(referral.id, `Rerouting: ${h.name} can no longer accept`, "error", { ambulanceId: referral.ambulanceId });

  const ambulance = s.ambulances.find((a) => a.id === referral.ambulanceId);
  if (ambulance) {
    ambulance.status = "available";
    ambulance.referralId = null;
  }
  referral.ambulanceId = null;
  releaseResource(s, referral.hospitalId, referral.requiredResource);
  referral.rejectedHospitals.push(referral.hospitalId);

  // Recalculate candidates from the ambulance's CURRENT position, not the PHC.
  const origin = referral.currentPos;
  const ranked = matchHospitals({ ...referral, rejectedHospitals: referral.rejectedHospitals }, s.hospitals, origin);

  if (ranked.length) {
    referral.candidates = ranked.map((c) => ({ hospitalId: c.hospitalId, score: c.score, eta: c.eta, distanceKm: c.distanceKm, reasons: c.reasons }));
    referral.candidateIndex = 0;
    referral.hospitalId = ranked[0].hospitalId;
    referral.status = "awaiting_hospital";
    referral.reservationExpiresAt = Date.now() + RESERVATION_WINDOW_MS;
    referral.progress = 0;
    referral.dispatchedAt = null;
    reserveResource(s, ranked[0].hospitalId, referral.requiredResource);
    addTimeline(referral, `Recommended forward to ${ranked[0].hospital.name} (${ranked[0].eta} min from current location)`, "system");
  } else {
    referral.status = "no_hospital_found";
    referral.hospitalId = null;
  }
  referral.updatedAt = Date.now();
  persist();
  emit("rerouted");
}

// Lets the PHC flag a change in the patient's condition. The event is stored
// with the referral and immediately reaches the PHC, receiving hospital, and
// assigned ambulance as an in-app alert.
export function reportConditionDeterioration(referralId) {
  const referral = getReferral(referralId);
  if (!referral || ["completed", "no_hospital_found"].includes(referral.status)) return;
  referral.priority = "critical";
  addTimeline(referral, "Patient condition deteriorated — marked critical; receiving teams alerted", "phc");
  pushEvent(referral.id, `Urgent: ${referral.patientName}'s condition has deteriorated. Treat as critical.`, "warning");
  referral.updatedAt = Date.now();
  persist();
  emit("condition-deteriorated");
}

export function markArrived(referralId) {
  const referral = getReferral(referralId);
  if (!referral) return;
  referral.status = "arrived";
  referral.progress = 1;
  addTimeline(referral, "Ambulance arrived at destination hospital", "ambulance");
  pushEvent(referralId, "Ambulance arrived — patient handover in progress", "success");
  referral.updatedAt = Date.now();
  persist();
  emit("arrived");
}

export function completeReferral(referralId) {
  const s = getState();
  const referral = getReferral(referralId);
  if (!referral) return;
  referral.status = "completed";
  const ambulance = s.ambulances.find((a) => a.id === referral.ambulanceId);
  if (ambulance) {
    ambulance.status = "available";
    ambulance.referralId = null;
  }
  addTimeline(referral, "Patient handed over. Referral closed.", "hospital");
  pushEvent(referralId, "Referral completed", "success");
  referral.updatedAt = Date.now();
  persist();
  emit("completed");
}

export function updateHospitalResources(hospitalId, patch) {
  const s = getState();
  const h = s.hospitals.find((x) => x.id === hospitalId);
  if (!h) return;
  Object.assign(h.resources, patch);
  persist();
  emit("resources-updated");
}

// --- Background engine (escalation timers + ambulance movement) ----------
// Mirrors the "Background Jobs (Supabase Edge Functions)" box in the
// architecture diagram: escalation timers, reservation auto-release, and
// live location updates all run on a tick here instead of on a server.

let engineStarted = false;

export function startEngine() {
  if (engineStarted) return;
  engineStarted = true;
  setInterval(() => {
    const s = getState();
    let changed = false;
    const now = Date.now();

    s.referrals.forEach((referral) => {
      if (referral.status === "awaiting_hospital" && referral.reservationExpiresAt && now > referral.reservationExpiresAt) {
        escalateReferral(referral.id, "No response from hospital");
        changed = true;
      }
      if (referral.status === "accepted" && referral.dispatchedAt) {
        const totalMs = (referral.etaMinutesAtDispatch || 10) * 60 * 1000;
        const elapsed = now - referral.dispatchedAt;
        const progress = Math.min(1, elapsed / totalMs);
        const phc = s.phcs.find((p) => p.id === referral.phcId);
        const hospital = s.hospitals.find((h) => h.id === referral.hospitalId);
        if (phc && hospital) {
          referral.progress = progress;
          referral.currentPos = interpolate({ lat: phc.lat, lng: phc.lng }, { lat: hospital.lat, lng: hospital.lng }, progress);
          const amb = s.ambulances.find((a) => a.id === referral.ambulanceId);
          if (amb) amb.currentPos = referral.currentPos;
          if (progress >= 1) {
            markArrived(referral.id);
          }
          changed = true;
        }
      }
    });

    if (changed) {
      persist();
      emit("tick");
    }
  }, 1500);
}

// --- Auth (mock) -----------------------------------------------------------
export function findUser(userId) {
  return getState().users.find((u) => u.id === userId);
}

// No-op in demo mode — the local store is a single shared browser session,
// not scoped per signed-in user like the Supabase backend is.
export function setCurrentUser() {}
