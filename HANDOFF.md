# HANDOFF — mail

### Was wurde in dieser Session gemacht (2026-09-27)
- Entscheidungen: eigene App `mail.aleksa.ai`, **Mail + Kalender**, Design **genau wie PM-Tool**, **alle Postfächer getrennt** (SPEC §8).
- **Phase 0 + Phase 1 (Mail) gebaut**, Build + Typprüfung grün, Anmeldeseite im Browser geprüft (PM-Look). Noch **nicht mit echtem Login getestet** — Entra-App fehlt.
  - `src/config/mailboxes.ts` — die drei Bereiche (Aleksa inkl. Alias spalevic-consulting.de, info@, April nur lesen) + Ordner.
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

### Nächster Schritt
1. Aleksa: Entra-App „Aleksa Mail“ (SPEC §6) → `.env` mit `VITE_MS_CLIENT_ID` (+ Tenant, erlaubter Nutzer, siehe `.env.example`); dieselben drei Variablen in Netlify.
2. Cloud Shell: `Set-OrganizationConfig -SendFromAliasesEnabled $true` und `Add-RecipientPermission info@aleksa.ai -AccessRights SendAs -Trustee Aleksa@spalevic-partner.com`.
3. Echter Login-Test, dann Phase 2 Kalender.
