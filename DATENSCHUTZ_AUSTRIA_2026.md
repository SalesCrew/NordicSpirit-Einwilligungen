# Datenschutzkonzept „Geh ma steil!“ – Frequency Festival 2026

Stand: 18. August 2026  
Arbeitsfassung für die technische Umsetzung; finale Freigabe durch österreichische Datenschutz-/Veranstaltungsrechtsberatung vor dem Produktivstart erforderlich.

## Kurzfazit

Die digitale Teilnahme kann datenschutzkonform umgesetzt werden, wenn die Information vor der Dateneingabe bereitgestellt, die Foto-/Videoeinwilligung freiwillig gestaltet, die Nachweise nur einem eng berechtigten Personenkreis zugänglich gemacht und nach einem dokumentierten Löschkonzept entfernt werden.

Die bisherige Regel „Nein zu Foto/Video = keine Teilnahme“ sollte nicht verwendet werden. Nach der aktuellen Einwilligungsleitlinie des Europäischen Datenschutzausschusses ist eine Einwilligung nicht freiwillig, wenn eine Ablehnung einen Nachteil auslöst oder eine für die Leistung nicht erforderliche Verarbeitung zur Bedingung gemacht wird. Die sportliche Aktivität muss daher auch mit „Nein“ möglich bleiben. Bei „Nein“ wird kein Foto-/Video-Einwilligungsdokument erzeugt, sondern ein eindeutiger Nicht-Einwilligungsnachweis.

Die Bestätigung der Datenschutzinformation ist kein eigener Erlaubnistatbestand. Sie dient nur als Nachweis, dass die Information gemäß Art. 13 DSGVO rechtzeitig bereitgestellt wurde.

## Verantwortliche und Rollen

Auf Basis des beschriebenen Ablaufs ist für die digitale Erfassung und die gemeinsame Nachweisführung folgende Rollenverteilung vorgesehen:

- **Gastro Werbe & Service GmbH**, Eugengasse 25, 2500 Baden, E-Mail: hannes.friedriger@gws.co.at
- **JTI Austria GmbH**, Erdberger Lände 26a/71, 1030 Wien, FN 309726f, E-Mail: konsumentenservice@jti.com

GWS und JTI entscheiden gemeinsam über Zweck und Mittel der digitalen Nachweisführung und sind dafür gemeinsam Verantwortliche gemäß Art. 26 DSGVO. JTI ist darüber hinaus für die in der gesonderten Einwilligung beschriebene Aufnahme, Veröffentlichung und kommerzielle Nutzung von Foto- und Videoaufnahmen verantwortlich.

**Launch-Blocker:** Diese Rollenverteilung muss vor dem Einsatz durch eine schriftliche Vereinbarung nach Art. 26 DSGVO bestätigt werden. Darin sind Zuständigkeiten für Betroffenenanfragen, Informationspflichten, Sicherheit, Löschung, Vorfälle und ein gemeinsamer Kontaktpunkt festzulegen. Falls die tatsächlichen Entscheidungen getrennt getroffen werden, muss der Text stattdessen auf getrennte Verantwortlichkeit angepasst werden. Bloßer Datenzugriff allein begründet noch keine gemeinsame Verantwortlichkeit.

## Rechtsgrundlagen je Zweck

