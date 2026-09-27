import { useMsal } from '@azure/msal-react'
import { Button } from '@/components/ui/button'
import { CONFIGURED, SCOPES } from '@/lib/auth'
import logo from '@/assets/aleksa-brand-logo.png'

export function LoginPage({ blocked }: { blocked: boolean }) {
  const { instance } = useMsal()
  return (
    <div className="min-h-dvh w-full bg-sky flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-white shadow-panel p-8 text-center">
        <img src={logo} alt="" className="w-10 h-10 mx-auto mb-4 object-contain" />
        <h1 className="text-2xl font-bold text-ink">Aleksa Mail</h1>
        <p className="mt-1 text-sm text-body">Mail und Kalender aus Microsoft 365.</p>
        {blocked ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-destructive">Dieses Konto hat keinen Zugang.</p>
            <Button variant="outline" className="w-full" onClick={() => instance.logoutRedirect()}>Abmelden</Button>
          </div>
        ) : !CONFIGURED ? (
          <p className="mt-6 text-sm text-body">Microsoft-Anmeldung ist noch nicht eingerichtet (VITE_MS_CLIENT_ID fehlt).</p>
        ) : (
          <Button className="mt-6 w-full" onClick={() => instance.loginRedirect({ scopes: SCOPES, prompt: 'select_account' })}>
            Mit Microsoft anmelden
          </Button>
        )}
      </div>
    </div>
  )
}
