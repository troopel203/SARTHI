import { useEffect, useRef, useState } from "react";
import { getState, subscribe, startEngine } from "./db";
import { toast, nativeNotify } from "./notify";

// Subscribes a component to the shared client-side "realtime" store.
// Any mutation in db.js (this tab or another tab) re-renders consumers,
// the same contract Supabase Realtime channels give the real backend.
export function useSarthiState() {
  const [state, setState] = useState(getState());

  useEffect(() => {
    startEngine();
    const unsub = subscribe((s) => setState({ ...s }));
    return unsub;
  }, []);

  return state;
}

// Watches the events log and surfaces toast + native notifications for
// events relevant to the signed-in role/entity (e.g. a PHC only hears
// about its own referrals; a hospital hears about referrals routed to it).
export function useRoleNotifications(state, user) {
  const seen = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!user) return;
    const relevant = state.events.filter((e) => isRelevant(e, state, user));

    if (!initialized.current) {
      // On first mount, mark existing events as seen so we don't spam on load.
      state.events.forEach((e) => seen.current.add(e.id));
      initialized.current = true;
      return;
    }

    relevant.forEach((e) => {
      if (seen.current.has(e.id)) return;
      seen.current.add(e.id);
      toast(e.message, e.kind);
      nativeNotify("SARTHI", e.message);
    });
  }, [state.events, user, state]);
}

function isRelevant(evt, state, user) {
  const referral = state.referrals.find((r) => r.id === evt.referralId);
  if (!referral) return user.role === "admin";
  if (user.role === "admin") return true;
  if (user.role === "ambulance" && evt.audience?.ambulanceId === user.entityId) return true;
  if (user.role === "phc") return referral.phcId === user.entityId;
  if (user.role === "hospital")
    return referral.hospitalId === user.entityId || referral.rejectedHospitals?.includes(user.entityId);
  if (user.role === "ambulance") return referral.ambulanceId === user.entityId;
  return false;
}