| Verarbeitung | Rechtsgrundlage | Begründung |
|---|---|---|
| Anmeldung, Altersprüfung, Teilnahmeabwicklung, Übernahme der Angaben in den Haftungsausschluss | Art. 6 Abs. 1 lit. b DSGVO | Erforderlich für die Durchführung der von der Person gewünschten Teilnahme. |
| Nachweis von Unterzeichnung, Dokumentversion, Zeitpunkt, Integrität und Geltendmachung/Abwehr von Ansprüchen | Art. 6 Abs. 1 lit. f DSGVO | Berechtigtes Interesse an beweissicherer Dokumentation und Rechtsverteidigung. |
| Technischer Schutz, Fehleranalyse und Missbrauchsabwehr | Art. 6 Abs. 1 lit. f DSGVO | Berechtigtes Interesse an einem sicheren und zuverlässigen Kiosksystem. |
| Identifizierbare Foto-/Videoaufnahme und die konkret beschriebenen Veröffentlichungen | Art. 6 Abs. 1 lit. a DSGVO | Freiwillige, gesonderte und jederzeit für die Zukunft widerrufbare Einwilligung. |
| Erfüllung einer konkreten gesetzlichen Pflicht oder behördlichen/gerichtlichen Anordnung | Art. 6 Abs. 1 lit. c DSGVO | Nur soweit im Einzelfall tatsächlich eine bestimmte Pflicht besteht. |

Die Foto-/Videoeinwilligung darf nicht mit der Teilnahmebestätigung gebündelt, nicht vorangekreuzt und nicht durch eine Datenschutz-Lesebestätigung ersetzt werden. Aufnahme und Veröffentlichung sind getrennt rechtlich zu beurteilen; eine zulässige Aufnahme erlaubt nicht automatisch jede Veröffentlichung.

## Verarbeitete Daten

- Vor- und Nachname
- Geburtsdatum und daraus abgeleitete Volljährigkeitsprüfung
- Unterzeichnungsdatum und Unterschriftsbild
- Auswahl „Ja“ oder „Nein“ zur Foto-/Videoeinwilligung
- Bestätigungen, dass die Dokumente und die Datenschutzinformation bereitgestellt und gelesen wurden
- Versionen von Haftungsausschluss, Foto-/Videoentscheidung, Datenschutzinformation und App
- technische Nachweisdaten: zufällige Datensatz- und Gerätekennung, Erfassungs-/Synchronisationszeit, Dateipfade, Größen und SHA-256-Prüfwerte
- bei freiwilligem „Ja“: die von JTI oder beauftragten Agenturen erstellten Foto-/Videoaufnahmen; diese Aufnahmen liegen nicht zwingend in dieser App

Die Rohsignatur ist bei diesem Einsatz nicht automatisch ein besonderes biometrisches Datum. Das würde sich ändern, wenn sie mit besonderen technischen Verfahren zur eindeutigen Identifizierung ausgewertet würde; eine solche Auswertung ist nicht vorgesehen.

## Empfänger und Zugriffe

Zugriff erhalten ausschließlich hierzu berechtigte Mitarbeiter:innen von GWS und JTI, eingesetzte IT-/Hosting-Auftragsverarbeiter, bei erteilter Fotoeinwilligung beauftragte Fotograf:innen/Agenturen und die in der Einwilligung genannten Medien-/Kooperationskanäle sowie – nur bei einem Anlass – Rechtsberatung, Versicherungen, Gerichte, Behörden oder sonstige Stellen zur Bearbeitung eines Vorfalls oder Anspruchs.

Für jeden Auftragsverarbeiter ist vorab ein Vertrag gemäß Art. 28 DSGVO abzuschließen. Vercel wird für das Hosting der Web-App und der serverseitigen Schnittstellen eingesetzt; Supabase wird für die geschützte Dokument- und Nachweisspeicherung eingesetzt. Bei Supabase ist eine konkrete EU-Projektregion zu wählen; die allgemeine Regionsbezeichnung „Europe“ reicht nicht als Nachweis, weil sie auch Nicht-EU-Standorte umfassen kann. Die Function-Region von Vercel wird auf Frankfurt festgelegt. Das allein garantiert jedoch keine ausschließlich unionsinterne Verarbeitung, weil Vercel laut aktuellem DPA auch in den USA und an Standorten seiner Unterauftragsverarbeiter verarbeiten kann. Die aktuellen Datenverarbeitungsvereinbarungen, Unterauftragsverarbeiter und Garantien für etwaige Drittlandübermittlungen sind vor dem Start zu prüfen und zu dokumentieren. Der Vercel-DPA mit Stand 17. März 2026 gilt nach seinem Wortlaut für Pro- und Enterprise-Pläne; der tatsächlich eingesetzte Plan muss davon erfasst sein.

