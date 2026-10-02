# HANDOFF — mail

### Was wurde in dieser Session gemacht (2026-10-02): April schlägt Antworten vor, Phase 1
Spec: `docs/SPEC-april-vorschlaege.md` (freigegeben). Gateway-Teil liegt in claude-team `gateway/src/mail-vorschlag.ts` + `mail-hilfe.ts` (Aktionen `brief` per Haiku als JSON, `draft` per Sonnet als SSE, Aprils Gedächtnis gecacht), Commit 4a1f0ca, Tests `mail-vorschlag.test.ts` grün.
- `src/lib/april-context.ts`: Mail-Text (Zitate abgeschnitten), letzte 5 Mails der Unterhaltung, letzte 3 gesendete Mails an den Absender (andere Unterhaltungen), belegte Zeiten aus beiden Kalendern der nächsten 14 Tage (ohne Titel). Jede Quelle darf einzeln ausfallen. `APRIL_BOXES` = info, aleksa, consulting.
- `src/lib/april.ts`: `brief()` (Ergebnis je Mail-ID in sessionStorage), `draft()` mit SSE-Leser + Abbruch, Entwurf je Mail+Absicht ebenfalls im sessionStorage.
- `src/components/april/AprilCard.tsx`: Glas-Karte über dem Mail-Text, Zusammenfassung + Frist, Chips, gestreamter Entwurf, Einsetzen / Kürzer / Förmlicher / Lockerer / Sprache / Neu / Freitext, zuklappbar je Mail. `AprilOrb` = Platzhalter-Avatar (Leuchtkreis), Zustände idle/thinking/writing/done, respektiert reduzierte Bewegung. Phase 2 ersetzt ihn durch die Plüsch-April.
- `Compose.tsx`: `ComposeMode.startHtml` als Starttext; Platzhalter `[..?]` werden gelb markiert, vor dem Senden kommt eine Rückfrage, solange noch einer drin steht.
- Nicht in Sent/Entwürfe/Junk/Gelöscht. Nichts wird automatisch gesendet.
- Noch nicht mit echtem Login getestet (Container hat kein MSAL-Login). Offen aus der Spec: Abschalten für ganze Absender/Ordner.

### Was wurde in dieser Session gemacht (2026-09-29)
Kurzfassung (Details in den Nachträgen „2026-09-29“ weiter unten): Mail als PDF (Druckdialog), info@ oben + Start + andere Postfächer zugeklappt, formatiertes Schreiben mit empfängerfestem HTML, Liquid-Glass-Look (Randbrechung per SVG-Filter in Chromium, Glas-Lehren zu verschachteltem backdrop-filter und iframe), „Alle Posteingänge“, Beantwortet-Hinweis, dezente Schnellaktionen. Lokale Testseite ohne Login: `npm run dev` → `http://localhost:5173/ui-test.html?p=/mail/info/inbox/info-1` (Dateien `ui-test.html/.tsx` sind gitignored, liegen nur auf der MacBook home).
**Offen bei Aleksa:** formatierte Mail an Gmail prüfen, Beantwortet-Pfeil nach neuer Antwort prüfen, sagen welcher Browser (Brechung nur Chrome/Edge/Arc). Danach Stufe 2 (Relevant/Sonstige, Unterhaltungen, Mehrfachauswahl, Wischen, Drag and Drop, Später erinnern) oder Stufe 3 (April im Postfach über Gateway).

