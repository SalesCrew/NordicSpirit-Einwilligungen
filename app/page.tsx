"use client";

import Image from "next/image";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  APP_VERSION,
  CONSENT_TEMPLATE_VERSION,
  EVENT_ID,
  LIABILITY_TEMPLATE_VERSION,
  PRIVACY_NOTICE_VERSION,
  type LocalConsentRecord,
} from "@/lib/contracts";
import { generateConsentDocuments } from "@/lib/client/document-generator";
import { dataUrlToBlob, getOrCreateDeviceId, saveLocalRecord } from "@/lib/client/offline-db";
import { installSyncTriggers, prepareOfflineApp } from "@/lib/client/pwa";
import { syncRecord } from "@/lib/client/sync";

type Step = "start" | "liability" | "consent" | "privacy" | "form" | "preview" | "success";
type PhotoChoice = "" | "yes" | "no";

function getToday() {
  const parts = new Intl.DateTimeFormat("de-AT", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = value.year;
  const month = value.month;
  const day = value.day;
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-AT").format(new Date(`${value}T12:00:00`));
}

function isAdult(birthDate: string, referenceDate: string) {
  if (!birthDate) return false;
  const birth = new Date(`${birthDate}T12:00:00`);
  const reference = new Date(`${referenceDate}T12:00:00`);
  let age = reference.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    reference.getMonth() < birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 18;
}

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

type DatePickerView = "year" | "month" | "day";

function CustomDatePicker({
  label,
  value,
  onChange,
  minYear = 1900,
  maxYear = new Date().getFullYear() + 2,
  maxDate,
  helper,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
  maxDate?: string;
  helper?: string;
  error?: string;
}) {
  const selected = value ? value.split("-").map(Number) : [];
  const initialYear = selected[0] || Math.min(new Date().getFullYear(), maxYear);
  const initialMonth = selected[1] ? selected[1] - 1 : new Date().getMonth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DatePickerView>("year");
  const [draftYear, setDraftYear] = useState(initialYear);
  const [draftMonth, setDraftMonth] = useState(initialMonth);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const openPicker = () => {
    const current = value ? value.split("-").map(Number) : [];
    setDraftYear(current[0] || Math.min(new Date().getFullYear(), maxYear));
    setDraftMonth(current[1] ? current[1] - 1 : new Date().getMonth());
    setView("year");
    setOpen(true);
  };

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
  const maxParts = maxDate ? maxDate.split("-").map(Number) : null;
  const daysInMonth = new Date(draftYear, draftMonth + 1, 0).getDate();
  const leadingDays = (new Date(draftYear, draftMonth, 1).getDay() + 6) % 7;

  const chooseDay = (day: number) => {
    const nextValue = `${draftYear}-${String(draftMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (maxDate && nextValue > maxDate) return;
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className="field date-field">
      <span>{label}</span>
      <button
        className={`date-trigger ${value ? "has-value" : ""}`}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{value ? formatDate(value) : "tt.mm.jjjj"}</span>
        <span className="date-trigger-icon" aria-hidden="true" />
      </button>
      {helper && <small>{helper}</small>}
      {error && <small className="field-error">{error}</small>}

      {open && (
        <div className="date-picker-backdrop" role="presentation" onPointerDown={() => setOpen(false)}>
          <section
            className="date-picker-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${label} auswählen`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="date-picker-header">
              <button
                className="date-picker-back"
                type="button"
                onClick={() => setView(view === "day" ? "month" : "year")}
                aria-label="Einen Schritt zurück"
                disabled={view === "year"}
              >
                ←
              </button>
              <div>
                <span>{view === "year" ? "Jahr" : view === "month" ? "Monat" : "Tag"}</span>
                <strong>
                  {view === "year" && "Wähle dein Jahr"}
                  {view === "month" && draftYear}
                  {view === "day" && `${MONTHS[draftMonth]} ${draftYear}`}
                </strong>
              </div>
              <button className="date-picker-close" type="button" onClick={() => setOpen(false)} aria-label="Schließen">
                ×
              </button>
            </header>

            <div className="date-picker-progress" aria-hidden="true">
              <span className="active" />
              <span className={view !== "year" ? "active" : ""} />
              <span className={view === "day" ? "active" : ""} />
            </div>

            <div className="date-picker-stage" key={view}>
              {view === "year" && (
                <div className="date-year-grid">
                  {years.map((year) => (
                    <button
                      className={selected[0] === year ? "selected" : ""}
                      type="button"
                      key={year}
                      onClick={() => {
                        setDraftYear(year);
                        setView("month");
                      }}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}

              {view === "month" && (
                <div className="date-month-grid">
                  {MONTHS.map((month, monthIndex) => {
                    const disabled = Boolean(
                      maxParts &&
                      draftYear === maxParts[0] &&
                      monthIndex + 1 > maxParts[1],
                    );
                    return (
                      <button
                        className={selected[0] === draftYear && selected[1] === monthIndex + 1 ? "selected" : ""}
                        type="button"
                        key={month}
                        disabled={disabled}
                        onClick={() => {
                          setDraftMonth(monthIndex);
                          setView("day");
                        }}
                      >
                        {month}
                      </button>
                    );
                  })}
                </div>
              )}

              {view === "day" && (
                <div className="date-day-wrap">
                  <div className="date-weekdays" aria-hidden="true">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="date-day-grid">
                    {Array.from({ length: leadingDays }, (_, index) => <span key={`empty-${index}`} />)}
                    {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                      const candidate = `${draftYear}-${String(draftMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      return (
                        <button
                          className={value === candidate ? "selected" : ""}
                          type="button"
                          key={day}
                          disabled={Boolean(maxDate && candidate > maxDate)}
                          onClick={() => chooseDay(day)}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DocumentScreen({
  type,
  onContinue,
}: {
  type: "liability" | "consent";
  onContinue: () => void;
}) {
  const pages =
    type === "liability"
      ? [
          "/documents/haftung/page-1.png",
          "/documents/haftung/page-2.png",
          "/documents/haftung/page-3.png",
        ]
      : [
          "/documents/einwilligung/page-1.png",
          "/documents/einwilligung/page-2.png",
        ];
  const title =
    type === "liability"
      ? "Haftungsausschluss und Datenschutzinformation"
      : "Einwilligung zur Foto- und Videoverwendung";

  return (
    <main className="document-reader" aria-labelledby="document-title">
      <div className="document-overlay">
        <h1 id="document-title" className="visually-hidden">{title}</h1>
        <div className="word-pages">
          {pages.map((src, index) => (
            <div
              key={src}
              className={index === pages.length - 1 ? "word-page-frame last-word-page-frame" : "word-page-frame"}
            >
              <Image
                className="word-page"
                src={src}
                alt={`${title}, Seite ${index + 1} von ${pages.length}`}
                width={1489}
                height={2106}
                priority={index === 0}
                unoptimized
              />
            </div>
          ))}
          <div className="document-bottom-action">
            <button className="primary-button start-button document-next-button" type="button" onClick={onContinue}>
              Weiter <span aria-hidden="true">⟶</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function PrivacyNoticeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="document-reader" aria-labelledby="privacy-title">
      <div className="document-overlay">
        <div className="word-pages">
          <article className="legal-paper privacy-paper">
            <header className="document-heading privacy-heading">
              <span className="document-tag">Datenschutzinformation · Version {PRIVACY_NOTICE_VERSION}</span>
              <h1 id="privacy-title">Digitale Teilnahme und Nachweisführung</h1>
              <p>Diese Information wird dir vor der Eingabe deiner persönlichen Daten bereitgestellt.</p>
            </header>

            <section className="legal-section">
              <h2>1. Wer ist verantwortlich?</h2>
              <p>
                Für die digitale Erfassung deiner Teilnahmeunterlagen und die gemeinsame
                Nachweisführung sind die <strong>Gastro Werbe &amp; Service GmbH</strong>,
                Eugengasse 25, 2500 Baden, hannes.friedriger@gws.co.at, und die
                <strong> JTI Austria GmbH</strong>, Erdberger Lände 26a/71, 1030 Wien,
                FN 309726f, konsumentenservice@jti.com, gemeinsam verantwortlich. Du kannst
                deine Datenschutzrechte gegenüber beiden Unternehmen ausüben. Für Foto- und
                Videoaufnahmen sowie deren in der gesonderten Einwilligung beschriebene
                Verwendung ist JTI verantwortlich.
              </p>
            </section>

            <section className="legal-section">
              <h2>2. Welche Daten verarbeiten wir?</h2>
              <p>
                Wir verarbeiten deinen Vor- und Nachnamen, dein Geburtsdatum, das Datum deiner
                Teilnahme, deine Unterschrift, deine Auswahl zur Foto-/Videoeinwilligung,
                deine Lesebestätigungen und die Versionen der angezeigten Dokumente. Zur
                sicheren Nachweisführung speichern wir außerdem technische Kennungen,
                Zeitpunkte, Dateipfade, Dateigrößen und kryptografische Prüfwerte.
              </p>
              <p>
                Wenn du der Foto-/Videoverwendung zustimmst, können JTI oder beauftragte
                Agenturen außerdem erkennbare Foto- und Videoaufnahmen von dir erstellen und
                wie in der gesonderten Einwilligung beschrieben verwenden.
              </p>
            </section>

            <section className="legal-section">
              <h2>3. Wofür und auf welcher Grundlage?</h2>
              <p>
                Wir verwenden deine Angaben, um deine Volljährigkeit zu prüfen, deine Teilnahme
                abzuwickeln und die unterzeichneten Unterlagen zu erstellen (Art. 6 Abs. 1 lit. b
                DSGVO). Dokumentversion, Auswahl, Unterzeichnung, Integrität und Übermittlung
                werden gespeichert, damit GWS und JTI die ordnungsgemäße Abwicklung belegen,
                Ansprüche geltend machen oder abwehren und das System schützen können (Art. 6
                Abs. 1 lit. f DSGVO). Unser berechtigtes Interesse ist eine beweissichere,
                sichere und nachvollziehbare Veranstaltungsabwicklung.
              </p>
              <p>
                Die Aufnahme und Nutzung erkennbarer Foto-/Videoaufnahmen erfolgt nur, wenn du
                gesondert „Ja“ auswählst (Art. 6 Abs. 1 lit. a DSGVO). Die Aktivität ist als
                Foto-/Video-Promotion konzipiert; die Einwilligung in die im Dokument
                beschriebenen Aufnahmen und Nutzungen ist daher Teilnahmevoraussetzung. Wenn
                du „Nein“ auswählst, kann die Anmeldung nicht abgeschlossen werden. Du kannst
                eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft über
                konsumentenservice@jti.com widerrufen. Die Rechtmäßigkeit der Verarbeitung bis
                zum Widerruf bleibt unberührt.
              </p>
            </section>

            <section className="legal-section">
              <h2>4. Wer erhält die Daten?</h2>
              <p>
                Zugriff erhalten nur berechtigte Mitarbeiter:innen von GWS und JTI sowie
                notwendige IT-/Hosting-Dienstleister, die vertraglich gebunden sind. Bei
                erteilter Foto-/Videoeinwilligung können beauftragte Fotograf:innen, Agenturen,
                Medien-, Plattform- und Kooperationspartner die dafür erforderlichen Aufnahmen
                erhalten. Bei einem Vorfall oder Rechtsstreit können erforderliche Unterlagen an
                Rechtsberatung, Versicherungen, Gerichte, Behörden oder sonstige zuständige
                Stellen übermittelt werden.
              </p>
              <p>
                Für die Bereitstellung der Web-App und ihrer serverseitigen Schnittstellen wird
                Vercel als Hosting-Auftragsverarbeiter eingesetzt. Dabei werden die für Betrieb,
                Sicherheit und Übermittlung erforderlichen Anfragen, technischen Protokolldaten
                und Dokumente verarbeitet. Die geschützte Speicherung der unterzeichneten
                Dokumente erfolgt bei Supabase in der Projektregion Frankfurt (EU).
                Soweit Vercel, Supabase oder deren Unterauftragsverarbeiter Daten außerhalb des
                Europäischen Wirtschaftsraums verarbeiten, erfolgt dies nur auf Grundlage eines
                Angemessenheitsbeschlusses oder geeigneter Garantien wie
                EU-Standardvertragsklauseln.
              </p>
            </section>

            <section className="legal-section">
              <h2>5. Wie lange speichern wir die Daten?</h2>
              <p>
                Die unterzeichneten Teilnahme- und Nachweisdokumente werden grundsätzlich drei
                Jahre nach Ende des Frequency Festivals 2026 gelöscht oder irreversibel
                anonymisiert. Besteht ein konkreter Vorfall, Anspruch oder Rechtsstreit, werden
                nur die dafür erforderlichen Datensätze gesperrt und bis zur abschließenden
                Klärung sowie zum Ablauf der einschlägigen gesetzlichen Frist aufbewahrt.
              </p>
              <p>
                Nicht synchronisierte Unterlagen bleiben im lokalen Browserspeicher des
                Veranstaltungs-iPads, bis der erfolgreiche Upload anhand von Prüfwerten bestätigt
                ist. Danach werden Name, Geburtsdatum, Rohsignatur und vollständige
                Dokumentkopien auf dem iPad automatisch gelöscht. Die Foto-/Videoeinwilligung
                und der dafür erforderliche Minimalnachweis werden solange aufbewahrt, wie die
                erlaubte Nutzung fortbesteht; nach einem Widerruf wird die zukünftige Nutzung
                beendet und der verbleibende Nachweis nur noch gesperrt zur Rechtsverteidigung
                verwendet.
              </p>
            </section>

            <section className="legal-section">
              <h2>6. Welche Rechte hast du?</h2>
              <p>
                Du hast – je nach den gesetzlichen Voraussetzungen – das Recht auf Auskunft,
                Berichtigung, Löschung, Einschränkung der Verarbeitung und
                Datenübertragbarkeit. Einer Verarbeitung auf Grundlage berechtigter Interessen
                kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben,
                widersprechen. Eine Einwilligung kannst du jederzeit für die Zukunft widerrufen.
              </p>
              <p>
                Du kannst dich an GWS oder JTI wenden. Außerdem hast du das Recht auf Beschwerde
                bei der <strong>Österreichischen Datenschutzbehörde</strong>, Barichgasse 40–42,
                1030 Wien, +43 1 52 152-0, dsb@dsb.gv.at.
              </p>
            </section>

            <section className="legal-section">
              <h2>7. Musst du die Daten angeben?</h2>
              <p>
                Name, Geburtsdatum, Datum, Unterschrift, die Bestätigung der
                Teilnahmebedingungen und die ausdrückliche Foto-/Videoeinwilligung sind für
                diese Aktivität erforderlich. Ohne diese Angaben und Bestätigungen kann die
                Anmeldung nicht abgeschlossen werden. Es findet keine ausschließlich
                automatisierte Entscheidung und kein Profiling statt.
              </p>
            </section>

            <section className="legal-section privacy-last-section">
              <h2>8. Lokale Technik auf dem iPad</h2>
              <p>
                Die App nutzt ausschließlich technisch erforderliche lokale Speichermechanismen
                und ein Service-Worker-Caching, damit der Vorgang bei einer unterbrochenen
                Internetverbindung fortgesetzt und später sicher synchronisiert werden kann. Es
                werden dabei keine Analyse- oder Werbe-Tracker eingesetzt.
              </p>
            </section>
          </article>

          <div className="document-bottom-action privacy-bottom-action">
            <button className="primary-button start-button document-next-button" type="button" onClick={onContinue}>
              Gelesen &amp; weiter <span aria-hidden="true">⟶</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function SignaturePad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.getBoundingClientRect().width;
      canvas.width = width * ratio;
      canvas.height = 210 * ratio;
      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (context) {
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 3;
        context.strokeStyle = "#17202a";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    const p = point(event);
    drawing.current = true;
    context?.beginPath();
    context?.moveTo(p.x, p.y);
    context?.lineTo(p.x + 0.1, p.y + 0.1);
    context?.stroke();
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    const p = point(event);
    context?.lineTo(p.x, p.y);
    context?.stroke();
  };

  const finish = () => {
    if (!drawing.current || !canvasRef.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (context) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
      context.beginPath();
    }
    drawing.current = false;
    onChange("");
  };

  return (
    <div className={`signature-field ${value ? "has-signature" : ""}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label="Unterschrift mit Finger zeichnen"
      />
      {!value && <span className="signature-placeholder">Hier mit dem Finger unterschreiben</span>}
      <div className="signature-baseline" />
      <button type="button" className="clear-signature" onClick={clear} disabled={!value}>
        Löschen
      </button>
    </div>
  );
}

function ParticipationForm({
  onContinue,
  onAbort,
  onOpenPrivacy,
  fullName,
  setFullName,
  birthDate,
  setBirthDate,
  signedDate,
  setSignedDate,
  photoChoice,
  setPhotoChoice,
  readConfirmed,
  setReadConfirmed,
  privacyAcknowledged,
  setPrivacyAcknowledged,
  signature,
  setSignature,
}: {
  onContinue: () => void;
  onAbort: () => void;
  onOpenPrivacy: () => void;
  fullName: string;
  setFullName: (value: string) => void;
  birthDate: string;
  setBirthDate: (value: string) => void;
  signedDate: string;
  setSignedDate: (value: string) => void;
  photoChoice: PhotoChoice;
  setPhotoChoice: (value: PhotoChoice) => void;
  readConfirmed: boolean;
  setReadConfirmed: (value: boolean) => void;
  privacyAcknowledged: boolean;
  setPrivacyAcknowledged: (value: boolean) => void;
  signature: string;
  setSignature: (value: string) => void;
}) {
  const [showNoModal, setShowNoModal] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const adult = isAdult(birthDate, signedDate);
  const valid =
    readConfirmed &&
    privacyAcknowledged &&
    photoChoice === "yes" &&
    fullName.trim().length >= 3 &&
    Boolean(birthDate) &&
    adult &&
    Boolean(signedDate) &&
    Boolean(signature);

  const choosePhoto = (choice: PhotoChoice) => {
    setPhotoChoice(choice);
    if (choice === "no") setShowNoModal(true);
  };

  const submit = () => {
    setAttempted(true);
    if (valid) onContinue();
  };

  return (
    <main className="form-reader">
      <section className="form-overlay">
        <div className="form-scroll">
          <div className="form-panel">
            <div className="panel-heading">
              <span className="document-tag">Fast geschafft</span>
              <h2>Jetzt fehlen nur noch deine Angaben.</h2>
              <p>Sie werden später automatisch in beide Dokumente übernommen.</p>
            </div>

            {attempted && !valid && (
              <div className="error-summary" role="alert">
                <strong>Bitte vervollständige deine Angaben.</strong>
                <span>Alle Felder, beide Bestätigungen, deine Auswahl und deine Unterschrift sind erforderlich.</span>
              </div>
            )}

            <div className="form-stack">
              <label className="confirmation-card">
            <input
              type="checkbox"
              checked={readConfirmed}
              onChange={(event) => setReadConfirmed(event.target.checked)}
            />
            <span className="custom-checkbox" aria-hidden="true">✓</span>
            <span>
              <strong>Ich habe beide Dokumente ausführlich gelesen.</strong>
              <small>Ich habe den Inhalt verstanden und akzeptiere die Bedingungen.</small>
            </span>
              </label>

              <label className="confirmation-card privacy-confirmation-card">
                <input
                  type="checkbox"
                  checked={privacyAcknowledged}
                  onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
                />
                <span className="custom-checkbox" aria-hidden="true">✓</span>
                <span>
                  <strong>Ich habe die Datenschutzinformation gelesen.</strong>
                  <small>
                    Version {PRIVACY_NOTICE_VERSION} ·{" "}
                    <button
                      className="privacy-inline-link"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenPrivacy();
                      }}
                    >
                      Datenschutzinformation erneut öffnen
                    </button>
                  </small>
                </span>
              </label>

              <fieldset className="choice-fieldset">
            <legend>Einwilligung Foto & Video</legend>
            <p>
              Darf Bild- und Videomaterial, auf dem du erkennbar bist, wie beschrieben verwendet
              werden?
            </p>
            <div className="choice-grid">
              <label className={photoChoice === "yes" ? "choice-card selected" : "choice-card"}>
                <input
                  type="radio"
                  name="photo-choice"
                  value="yes"
                  checked={photoChoice === "yes"}
                  onChange={() => choosePhoto("yes")}
                />
                <span className="choice-mark">✓</span>
                <span><strong>Ja</strong><small>Ich willige ein</small></span>
              </label>
              <label className={photoChoice === "no" ? "choice-card selected danger" : "choice-card"}>
                <input
                  type="radio"
                  name="photo-choice"
                  value="no"
                  checked={photoChoice === "no"}
                  onChange={() => choosePhoto("no")}
                />
                <span className="choice-mark">×</span>
                <span><strong>Nein</strong><small>Keine Einwilligung</small></span>
              </label>
            </div>
              </fieldset>

              <div className="input-grid">
            <label className="field full-field">
              <span>Vor- und Nachname</span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="z. B. Max Mustermann"
                autoComplete="name"
              />
            </label>
            <CustomDatePicker
              label="Geburtsdatum"
              value={birthDate}
              maxDate={signedDate}
              maxYear={Number(signedDate.slice(0, 4))}
              onChange={setBirthDate}
              error={birthDate && !adult ? "Teilnahme erst ab 18 Jahren." : undefined}
            />
            <CustomDatePicker
              label="Datum"
              value={signedDate}
              minYear={new Date().getFullYear() - 2}
              maxYear={new Date().getFullYear() + 2}
              onChange={setSignedDate}
              helper="Automatisch vorausgefüllt"
            />
              </div>

              <div className="signature-group">
                <div>
                  <h3>Unterschrift</h3>
                  <p>Bitte direkt im Feld mit dem Finger unterschreiben.</p>
                </div>
                <SignaturePad value={signature} onChange={setSignature} />
              </div>
            </div>
          </div>
          <footer className="form-bottom-action">
            <button className="primary-button start-button form-next-button" type="button" onClick={submit}>
              Angaben prüfen <span aria-hidden="true">⟶</span>
            </button>
          </footer>
        </div>
      </section>

      {showNoModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="no-title">
            <div className="modal-icon no-consent-modal-icon" aria-hidden="true">i</div>
            <h2 id="no-title">Teilnahmevoraussetzung Foto &amp; Video</h2>
            <p>
              Für die Teilnahme an „Geh ma steil!“ ist die Einwilligung in die im Dokument
              beschriebenen Foto- und Videoaufnahmen und deren Nutzung erforderlich. Mit „Nein“
              kann die Anmeldung nicht abgeschlossen werden. Deine Auswahl wird nicht als
              Teilnahme gespeichert.
            </p>
            <div className="modal-actions">
              <button
                className="primary-button compact-button"
                type="button"
                onClick={() => {
                  setPhotoChoice("");
                  setShowNoModal(false);
                }}
              >
                Auswahl ändern
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={onAbort}
              >
                Zur Startseite
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ReviewWordDocument({
  type,
  fullName,
  birthDate,
  signedDate,
  signature,
}: {
  type: "liability" | "consent";
  fullName: string;
  birthDate: string;
  signedDate: string;
  signature: string;
}) {
  const pages =
    type === "liability"
      ? [
          "/documents/haftung/page-1.png",
          "/documents/haftung/page-2.png",
          "/documents/haftung/page-3.png",
        ]
      : [
          "/documents/einwilligung/page-1.png",
          "/documents/einwilligung/page-2.png",
        ];
  const title = type === "liability"
    ? "Haftungsausschluss und Datenschutzinformation"
    : "Einwilligung zur Foto- und Videoverwendung";

  return (
    <section className="review-word-document" aria-label={title}>
      <div className="review-document-label">{title}</div>
      {pages.map((src, index) => (
        <div
          key={src}
          className={`word-page-frame review-word-page-frame ${index === pages.length - 1 ? "last-word-page-frame" : ""}`}
        >
          <Image
            className="word-page"
            src={src}
            alt={`${title}, Seite ${index + 1} von ${pages.length}`}
            width={1489}
            height={2106}
            unoptimized
          />

          {type === "liability" && index === 0 && (
            <div className="review-field-layer" aria-hidden="true">
              <span className="review-field liability-check">✓</span>
              <span className="review-field liability-name">{fullName}</span>
              <span className="review-field liability-birth">{formatDate(birthDate)}</span>
              <span className="review-field liability-date">{formatDate(signedDate)}</span>
              {signature && (
                <Image
                  className="review-signature liability-signature"
                  src={signature}
                  alt=""
                  width={500}
                  height={180}
                  unoptimized
                />
              )}
            </div>
          )}

          {type === "consent" && index === 1 && (
            <div className="review-field-layer" aria-hidden="true">
              <span className="review-field consent-name">{fullName}</span>
              <span className="review-field consent-birth">{formatDate(birthDate)}</span>
              <span className="review-field consent-date">{formatDate(signedDate)}</span>
              {signature && (
                <Image
                  className="review-signature consent-signature"
                  src={signature}
                  alt=""
                  width={500}
                  height={180}
                  unoptimized
                />
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function ReviewScreen({
  onConfirm,
  saving,
  fullName,
  birthDate,
  signedDate,
  signature,
}: {
  onConfirm: () => void;
  saving: boolean;
  fullName: string;
  birthDate: string;
  signedDate: string;
  signature: string;
}) {
  return (
    <main className="review-reader">
      <section className="review-overlay">
        <div className="review-scroll">
          <header className="review-heading">
            <span className="document-tag">Letzter Check</span>
            <h2>Bitte prüfe beide Dokumente.</h2>
            <p>Deine Angaben sind direkt in die Originaldokumente eingesetzt.</p>
          </header>

          <ReviewWordDocument
            type="liability"
            fullName={fullName}
            birthDate={birthDate}
            signedDate={signedDate}
            signature={signature}
          />

          <ReviewWordDocument
            type="consent"
            fullName={fullName}
            birthDate={birthDate}
            signedDate={signedDate}
            signature={signature}
          />

          <footer className="review-bottom-action">
            <p className="review-privacy-receipt">
              Datenschutzinformation Version {PRIVACY_NOTICE_VERSION} wurde vor der Eingabe bereitgestellt und bestätigt.
            </p>
            <button
              className="primary-button start-button review-next-button"
              type="button"
              onClick={onConfirm}
              disabled={saving}
            >
              {saving ? "Dokumente werden gespeichert …" : "Alle Angaben sind korrekt"}
              {!saving && <span aria-hidden="true">⟶</span>}
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function SaveStatusDialog({
  mode,
  retrying,
  onContinue,
  onRetry,
  onBack,
}: {
  mode: "offline" | "storage-error";
  retrying: boolean;
  onContinue: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const offline = mode === "offline";
  return (
    <div className="modal-backdrop save-status-backdrop" role="presentation">
      <section className="modal-card save-status-card" role="dialog" aria-modal="true" aria-labelledby="save-status-title">
        <div className="modal-icon" aria-hidden="true">{offline ? "↻" : "!"}</div>
        <h2 id="save-status-title">{offline ? "Keine Internetverbindung" : "Lokales Speichern fehlgeschlagen"}</h2>
        <p>
          {offline
            ? "Die Unterlagen wurden auf diesem iPad zwischengespeichert. Der Upload wird erneut versucht, sobald Supabase erreichbar ist."
            : "Die Unterlagen konnten nicht sicher auf diesem iPad gespeichert werden. Bitte das Personal informieren und den Vorgang erneut versuchen."}
        </p>
        <div className="save-status-actions">
          {offline && (
            <button className="primary-button compact-button" type="button" onClick={onContinue}>
              Lokal speichern &amp; fortfahren
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onRetry} disabled={retrying}>
            {retrying ? "Wird erneut versucht …" : "Jetzt erneut versuchen"}
          </button>
          <button className="secondary-button" type="button" onClick={onBack} disabled={retrying}>
            Zur Prüfung zurück
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("start");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [signedDate, setSignedDate] = useState(getToday);
  const [photoChoice, setPhotoChoice] = useState<PhotoChoice>("");
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [privacyAcknowledgedAtClient, setPrivacyAcknowledgedAtClient] = useState("");
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState<"offline" | "storage-error" | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  useEffect(() => {
    void prepareOfflineApp().catch(() => undefined);
    return installSyncTriggers();
  }, []);

  const goTo = useCallback((nextStep: Step) => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setStep(nextStep);
  }, []);

  const reset = useCallback(() => {
    setFullName("");
    setBirthDate("");
    setSignedDate(getToday());
    setPhotoChoice("");
    setReadConfirmed(false);
    setPrivacyAcknowledged(false);
    setPrivacyAcknowledgedAtClient("");
    setSignature("");
    setSaving(false);
    setSaveDialog(null);
    setActiveRecordId(null);
    goTo("start");
  }, [goTo]);

  const finishSubmission = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveDialog(null);

    try {
      if (activeRecordId) {
        try {
          await syncRecord(activeRecordId);
          goTo("success");
        } catch {
          setSaveDialog("offline");
        }
        return;
      }

      const id = crypto.randomUUID();
      const deviceId = await getOrCreateDeviceId();
      const confirmedPhotoChoice = photoChoice === "yes" ? photoChoice : null;
      if (!confirmedPhotoChoice || !privacyAcknowledged || !privacyAcknowledgedAtClient) {
        throw new Error("Erforderliche Bestätigungen fehlen");
      }
      const source = {
        fullName: fullName.trim(),
        birthDate,
        signedDate,
        readConfirmed: true as const,
        privacyAcknowledged: true as const,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        privacyAcknowledgedAtClient,
        photoChoice: confirmedPhotoChoice,
        signatureDataUrl: signature,
      };
      const [documents, signaturePng] = await Promise.all([
        generateConsentDocuments(source),
        Promise.resolve(dataUrlToBlob(signature)),
      ]);
      const now = new Date().toISOString();
      const record: LocalConsentRecord = {
        id,
        eventId: EVENT_ID,
        deviceId,
        createdAtClient: now,
        signedOn: signedDate,
        templateHaftungVersion: LIABILITY_TEMPLATE_VERSION,
        templateEinwilligungVersion: CONSENT_TEMPLATE_VERSION,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        privacyAcknowledgedAtClient,
        photoChoiceHaftung: confirmedPhotoChoice,
        haftungSha256: documents.haftungSha256,
        einwilligungSha256: documents.einwilligungSha256,
        appVersion: APP_VERSION,
        source,
        signaturePng,
        haftungDocx: documents.haftungDocx,
        einwilligungDocx: documents.einwilligungDocx,
        syncState: "pending",
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        syncedAt: null,
        haftungPath: null,
        einwilligungPath: null,
        updatedAt: now,
      };

      try {
        await saveLocalRecord(record);
      } catch {
        setSaveDialog("storage-error");
        return;
      }

      setActiveRecordId(id);
      try {
        await syncRecord(id);
        goTo("success");
      } catch {
        setSaveDialog("offline");
      }
    } catch {
      setSaveDialog("storage-error");
    } finally {
      setSaving(false);
    }
  }, [
    activeRecordId,
    birthDate,
    fullName,
    goTo,
    photoChoice,
    privacyAcknowledged,
    privacyAcknowledgedAtClient,
    saving,
    signature,
    signedDate,
  ]);

  const retrySubmission = useCallback(async () => {
    if (!activeRecordId || saving) {
      if (!saving) void finishSubmission();
      return;
    }
    setSaving(true);
    try {
      await syncRecord(activeRecordId);
      setSaveDialog(null);
      goTo("success");
    } catch {
      setSaveDialog("offline");
    } finally {
      setSaving(false);
    }
  }, [activeRecordId, finishSubmission, goTo, saving]);

  if (step === "start") {
    return (
      <main className="app-shell">
        <section className="start-screen" aria-labelledby="welcome-title">
          <h1 id="welcome-title" className="visually-hidden">Geh ma steil!</h1>
          <button className="primary-button start-button" type="button" onClick={() => goTo("liability")}>
            Ich geh steil! <span aria-hidden="true">⟶</span>
          </button>
        </section>
      </main>
    );
  }

  if (step === "liability") {
    return <DocumentScreen key="liability" type="liability" onContinue={() => goTo("consent")} />;
  }

  if (step === "consent") {
    return <DocumentScreen key="consent" type="consent" onContinue={() => goTo("privacy")} />;
  }

  if (step === "privacy") {
    return <PrivacyNoticeScreen onContinue={() => goTo("form")} />;
  }

  if (step === "form") {
    return (
      <ParticipationForm
        onContinue={() => goTo("preview")}
        onAbort={reset}
        onOpenPrivacy={() => goTo("privacy")}
        fullName={fullName}
        setFullName={setFullName}
        birthDate={birthDate}
        setBirthDate={setBirthDate}
        signedDate={signedDate}
        setSignedDate={setSignedDate}
        photoChoice={photoChoice}
        setPhotoChoice={setPhotoChoice}
        readConfirmed={readConfirmed}
        setReadConfirmed={setReadConfirmed}
        privacyAcknowledged={privacyAcknowledged}
        setPrivacyAcknowledged={(value) => {
          setPrivacyAcknowledged(value);
          setPrivacyAcknowledgedAtClient(value ? new Date().toISOString() : "");
        }}
        signature={signature}
        setSignature={setSignature}
      />
    );
  }

  if (step === "preview") {
    return (
      <>
        <ReviewScreen
          onConfirm={() => void finishSubmission()}
          saving={saving}
          fullName={fullName}
          birthDate={birthDate}
          signedDate={signedDate}
          signature={signature}
        />
        {saveDialog && (
          <SaveStatusDialog
            mode={saveDialog}
            retrying={saving}
            onContinue={() => {
              setSaveDialog(null);
              goTo("success");
            }}
            onRetry={() => void retrySubmission()}
            onBack={() => setSaveDialog(null)}
          />
        )}
      </>
    );
  }

  return (
    <button className="success-screen" type="button" onClick={reset}>
      <span className="success-kicker">Geschafft!</span>
      <strong>Viel Spaß bei<br />Geh ma steil!</strong>
      <small>Tippe irgendwo, um zur Startseite zurückzukehren.</small>
    </button>
  );
}
