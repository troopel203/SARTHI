// SARTHI matching engine.
//
// Design mirrors the abstract: a deterministic rule engine filters hospitals
// on hard safety constraints FIRST. Only hospitals that pass are then ranked
// by a scoring layer that stands in for the Gemini-assisted ranking described
// in the architecture (see getAIExplanation below for how to wire a real
// Gemini/OpenAI call in place of the local heuristic).

import { roadDistanceKm, etaMinutes, fetchOsrmRoute } from "./geo";

const PRIORITY_WEIGHT = { critical: 1, high: 0.75, medium: 0.5, low: 0.3 };

// STEP 1 — deterministic, explainable hard filter.
// A hospital must have the required resource AND (if specified) the
// required specialist available right now to even be considered.
export function ruleFilter(referral, hospitals) {
  return hospitals.filter((h) => {
    if (referral.rejectedHospitals?.includes(h.id)) return false;
    const hasResource =
      !referral.requiredResource || (h.resources[referral.requiredResource] ?? 0) > 0;
    const hasSpecialist =
      !referral.requiredSpecialist || h.specialists.includes(referral.requiredSpecialist);
    return hasResource && hasSpecialist;
  });
}

// STEP 2 — AI-assisted ranking of the filtered set.
// Weighted scoring across resource depth, travel time, and specialist match.
// This is a transparent local heuristic used so the prototype works fully
// offline with zero API cost; swap `scoreHospital` for a call to
// getAIExplanation() (Gemini) to get natural-language justified ranking.
export function rankHospitals(referral, filteredHospitals, origin) {
  const urgency = PRIORITY_WEIGHT[referral.priority] ?? 0.5;

  return filteredHospitals
    .map((h) => {
      const distanceKm = roadDistanceKm(origin, h);
      const eta = etaMinutes(origin, h);
      const resourceCount = referral.requiredResource
        ? h.resources[referral.requiredResource]
        : 0;

      // Normalize sub-scores 0..1
      const distScore = Math.max(0, 1 - distanceKm / 120); // closer is better
      const resourceScore = Math.min(1, resourceCount / 4); // more headroom is safer
      const specialistScore = referral.requiredSpecialist
        ? h.specialists.includes(referral.requiredSpecialist) ? 1 : 0
        : 0.6;
      const icuBonus = referral.priority === "critical" && h.resources.icuBed > 0 ? 0.15 : 0;

      // Urgent cases weight travel time harder; stable cases weight resource depth harder.
      const score =
        distScore * (0.35 + urgency * 0.15) +
        resourceScore * (0.3 - urgency * 0.05) +
        specialistScore * 0.25 +
        icuBonus;

      const reasons = [];
      if (specialistScore === 1) reasons.push(`Has ${referral.requiredSpecialist} on duty`);
      if (resourceCount > 0) reasons.push(`${resourceCount} unit(s) of required resource available`);
      reasons.push(`${eta} min estimated travel time (${distanceKm.toFixed(1)} km)`);
      if (icuBonus) reasons.push("ICU bed open for critical case");

      return { hospitalId: h.id, hospital: h, score: Number(score.toFixed(3)), eta, distanceKm: Number(distanceKm.toFixed(1)), reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function matchHospitals(referral, hospitals, origin) {
  const filtered = ruleFilter(referral, hospitals);
  return rankHospitals(referral, filtered, origin);
}

// Real road routing is too slow to run for every hospital on every keystroke,
// so ranking above uses the fast haversine heuristic to pick a shortlist,
// then THIS refines just the top few candidates with actual OSRM road
// distance/time before showing anything to the PHC or reserving a bed.
// Falls back to the heuristic numbers untouched if OSRM is unreachable —
// this is what keeps referral creation working over a poor rural connection.
export async function refineWithRealRouting(ranked, origin, topN = 3) {
  const top = ranked.slice(0, topN);
  const refined = await Promise.all(
    top.map(async (c) => {
      const real = await fetchOsrmRoute(origin, { lat: c.hospital.lat, lng: c.hospital.lng });
      if (!real) return c; // offline fallback — keep heuristic estimate
      return {
        ...c,
        eta: real.durationMin,
        distanceKm: Number(real.distanceKm.toFixed(1)),
        reasons: c.reasons.map((r) => (r.includes("min estimated") ? `${real.durationMin} min real-time route (${real.distanceKm.toFixed(1)} km)` : r)),
      };
    })
  );
  return [...refined, ...ranked.slice(topN)].sort((a, b) => b.score - a.score);
}

// Reservation response window before auto-escalating to the next hospital.
// Kept short for demo purposes (production would use minutes, not seconds).
export const RESERVATION_WINDOW_MS = 45_000;

export function priorityLabel(p) {
  return { critical: "Critical", high: "High", medium: "Medium", low: "Low" }[p] || p;
}

export function priorityColor(p) {
  return (
    {
      critical: "coral",
      high: "amber",
      medium: "teal",
      low: "mint",
    }[p] || "teal"
  );
}

// --- Real Gemini integration ---------------------------------------------
// Active automatically once VITE_GEMINI_API_KEY is set in .env — no code
// change needed. Produces a short natural-language rationale for the top
// match, stored on the referral as ai_explanation and shown to the PHC.
// The rule engine above ALWAYS runs first and is what actually determines
// eligibility — Gemini only explains/narrates the ranking, it never filters
// or overrides it, matching the "AI can never override a doctor" design.
export const isGeminiConfigured = Boolean(import.meta.env?.VITE_GEMINI_API_KEY);

export async function getAIExplanation(referral, candidates) {
  const key = import.meta.env?.VITE_GEMINI_API_KEY;
  if (!key || !candidates.length) return null;
  try {
    const prompt = `You are a clinical referral coordinator assistant. A patient with condition "${referral.condition}" (priority: ${referral.priority}) needs "${referral.requiredResource || "general care"}"${referral.requiredSpecialist ? ` and a ${referral.requiredSpecialist}` : ""}.
These hospitals already passed a hard eligibility check (resource + specialist confirmed available) and are pre-ranked by a scoring engine — do not re-rank them, just explain the choice in 2-3 short sentences for the referring doctor:
${candidates.slice(0, 3).map((c, i) => `${i + 1}. ${c.hospital.name} — ${c.eta} min away, score ${c.score}, ${c.reasons.join("; ")}`).join("\n")}
Respond with plain text only, no markdown, under 60 words.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null; // network issue / rate limit — UI already has the local explainable reasons as a fallback
  }
}