### Was wurde in dieser Session gemacht (2026-09-27)
- Entscheidungen: eigene App `mail.aleksa.ai`, **Mail + Kalender**, Design **genau wie PM-Tool**, **alle Postfächer getrennt** (SPEC §8).
- **Phase 0 + Phase 1 (Mail) gebaut**, Build + Typprüfung grün, Anmeldeseite im Browser geprüft (PM-Look). Noch **nicht mit echtem Login getestet** — Entra-App fehlt.
  - `src/config/mailboxes.ts` — die drei Bereiche (Aleksa inkl. Alias spalevic-consulting.de, info@, April — seit 30.09. auch Senden aus april@) + Ordner.
  - `src/lib/auth.ts` — MSAL (SPA, PKCE, delegiert), `isAllowed` sperrt jedes Konto außer `VITE_ALLOWED_USER`.
  - `src/lib/graph.ts` — Ordner, Liste (Seiten, Suche), Nachricht, Anhänge, Inline-Bilder, gelesen/verschieben, Neu senden, Antworten/Weiterleiten über createReply → PATCH → send (Absender wählbar).
  - `src/components/Shell.tsx` — Rahmen + Seitenleiste wie PM-Tool, je Postfach eigene Sektion mit Ungelesen-Zahl.
  - `src/pages/MailPage.tsx` — Liste + Lesebereich, Tastatur j/k/c///Esc, mobil Liste ↔ Nachricht.
  - `src/components/mail/HtmlFrame.tsx` — Sandbox-iframe ohne Skripte, externe Bilder erst auf Klick, cid-Bilder als data-URL.
  - `src/components/mail/Compose.tsx` — Neu/Antworten/Allen/Weiterleiten, Absender aus dem Bereich, Antwort geht von der angeschriebenen Adresse raus.
  - Kalender: nur Platzhalter (`src/pages/CalendarPage.tsx`).
- Lokal starten: `npm run dev` (Port 5173 fest — muss zur Redirect-URI passen); in claude-team als Preview `aleksa-mail`.

### Nachtrag 2026-09-27 abends
- Live auf `mail.aleksa.ai` (Netlify, Env-Variablen gesetzt, Entra-Redirect `https://mail.aleksa.ai`), Login von Aleksa bestätigt.
- Bereiche: Aleksa, info@, April, **Archiv DestinyMedia** (`archiv.destinymedia@spalevic-partner.com`, nur lesen). Consulting (`aleksa@spalevic-consulting.de`) folgt, sobald das freigegebene Postfach angelegt werden kann (hing an Alias-Verzug, siehe claude-team STATUS).
- **Hintergrund + Glas** (`src/lib/background.tsx`, `src/components/BackdropPicker.tsx`, Regeln `[data-glass]` in `index.css`): 6 Verläufe + eigenes Bild (auf 2400 px verkleinert, localStorage je Gerät); Leiste/Panel `rgba(255,255,255,.62)` + `blur(28px)`, Mail-Inhalt auf weißer `.mail-card`. Von Aleksa abgenommen („es klappt“).

### Nachtrag 2026-09-27 spät: Kalender (Phase 2) gebaut
- `src/lib/calendar.ts` (calendarView mit Folgeseiten, Anlegen/Ändern/Löschen, accept/tentativelyAccept/decline; Wandzeit Europe/Berlin, Zone beim Schreiben ausdrücklich), `src/pages/CalendarPage.tsx` (Tag/Woche/Monat, Ansicht je Gerät gemerkt, Überlappungs-Spalten, Jetzt-Linie, Klick in freie Zeit = neuer Termin um diese halbe Stunde, Doppelklick in Ganztags-/Monatszelle = ganztägig, Tasten t/j/k/←/→/d/w/m/n), `src/components/calendar/EventDialog.tsx` (Ansehen, Bearbeiten nur als Organisator, Löschen mit Hinweis auf Absage an Teilnehmer, Antworten auf Einladungen).
- Farben nach Antwort: zugesagt/eigen Lila, Vorbehalt gestreift, offen gestrichelter Rand, abgesagt grau durchgestrichen. Build grün; **echter Login-Test durch Aleksa steht aus.**
- Noch nicht: Einladungen direkt in der Mail beantworten, mehrere Kalender auswählen, Serien bearbeiten (Änderung trifft nur das einzelne Vorkommen).

