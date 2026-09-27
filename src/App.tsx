import { Navigate, Route, Routes } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { Toaster } from 'sonner'
import { isAllowed } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { MailPage } from './pages/MailPage'
import { CalendarPage } from './pages/CalendarPage'
import { Shell } from './components/Shell'

export default function App() {
  const { accounts } = useMsal()
  const account = accounts[0]
  if (!account || !isAllowed(account)) return <><LoginPage blocked={!!account && !isAllowed(account)} /><Toaster position="bottom-right" /></>
  return (
    <>
      <Shell>
        <Routes>
          <Route path="/mail/:mailbox/:folder/:messageId?" element={<MailPage />} />
          <Route path="/kalender" element={<CalendarPage />} />
          <Route path="*" element={<Navigate to="/mail/aleksa/inbox" replace />} />
        </Routes>
      </Shell>
      <Toaster position="bottom-right" />
    </>
  )
}