## Speicher- und Löschkonzept

Die DSGVO verlangt eine angemessene, zweckgebundene Frist; sie schreibt für diesen Anwendungsfall keine pauschale Jahreszahl vor. § 1489 ABGB sieht für Schadenersatzansprüche grundsätzlich drei Jahre ab Kenntnis von Schaden und Schädiger vor; außergewöhnliche Konstellationen können längere Fristen auslösen. Daraus folgt dieses verhältnismäßige Konzept:

| Daten | Standardfrist | Ausnahme / Maßnahme |
|---|---|---|
| Unterzeichneter Haftungsausschluss, Fotoentscheidung und zugehörige Nachweismetadaten | Löschung oder irreversible Anonymisierung drei Jahre nach Ende des Frequency Festivals 2026 | Bei dokumentiertem Vorfall, Anspruch oder konkreter Rechtsstreitgefahr: gezielte Sperre („Legal Hold“) nur für betroffene Datensätze bis zur rechtskräftigen Erledigung und Ablauf der einschlägigen Frist. |
| Nachweis einer erteilten Foto-/Videoeinwilligung | Solange die freigegebene Nutzung tatsächlich fortbesteht; nach Widerruf bzw. letzter Nutzung nur ein gesperrter Minimalnachweis für grundsätzlich drei Jahre | Keine weitere Werbenutzung; Löschung kontrollierter Kopien, soweit möglich und keine Rechtsverteidigung entgegensteht. |
| Foto-/Videoaufnahmen | Bis Widerruf oder Wegfall des dokumentierten Nutzungszwecks | Widerruf wirkt für die Zukunft. Bereits rechtmäßige Verarbeitung bleibt rechtmäßig; veröffentlichte Fremdkopien können faktisch nicht immer vollständig zurückgeholt werden. |
| Vollständige Offline-Datensätze auf dem iPad | Nur bis zum hash-geprüften erfolgreichen Upload | Danach werden Quelldaten, Rohsignatur und beide DOCX-Dateien sofort lokal gelöscht; lokal verbleibt nur ein technischer Synchronisationsbeleg ohne Name, Geburtsdatum oder Unterschrift. |
| Noch nicht synchronisierte Offline-Datensätze | Bis zum erfolgreichen Upload, mit täglicher Kontrolle während des Events und Abschlusskontrolle danach | Fehlerfälle dürfen nicht unbemerkt liegen bleiben; bei Abbruch ist ein dokumentierter manueller Export-/Löschprozess erforderlich. |
| Technische Sicherheitsprotokolle | So kurz wie für Fehleranalyse und Sicherheit erforderlich, empfohlen maximal 30 Tage | Keine Analyse-/Marketing-Tracker im Kiosk. |

Ein Legal Hold darf nicht pauschal für alle Besucher:innen gelten. Er muss Anlass, Verantwortliche, Beginn, Umfang und regelmäßige Überprüfung dokumentieren. Die außergewöhnliche 30-Jahresfrist des § 1489 ABGB ist kein Grund, alle Unterlagen vorsorglich 30 Jahre aufzubewahren.

## Teilnehmer:innen-Text für die App

### Datenschutzinformation zur digitalen Teilnahme und Nachweisführung

**Version 19.08.2026**

#### 1. Wer ist verantwortlich?

Für die digitale Erfassung deiner Teilnahmeunterlagen und die gemeinsame Nachweisführung sind die **Gastro Werbe & Service GmbH**, Eugengasse 25, 2500 Baden, hannes.friedriger@gws.co.at, und die **JTI Austria GmbH**, Erdberger Lände 26a/71, 1030 Wien, FN 309726f, konsumentenservice@jti.com, gemeinsam verantwortlich. Du kannst deine Datenschutzrechte gegenüber beiden Unternehmen ausüben. Für Foto- und Videoaufnahmen sowie deren in der gesonderten Einwilligung beschriebene Verwendung ist JTI verantwortlich.

