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

### Nächster Schritt
1. Aleksa: Entra-App „Aleksa Mail“ (SPEC §6) → `.env` mit `VITE_MS_CLIENT_ID` (+ Tenant, erlaubter Nutzer, siehe `.env.example`); dieselben drei Variablen in Netlify.
2. Cloud Shell: `Set-OrganizationConfig -SendFromAliasesEnabled $true` und `Add-RecipientPermission info@aleksa.ai -AccessRights SendAs -Trustee Aleksa@spalevic-partner.com`.
3. Echter Login-Test, dann Phase 2 Kalender.
