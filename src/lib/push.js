import supabase from "lib/supabaseClient";
import { env } from "./env";

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || "";

function getFunctionsBase() {
  return env.SUPABASE_FUNCTIONS_URL || `${env.SUPABASE_URL}/functions/v1`;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensurePushPermission() {
  if (!("Notification" in window)) {
    throw new Error("Notifications are not supported in this browser.");
  }
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  if (result !== "granted") {
    throw new Error("Please allow notifications to continue.");
  }
  return true;
}

export async function getPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Missing VAPID public key.");
  }
  await ensurePushPermission();
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${getFunctionsBase()}/push-subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ subscription }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to save push subscription.");
  }

  return subscription;
}

export async function sendTestPush() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const userId = data?.session?.user?.id;
  if (!token || !userId) throw new Error("Not signed in.");

  const res = await fetch(`${getFunctionsBase()}/push-send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      title: "SuperFilm",
      body: "Test notification from SuperFilm.",
      url: "/",
      test: true,
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to send test notification.");
  }
  return true;
}
