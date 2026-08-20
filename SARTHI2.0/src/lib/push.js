// Real push notifications (production mode only). Subscribes this device to
// the browser's push service and stores the subscription in Supabase so the
// send-push Edge Function can deliver notifications to it even when the app
// isn't open — unlike the Notification API used in demo mode, which only
// fires while a tab is active.

import { supabase } from "./supabaseClient";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function subscribeToPush(userId) {
  const vapidKey = import.meta.env?.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const registration = await registerServiceWorker();
  if (!registration) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await supabase.from("push_subscriptions").upsert(
      { user_id: userId, subscription: subscription.toJSON() },
      { onConflict: "user_id,subscription" }
    );
    return true;
  } catch (err) {
    console.warn("SARTHI: push subscription failed", err.message);
    return false;
  }
}
