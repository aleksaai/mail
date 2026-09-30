import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser'

export const SCOPES = [
  'User.Read',
  'Mail.ReadWrite',
  'Mail.ReadWrite.Shared',
  'Mail.Send',
  'Mail.Send.Shared',
  'Calendars.ReadWrite',
  // info@aleksa.ai ist der Hauptkalender (Aleksa 30.09.2026) — freigegebenes Postfach.
  'Calendars.ReadWrite.Shared',
  'MailboxSettings.Read',
]

export const CONFIGURED = Boolean(import.meta.env.VITE_MS_CLIENT_ID && import.meta.env.VITE_MS_TENANT_ID)

export const msal = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_MS_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MS_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'localStorage' },
})

/** Nur Aleksa. Ein anderes Konto aus dem Mandanten bekommt die App nicht zu sehen. */
export function isAllowed(account: AccountInfo | null | undefined): boolean {
  const allowed = (import.meta.env.VITE_ALLOWED_USER || '').toLowerCase()
  return !!account && !!allowed && account.username.toLowerCase() === allowed
}

export async function getToken(): Promise<string> {
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0]
  if (!account) throw new Error('Nicht angemeldet')
  try {
    return (await msal.acquireTokenSilent({ scopes: SCOPES, account })).accessToken
  } catch {
    await msal.acquireTokenRedirect({ scopes: SCOPES, account })
    throw new Error('Anmeldung wird erneuert')
  }
}
