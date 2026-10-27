"use client";

import { useEffect } from "react";

/** Registers the offline service worker (production builds only). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_CANVAS_SW_DEV !== "1") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[canvas] service worker", e));
  }, []);
  return null;
}
