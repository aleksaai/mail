# SPEC — April schlägt Antworten vor (Aleksa Mail, Stufe 3)

Stand 2026-10-02 · Owner: Marcus · Status: 📝 Entwurf, wartet auf Aleksas Freigabe

## 1. Ziel in einem Satz

Öffnet Aleksa eine Mail, auf die er antworten sollte, liegen schon zwei, drei kurze Antwortvorschläge von April bereit. Sie schreibt sie in seinem Ton und kennt den Hintergrund. Ein Klick öffnet das Schreibfenster mit dem fertigen Entwurf. Gesendet wird nie automatisch.

## 2. Was es heute schon gibt (nicht doppelt bauen)

- `src/lib/april.ts` → Gateway `POST /api/mail-hilfe` (`claude-team/gateway/src/mail-hilfe.ts`): Überarbeiten und Übersetzen. Anmeldung über Aleksas Graph-Token, CORS nur `mail.aleksa.ai`. Ein reiner Modellaufruf: April kennt dabei nur den Schreibstil, nicht Aleksa selbst.
- Im Gateway gibt es Aprils Wissen über Aleksa:
  - `loadUserModel()` (`nutzerbild.ts`): wie er kommuniziert und entscheidet, wird jede Nacht neu geschrieben
  - `loadMemory()` (`gedaechtnis.ts`): Fakten, Termine, offene Fäden
  - `wiki/aleksa-writing-style.md` und `wiki/contacts.md`
- `posteingang.ts` sortiert info@ alle 15 Minuten vor und erkennt dabei „wichtig / Antwort nötig / Frist“. Dieses Urteil wird heute nicht gespeichert.

**Der Kern der Erweiterung:** `mail-hilfe` bekommt Aprils Gedächtnis. Erst dadurch werden die Vorschläge persönlich und nicht nur stilistisch.

## 3. Ablauf für den Nutzer

1. Aleksa öffnet eine Mail. Über dem Mail-Text erscheint die **April-Karte** aus Glas:
   - eine Zeile, worum es geht und was erwartet wird (z. B. „Will bis Freitag wissen, ob du kommst“)
   - zwei bis drei **Vorschlags-Chips**, je nach Mail, z. B. „Zusagen“, „Rückfrage zum Termin“, „Freundlich absagen“
2. Ein Klick auf einen Chip lässt den Entwurf live in die Karte schreiben (Streaming, man sieht April tippen).
3. Unter dem Entwurf stehen die Knöpfe **Einsetzen** (öffnet Antworten mit dem Entwurf im Editor, Signatur und Zitat wie gewohnt), **Kürzer**, **Förmlicher / Lockerer**, eine **Sprachwahl** und ein Freitextfeld („sag ihm, dass ich erst ab 15 Uhr kann“).
4. Braucht eine Mail keine Antwort (Newsletter, Benachrichtigung), bleibt die Karte klein: nur die Zusammenfassung, keine Chips.
5. Aleksa kann die Karte für eine Mail zuklappen und für ganze Absender oder Ordner abschalten.

## 4. Kontext, den April je Vorschlag bekommt

| Quelle | Woher | Warum |
|---|---|---|
| Mail + Verlauf der Unterhaltung | App, Graph `conversationId` (die letzten 5 Nachrichten) | Worauf geantwortet wird |
| Bisherige Mails an diesen Absender | App, Graph Gesendet `toRecipients/any(...)` (die letzten 3, gekürzt) | Du oder Sie, Ton, wie Aleksa mit genau dieser Person schreibt |
| Postfach und Absenderadresse | App | Firmen-Kontext (persönlich, info@, Consulting) |
| Nutzerbild, Fakten, offene Fäden, Termine | Gateway, `loadUserModel` + `loadMemory` | Hintergrund, z. B. dass die Holding-Sitzfrage beim Anwalt liegt |
| Schreibstil + Kontakte | Gateway, Wiki | Ton, wer die Person ist |
| Kalender der nächsten 14 Tage (frei/belegt) | App, Graph `calendarView` | Terminvorschläge, die wirklich passen |

Systemanweisung und Gedächtnis werden gecacht (`cache_control`), pro Klick kommt nur die Mail neu dazu.

**Modell:** Zusammenfassung und Chips mit Haiku (schnell, billig, startet automatisch beim Öffnen). Den ausformulierten Entwurf schreibt erst beim Klick `claude-sonnet-5`, gestreamt.
**Kosten grob:** Haiku-Karte unter 1 Cent pro geöffneter Mail, ausformulierter Entwurf etwa 2 bis 4 Cent (wegen des Cache). Der Verbrauch wird wie bisher als `patricia/web/mail-app` protokolliert.

