# Backend- und Supabase-Setup

Die App ist jetzt als eine gemeinsame Full-Stack-Anwendung für Vercel aufgebaut: Die Gastoberfläche, die Offline-Warteschlange und die API-Endpunkte werden zusammen gehostet. Vinext erzeugt über Nitro eine Vercel Function und statische CDN-Assets. Supabase-Zugangsdaten bleiben ausschließlich in der serverseitigen Hosting-Umgebung.

Es bleibt damit **ein Deployment**, der Host muss aber die enthaltenen API-Routen als Server-/Worker-Funktionen ausführen können. Reines statisches Datei-Hosting ohne Functions ist nicht ausreichend, weil sonst der Supabase Secret Key sicherheitshalber nirgends ausgeführt werden könnte.

Die verbindlichen Vercel-Einstellungen und Variablen stehen in `VERCEL_DEPLOYMENT.md`. `vercel.json` setzt die Function-Region auf Frankfurt (`fra1`), passend zum Supabase-Projekt in `eu-central-1`.

## 1. Supabase vorbereiten

1. Das isolierte Supabase-Projekt **Digitale Einwilligungen Nordic Spirit** (`muqirsxlsfwslovdeawa`) in **Frankfurt (`eu-central-1`)** verwenden. Keine bestehenden Projekte der Organisation verändern.
2. `supabase/migrations/20260818000000_initial_consent_backend.sql` als Migration anwenden (inhaltlich identisch mit `supabase/schema.sql`).
3. Prüfen, dass der Bucket `frequency-2026-consents` privat ist.
4. Im Security Advisor prüfen, dass `consent_records` RLS aktiviert hat und für `anon`/`authenticated` nicht freigegeben ist. Das Schema enthält den seit Mai 2026 erforderlichen expliziten `GRANT` nur für `service_role`, damit die serverseitige REST-Nutzung trotz der neuen Data-API-Defaults funktioniert.

Die Datenbank speichert bewusst keine Namen, Geburtsdaten oder Rohsignaturen. Diese stehen nur in den privaten Dokumentdateien und bis zur hash-geprüften Synchronisierung in IndexedDB auf dem iPad. Danach werden Quelldaten, Rohsignatur und beide lokalen DOCX-Blobs sofort gelöscht; lokal bleibt nur ein technischer Synchronisationsbeleg.

Jeder Metadatensatz erhält serverseitig den Löschstichtag **22. August 2029**. `legal_hold` ist standardmäßig `false` und darf nur bei einem konkret dokumentierten Vorfall durch eine autorisierte Datenbank-Administration gesetzt werden. Der App-Server besitzt bewusst nur `SELECT` und `INSERT`: abgeschlossene Nachweise können über die Anwendung weder verändert noch gelöscht werden.

## 2. Hosting-Variablen setzen

Alle erwarteten Werte stehen in `.env.example`.

- `SUPABASE_URL`: Projekt-URL.
- `SUPABASE_SECRET_KEY`: serverseitiger `sb_secret_...`-Schlüssel; niemals als öffentliche Variable setzen.
- `SUPABASE_BUCKET`: standardmäßig `frequency-2026-consents`.
- `EVENT_ID`: muss dem öffentlichen Event-Identifier entsprechen.
- `KIOSK_SETUP_CODE`: langer, zufälliger Code für die einmalige Gerätefreischaltung.
- `KIOSK_SESSION_SECRET`: mindestens 32 zufällige Bytes zum Signieren des HttpOnly-Geräte-Cookies.
- öffentliche Versionswerte: Event-, App- und Dokumentversionen gemäß `.env.example`.
- `NEXT_PUBLIC_PRIVACY_NOTICE_VERSION`: veröffentlichte Version der Datenschutzinformation; bei jeder inhaltlichen Änderung erhöhen.

## 3. iPad einmalig freischalten

Nach dem Deployment `/setup` aufrufen, den Setup-Code eingeben und anschließend die App zum Home-Bildschirm hinzufügen. Der Code wird nicht im Browser gespeichert. Das iPad erhält ein signiertes, HttpOnly und SameSite-Strict geschütztes Gerätesitzungs-Cookie.

Die Setup-Seite prüft außerdem die Offline-Bereitschaft, zeigt lokale Speichernutzung, ausstehende/synchronisierte/fehlerhafte Datensätze und die letzte erfolgreiche Synchronisierung und bietet einen manuellen Synchronisationsversuch.

## API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/health` | Prüft, ob Datenbank und Supabase-Konfiguration erreichbar sind. |
| `GET` | `/api/device/session` | Prüft die aktuelle Kiosk-Gerätesitzung. |
| `POST` | `/api/device/session` | Tauscht Setup-Code und lokale Geräte-UUID gegen ein signiertes HttpOnly-Cookie. |
| `DELETE` | `/api/device/session` | Entfernt die Gerätesitzung. |
| `POST` | `/api/submissions/prepare` | Validiert Metadaten und Gerätesitzung und erstellt zwei gerätegebundene Upload-Endpunkte. |
| `PUT` | `/api/submissions/:id/documents/:kind` | Nimmt je eine lokale DOCX-Datei entgegen und überträgt sie serverseitig in den privaten Supabase-Bucket. |
| `POST` | `/api/submissions/complete` | Lädt beide privaten Dateien serverseitig zur Hashprüfung und schreibt danach idempotent den Metadatensatz. |
| `GET` | `/api/submissions/:id` | Verifiziert den synchronisierten Status für das aktuelle Gerät. |