### Nachtrag 2026-09-28: Anhänge beim Senden
- `graph.ts`: Senden läuft jetzt immer über einen Entwurf (`POST /messages` bzw. `createReply/createReplyAll/createForward` → PATCH → Anhänge → `/send`). Anhänge ≤ 3 MB direkt als `fileAttachment`, größere per `attachments/createUploadSession` in 4-MB-Stücken (uploadUrl ohne Authorization-Header), Grenze 150 MB je Datei.
- `Compose.tsx`: Knopf „Anhang“, Dateien ins Fenster ziehen, Liste mit Größe + Entfernen; beim Weiterleiten gehen die Original-Anhänge automatisch mit. Build grün, **Versand mit Anhang noch nicht von Aleksa getestet.**
- Neuer Bereich „Spalevic Consulting“ (`aleksa@spalevic-consulting.de`, eigenes freigegebenes Postfach, 2.151 migrierte Mails).

### Nachtrag 2026-09-29: Mail als PDF
- Knopf „Als PDF speichern“ (rechts in der Leiste der geöffneten Mail). `src/lib/pdf.ts`: Druckvorlage mit Betreff, Von/An/Cc/Datum/Anhangsnamen + Mail-Inhalt in unsichtbarem iframe (sandbox ohne Skripte + CSP), danach Druckdialog → „Als PDF sichern“. Echtes Text-PDF, Dateiname-Vorschlag `JJJJ-MM-TT Absender - Betreff`.
- Externe Bilder kommen nur mit, wenn sie in der Mail freigegeben wurden (Tracking-Schutz bleibt). `prepareMailHtml` in `HtmlFrame.tsx` ist jetzt gemeinsam für Anzeige und PDF.
- Build grün, **noch nicht von Aleksa im echten Login getestet.**

### Nachtrag 2026-09-29 abends: Formatierung + Liquid-Glass-Look (Stufe 1)
- **Formatiertes Schreiben** (`src/components/mail/MailEditor.tsx`, Tiptap 3): Größe, fett/kursiv/unterstrichen/durchgestrichen, Schriftfarbe, Markieren, Aufzählung, Nummerierung, Zitat, Ausrichtung, Link (⌘K), Formatierung entfernen; ⌘B/⌘I/⌘U, ⌘⇧8/⌘⇧7, ⌘Enter sendet. Einfügen aus Word/Google behält die Formatierung.
- **Empfängerfest** (`src/lib/email-html.ts` → `toEmailHtml`): jedes Element bekommt Inline-Styles (Gmail/Outlook werfen `<style>` und Klassen weg), `<mark>` → `<span style=background-color>` (Outlook für Windows), leere Zeilen behalten Höhe, Schrift Aptos/Calibri/Helvetica. Bei Antworten steht der eigene Text jetzt hinter `<body>` des Microsoft-Entwurfs statt vor `<html>` (`withReply` in graph.ts).
- **Liquid Glass** (`index.css` Abschnitt „Liquid Glass“: `.lg`, `.lg-pill`, `.lg-selected`, `.glass-surface`, `.fade-edges`, `.smooth-scroll`): Standard-Hintergrund ist jetzt ein zarter Verlauf, Glas also immer an. Kopfleiste der Liste und Aktionsleiste der Mail schweben als Glas, Inhalt läuft darunter durch, Leisten werden beim Scrollen schmaler. Aktive Zeile in der Leiste = gleitende Glas-Kapsel (motion `layoutId`). Avatare mit Initialen, Schnellaktionen beim Drüberfahren (gelesen/archivieren/löschen), weiches Einblenden. Scrollbalken erst beim Drüberfahren.
- **Seitenleiste:** Postfächer mit Farbe + Adresse darunter, „Aleksa“ heißt jetzt „Aleksa persönlich“, Aufklappen animiert. **„Alle Posteingänge“** (`/mail/alle/inbox`): info@, persönlich, Consulting zusammen, nach Datum sortiert, Farbpunkt je Postfach; Nachricht-ID in der URL als `<postfach>~<id>`.
- Mobil: Menüknopf sitzt in der Glas-Kopfleiste (`openMenu()` aus Shell.tsx), auf Nicht-Mail-Seiten schwebt er weiter.
- Geprüft mit lokaler Testseite `ui-test.html` (Beispieldaten, kein Login, gitignored): Desktop, dunkler Hintergrund, Handy, Schreibfenster. **Echter Versand formatierter Mail an Gmail/Outlook noch nicht getestet.**
- Nächste Stufen (vorgeschlagen, nicht gebaut): 2 = Relevant/Sonstige, Unterhaltungen, Mehrfachauswahl, Wischen, Drag and Drop auf Ordner, Später erinnern, Suchfilter. 3 = April im Postfach über den Gateway.

