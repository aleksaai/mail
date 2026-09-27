# mail — eigene Mail- und Kalender-Oberfläche auf Microsoft 365

Nur für Aleksa. Microsoft 365 ist der Unterbau (Mandant SPALEVIC & PARTNER HOLDING), diese App ersetzt die Outlook-Oberfläche. Master-Index aller Projekte: `claude-team/ai-team/status/PROJECTS.md`.

- **Spec:** `SPEC.md` (Umfang, Architektur, Phasen, Einrichtung)
- **Stand:** `HANDOFF.md`
- **Keine Mail-Inhalte in eigener Datenbank** — alles direkt aus Microsoft Graph mit Aleksas delegierten Rechten.
- April kommt über den Agent-Gateway (`claude-team/gateway`), nicht über ein eigenes Modell-Setup.
- Microsoft-Lehren (Zeitzonen, Aliase, freigegebene Postfächer, RBAC-Verzug): `claude-team/ai-team/agents/marcus-engineer/knowledge.md` § „Microsoft-365-Umzug — Lehren“.
