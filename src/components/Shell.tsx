import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, CalendarDays, ChevronRight, Clock, FileText, Inbox, Layers, LogOut, Menu, Send, ShieldAlert, Trash2 } from 'lucide-react'
import { useBackdrop } from '@/lib/background'
import { BackdropPicker } from './BackdropPicker'
import { FOLDERS, INBOX_BOXES, MAILBOXES, PRIMARY_MAILBOX, type Mailbox } from '@/config/mailboxes'
import { folderInfo } from '@/lib/graph'
import logo from '@/assets/aleksa-brand-logo.png'

const ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox, drafts: FileText, outbox: Clock, sentitems: Send, archive: Archive, junkemail: ShieldAlert, deleteditems: Trash2,
}

const itemBase = 'relative flex items-center gap-2.5 h-8 rounded-[10px] px-2.5 text-[13px] text-asphalt/75 hover:text-asphalt transition-colors overflow-hidden whitespace-nowrap'

/** Aktive Zeile: eine Glas-Kapsel, die zwischen den Eintraegen gleitet (layoutId). */
function ActivePill() {
  return <motion.span layoutId="nav-pill" className="lg-selected absolute inset-0 -z-10 rounded-[10px]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
}

function useUnread(mb: Mailbox, folder: string) {
  const { data } = useQuery({ queryKey: ['folder', mb.id, folder], queryFn: () => folderInfo(mb, folder), refetchInterval: 60_000 })
  return folder === 'drafts' || folder === 'outbox' ? data?.totalItemCount : data?.unreadItemCount
}

