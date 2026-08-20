// Offline-tolerant referral creation for PHCs with unreliable connectivity —
// the exact scenario called out in the abstract ("PHCs in rural areas
// frequently face unreliable connectivity"). If the browser is offline (or
// the create call fails) when a PHC submits a referral, it's queued in
// IndexedDB and automatically retried the moment connectivity returns —
// nothing is lost, and the PHC gets a clear "queued, will sync" state
// instead of a silent failure or a spinner that never resolves.

import { get, set } from "idb-keyval";
import { createReferral } from "./db";
import { toast } from "./notify";

const QUEUE_KEY = "sarthi_pending_referrals";
const listeners = new Set();

async function readQueue() {
  return (await get(QUEUE_KEY)) || [];
}

async function writeQueue(items) {
  await set(QUEUE_KEY, items);
  listeners.forEach((fn) => fn(items));
}

export function subscribeQueue(fn) {
  listeners.add(fn);
  readQueue().then(fn);
  return () => listeners.delete(fn);
}

export async function queueReferral(input) {
  const items = await readQueue();
  const queued = { ...input, _queuedAt: Date.now(), _localId: `pending-${Date.now()}` };
  await writeQueue([...items, queued]);
  return queued;
}

export async function flushQueue() {
  if (!navigator.onLine) return;
  const items = await readQueue();
  if (!items.length) return;

  const remaining = [];
  for (const item of items) {
    try {
      const { _queuedAt, _localId, ...input } = item;
      await createReferral(input);
      toast(`Queued referral for ${input.patientName} synced successfully.`, "success");
    } catch {
      remaining.push(item); // still offline / still failing — keep it queued
    }
  }
  await writeQueue(remaining);
}

let wired = false;
export function initOfflineSync() {
  if (wired) return;
  wired = true;
  window.addEventListener("online", flushQueue);
  // Also retry periodically in case the 'online' event is unreliable on some devices.
  setInterval(flushQueue, 15000);
  flushQueue();
}