#### 2. Welche Daten verarbeiten wir?

Wir verarbeiten deinen Vor- und Nachnamen, dein Geburtsdatum, das Datum deiner Teilnahme, deine Unterschrift, deine Auswahl zur Foto-/Videoeinwilligung, deine Lesebestätigungen und die Versionen der angezeigten Dokumente. Zur sicheren Nachweisführung speichern wir außerdem technische Kennungen, Zeitpunkte, Dateipfade, Dateigrößen und kryptografische Prüfwerte. Wenn du der Foto-/Videoverwendung zustimmst, können JTI oder beauftragte Agenturen außerdem erkennbare Foto- und Videoaufnahmen von dir erstellen und wie in der gesonderten Einwilligung beschrieben verwenden.

#### 3. Wofür und auf welcher Grundlage?

Wir verwenden deine Angaben, um deine Volljährigkeit zu prüfen, deine Teilnahme abzuwickeln und die unterzeichneten Unterlagen zu erstellen (Art. 6 Abs. 1 lit. b DSGVO). Dokumentversion, Auswahl, Unterzeichnung, Integrität und Übermittlung werden gespeichert, damit GWS und JTI die ordnungsgemäße Abwicklung belegen, Ansprüche geltend machen oder abwehren und das System schützen können (Art. 6 Abs. 1 lit. f DSGVO). Unser berechtigtes Interesse ist eine beweissichere, sichere und nachvollziehbare Veranstaltungsabwicklung.

Die Aufnahme und Nutzung erkennbarer Foto-/Videoaufnahmen erfolgt nur, wenn du gesondert „Ja“ auswählst (Art. 6 Abs. 1 lit. a DSGVO). Ein „Nein“ verhindert deine Teilnahme an der Aktivität nicht. Du kannst eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft über konsumentenservice@jti.com widerrufen. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.

#### 4. Wer erhält die Daten?

Zugriff erhalten nur berechtigte Mitarbeiter:innen von GWS und JTI sowie notwendige IT-/Hosting-Dienstleister, die vertraglich gebunden sind. Bei erteilter Foto-/Videoeinwilligung können beauftragte Fotograf:innen, Agenturen, Medien-, Plattform- und Kooperationspartner die dafür erforderlichen Aufnahmen erhalten. Bei einem Vorfall oder Rechtsstreit können erforderliche Unterlagen an Rechtsberatung, Versicherungen, Gerichte, Behörden oder sonstige zuständige Stellen übermittelt werden.

Für die Bereitstellung der Web-App und ihrer serverseitigen Schnittstellen wird Vercel als Hosting-Auftragsverarbeiter eingesetzt. Dabei werden die für Betrieb, Sicherheit und Übermittlung erforderlichen Anfragen, technischen Protokolldaten und Dokumente verarbeitet. Die geschützte Speicherung der unterzeichneten Dokumente erfolgt bei Supabase in der Projektregion Frankfurt (EU). Soweit Vercel, Supabase oder deren Unterauftragsverarbeiter Daten außerhalb des Europäischen Wirtschaftsraums verarbeiten, erfolgt dies nur auf Grundlage eines Angemessenheitsbeschlusses oder geeigneter Garantien wie EU-Standardvertragsklauseln. Weitere Informationen können über die oben genannten Kontakte angefordert werden.

#### 5. Wie lange speichern wir die Daten?

Die unterzeichneten Teilnahme- und Nachweisdokumente werden grundsätzlich drei Jahre nach Ende des Frequency Festivals 2026 gelöscht oder irreversibel anonymisiert. Besteht ein konkreter Vorfall, Anspruch oder Rechtsstreit, werden nur die dafür erforderlichen Datensätze gesperrt und bis zur abschließenden Klärung sowie zum Ablauf der einschlägigen gesetzlichen Frist aufbewahrt.

