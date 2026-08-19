"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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
  const [message, setMessage] = useState("Gerätestatus wird geprüft …");
  const [working, setWorking] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, uploading: 0, synced: 0, error: 0 });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [offline, setOffline] = useState<OfflinePreparation | null>(null);

  const refreshStatus = async () => {
    const [nextCounts, nextLastSync] = await Promise.all([getQueueCounts(), getLastSuccessfulSync()]);
    setCounts(nextCounts);
    setLastSync(nextLastSync);
  };

  useEffect(() => {
    void getOrCreateDeviceId().then(async (id) => {
      setDeviceId(id);
      const response = await fetch("/api/device/session", { cache: "no-store" }).catch(() => null);
      const session = response?.ok
        ? await response.json() as { configured?: boolean }
        : null;
      setMessage(session?.configured
        ? "Dieses iPad ist bereit für die Synchronisierung."
        : "Dieses iPad muss einmalig freigeschaltet werden.");
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
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Freischaltung fehlgeschlagen");
      setSetupCode("");
      setMessage("Dieses iPad ist freigeschaltet. Ausstehende Datensätze werden jetzt synchronisiert.");
      await syncPendingRecords(true);
      await refreshStatus();
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
        <p>{message}</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Geräte-ID</span>
            <input value={deviceId} readOnly aria-readonly="true" />
          </label>
          <label className="field">
            <span>Setup-Code</span>
            <input
              type="password"
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <button className="primary-button start-button" type="submit" disabled={working || !deviceId || !setupCode}>
            {working ? "Wird freigeschaltet …" : "iPad freischalten"}
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
          disabled={working}
          onClick={() => {
            setWorking(true);
            void syncPendingRecords(true)
              .then(refreshStatus)
              .finally(() => setWorking(false));
          }}
        >
          Jetzt synchronisieren
        </button>
        <Link href="/">Zur App</Link>
      </section>
    </main>
  );
}
