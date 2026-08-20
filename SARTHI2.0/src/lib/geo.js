// Lightweight geo helpers. In production, road-network distance/ETA would
// come from a GIS routing engine (OSRM / GraphHopper) — see README.
// Here we approximate with haversine distance + a rural-road speed factor,
// which is enough to demonstrate matching, ETA and dynamic rerouting logic.

const R_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

// Rural road detour factor — straight-line distance underestimates actual
// road travel, so we inflate it a bit for a more realistic ETA.
const ROAD_FACTOR = 1.35;
const AVG_SPEED_KMH = 38;

export function roadDistanceKm(a, b) {
  return haversineKm(a, b) * ROAD_FACTOR;
}

export function etaMinutes(a, b, speedKmh = AVG_SPEED_KMH) {
  const dist = roadDistanceKm(a, b);
  return Math.max(2, Math.round((dist / speedKmh) * 60));
}

export function bearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// Linear interpolation along the straight segment between origin & destination.
// t is 0..1 progress. Good enough to animate ambulance movement on the map.
export function interpolate(origin, dest, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: origin.lat + (dest.lat - origin.lat) * clamped,
    lng: origin.lng + (dest.lng - origin.lng) * clamped,
  };
}

// --- Real road-network routing (OSRM) ---------------------------------
// Public OSRM demo server — free, no key required, good for pilots/demos.
// For production scale, self-host OSRM (docker) or use a paid routing API
// and just swap the URL below; the calling code doesn't need to change.
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 4000;

// Returns real road-network distance/duration, or null if unreachable
// (e.g. the PHC has no signal) — callers MUST fall back to
// roadDistanceKm/etaMinutes above when this returns null. That fallback is
// what keeps referral creation working in low-connectivity rural areas,
// per the offline-tolerant design goal.
export async function fetchOsrmRoute(origin, dest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMin: Math.max(2, Math.round(route.duration / 60)),
    };
  } catch {
    return null; // offline, timed out, or OSRM demo server rate-limited — caller falls back
  } finally {
    clearTimeout(timeout);
  }
}