### Nachtrag 2026-09-29 spät: echtes Glas statt weißer Transparenz
- Aleksa: „das ist nicht Glas, ich sehe scharf durch“. Zwei Ursachen, beide im Browser gemessen:
  1. **Verschachtelter backdrop-filter:** `.glass-surface` (Panel) hatte selbst `backdrop-filter` → in Chrome „Backdrop Root“ → Kopf-/Aktionsleiste darin verwischten den Text darunter NICHT. Fix: Panel-Unschärfe liegt jetzt auf `.glass-surface::before`, das Panel selbst hat keinen Filter. **Regel: nie Glas in einem Element mit backdrop-filter.**
  2. **iframe-Inhalt** (Mail-Text) nimmt kein Browser in den backdrop auf. Fix: Lesebereich blendet oben unter der Aktionsleiste aus (`.fade-top`, wie Apples Scroll Edge Effect).
- `src/lib/liquid-glass.ts` → `useLiquidGlass()` (Callback-Ref): SVG-Filter je Element mit Blur + Randbrechung (Verschiebungskarte aus Signed-Distance-Field des abgerundeten Rechtecks) + Sättigung. Nur Chromium (Chrome/Edge/Arc); Safari/Firefox bekommen die CSS-Variante von `.lg` (Blur, Tönung, Lichtkante per ::after-Verlaufsring). Eingesetzt an Kopfleiste der Liste + Aktionsleiste der Mail. Suchfeld als eingelassenes Feld `.lg-well`.

### Nachtrag 2026-09-29 nachts: „Beantwortet“ + dezentere Zeilen
- **Beantwortet/Weitergeleitet** wie Outlook: MAPI-Eigenschaft `Integer 0x1081` (102/103/104) wird in Liste + Mail per `$expand=singleValueExtendedProperties(...)` mitgeladen (`withVerb` fällt ohne $expand zurück, falls Graph ablehnt). Nach eigenem Senden setzt `sendResponse` die Eigenschaft am Original (+ `SystemTime 0x1082`), damit auch Outlook „beantwortet“ zeigt. Zusätzlich sucht die Mail-Ansicht eigene Antworten derselben Unterhaltung in Gesendet (`sentInConversation`) → Hinweis „Du hast am … geantwortet an … · Ansehen“ (öffnet die Antwort). Liste: kleines ↩ bzw. ⇨ neben dem Namen.
- **Ungeprüft gegen echtes Graph:** ob `$expand` mit `$filter` auf die Eigenschaft im Mandanten durchgeht und ob das PATCH am Original erlaubt ist. Mails, auf die vor diesem Stand geantwortet wurde, zeigen den Hinweis über die Gesendet-Suche.
- Zeilen: Schnellaktionen sind drei dezente Symbole an Stelle der Uhrzeit (kein eigener Kasten), Zeile ist jetzt `div role=button` (keine verschachtelten Buttons). Hover = hauchdünne Glasscheibe (`.row-glass`), Auswahl `.lg-selected` ebenfalls als Scheibe.

### Nächster Schritt
1. Aleksa: Entra-App „Aleksa Mail“ (SPEC §6) → `.env` mit `VITE_MS_CLIENT_ID` (+ Tenant, erlaubter Nutzer, siehe `.env.example`); dieselben drei Variablen in Netlify.
2. Cloud Shell: `Set-OrganizationConfig -SendFromAliasesEnabled $true` und `Add-RecipientPermission info@aleksa.ai -AccessRights SendAs -Trustee Aleksa@spalevic-partner.com`.
3. Echter Login-Test, dann Phase 2 Kalender.