Nicht synchronisierte Unterlagen bleiben im lokalen Browserspeicher des Veranstaltungs-iPads, bis der erfolgreiche Upload anhand von Prüfwerten bestätigt ist. Danach werden Name, Geburtsdatum, Rohsignatur und vollständige Dokumentkopien auf dem iPad automatisch gelöscht. Die Foto-/Videoeinwilligung und der dafür erforderliche Minimalnachweis werden solange aufbewahrt, wie die erlaubte Nutzung fortbesteht; nach einem Widerruf wird die zukünftige Nutzung beendet und der verbleibende Nachweis nur noch gesperrt zur Rechtsverteidigung verwendet.

#### 6. Welche Rechte hast du?

Du hast – je nach den gesetzlichen Voraussetzungen – das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Einer Verarbeitung auf Grundlage berechtigter Interessen kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, widersprechen. Eine Einwilligung kannst du jederzeit für die Zukunft widerrufen.

Du kannst dich an GWS oder JTI wenden. Außerdem hast du das Recht auf Beschwerde bei der **Österreichischen Datenschutzbehörde**, Barichgasse 40–42, 1030 Wien, +43 1 52 152-0, dsb@dsb.gv.at.

#### 7. Musst du die Daten angeben?

Name, Geburtsdatum, Datum, Unterschrift und die Bestätigung der Teilnahmebedingungen sind für die Teilnahme erforderlich. Ohne diese Angaben kann die Anmeldung nicht abgeschlossen werden. Die Foto-/Videoeinwilligung ist freiwillig; ein „Nein“ hat keine Auswirkung auf die Teilnahme. Es findet keine ausschließlich automatisierte Entscheidung und kein Profiling statt.

#### 8. Lokale Technik auf dem iPad

Die App nutzt ausschließlich technisch erforderliche lokale Speichermechanismen und ein Service-Worker-Caching, damit der Vorgang bei einer unterbrochenen Internetverbindung fortgesetzt und später sicher synchronisiert werden kann. Es werden dabei keine Analyse- oder Werbe-Tracker eingesetzt.

## Textelemente für die Oberfläche

Pflichtbestätigung nach dem Lesen:

> Ich bestätige, dass mir die Datenschutzinformation zur digitalen Teilnahme und Nachweisführung (Version 19.08.2026) vor Eingabe meiner Daten bereitgestellt wurde und dass ich sie gelesen habe.

Kurze Darstellung in der Eingabemaske:

> **Ich habe die Datenschutzinformation gelesen.**  
> Version 19.08.2026 · Datenschutzinformation erneut öffnen

Bei Fotoauswahl „Nein“:

> **Keine Foto-/Videoeinwilligung**  
> Du kannst trotzdem an „Geh ma steil!“ teilnehmen. Wir erstellen lediglich einen Nachweis deiner Auswahl, damit keine erkennbare kommerzielle Foto-/Videoverwendung auf Grundlage dieser Einwilligung erfolgt.

## Technische und organisatorische Mindestmaßnahmen vor dem Start

