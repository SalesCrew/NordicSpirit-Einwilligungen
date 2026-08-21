"use client";

import { type FormEvent, useEffect, useState } from "react";

import { getLastSuccessfulSync, getOrCreateDeviceId, getQueueCounts } from "@/lib/client/offline-db";
import { type OfflinePreparation, prepareOfflineApp } from "@/lib/client/pwa";
import { syncPendingRecords } from "@/lib/client/sync";

function formatStorage(bytes: number | null) {
  if (bytes === null) return "nicht verfügbar";
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export default function SetupPage() {
  const [deviceId, setDeviceId] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [showSetupCode, setShowSetupCode] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState("Gerätestatus wird geprüft …");
  const [working, setWorking] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, uploading: 0, synced: 0, error: 0 });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [offline, setOffline] = useState<OfflinePreparation | null>(null);

  const refreshStatus = async () => {
    const [nextCounts, nextLastSync] = await Promise.all([getQueueCounts(), getLastSuccessfulSync()]);
    setCounts(nextCounts);
    setLastSync(nextLastSync);
    return nextCounts;
  };

  const syncQueue = async () => {
    setMessage("Synchronisierung wird gestartet …");
    const result = await syncPendingRecords(true, (progress) => {
      setMessage(
        `Synchronisierung läuft: ${progress.attempted} von ${progress.total} geprüft · ${progress.synced} erfolgreich · ${progress.failed} fehlgeschlagen`,
      );
      void refreshStatus().catch(() => undefined);
    });
    const nextCounts = await refreshStatus();
    if (!result) {
      setMessage("Eine Synchronisierung läuft bereits. Der Status wird automatisch aktualisiert.");
      return;
    }
    if (result?.failed) {
      setMessage(
        `Synchronisierung beendet: ${result.synced} erfolgreich, ${result.failed} fehlgeschlagen. ${result.lastError || "Unbekannter Fehler"}`,
      );
      return;
    }
    if (nextCounts.pending + nextCounts.uploading + nextCounts.error === 0) {
      setMessage(result?.synced
        ? `${result.synced} Datensatz/Datensätze erfolgreich mit Supabase synchronisiert.`
        : "Keine ausstehenden Datensätze. Dieses iPad ist freigeschaltet und bereit.");
      return;
    }
    setMessage("Die Synchronisierung läuft bereits. Bitte Status erneut prüfen.");
  };

  useEffect(() => {
    void getOrCreateDeviceId().then(async (id) => {
      setDeviceId(id);
      const response = await fetch("/api/device/session", { cache: "no-store" }).catch(() => null);
      const session = response
        ? await response.json().catch(() => null) as { configured?: boolean; reason?: string; error?: string } | null
        : null;
      setConfigured(Boolean(session?.configured));
      setMessage(
        session?.configured
          ? "Dieses iPad ist in Supabase registriert und bereit für die Synchronisierung."
          : session?.reason === "device-not-registered"
            ? "Diese Geräte-ID ist nicht in Supabase registriert. Bitte mit dem Setup-Code erneut freischalten."
            : response && !response.ok
              ? session?.error || "Der Gerätestatus konnte gerade nicht geprüft werden. Bitte erneut versuchen."
              : "Dieses iPad muss einmalig freigeschaltet werden.",
      );
      await Promise.all([
        refreshStatus(),
        prepareOfflineApp().then(setOffline).catch(() => setOffline({
          ready: false,
          persisted: null,
          usage: null,
          quota: null,
          missing: [],
        })),
      ]);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    try {
      const response = await fetch("/api/device/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, setupCode }),
        credentials: "same-origin",
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Freischaltung fehlgeschlagen");
      const verificationResponse = await fetch("/api/device/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const verification = verificationResponse.ok
        ? await verificationResponse.json() as { configured?: boolean }
        : null;
      if (!verification?.configured) {
        throw new Error("Die Freischaltung konnte auf diesem iPad nicht gespeichert werden. Bitte erneut versuchen.");
      }
      setConfigured(true);
      setSetupCode("");
      setShowSetupCode(false);
      setMessage("Dieses iPad ist freigeschaltet. Ausstehende Datensätze werden jetzt synchronisiert.");
      await syncQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Freischaltung fehlgeschlagen");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <span className="document-tag">Personal-Setup</span>
        <h1>iPad freischalten</h1>
        <p className={`setup-message ${configured ? "ready" : ""}`} role="status" aria-live="polite">
          <strong>{configured ? "Freigeschaltet" : "Setup erforderlich"}</strong>
          <span>{message}</span>
        </p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Geräte-ID</span>
            <input value={deviceId} readOnly aria-readonly="true" />
          </label>
          <div className="field">
            <label htmlFor="setup-code">Setup-Code</label>
            <span className="setup-code-control">
              <input
                id="setup-code"
                type={showSetupCode ? "text" : "password"}
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value)}
                autoComplete="off"
                required
              />
              <button
                className="setup-code-visibility"
                type="button"
                aria-label={showSetupCode ? "Setup-Code ausblenden" : "Setup-Code anzeigen"}
                aria-pressed={showSetupCode}
                onClick={() => setShowSetupCode((visible) => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {showSetupCode ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.7 10.7 0 0 1 12 4c5.5 0 9 5.5 9 5.5a15 15 0 0 1-2.1 2.6M6.6 6.7C4.3 8.2 3 10.5 3 10.5S6.5 16 12 16c1 0 1.9-.2 2.7-.5" />
                    </>
                  ) : (
                    <>
                      <path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  )}
                </svg>
              </button>
            </span>
          </div>
          <button
            className={`primary-button start-button ${configured ? "setup-unlocked-button" : ""}`}
            type="submit"
            disabled={working || !deviceId || !setupCode}
          >
            {working
              ? "Wird freigeschaltet …"
              : configured
                ? "iPad erneut freischalten"
                : "iPad freischalten"}
          </button>
        </form>
        <div className="setup-queue" aria-label="Lokale Warteschlange">
          <div><strong>{counts.pending + counts.uploading + counts.error}</strong><span>ausstehend</span></div>
          <div><strong>{counts.synced}</strong><span>synchronisiert</span></div>
          <div><strong>{counts.error}</strong><span>mit Fehler</span></div>
        </div>
        <div className={`setup-readiness ${offline?.ready ? "ready" : ""}`} aria-live="polite">
          <strong>
            {!offline
              ? "Offline-Status wird geprüft …"
              : offline.ready
                ? "Offline bereit"
                : `Offline noch nicht bereit${offline.missing.length ? ` · ${offline.missing.length} Datei(en) fehlen` : ""}`}
          </strong>
          <span>
            {offline
              ? `${formatStorage(offline.usage)} von ${formatStorage(offline.quota)} lokal belegt · ${offline.persisted ? "persistenter Speicher" : "Best-Effort-Speicher"}`
              : "App-Shell und Dokumentseiten werden geprüft."}
          </span>
          <span>
            Letzte erfolgreiche Synchronisierung: {lastSync
              ? new Intl.DateTimeFormat("de-AT", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastSync))
              : "noch keine"}
          </span>
        </div>
        <button
          className="secondary-button setup-sync-button"
          type="button"
          disabled={working || !configured}
          onClick={() => {
            setWorking(true);
            void syncQueue()
              .catch((error) => setMessage(error instanceof Error ? error.message : "Synchronisierung fehlgeschlagen"))
              .finally(() => setWorking(false));
          }}
        >
          {working
            ? "Synchronisierung läuft …"
            : configured
              ? "Jetzt synchronisieren"
              : "Zuerst iPad freischalten"}
        </button>
        <button
          className="setup-app-link"
          type="button"
          onTouchEnd={(event) => {
            event.preventDefault();
            window.location.replace("/");
          }}
          onClick={() => window.location.replace("/")}
        >
          Zur App
        </button>
      </section>
    </main>
  );
}
