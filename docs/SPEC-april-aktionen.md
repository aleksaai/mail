# SPEC — April schlägt Aktionen vor (Aleksa Mail)

Stand 2026-10-02 · Owner: Marcus · Status: 📝 Entwurf, wartet auf Aleksas Freigabe
Baut auf `SPEC-april-vorschlaege.md` auf. Dort heißt „Phase 2" die Animation. Diese Spec ist ein eigener Strang („Aktionen") und kann vor oder nach der Animation kommen.

## 1. Ziel in einem Satz

Braucht eine Mail keine Antwort, aber trotzdem etwas von Aleksa (Frist, Dokument, Zahlung, Termin), zeigt die April-Karte zwei, drei Aktionsknöpfe statt Antwortvorschlägen. Ein Klick erledigt den Schritt oder legt ihn sauber ab.

Auslöser: K&H-Mail vom 29.09.2026 (Kundenidentifizierung Holding bis 31.12.2026). April erkennt Frist und Inhalt richtig, bietet aber nichts an.

## 2. Heute

- Gateway `brief` (`claude-team/gateway/src/mail-vorschlag.ts`) liefert `{zusammenfassung, antwort_noetig, frist, vorschlaege}`. Bei `antwort_noetig: false` ist `vorschlaege` immer leer (Zeile ~125, ~153).
- `AprilCard.tsx` zeigt Chips nur bei `canSend` und nicht-leeren Vorschlägen.
- Vorhanden und nutzbar: Kalender-Anlage über Graph (`src/lib/calendar.ts`, `EventDialog.tsx`), PM-Tool-Aufgaben und Erinnerungen im Gateway (`errands.ts`, pm-Tools), Delegation an Lisa im Gateway.

## 3. Ablauf für den Nutzer

1. Mail öffnen. Karte zeigt wie bisher die Zusammenfassung und das Frist-Badge.
2. Darunter, wenn sinnvoll, **Aktions-Chips** (höchstens drei), z. B. bei K&H:
   - „Erinnern 1.12." 
   - „Aufgabe anlegen"
   - „An Fanni weiterleiten"
3. Klick → kleine Bestätigungszeile in der Karte mit den vorausgefüllten Werten (Datum, Projekt, Empfänger), editierbar. Erst „OK" führt aus.
4. Danach: Häkchen und ein Satz, was passiert ist („Aufgabe im PM-Tool, Projekt Spalevic Holding, fällig 1.12."). Die Mail bekommt ein Outlook-Fähnchen, damit man es in der Liste sieht.
5. Mails mit Antwortbedarf behalten die Antwort-Chips. Beides gleichzeitig nur, wenn es wirklich passt (z. B. „Zusagen" + „In Kalender").

## 4. Aktionskatalog (fest, April wählt nur aus)

| Aktion | Was passiert | Wo | Bestätigung nötig |
|---|---|---|---|
| `erinnern` | Erinnerung per Telegram zum Datum (Default: 7 Tage vor Frist) | Gateway `errands` | ja |
| `aufgabe` | Aufgabe im PM-Tool, Titel + Fälligkeit + Link zur Mail | Gateway pm-Tool | ja |
| `kalender` | Termin/Frist als Kalendereintrag (ganztägig bei Fristen) | App, Graph | ja |
| `weiterleiten` | Weiterleiten-Fenster öffnet sich mit Empfänger + kurzem Begleitsatz, Senden drückt Aleksa | App, `Compose.tsx` | Senden selbst |
| `an_lisa` | Rechnung/Beleg an Lisa zur Ablage (PDF-Anhang → Buchhaltungsordner) | Gateway Delegation | ja |
| `wiedervorlage` | Outlook-Fähnchen mit Fälligkeitsdatum | App, Graph `flag` | nein (rückgängig machbar) |
| `abbestellen` | List-Unsubscribe-Link öffnen bzw. mailto vorbereiten | App | ja |
| `archivieren` | Mail ins Archiv | App, Graph | nein (rückgängig machbar) |

Keine freien Aktionen, die das Modell erfindet. Empfänger für `weiterleiten` nur aus `wiki/contacts.md` oder früheren Mails, nie geraten. Fehlt ein Wert, bleibt das Feld leer und gelb.

## 5. Technik

**Gateway (`claude-team`)**
- `brief`-JSON erweitern: `aktionen: [{typ, label, werte}]`. `werte` je Typ, z. B. `{datum, titel, projekt}` oder `{empfaenger, grund}`.
- Prompt: Aktionen nur, wenn die Mail etwas von Aleksa verlangt oder ein Datum/Dokument enthält. Newsletter ohne Bezug bekommen höchstens `abbestellen`/`archivieren`.
- Neue Aktion `ausfuehren` in `mail-hilfe` für die Gateway-seitigen Typen (`erinnern`, `aufgabe`, `an_lisa`). Prüft Typ gegen den Katalog, protokolliert wie bisher.
- PM-Projekt-Zuordnung: Absender/Postfach → Projekt aus Gedächtnis; unsicher → leer lassen, Aleksa wählt.

**App (`mail`)**
- `AprilCard.tsx`: Chip-Leiste für Aktionen, Bestätigungszeile mit Feldern, Erfolgszeile.
- Client-seitige Typen (`kalender`, `weiterleiten`, `wiedervorlage`, `abbestellen`, `archivieren`) direkt über Graph.
- `brief`-Cache bleibt pro Mail-ID; Erledigt-Status je Mail lokal merken, damit der Chip nicht nochmal angeboten wird.

**Kosten:** keine zusätzlichen Modellaufrufe, die Aktionen kommen im selben Haiku-`brief` mit. `ausfuehren` ist ein normaler API-Aufruf.

## 6. Regeln

- Nichts geht ohne Klick raus. Weiterleiten und Antworten sendet nur Aleksa selbst.
- Wirkt eine Mail wie Phishing (Bank, Zahlungsaufforderung, fremde Links), sagt die Karte das und bietet keine Link-Aktionen an. Bei echten Bank-Mails (K&H, Wise) keine Klicks auf Links in der Mail, nur Erinnerung/Aufgabe.
- enneo-Postfach bleibt draußen, Postfächer wie in der Vorschlags-Spec.

## 7. Phasen

| Schritt | Inhalt | Aufwand |
|---|---|---|
| A | `brief` liefert Aktionen, Karte zeigt Chips, client-seitige Aktionen (Kalender, Wiedervorlage, Weiterleiten, Archivieren) | ~½ Tag |
| B | `ausfuehren` im Gateway: Erinnerung, PM-Aufgabe, an Lisa | ~½ Tag |
| C | Lernen: welche Aktion Aleksa je Absender nimmt, wird beim nächsten Mal zuerst angeboten | später |

## 8. Fertig, wenn

- [ ] K&H-Mail zeigt Erinnern / Aufgabe / Weiterleiten mit korrekter Frist 31.12.2026.
- [ ] Bei 10 echten Mails ohne Antwortbedarf passen die angebotenen Aktionen in mindestens 8 Fällen.
- [ ] Kein Klick führt ohne Bestätigungszeile etwas außerhalb der App aus.
- [ ] Erledigte Aktion wird beim erneuten Öffnen als erledigt angezeigt, nicht nochmal angeboten.

## 9. Offene Fragen an Aleksa

1. Erinnerungen per Telegram (April) oder lieber nur als PM-Aufgabe?
2. Default-Vorlauf bei Fristen: 7 Tage oder anders?
3. Soll April bei Rechnungen automatisch `an_lisa` anbieten, oder nur bei bestimmten Absendern?