function Count({ n, strong }: { n?: number; strong?: boolean }) {
  if (!n) return null
  return <span className={`ml-auto min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums ${strong ? 'bg-primary text-white' : 'text-steel'}`}>{n > 999 ? '999+' : n}</span>
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
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try { const ids = new Set(readOpen()); if (next) ids.add(mb.id); else ids.delete(mb.id); localStorage.setItem(OPEN_KEY, JSON.stringify([...ids])) } catch { /* egal */ }
  }
  // Liegt die offene Mail in einem zugeklappten Postfach, dieses aufklappen.
  const here = location.pathname.startsWith(`/mail/${mb.id}/`)
  useEffect(() => { if (here && !open) setOpen(true) }, [here])
  const unread = useUnread(mb, 'inbox')

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="group flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left hover:bg-white/40 transition-colors">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/80" style={{ background: mb.color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{mb.label}</span>
          <span className="block truncate text-[11px] text-steel/90">{mb.sub}</span>
        </span>
        {!open && <Count n={unread} />}
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-steel transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="overflow-hidden">
            <div className="ml-[13px] mt-0.5 space-y-0.5 border-l border-asphalt/[0.07] pl-2 pb-1.5">
              {FOLDERS.map(f => <FolderLink key={f.id} mb={mb} folder={f.id} label={f.label} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FolderLink({ mb, folder, label }: { mb: Mailbox; folder: string; label: string }) {
  const location = useLocation()
  const Icon = ICONS[folder]
  const to = `/mail/${mb.id}/${folder}`
  const active = location.pathname.startsWith(to)
  const n = useUnread(mb, folder)
  return (
    <NavLink to={to} className={`${itemBase} ${active ? '!text-ink font-medium' : ''} isolate`}>
      {active && <ActivePill />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-indigo2-700' : ''}`} />
      <span className="truncate">{label}</span>
      {(folder === 'inbox' || folder === 'drafts' || folder === 'outbox') && <Count n={n} strong={folder === 'inbox' && active} />}
    </NavLink>
  )
}

function TopLink({ to, icon: Icon, label, children }: { to: string; icon: typeof Inbox; label: string; children?: ReactNode }) {
  const location = useLocation()
  const active = location.pathname.startsWith(to)
  return (
    <NavLink to={to} className={`${itemBase} h-9 isolate ${active ? '!text-ink font-medium' : ''}`}>
      {active && <ActivePill />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-indigo2-700' : ''}`} />
      <span>{label}</span>
      {children}
    </NavLink>
  )
}

function AllUnread() {
  const results = useQueries({ queries: INBOX_BOXES.map(mb => ({ queryKey: ['folder', mb.id, 'inbox'], queryFn: () => folderInfo(mb, 'inbox'), refetchInterval: 60_000 })) })
  return <Count n={results.reduce((a, r) => a + (r.data?.unreadItemCount ?? 0), 0)} />
}

function Sidebar({ drawer = false }: { drawer?: boolean }) {
  const { instance, accounts } = useMsal()
  return (
    <aside className={`glass-surface relative z-20 flex w-[256px] shrink-0 flex-col overflow-hidden ${drawer ? 'h-full pt-safe pb-safe rounded-r-[24px]' : 'm-2.5 mr-0 rounded-[24px]'}`}>
      <div className="flex h-16 items-center gap-2.5 px-4">
        <img src={logo} alt="" className="h-7 w-7 shrink-0 object-contain" />
        <span className="text-[15px] font-bold tracking-tight text-ink">Aleksa Mail</span>
      </div>
      <nav className="aw-scroll smooth-scroll flex-1 space-y-4 overflow-y-auto px-2.5 pb-3">
        <div className="space-y-0.5">
          <TopLink to="/mail/alle/inbox" icon={Layers} label="Alle Posteingänge"><AllUnread /></TopLink>
          <TopLink to="/kalender" icon={CalendarDays} label="Kalender" />
        </div>
        <div className="space-y-1">
          <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-steel/70">Postfächer</p>
          {MAILBOXES.map(mb => <MailboxSection key={mb.id} mb={mb} />)}
        </div>
      </nav>
      <div className="m-2.5 mt-0 flex items-center gap-2 rounded-[16px] bg-white/35 px-2.5 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo2-500 to-indigo2-900 text-[12px] font-bold text-white">
          {(accounts[0]?.name ?? 'A').slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{accounts[0]?.name}</p>
          <p className="truncate text-[11px] text-steel">{accounts[0]?.username}</p>
        </div>
        <BackdropPicker />
        <button onClick={() => instance.logoutRedirect()} title="Abmelden" className="rounded-md p-1.5 text-steel hover:bg-white/60 hover:text-asphalt">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}

const MENU_EVENT = 'mail:open-menu'
/** Mobiles Menue von einer Seite aus oeffnen (Knopf in deren Kopfleiste). */
export const openMenu = () => window.dispatchEvent(new Event(MENU_EVENT))

/** Rahmen: Hintergrund, schwebende Glas-Leiste links, Glas-Panel fuer den Inhalt. */
export function Shell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { css } = useBackdrop()
  const onMail = location.pathname.startsWith('/mail/')
  useEffect(() => {
    const open = () => setMobileOpen(true)
    window.addEventListener(MENU_EVENT, open)
    return () => window.removeEventListener(MENU_EVENT, open)
  }, [])
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-sky" data-glass="" style={css ? { background: css } : undefined}>
      <div className="hidden shrink-0 md:flex"><Sidebar /></div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-asphalt/20 backdrop-blur-[2px] md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div key={location.pathname} initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 360, damping: 34 }} className="fixed bottom-0 left-0 top-0 z-50 flex md:hidden" onClick={e => { if ((e.target as HTMLElement).closest('a')) setMobileOpen(false) }}>
              <Sidebar drawer />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className="glass-surface relative flex min-w-0 flex-1 flex-col overflow-hidden sm:m-2.5 sm:rounded-[24px]">
        {/* Mail-Seiten tragen den Menueknopf in ihrer eigenen Glas-Kopfleiste (openMenu), sonst schwebt er hier. */}
        {!onMail && (
          <button onClick={() => setMobileOpen(true)} className="lg lg-pill absolute left-2 top-2.5 z-30 inline-flex h-10 w-10 items-center justify-center text-asphalt md:hidden" aria-label="Menü">
            <Menu className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
