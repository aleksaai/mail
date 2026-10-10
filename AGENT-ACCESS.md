# April’s native app access — 11 October 2026

## What is live

`/agent` is the read-only agent workspace used by April’s Browser Use cloud profile in Team House. The normal owner sign-in and app remain unchanged. April’s own shared mailbox `april@aleksa.ai`, with inbox, sent messages and plain-text reading. No separate Microsoft user was created; her shared mailbox has no independent password.

Source: `src/pages/AgentWorkspace.tsx`, scoped `AgentWorkspace.css`, `src/lib/agent-access.ts`, `/agents/april.jpg`, and the route selection in `App.tsx`. Glass styles remain local to this view.

## Authentication and boundaries

The trusted Team House gateway issues a 90-second, single-use fragment ticket tied to an active April/browser/profile/app grant. The app immediately removes the fragment and exchanges it for a bounded app token. Only hashes are stored server-side in private `studio_app_sessions` (team Supabase, migration `20261010225804_studio_native_apps.sql`). The token lives in this dedicated cloud browser profile and expires with its browser lease; closing/stopping the lease or revoking the grant invalidates access on the server. It is not a Microsoft token, owner Supabase token, gateway token or service-role key.

API: `https://aleksa-ai-team-production.up.railway.app/api/agent-apps/mail/`. Exact app-origin CORS, bearer reads, no-store responses. No public write/send endpoint. Existing agent tools and their action approvals still handle changes. This is not the complete owner UI or a new human account.

## Use and renewal

Team House → April → Computer → **Open app**. This automatically renews app access when a new browser starts. A plain `/agent` visit without a valid grant shows a connection instruction. Agents select the existing saved connection through `browser_use_login`; no manual Microsoft or Supabase login is required.

## Verification

- Published first app code: 3e7e918; gateway runtime e67bdb76, successful Railway deployment 7a04062f-48b9-485e-a10d-6aa6119d6a76.
- Real April notebook turn `b2e7b859-5b25-4668-989c-650e662f7cd4` opened both cloud profiles and confirmed April, `april@aleksa.ai`, and Aleksa Universe (10/45 tasks). No mail sent, project changed or invitation issued.
- Production build / targeted ESLint passed. Projects also has a type-only `Uint8Array<ArrayBuffer>[]` correction in `chatPdf.ts` for the existing Blob typing error.
- Shared gateway tests cover one-time exchange, wrong app, expired/stopped/revoked access, mailbox scope, project scope, forbidden writes and owner connection route responses.

Recovery and full backend details: team repo `ai-office/APRIL-NATIVE-APPS.md`. Never put bootstrap fragments or tokens in logs, screenshots, docs or chat.
