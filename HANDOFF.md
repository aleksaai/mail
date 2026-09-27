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

### Nächster Schritt
1. Aleksa: Entra-App „Aleksa Mail“ (SPEC §6) → `.env` mit `VITE_MS_CLIENT_ID` (+ Tenant, erlaubter Nutzer, siehe `.env.example`); dieselben drei Variablen in Netlify.
2. Cloud Shell: `Set-OrganizationConfig -SendFromAliasesEnabled $true` und `Add-RecipientPermission info@aleksa.ai -AccessRights SendAs -Trustee Aleksa@spalevic-partner.com`.
3. Echter Login-Test, dann Phase 2 Kalender.
