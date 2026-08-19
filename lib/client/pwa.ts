import { syncPendingRecords } from "@/lib/client/sync";

const SHELL_CACHE_NAME = "frequency-consent-shell-v3";

const OFFLINE_REQUIRED_PATHS = [
  "/",
  "/manifest.webmanifest",
  "/assets/nordic-spirit-logo.png",
  "/assets/frequency-background.png",
  "/documents/haftung/page-1.png",
  "/documents/haftung/page-2.png",
  "/documents/haftung/page-3.png",
  "/documents/einwilligung/page-1.png",
  "/documents/einwilligung/page-2.png",
];

export interface OfflinePreparation {
  ready: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
  missing: string[];
}

export async function prepareOfflineApp(): Promise<OfflinePreparation> {
  let ready = false;
  let missing = [...OFFLINE_REQUIRED_PATHS];
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await registration.update().catch(() => undefined);
    await navigator.serviceWorker.ready;
    const resourceUrls = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => url.startsWith(window.location.origin))
      .filter((url) => !new URL(url).pathname.startsWith("/api/"));
    const cache = await caches.open(SHELL_CACHE_NAME);
    await Promise.all(resourceUrls.map((url) => cache.add(url).catch(() => undefined)));
    registration.active?.postMessage({ type: "CACHE_URLS", urls: resourceUrls });
    if ("caches" in window) {
      const checks = await Promise.all(
        OFFLINE_REQUIRED_PATHS.map(async (path) => ({ path, cached: Boolean(await caches.match(path)) })),
      );
      missing = checks.filter(({ cached }) => !cached).map(({ path }) => path);
      ready = missing.length === 0;
    }
  }
  const persisted = navigator.storage?.persist
    ? await navigator.storage.persist().catch(() => false)
    : null;
  const estimate = navigator.storage?.estimate
    ? await navigator.storage.estimate().catch(() => null)
    : null;
  return {
    ready,
    persisted,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
    missing,
  };
}

export function installSyncTriggers() {
  const trigger = () => void syncPendingRecords().catch(() => undefined);
  const visible = () => {
    if (document.visibilityState === "visible") trigger();
  };
  window.addEventListener("online", trigger);
  window.addEventListener("pageshow", trigger);
  document.addEventListener("visibilitychange", visible);
  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") trigger();
  }, 45_000);
  trigger();
  return () => {
    window.removeEventListener("online", trigger);
    window.removeEventListener("pageshow", trigger);
    document.removeEventListener("visibilitychange", visible);
    window.clearInterval(interval);
  };
}