## 5. Regeln für April

- Nichts erfinden: keine Zusagen, Preise, Termine oder Fakten, die nicht aus dem Kontext folgen. Fehlt etwas, schreibt sie einen Platzhalter `[Uhrzeit?]` und markiert ihn gelb im Editor.
- Die Antwort ist immer in Aleksas Namen geschrieben, aus seinem Postfach, in seinem Stil. Ausnahme: Im April-Postfach schreibt sie als April mit ihrer Signatur.
- Sprache wie die eingehende Mail, außer Aleksa wählt eine andere.
- Private Fakten (Kontostand, Familie, Gesundheit) kommen nur in eine Antwort, wenn die Mail genau danach fragt.
- Das enneo-Postfach ist nicht Teil der App und bleibt draußen.

## 6. Die animierte April

**Festgelegt 02.10.2026:** April ist das lila Plüsch-Wesen mit der cremefarbenen Schleife (Bild von Aleksa, liegt als `public/april/april.png`). Sie hat keine Arme und keinen Mund. Gesten wie Zeigen oder Tippen passen deshalb nicht. Ihr Ausdruck kommt aus **Körper, Augen und Schleife**:

| Zustand | Bewegung |
|---|---|
| `idle` | atmet langsam (Skalierung 1 → 1,02), blinzelt alle 4–7 s zufällig |
| `thinking` | Augen wandern zur Seite und zurück, leichtes Neigen, die Schleife wippt, sanfter lila Schimmer drumherum |
| `writing` | kleines rhythmisches Hüpfen im Takt der gestreamten Wörter |
| `done` | Squash-and-Stretch-Hüpfer, Schleife schnippt nach, kurz „glückliche“ Augen (Bögen) |
| `wave` | schaut von der Seite herein, wackelt kurz hin und her |

Umsetzung: Körper und Schleife als zwei freigestellte Ebenen, die Augen als eigene SVG-Ebene. So blinzeln und schauen sie per Motion, ohne für jede Pose ein neues Bild zu brauchen. Freistellen und Ebenen erzeuge ich aus dem Original. Ein zweites Bild „Augen zu / glücklich“ entsteht mit dem Bildgenerator im selben Stil.

Die drei Wege von vorher gelten weiter, A ist jetzt aber deutlich stärker, weil die Figur sich gut für Squash-and-Stretch eignet:

| Weg | Wie | Pro | Contra |
|---|---|---|---|
| **A. Zustandsbilder + Motion** (Empfehlung für den Start) | Aus Aprils vorhandenem Bild erzeugt der Bildgenerator 5 bis 6 Posen im selben Stil (wartet, denkt, schreibt, zeigt auf etwas, fertig/nickt, winkt). In der App bewegen Motion-Federn sie: atmen, kurz hineinschauen, Überblendung zwischen den Posen, ein Leuchtring, solange sie denkt | Schnell gebaut, leicht, keine laufenden Kosten | Gezeichnete Bewegung, keine echte Animation |
| **B. Kurze Video-Loops** | Je Zustand ein Clip von 3 bis 5 s (Bild-zu-Video, erstes Bild = Pose aus A), als WebM/MP4 in Schleife | Wirkt am lebendigsten | Kostet einmalig ca. 2 bis 4 € pro Clip, mehrere MB, die Figur wechselt beim Zustandswechsel sichtbar zwischen den Clips |
| **C. Rive-Figur** | Eine echte Figur mit Zustandsmaschine, Blick folgt der Maus, Mund bewegt sich beim Schreiben | Sieht am hochwertigsten aus und reagiert live | Braucht eine Illustratorin oder einen Rive-Designer, Aufwand Tage, nicht von mir allein machbar |

Vorschlag: A jetzt bauen und B später für zwei Momente nachrüsten (Begrüßung und „fertig“), wenn A gefällt.

**Wo sie auftaucht** (höchstens zwei, drei Momente pro Bildschirm, alles andere bleibt ruhig):
- **April-Karte:** Sie schaut von links hinein, solange sie liest und denkt, und tippt beim Streamen.
- **Schreibfenster:** Beim Überarbeiten oder Übersetzen sitzt sie klein an der Leiste und nickt am Ende.
- **Leerer Posteingang:** Sie lehnt sich zurück: „Alles erledigt“.
- **Nach dem Senden:** ein kurzes Nicken in der Ecke, dann ist sie weg.
- **Liste:** ein kleiner April-Punkt an Mails, für die sie schon einen Vorschlag hat (erst ab Phase 3).
- `prefers-reduced-motion` schaltet die Bewegung ab, dann bleiben nur Standbilder.

