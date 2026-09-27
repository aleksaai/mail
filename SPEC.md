# SPEC — Aleksa Mail (`mail.aleksa.ai`)

Stand 2026-09-27 · Owner: Marcus · Status: 📝 Spec, wartet auf Aleksas Freigabe

## 1. Warum

Aleksa mag die Outlook-Oberfläche nicht. Seit dem Google-Ausstieg (26./27.09.2026) liegen Mail und Kalender in **einem** Microsoft-365-Mandanten („SPALEVIC & PARTNER HOLDING“, eine Lizenz Business Basic, `Aleksa@spalevic-partner.com`). Microsoft bleibt der Unterbau — Zustellung, Spamfilter, Archivierung, Aufbewahrung. Diese App ersetzt nur die **Oberfläche**: Mail + Kalender, eigenes Design, April eingebaut. Outlook wird nicht mehr geöffnet.

**Bewusst nicht:** eigener Mailserver (Spam, Zustellbarkeit, GoBD-Archivierung, Ausfallrisiko). Nicht im PM-Tool (dort sind Projektmitglieder und Kunden; dessen Microsoft-App ist wegen enneo-Admin-Consent bewusst nur lesend).

## 2. Nutzer

Nur Aleksa. Kein Mehrbenutzer, kein Teilen. Login nur mit seinem Microsoft-Konto; jedes andere Konto wird abgewiesen (Prüfung der Objekt-ID).

## 3. Postfächer und Adressen

| Adresse | Art | Lesen | Senden als |
|---|---|---|---|
| `Aleksa@spalevic-partner.com` | eigenes Postfach (Lizenz) | ✅ | ✅ |
| `aleksa@spalevic-consulting.de`, später `aleksa@destinymedia.de`, `aleksa@pengoro.com` | Aliase im eigenen Postfach | ✅ (landen im selben Posteingang) | ✅ nach `Set-OrganizationConfig -SendFromAliasesEnabled $true` |
| `info@aleksa.ai` | freigegebenes Postfach | ✅ | ✅ für Aleksa (braucht „Senden als“-Recht; April sendet von dort nie) |
| `april@aleksa.ai` | freigegebenes Postfach (Aprils) | ✅ | nein — dort sendet April, Aleksa sieht mit |

Domains `destinymedia.de` und `pengoro.com` müssen erst in den Mandanten (eigener Umzug, nicht Teil dieser App).

## 4. Umfang

### Mail
- **Jedes Postfach getrennt** (eigener Bereich mit Ordnern); Unterhaltungen gruppiert (`conversationId`) — Gruppierung noch offen.
- Lesen (HTML sicher gerendert in Sandbox-iframe, externe Bilder erst auf Klick), Anhänge ansehen/laden.
- Schreiben, Antworten, Allen antworten, Weiterleiten; **Absender-Auswahl** (Adresse aus §3); Entwürfe (auch Aprils Entwürfe in info@).
- Archivieren, Löschen (Papierkorb), Verschieben in Ordner, Gelesen/Ungelesen, Markieren, Später erinnern (Snooze über Ordner + Termin).
- Suche über alle Postfächer.
- Tastatur-Kürzel (j/k, e archivieren, r antworten, c neu, / suchen).

### Kalender
- Tag / Woche / Monat, mehrere Kalender (eigener + enneo-Kopien aus dem ICS-Abgleich).
- Termin anlegen/ändern/löschen, Serien, Ort/Teams-Link, Teilnehmer einladen.
- Einladungen annehmen/ablehnen/vorschlagen direkt aus der Mail.
- Zeiten immer mit Zeitzone Europe/Berlin (Lehre aus der Bridge: Graph ohne Zone führt zu 2 h Versatz).

### April (Agent-Gateway)
- Seitenleiste an jeder Mail: „Zusammenfassen“, „Antwort entwerfen“, „Beleg ablegen“ (→ `mail_attachment_to_drive`), „Termin daraus machen“.
- Freigaben aus `april@` (Tabelle `agent_mail_approvals`) als Liste mit Senden / Nicht senden — zusätzlich zu Telegram.
- Aufruf über den bestehenden Gateway (`/api/chat`, Agent `patricia`, Stufe `aleksa`); kein zweites Modell-Setup.