Beide POST-Endpunkte erwarten JSON-Metadaten. Zwischen `prepare` und `complete` überträgt der Browser die beiden DOCX-Dateien an dieselbe Vercel-Origin; die Server-Route schreibt sie mit dem geheimen Supabase-Schlüssel in den privaten Bucket. Dadurch hängt die iPad-Synchronisierung nach einer Offline-Phase nicht von einem direkten Cross-Origin-Upload zu Supabase Storage ab. `complete` lädt die privaten Objekte serverseitig, vergleicht beide SHA-256-Hashwerte erneut, erzwingt die Gerätebindung und akzeptiert höchstens 12 MiB pro DOCX-Datei.

Neue Einreichungen werden nur mit der ausdrücklichen Foto-/Videoauswahl `yes` akzeptiert. Bei `no` beendet die Oberfläche die Anmeldung vor der Dokumenterzeugung; auch ein direkt manipulierter API-Aufruf wird mit `400` abgewiesen und erzeugt weder Datensatz noch Upload-URLs.

## Offline- und Sync-Verhalten

- Beide ausgefüllten DOCX-Dateien werden vollständig im Browser erzeugt.
- Quelldaten, Rohsignatur, beide Dateien, Hashwerte und Status werden zuerst in einer IndexedDB-Transaktion gespeichert.
- Erst danach wird ein Upload versucht.
- Fehlende Verbindung, Captive Portal, abgelaufene Gerätesitzung oder Supabase-Fehler lassen den Datensatz lokal erhalten.
- Wiederholungen verwenden dieselbe UUID und dieselben Objektpfade; dadurch entstehen keine doppelten Datensätze.
- Wiederholungen laufen nach Abschluss, beim App-Start, bei `online`, `pageshow`, Sichtbarwerden und über die Setup-Seite.
- Der Service Worker cached App-Shell, Markenassets und alle Dokumentseiten für einen erneuten Offline-Start.
- Nach erfolgreicher serverseitiger Hashprüfung werden alle direkt identifizierenden lokalen Quelldaten und Dokumentblobs automatisch entfernt.

## Datenschutz- und Rechtsfreigabe vor Live-Betrieb

Die technische Umsetzung ersetzt keine organisatorische Freigabe. Vor dem ersten echten Datensatz müssen mindestens diese Punkte abgeschlossen sein:

1. Rollen von Sales Crew und JTI bestätigen und eine Vereinbarung nach Art. 26 DSGVO unterschreiben; falls tatsächlich getrennte Verantwortlichkeit vorliegt, die App-Texte entsprechend ändern.
2. Supabase- und Vercel-DPA nach Art. 28 DSGVO abschließen, Unterauftragsverarbeiter/Drittlandgarantien prüfen und die konkrete Supabase- sowie Vercel-Function-Region dokumentieren. Der aktuelle Vercel-DPA gilt für Pro- und Enterprise-Pläne; der eingesetzte Plan muss davon erfasst sein.
3. Den Teilnehmer:innen-Text und das vollständige Konzept in `DATENSCHUTZ_AUSTRIA_2026.md` rechtlich freigeben.
4. Die Teilnahme-Kopplung der Foto-/Videoeinwilligung nach Art. 7 Abs. 4 DSGVO für jeden beschriebenen Nutzungszweck schriftlich prüfen und freigeben lassen. Die App verlangt derzeit technisch „Ja“ und speichert bei „Nein“ nichts. Kann die objektive Erforderlichkeit nicht belastbar begründet werden, muss die Oberfläche wieder einen gültigen Teilnahmeweg mit „Nein“ anbieten.
5. Die rechtlich freigegebenen Masterdokumente mit dem erzwungenen App-Ablauf abstimmen; Unterlagen, die die Foto-/Videoeinwilligung als optional bezeichnen, dürfen nicht zusammen mit diesem Ablauf eingesetzt werden.
6. Löschlauf grundsätzlich drei Jahre nach Ende des Frequency Festivals 2026 sowie einen fallbezogenen Legal-Hold-Prozess festlegen. Keine pauschale 30-Jahres-Aufbewahrung.
7. Berechtigungen für Sales Crew/JTI, iPad-Geräteschutz, tägliche Offline-Queue-Kontrolle, Abschlusskontrolle und Bearbeitung von Betroffenenanfragen dokumentieren.

## Empfohlener Abnahmetest

1. iPad online freischalten und einen Testdatensatz synchronisieren.
2. „Nein“ zur Foto-/Videoeinwilligung auswählen; die Anmeldung muss blockiert werden und darf weder lokalen Datensatz noch Upload erzeugen.
3. Flugmodus aktivieren und mindestens zehn vollständige Datensätze mit ausdrücklichem „Ja“ erfassen.
4. App schließen und vom Home-Bildschirm erneut offline öffnen.
5. Unter `/setup` prüfen, dass alle zehn Datensätze ausstehend sind.
6. Netzwerk wiederherstellen und „Jetzt synchronisieren“ ausführen.
7. In Supabase pro UUID genau zwei DOCX-Dateien und einen Metadatensatz prüfen; Hashwerte müssen übereinstimmen.