## 7. Technik

**Gateway (`claude-team`)**
- `mail-hilfe.ts` bekommt zwei neue Aktionen:
  - `brief`: Haiku liefert JSON `{zusammenfassung, antwort_noetig, frist, vorschlaege:[{label, absicht}]}`
  - `draft`: Sonnet schreibt den Entwurf für eine `absicht` (+ Anweisung, Sprache, Länge), Antwort als **Server-Sent Events**
- Ein Kontextbaustein `aprilKontext()` = Nutzerbild + Fakten + Stil + Kontakte. Er ändert sich höchstens einmal täglich, deshalb hält der Cache.
- Anmeldung, CORS und Protokoll bleiben wie heute.

**App (`mail`)**
- `src/lib/april.ts`: `brief()` und `draft()` mit Stream-Leser; Ergebnis je Mail-ID in `sessionStorage`, damit nichts doppelt bezahlt wird.
- `src/lib/april-context.ts`: sammelt Verlauf, frühere Mails an den Absender und freie Zeiten über Graph.
- `src/components/april/AprilCard.tsx` (Karte, Chips, Streaming-Entwurf), `AprilAvatar.tsx` (Zustände `idle | thinking | writing | done | wave`, Motion), Bilder unter `public/april/*.webp`.
- „Einsetzen“ nutzt den vorhandenen Antworten-Ablauf in `Compose.tsx` mit Starttext.

**Keine Mail-Inhalte in einer Datenbank** (SPEC §5). Ausnahme nur in Phase 3 und nur, wenn Aleksa zustimmt.

## 8. Phasen

| Phase | Inhalt | Aufwand | Ergebnis |
|---|---|---|---|
| 1 | Gateway `brief` + `draft` mit Aprils Gedächtnis, April-Karte mit Chips und Streaming, Einsetzen ins Schreibfenster, Platzhalter-Avatar (Leuchtkreis) | ~1 Tag | Vorschläge funktionieren im echten Postfach |
| 2 | April-Posen erzeugen, `AprilAvatar` mit Zuständen, Animationen an den Stellen aus §6 | ~½–1 Tag | Sie lebt |
| 3 | Vorschläge vorab: `posteingang.ts` erzeugt für wichtige info@-Mails die Karte schon beim Sortieren, die Liste zeigt den April-Punkt, Öffnen geht sofort | ~½ Tag | Proaktiv statt auf Klick |
| 4 | Lernen: beim Senden wird nur gemessen, wie stark Aleksa den Vorschlag geändert hat, und als Signal ins nächtliche Nutzerbild gegeben | ~½ Tag | Vorschläge werden mit der Zeit treffender |

## 9. Fertig, wenn

- [ ] Bei 10 echten Mails aus info@ und dem persönlichen Postfach passen Du/Sie, Sprache und Ton in mindestens 8 Fällen ohne Nacharbeit.
- [ ] Die Karte erscheint nach unter 2 s, der erste Satz des Entwurfs nach unter 3 s.
- [ ] Kein Vorschlag erfindet einen Termin, Preis oder eine Zusage (Stichprobe).
- [ ] Gesendet wird nur, wenn Aleksa im Schreibfenster selbst auf Senden drückt.
- [ ] Die Animationen laufen flüssig auf dem MacBook und im iPhone-Safari; mit reduzierter Bewegung gibt es nur Standbilder.

## 10. Nicht dabei

Automatisches Senden, Antworten im enneo-Postfach, Mails im Hintergrund lesen ohne Öffnen (außer Phase 3 für info@), Sprachausgabe, eine Rive-Figur (Weg C) ohne Designer.

## 11. Entscheidungen und offene Fragen

**Entschieden 02.10.2026:**
1. Bild: das lila Plüsch-Wesen mit Schleife (siehe §6).
2. Postfächer: `info@aleksa.ai`, `aleksa@spalevic-partner.com` und `aleksa@spalevic-consulting.de`. Die Consulting-Adresse ist ein Alias im persönlichen Postfach. Es ist also derselbe Posteingang, April erkennt aber an der Empfängeradresse, ob es um Consulting geht, und antwortet von dieser Adresse. Archiv DestinyMedia und das April-Postfach bleiben ohne Vorschläge.

3. Vorab-Vorschläge (Phase 3): erlaubt. Kurze Entwürfe dürfen in Supabase liegen, nur für die drei Postfächer oben. Sie werden nach 14 Tagen oder sobald die Mail beantwortet ist gelöscht.

Alle Fragen sind geklärt. Die Spec wartet nur noch auf das Go zum Bauen.
