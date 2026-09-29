import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, CalendarDays, ChevronDown, FileText, Inbox, LogOut, Menu, Send, ShieldAlert, Trash2 } from 'lucide-react'
import { useBackdrop } from '@/lib/background'
import { BackdropPicker } from './BackdropPicker'
import { FOLDERS, MAILBOXES, PRIMARY_MAILBOX, type Mailbox } from '@/config/mailboxes'
import { folderInfo } from '@/lib/graph'
import logo from '@/assets/aleksa-brand-logo.png'

const ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox, drafts: FileText, sentitems: Send, archive: Archive, junkemail: ShieldAlert, deleteditems: Trash2,
}

const itemBase = 'flex items-center gap-2.5 h-8 rounded-[10px] px-2 text-sm text-body hover:bg-ice hover:text-asphalt transition-colors overflow-hidden whitespace-nowrap'
const itemActive = 'bg-indigo2-50 !text-indigo2-900 font-medium'

function Unread({ mb, folder }: { mb: Mailbox; folder: string }) {
  const { data } = useQuery({ queryKey: ['folder', mb.id, folder], queryFn: () => folderInfo(mb, folder), refetchInterval: 60_000 })
  const n = folder === 'drafts' ? data?.totalItemCount : data?.unreadItemCount
  if (!n) return null
  return <span className="ml-auto text-[11px] font-semibold text-steel">{n}</span>
}

// Auf-/Zugeklappt je Geraet merken; Standard: nur das Hauptpostfach offen.
const OPEN_KEY = 'mail.openMailboxes'
function readOpen(): string[] {
  try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null'); if (Array.isArray(v)) return v } catch { /* egal */ }
  return [PRIMARY_MAILBOX]
}

function MailboxSection({ mb }: { mb: Mailbox }) {
  const location = useLocation()
  const [open, setOpenState] = useState(() => readOpen().includes(mb.id))
  const setOpen = (fn: (o: boolean) => boolean) => setOpenState(o => {
    const next = fn(o)
    try { const ids = new Set(readOpen()); if (next) ids.add(mb.id); else ids.delete(mb.id); localStorage.setItem(OPEN_KEY, JSON.stringify([...ids])) } catch { /* egal */ }
    return next
  })
  // Liegt die offene Mail in einem zugeklappten Postfach, dieses aufklappen.
  const here = location.pathname.startsWith(`/mail/${mb.id}/`)
  useEffect(() => { if (here && !open) setOpen(() => true) }, [here])
  return (
    <div className="space-y-0.5">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-2 pt-1 pb-1 text-[11px] font-medium text-steel/80 hover:text-asphalt">
        <span className="truncate" title={mb.address}>{mb.label}</span>
        {!open && <span className="ml-auto mr-1.5"><Unread mb={mb} folder="inbox" /></span>}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && FOLDERS.map(f => {
        const Icon = ICONS[f.id]
        const to = `/mail/${mb.id}/${f.id}`
        const active = location.pathname.startsWith(to)
        return (
          <NavLink key={f.id} to={to} className={`${itemBase} ${active ? itemActive : ''}`}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{f.label}</span>
            {(f.id === 'inbox' || f.id === 'drafts') && <Unread mb={mb} folder={f.id} />}
          </NavLink>
        )
      })}
    </div>
  )
}

function Sidebar({ drawer = false }: { drawer?: boolean }) {
  const { instance, accounts } = useMsal()
  return (
    <aside className={`glass-surface relative z-20 flex w-[232px] shrink-0 flex-col overflow-hidden bg-white ${drawer ? 'h-full pt-safe pb-safe' : 'm-2 mr-0 rounded-2xl border border-white shadow-panel'}`}>
      <div className="flex items-center h-14 px-3 gap-2">
        <img src={logo} alt="" className="w-7 h-7 object-contain shrink-0" />
        <span className="font-bold text-[15px] text-ink tracking-tight">Aleksa Mail</span>
      </div>
      <div className="flex-1 overflow-y-auto aw-scroll px-2 pb-2 space-y-4">
        <NavLink to="/kalender" className={({ isActive }) => `${itemBase} ${isActive ? itemActive : ''}`}>
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span>Kalender</span>
        </NavLink>
        {MAILBOXES.map(mb => <MailboxSection key={mb.id} mb={mb} />)}
      </div>
      <div className="border-t border-line p-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{accounts[0]?.name}</p>
            <p className="truncate text-[11px] text-steel">{accounts[0]?.username}</p>
          </div>
          <BackdropPicker />
          <button onClick={() => instance.logoutRedirect()} title="Abmelden" className="p-1.5 rounded-md text-steel hover:bg-ice hover:text-asphalt">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

/** awork-Rahmen wie im PM-Tool: hellblauer Canvas, schwebende weisse Leiste, weisses Inhalts-Panel. */
export function Shell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { css, glass } = useBackdrop()
  return (
    <div className="h-dvh w-full flex bg-sky overflow-hidden" data-glass={glass ? '' : undefined} style={css ? { background: css } : undefined}>
      <div className="hidden md:flex shrink-0"><Sidebar /></div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-asphalt/30 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div key={location.pathname} initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 360, damping: 34 }} className="fixed bottom-0 left-0 top-0 z-50 flex md:hidden" onClick={e => { if ((e.target as HTMLElement).closest('a')) setMobileOpen(false) }}>
              <Sidebar drawer />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className="glass-surface flex-1 flex flex-col min-w-0 overflow-hidden bg-white sm:m-2 sm:rounded-2xl sm:shadow-panel sm:border sm:border-white">
        <button onClick={() => setMobileOpen(true)} className="md:hidden absolute left-2 top-2 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg text-steel hover:bg-ice" aria-label="Menü">
          <Menu className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