## 30.09.2026 — Senden aus Aprils Postfach
- `mailboxes.ts`: April-Bereich `from: ['april@aleksa.ai']` statt nur lesen.
- Braucht einmalig in Exchange (Cloud Shell, Aleksa): `Add-RecipientPermission april@aleksa.ai -AccessRights SendAs -Trustee Aleksa@spalevic-partner.com`. Ohne das Recht lehnt Graph das Senden mit `ErrorSendAsDenied` ab.
- Mails, die Aleksa hier selbst schreibt, bekommen KEINE automatische April-Signatur (die setzt nur der Gateway bei `april_send_email`).
- Signatur im Schreibfenster: `src/config/signatures.ts` (je Absenderadresse, aktuell nur april@). Vorschau unter dem Editor mit Schalter „Signatur anhängen“, beim Senden hinter den Text gehängt (bei Antworten vor dem Zitat). Nicht im Tiptap-Editor selbst, weil der Tabelle und Inline-Styles verwirft. Zweite Kopie im Gateway (`claude-team/gateway/src/mail-freigabe.ts`).
- **Kalender (30.09.2026):** info@aleksa.ai ist der Hauptkalender. Die Kalenderseite zeigt info@ + Aleksas eigenen Kalender (enneo-Termine) zusammen (`listAllEvents`, doppelte per iCalUId entfernt), neue Termine gehen nach info@. Jeder Termin traegt `owner` (Graph-Pfad), Bearbeiten/Loeschen/Antworten laufen gegen das richtige Postfach. Braucht delegiert `Calendars.ReadWrite.Shared` — beim ersten Laden fragt Microsoft einmal nach Zustimmung.

## 01.10.2026 — Tief verschachtelte Gmail-Weiterleitungen
- Andys IBCB-Newsletter-Anfrage zeigte nur die erste Zeile: Er leitet jede Woche die Vorwochen-Mail weiter, Gmail packt jedes Mal neue `<div dir="ltr"><div class="gmail_quote">` drum, der Text lag auf Tiefe 514 (Browser-Grenze 512).
- `flattenDeepNesting` in `HtmlFrame.tsx` (läuft in `prepareMailHtml`, also auch fürs PDF): erst ab Tiefe 100, entfernt nur stillose `div`-Hüllen, die genau ein weiteres `div` enthalten. Ergebnis bei Andys Mail: Tiefe 5, ganzer Text sichtbar.
- Zum Nachprüfen kann die `microsoft-bridge` jetzt `mail/message` mit `format: "html"` liefern (Standard bleibt Text).

## 02.10.2026 — April im Postfach: übersetzen und überarbeiten
- Schreibfenster: Leiste „April“ unter dem Editor. Freitext-Anweisung + „Überarbeiten“ (leer = Fehler korrigieren, schreibt in Aleksas Stil aus `wiki/aleksa-writing-style.md`), Sprachwahl + „Übersetzen“. Ergebnis ersetzt den Entwurf, „Rückgängig“ holt den alten Stand zurück. Signatur und Zitat bleiben unberührt.
- Lesen: Übersetzen-Symbol in der Aktionsleiste, Übersetzung erscheint als Karte über der Mail, Sprache dort umschaltbar.
- Technik: `src/lib/april.ts` → Gateway `POST /api/mail-hilfe` (`claude-team/gateway/src/mail-hilfe.ts`). Nachweis = Aleksas Graph-Token, der Gateway prüft per `/me` gegen `aleksa@spalevic-partner.com`, CORS nur `mail.aleksa.ai` + localhost:5173. Reiner Modellaufruf (claude-sonnet-5), keine Werkzeuge, nichts wird gesendet. Verbrauch landet als patricia/web/mail-app in `agent_messages`.
- Optional `VITE_GATEWAY_URL` (Standard: aleksa-ai-team-production.up.railway.app).
- Ergebnis-HTML wird vor dem Einsetzen auf die Editor-Tags reduziert (`cleanAprilHtml`).