### Nicht in Phase 1
Kontakte-Verwaltung, Regeln/Filter, Signaturen-Editor (feste Signatur je Adresse reicht), Offline-Modus, Mehrbenutzer.

## 5. Architektur

- **Frontend:** Vite + React + TypeScript + Tailwind, Netlify, `mail.aleksa.ai`. Design-Niveau wie PM-Tool, Regeln aus `feedback_design_no_slop` (keine Emoji-Icons, keine Boxen um Listen). Als PWA installierbar (iPhone-Homescreen).
- **Anmeldung:** eigene Entra-App **„Aleksa Mail“** im Mandanten SPALEVIC & PARTNER HOLDING, Single-Tenant, Plattform SPA, MSAL.js mit PKCE. **Delegierte** Rechte (arbeitet mit Aleksas eigenen Rechten, kein App-Secret): `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Mail.ReadWrite.Shared`, `Mail.Send.Shared`, `Calendars.ReadWrite`, `MailboxSettings.Read`, `offline_access`. Unabhängig von der Agenten-App (`e3881479…`, app-only) und vom PM-Tool.
- **Daten:** direkt aus Graph im Browser; **kein** Mail-Inhalt in einer eigenen Datenbank. Synchronisation über Graph-Delta-Abfragen (beim Öffnen, bei Fokus, alle 30 s).
- **Phase 2 — live + Push:** Graph-Change-Notifications (Webhook) → kleine Supabase-Edge-Function → Supabase Realtime + Web-Push aufs iPhone. Braucht serverseitig einen Refresh-Token (im Vault) — erst wenn Phase 1 steht.
- **April:** Gateway-Aufrufe über eine Edge Function mit Aleksas Sitzung als Nachweis (Gateway-Token nie im Browser).

## 6. Einrichtung durch Aleksa (Classifier sperrt Rechtevergaben für Claude)

1. Entra: App „Aleksa Mail“ registrieren (SPA, Redirect `https://mail.aleksa.ai` + `http://localhost:5173`), delegierte Rechte aus §5 eintragen, beim ersten Login selbst zustimmen.
2. Cloud Shell: `Set-OrganizationConfig -SendFromAliasesEnabled $true` (Senden als Alias) und `Add-RecipientPermission info@aleksa.ai -AccessRights SendAs -Trustee Aleksa@spalevic-partner.com`.
3. IONOS: CNAME `mail` → Netlify.
4. ✅ GitHub-Repo `aleksaai/mail` (angelegt 27.09.).

## 7. Phasen

| Phase | Inhalt | Ergebnis |
|---|---|---|
| 0 | Entra-App, Repo, Gerüst, Login, Konto-Sperre | Aleksa loggt sich ein, sieht seinen Namen |
| 1 | Posteingang über alle Postfächer, Lesen, Schreiben/Antworten mit Absender-Wahl, Archiv/Löschen/Suche | Outlook für Mail entbehrlich |
| 2 | Kalender Woche/Tag/Monat, Termine, Einladungen aus Mail | Outlook für Kalender entbehrlich |
| 3 | April-Seitenleiste + Freigaben | April direkt an der Mail |
| 4 | Webhooks + Push aufs iPhone | Neue Mail sofort, auch zu |

## 8. Entscheidungen (Aleksa 27.09.2026)

1. Domain `mail.aleksa.ai` — Subdomain angelegt, Netlify-Verbindung macht Aleksa.
2. Design **genau wie das PM-Tool** (awork-Palette, Figtree, Lila `#8b79f0`, schwebende weiße Leiste auf hellblauem Canvas) — Tokens, `index.css`, `tailwind.config.ts` und shadcn-Komponenten 1:1 aus `projectmanagement` übernommen.
3. **Alle Postfächer getrennt:** jedes Postfach ist ein eigener Bereich in der Seitenleiste mit eigenen Ordnern, kein gemeinsamer Posteingang (§4 „Ein Posteingang für alles“ damit überholt).
