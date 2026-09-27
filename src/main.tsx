import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MsalProvider } from '@azure/msal-react'
import { EventType, type AuthenticationResult } from '@azure/msal-browser'
import { msal } from './lib/auth'
import App from './App'
import { BackdropProvider } from './lib/background'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: true, retry: 1 } } })

msal.initialize().then(async () => {
  const result = await msal.handleRedirectPromise().catch(() => null)
  if (result?.account) msal.setActiveAccount(result.account)
  else if (!msal.getActiveAccount() && msal.getAllAccounts()[0]) msal.setActiveAccount(msal.getAllAccounts()[0])
  msal.addEventCallback(e => {
    if (e.eventType === EventType.LOGIN_SUCCESS && (e.payload as AuthenticationResult)?.account) msal.setActiveAccount((e.payload as AuthenticationResult).account)
  })
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msal}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <BackdropProvider>
              <App />
            </BackdropProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </MsalProvider>
    </React.StrictMode>,
  )
})