1. Art.-26-Vereinbarung zwischen GWS und JTI unterschreiben und einen Kontaktpunkt festlegen.
2. Art.-28-Verträge mit Supabase und Vercel sowie allen weiteren Auftragsverarbeitern abschließen; sicherstellen, dass der Vercel-Plan vom DPA erfasst ist; Unterauftragsverarbeiter und Drittlandgarantien dokumentieren.
3. Die konkrete Supabase-Projektregion Frankfurt und die Vercel-Function-Region Frankfurt dokumentieren; die Vercel-Region nicht als Garantie ausschließlich unionsinterner Verarbeitung darstellen.
4. Private Storage-Buckets, serverseitige Geheimnisse, kurze objektspezifische Upload-Links, RLS/Entzug von Browserrollen und rollenbasierte Mitarbeiterzugriffe beibehalten.
5. Gerätecode, iPad-Sperre, kontrollierter Einsatz und tägliche Kontrolle der Offline-Warteschlange vorsehen.
6. Nach hash-geprüfter Synchronisierung die vollständigen lokalen Quelldaten automatisch löschen.
7. Löschlauf drei Jahre nach Veranstaltungsende, Legal-Hold-Prozess und Abschlussprotokoll organisatorisch festlegen.
8. Verzeichnis der Verarbeitungstätigkeiten nach Art. 30 DSGVO, Interessenabwägung für Art. 6 Abs. 1 lit. f, Sicherheits-/Vorfallsprozess und Betroffenenanfragen dokumentieren.
9. Keine Analyse-, Werbe- oder Fingerprinting-Skripte im Kiosk integrieren. Bei ausschließlich technisch erforderlichem Browser-/Gerätespeicher ist keine gesonderte TKG-Einwilligung erforderlich; die Nutzung wird in dieser Information offengelegt.
10. Den finalen Text, die tatsächlichen Empfänger, Fotoveröffentlichungskanäle, die Art.-26-Rollen und die Fristen vor dem Live-Einsatz rechtlich freigeben.

## Verifizierte offizielle Quellen

- [DSGVO, insbesondere Art. 5, 6, 7, 13, 17, 18, 21, 26, 28 und 32 – EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj/?locale=de)
- [Einwilligung: aktuelle Zusammenfassung des Europäischen Datenschutzausschusses, April 2026](https://www.edpb.europa.eu/system/files/2026-04/edpb-summary-consent_en.pdf)
- [Österreichische Datenschutzbehörde: Pflichten als Verantwortlicher](https://dsb.gv.at/rechte-pflichten/ihre-pflichten-als-verantwortlicher)
- [Österreichische Datenschutzbehörde: Rechte betroffener Personen](https://dsb.gv.at/rechte-pflichten/ihre-rechte-als-betroffene-person)
- [Österreichische Datenschutzbehörde: FAQ Foto & Video](https://dsb.gv.at/faqs/foto-video)
- [Österreichische Datenschutzbehörde: FAQ zu Informationspflichten](https://dsb.gv.at/faqs/faq)
- [Datenschutzgesetz, geltende Fassung 2026 – RIS](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001597)
- [§ 1489 ABGB, geltende Fassung 2026 – RIS](https://ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Anlage=&Artikel=&FassungVom=2026-02-01&Gesetzesnummer=10001622&Paragraf=1489&ShowPrintPreview=True&Uebergangsrecht=)
- [§ 165 TKG 2021, geltende Fassung 2026 – RIS](https://ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Anlage=&Artikel=&FassungVom=2026-01-14&Gesetzesnummer=20011678&Paragraf=165&Uebergangsrecht=)
- [Supabase DPA, Fassung 1. Juni 2026](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf)
- [Supabase-Projektregionen](https://supabase.com/docs/guides/platform/regions)
- [Supabase Breaking Changes 2026](https://supabase.com/changelog?types=breaking-change)
- [Vercel Data Processing Addendum, Stand 17. März 2026](https://vercel.com/legal/dpa)
- [Vercel Privacy Notice, Stand 1. Juni 2026](https://vercel.com/legal/privacy-notice)

Als reine Strukturinspiration wurde außerdem die [offizielle Coca-Cola Datenschutzinformation 2026](https://datatrust.coca-cola.com/content/dam/privacyhub/shared/notice-pdfs/german/global-consumer-privacy-notice-01312026-german.pdf) herangezogen. Formulierungen und inhaltliche Aussagen dieses Konzepts wurden nicht daraus übernommen, sondern auf den konkreten GWS-/JTI-Prozess und die oben genannten offiziellen Rechtsquellen abgestimmt.

