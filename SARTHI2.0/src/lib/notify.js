// Toast bus (in-app) + native browser notifications (system-level), so the
// prototype demonstrates both the in-app alert stream and true push-style
// alerts, matching the "instant communication" requirement in the brief.

const bus = new EventTarget();

export function toast(message, kind = "info") {
  bus.dispatchEvent(new CustomEvent("toast", { detail: { message, kind, id: Date.now() + Math.random() } }));
}

export function onToast(handler) {
  const listener = (e) => handler(e.detail);
  bus.addEventListener("toast", listener);
  return () => bus.removeEventListener("toast", listener);
}

export async function requestNotifyPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

export function nativeNotify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/sarthi-icon.svg" });
    } catch {
      /* some mobile browsers block this without a service worker — toast covers it */
    }
  }
}
