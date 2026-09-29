import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isToday, isThisYear, isYesterday } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { Archive, ArrowLeft, Menu, FileDown, Forward, Image, Mail, MailOpen, Paperclip, PenSquare, Reply, ReplyAll, Search, Trash2, X } from 'lucide-react'
import { FOLDERS, INBOX_BOXES, PRIMARY_MAILBOX, mailboxById, type Mailbox } from '@/config/mailboxes'
import { attachmentBlob, getMessage, inlineImages, listAttachments, listMessages, moveMessage, updateMessage, type MessageSummary } from '@/lib/graph'
import { HtmlFrame } from '@/components/mail/HtmlFrame'
import { Compose, type ComposeMode } from '@/components/mail/Compose'
import { Skeleton } from '@/components/ui/skeleton'
import { saveMessageAsPdf } from '@/lib/pdf'
import { useLiquidGlass } from '@/lib/liquid-glass'
import { openMenu } from '@/components/Shell'

/** "Alle Posteingänge": eigener Pseudo-Bereich, der die Posteingaenge von INBOX_BOXES zusammenfuehrt. */
const ALL = 'alle'
type Item = { mb: Mailbox; m: MessageSummary }
/** Nachricht in der URL: im Sammel-Posteingang mit Postfach davor (Graph-IDs enthalten kein "~"). */
const routeId = (it: Item, all: boolean) => encodeURIComponent(all ? `${it.mb.id}~${it.m.id}` : it.m.id)
const parseRouteId = (raw: string, all: boolean, fallback?: Mailbox) => {
  const v = decodeURIComponent(raw)
  if (!all) return { mb: fallback, id: v }
  const i = v.indexOf('~')
  return { mb: mailboxById(v.slice(0, i)), id: v.slice(i + 1) }
}

const when = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isToday(d) ? format(d, 'HH:mm') : isYesterday(d) ? 'Gestern' : isThisYear(d) ? format(d, 'd. MMM', { locale: de }) : format(d, 'dd.MM.yy')
}
const who = (m: MessageSummary, sent: boolean) =>
  sent ? (m.toRecipients?.map(r => r.emailAddress.name || r.emailAddress.address).join(', ') || '(kein Empfänger)')
       : (m.from?.emailAddress.name || m.from?.emailAddress.address || '(unbekannt)')
const time = (m: MessageSummary) => new Date(m.receivedDateTime || m.sentDateTime || 0).getTime()

// Avatar: Initialen + ruhige Farbe je Absender (immer dieselbe fuer dieselbe Adresse).
const AVATAR = ['#8b79f0', '#3b82f6', '#0ea5a4', '#f59e0b', '#ec4899', '#10b981', '#6366f1', '#ef4444', '#14b8a6', '#a855f7']
function Avatar({ name, address, size = 36 }: { name: string; address?: string; size?: number }) {
  const key = (address || name).toLowerCase()
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const parts = name.replace(/["'<>()]/g, '').trim().split(/[\s@._-]+/).filter(Boolean)
  const initials = ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
  const c = AVATAR[h % AVATAR.length]
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)]"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg, ${c}, ${c}cc)` }}>{initials}</span>
  )
}

export function MailPage() {
  const { mailbox = PRIMARY_MAILBOX, folder = 'inbox', messageId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const all = mailbox === ALL
  const mb = all ? undefined : mailboxById(mailbox)
  const boxes = useMemo(() => (all ? INBOX_BOXES : mb ? [mb] : []), [all, mb])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [compose, setCompose] = useState<{ mb: Mailbox; mode: ComposeMode } | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const headerGlass = useLiquidGlass({ radius: 20 })
  const folderLabel = all ? 'Alle Posteingänge' : FOLDERS.find(f => f.id === folder)?.label ?? folder
  const sentView = folder === 'sentitems' || folder === 'drafts'

  useEffect(() => { setSearch(''); setQuery(''); scroller.current?.scrollTo({ top: 0 }) }, [mailbox, folder])

  // Jede Seite holt aus jedem beteiligten Postfach die naechsten Mails; `null` = dort ist nichts mehr.
  type Cursor = Record<string, string | null | undefined>
  const list = useInfiniteQuery({
    queryKey: ['messages', mailbox, folder, query],
    queryFn: async ({ pageParam }) => {
      const cur = pageParam as Cursor
      const res = await Promise.all(boxes.map(async b => {
        if (cur[b.id] === null) return { b, value: [] as MessageSummary[], next: null }
        const r = await listMessages(b, all ? 'inbox' : folder, { next: cur[b.id] ?? undefined, search: query || undefined })
        return { b, value: r.value, next: r['@odata.nextLink'] ?? null }
      }))
      return { items: res.flatMap(r => r.value.map(m => ({ mb: r.b, m }))), next: Object.fromEntries(res.map(r => [r.b.id, r.next])) as Cursor }
    },
    initialPageParam: {} as Cursor,
    getNextPageParam: last => (Object.values(last.next).some(Boolean) ? last.next : undefined),
    enabled: boxes.length > 0,
    refetchInterval: 30_000,
  })
  const items = useMemo(() => {
    const flat = list.data?.pages.flatMap(p => p.items) ?? []
    return all ? [...flat].sort((a, b) => time(b.m) - time(a.m)) : flat
  }, [list.data, all])

  const open = (it: Item) => navigate(`/mail/${mailbox}/${folder}/${routeId(it, all)}`)
  const back = () => navigate(`/mail/${mailbox}/${folder}`)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['messages'] }); qc.invalidateQueries({ queryKey: ['folder'] }) }

  const act = async (fn: () => Promise<unknown>, ok: string, leave = true) => {
    try { await fn(); toast.success(ok); refresh(); if (leave) back() }
    catch (e) { toast.error((e as Error).message) }
  }

  const current = messageId ? parseRouteId(messageId, all, mb) : null
  const composeBox = mb?.from.length ? mb : mailboxById(PRIMARY_MAILBOX)!

  // Tastatur: j/k weiter/zurueck, c neue Mail, / suchen, Esc schliessen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (compose || t.closest('input,textarea,select,[contenteditable]')) return
      const idx = items.findIndex(it => it.m.id === current?.id)
      if (e.key === 'j' && items[idx + 1]) open(items[idx + 1])
      if (e.key === 'k' && idx > 0) open(items[idx - 1])
      if (e.key === '/') { e.preventDefault(); document.getElementById('mail-search')?.focus() }
      if (e.key === 'c') setCompose({ mb: composeBox, mode: { kind: 'new' } })
      if (e.key === 'Escape' && messageId) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!all && !mb) return <div className="p-8 text-sm text-body">Unbekanntes Postfach.</div>

  return (
    <div className="flex min-h-0 flex-1">
      {/* Liste: laeuft unter der schwebenden Glas-Kopfleiste durch */}
      <section className={`${messageId ? 'hidden lg:flex' : 'flex'} relative min-h-0 w-full shrink-0 flex-col lg:w-[400px] lg:border-r lg:border-white/50`}>
        <header className={`absolute inset-x-0 top-0 z-20 px-3 pt-2.5 transition-all duration-300 ${scrolled ? 'pb-2' : 'pb-3'}`}>
          <div ref={headerGlass} className={`lg flex items-center gap-2 rounded-[20px] pl-1.5 pr-2 md:pl-4 transition-all duration-300 ${scrolled ? 'h-12' : 'h-[60px]'}`}>
            <button onClick={openMenu} aria-label="Menü" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-asphalt hover:bg-white/60 md:hidden"><Menu className="h-[18px] w-[18px]" /></button>
            <div className="min-w-0 flex-1">
              <p className={`truncate font-bold tracking-tight text-ink transition-all duration-300 ${scrolled ? 'text-[15px]' : 'text-[17px]'}`}>{folderLabel}</p>
              {!scrolled && <p className="truncate text-[11px] text-steel">{all ? `${boxes.length} Postfächer` : mb!.address}</p>}
            </div>
            <form className="lg-well flex h-9 w-[46%] max-w-[200px] items-center gap-1.5 rounded-full px-3 transition-colors"
              onSubmit={e => { e.preventDefault(); setQuery(search.trim()) }}>
              <Search className="h-3.5 w-3.5 shrink-0 text-steel" />
              <input id="mail-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-steel/70" />
              {query && <button type="button" onClick={() => { setSearch(''); setQuery('') }} className="text-steel hover:text-asphalt"><X className="h-3.5 w-3.5" /></button>}
            </form>
            {(all || mb!.from.length > 0) && (
              <button onClick={() => setCompose({ mb: composeBox, mode: { kind: 'new' } })} title="Neue Mail (c)"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-indigo2-900 to-indigo2-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_16px_-6px_rgba(122,102,236,.7)] transition-transform hover:scale-105 active:scale-95">
                <PenSquare className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        <div ref={scroller} onScroll={e => setScrolled(e.currentTarget.scrollTop > 12)} className="aw-scroll smooth-scroll fade-edges flex-1 overflow-y-auto px-2 pb-6 pt-[84px]">
          {mb?.hint && <p className="mx-2 mb-2 rounded-[14px] bg-white/40 px-3 py-2 text-[12px] text-steel">{mb.hint}</p>}
          {list.isLoading && Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-3 py-3"><Skeleton className="h-9 w-9 rounded-full bg-white/60" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3 bg-white/60" /><Skeleton className="h-3 w-4/5 bg-white/60" /></div></div>
          ))}
          {list.isError && <p className="p-4 text-sm text-destructive">{(list.error as Error).message}</p>}
          {!list.isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-body">
              <Mail className="h-6 w-6 text-light-steel" />{query ? 'Nichts gefunden.' : 'Alles erledigt. Keine Nachrichten.'}
            </div>
          )}
          {items.map((it, i) => (
            <Row key={it.mb.id + it.m.id} it={it} index={i} all={all} sentView={sentView} active={it.m.id === current?.id}
              onOpen={() => open(it)}
              onArchive={folder !== 'archive' ? () => act(() => moveMessage(it.mb, it.m.id, 'archive'), 'Archiviert', it.m.id === current?.id) : undefined}
              onDelete={folder !== 'deleteditems' ? () => act(() => moveMessage(it.mb, it.m.id, 'deleteditems'), 'In den Papierkorb verschoben', it.m.id === current?.id) : undefined}
              onToggleRead={() => act(() => updateMessage(it.mb, it.m.id, { isRead: !it.m.isRead }), it.m.isRead ? 'Als ungelesen markiert' : 'Als gelesen markiert', false)} />
          ))}
          {list.hasNextPage && (
            <div className="p-3 text-center">
              <button onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage} className="lg lg-pill px-4 py-1.5 text-[12px] font-medium text-asphalt">
                {list.isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className={`${messageId ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
        {current?.mb
          ? <Reader key={messageId} mb={current.mb} folder={folder} id={current.id} showBox={all} onAct={act}
              onCompose={(mode) => setCompose({ mb: current.mb!.from.length ? current.mb! : composeBox, mode })} onBack={back} />
          : <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-body">
              <span className="lg lg-pill inline-flex h-14 w-14 items-center justify-center"><Mail className="h-5 w-5 text-steel" /></span>
              Nachricht auswählen
              <span className="text-[11px] text-steel/80">j / k blättern · c neue Mail · / suchen</span>
            </div>}
      </section>

      {compose && <Compose mb={compose.mb} mode={compose.mode} open onClose={() => setCompose(null)} onSent={refresh} />}
    </div>
  )
}

function Row({ it, index, all, sentView, active, onOpen, onArchive, onDelete, onToggleRead }: {
  it: Item; index: number; all: boolean; sentView: boolean; active: boolean
  onOpen: () => void; onArchive?: () => void; onDelete?: () => void; onToggleRead: () => void
}) {
  const { m, mb } = it
  const unread = !m.isRead && !sentView
  const name = who(m, sentView)
  const quick = 'inline-flex h-7 w-7 items-center justify-center rounded-full text-steel hover:bg-white hover:text-asphalt transition-colors'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: Math.min(index, 14) * 0.018, ease: [0.32, 0.72, 0, 1] }}
      className={`group relative mb-0.5 rounded-[16px] transition-[background,box-shadow] duration-200 ${active ? 'lg-selected' : 'hover:bg-white/45'}`}>
      <button onClick={onOpen} className="flex w-full gap-3 px-3 py-2.5 text-left">
        <span className="relative flex h-9 w-9 shrink-0 self-start">
          <Avatar name={name} address={sentView ? m.toRecipients?.[0]?.emailAddress.address : m.from?.emailAddress.address} />
          {all && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white" style={{ background: mb.color }} title={mb.label} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-[13.5px] ${unread ? 'font-semibold text-ink' : 'text-asphalt'}`}>{name}</span>
            {m.hasAttachments && <Paperclip className="h-3 w-3 shrink-0 text-steel" />}
            <span className={`ml-auto shrink-0 text-[11px] tabular-nums group-hover:opacity-0 transition-opacity ${unread ? 'font-semibold text-indigo2-700' : 'text-steel'}`}>{when(m.receivedDateTime || m.sentDateTime)}</span>
          </span>
          <span className={`mt-0.5 block truncate text-[13px] ${unread ? 'font-medium text-ink' : 'text-asphalt/85'}`}>{m.subject || '(kein Betreff)'}</span>
          <span className="mt-0.5 block truncate text-[12px] text-body">{m.bodyPreview}</span>
        </span>
      </button>
      {unread && <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(139,121,240,.8)]" />}
      {/* Schnellaktionen beim Drueberfahren, wie in Outlook */}
      <div className="lg lg-pill pointer-events-none absolute right-2 top-2 flex items-center gap-0.5 px-1 py-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:none)]:hidden">
        <button className={quick} title={m.isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren'} onClick={onToggleRead}><MailOpen className="h-3.5 w-3.5" /></button>
        {onArchive && <button className={quick} title="Archivieren" onClick={onArchive}><Archive className="h-3.5 w-3.5" /></button>}
        {onDelete && <button className={`${quick} hover:!text-destructive`} title="Löschen" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
    </motion.div>
  )
}

function Reader({ mb, folder, id, showBox, onAct, onCompose, onBack }: {
  mb: Mailbox; folder: string; id: string; showBox: boolean
  onAct: (fn: () => Promise<unknown>, ok: string, leave?: boolean) => void
  onCompose: (m: ComposeMode) => void; onBack: () => void
}) {
  const qc = useQueryClient()
  const [remote, setRemote] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const bar = useLiquidGlass()
  const msg = useQuery({ queryKey: ['message', mb.id, id], queryFn: () => getMessage(mb, id) })
  const atts = useQuery({ queryKey: ['atts', mb.id, id], queryFn: () => listAttachments(mb, id), enabled: !!msg.data?.hasAttachments })
  const inline = useQuery({ queryKey: ['inline', mb.id, id], queryFn: () => inlineImages(mb, id), enabled: !!msg.data && /cid:/i.test(msg.data.body.content) })

  useEffect(() => {
    if (msg.data && !msg.data.isRead) updateMessage(mb, id, { isRead: true }).then(() => {
      qc.invalidateQueries({ queryKey: ['messages'] }); qc.invalidateQueries({ queryKey: ['folder', mb.id] })
    }).catch(() => {})
  }, [msg.data?.id])

  const download = async (attId: string, name: string) => {
    try {
      const blob = await attachmentBlob(mb, id, attId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) { toast.error((e as Error).message) }
  }

  if (msg.isLoading) return <div className="space-y-3 p-8 pt-24"><Skeleton className="h-6 w-2/3 bg-white/60" /><Skeleton className="h-3 w-1/3 bg-white/60" /><Skeleton className="h-64 w-full rounded-[18px] bg-white/60" /></div>
  if (msg.isError || !msg.data) return <p className="p-6 text-sm text-destructive">{(msg.error as Error)?.message ?? 'Nicht gefunden'}</p>
  const m = msg.data
  const canSend = mb.from.length > 0
  const hasRemote = /<img[^>]+src=["']https?:/i.test(m.body.content)
  const html = m.body.contentType === 'html' ? m.body.content : `<pre>${m.body.content.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`
  const btn = 'inline-flex h-8 w-8 items-center justify-center rounded-full text-asphalt/70 hover:bg-white/80 hover:text-ink transition-colors disabled:opacity-40'
  const files = atts.data?.filter(a => !a.isInline) ?? []

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Schwebende Glas-Kapsel mit den Aktionen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3 pt-2.5">
        <div ref={bar} className={`lg lg-pill pointer-events-auto flex items-center gap-0.5 px-1.5 transition-all duration-300 ${scrolled ? 'h-10' : 'h-11'}`}>
          <button className={`${btn} lg:hidden`} onClick={onBack} title="Zurück"><ArrowLeft className="h-4 w-4" /></button>
          {canSend && <>
            <button className={btn} title="Antworten" onClick={() => onCompose({ kind: 'reply', message: m })}><Reply className="h-4 w-4" /></button>
            <button className={btn} title="Allen antworten" onClick={() => onCompose({ kind: 'replyAll', message: m })}><ReplyAll className="h-4 w-4" /></button>
            <button className={btn} title="Weiterleiten" onClick={() => onCompose({ kind: 'forward', message: m })}><Forward className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-asphalt/10" />
          </>}
          {folder !== 'archive' && <button className={btn} title="Archivieren" onClick={() => onAct(() => moveMessage(mb, id, 'archive'), 'Archiviert')}><Archive className="h-4 w-4" /></button>}
          {folder !== 'deleteditems' && <button className={`${btn} hover:!text-destructive`} title="Löschen" onClick={() => onAct(() => moveMessage(mb, id, 'deleteditems'), 'In den Papierkorb verschoben')}><Trash2 className="h-4 w-4" /></button>}
          <button className={btn} title="Als ungelesen markieren" onClick={() => onAct(() => updateMessage(mb, id, { isRead: false }), 'Als ungelesen markiert')}><MailOpen className="h-4 w-4" /></button>
          <span className="mx-1 h-5 w-px bg-asphalt/10" />
          <button className={btn} title="Als PDF speichern" disabled={inline.isLoading || atts.isLoading}
            onClick={() => saveMessageAsPdf(m, html, { inline: inline.data ?? {}, allowRemote: remote, attachments: atts.data ?? [] })}><FileDown className="h-4 w-4" /></button>
        </div>
      </div>

      <div onScroll={e => setScrolled(e.currentTarget.scrollTop > 12)} className="aw-scroll smooth-scroll fade-top flex-1 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="mx-auto max-w-[860px] px-4 pb-10 pt-20 sm:px-8">
          <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">{m.subject || '(kein Betreff)'}</h2>
          <div className="mt-4 flex items-start gap-3">
            <Avatar name={m.from?.emailAddress.name || m.from?.emailAddress.address || '?'} address={m.from?.emailAddress.address} size={42} />
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="truncate"><span className="font-semibold text-ink">{m.from?.emailAddress.name || m.from?.emailAddress.address}</span> <span className="text-steel">{m.from?.emailAddress.address}</span></p>
              <p className="truncate text-steel">An {m.toRecipients?.map(r => r.emailAddress.name || r.emailAddress.address).join(', ')}{m.ccRecipients?.length ? ` · Cc ${m.ccRecipients.map(r => r.emailAddress.name || r.emailAddress.address).join(', ')}` : ''}</p>
            </div>
            <div className="shrink-0 text-right text-[12px] text-steel">
              {m.receivedDateTime && <p>{format(new Date(m.receivedDateTime), "EEE, d. MMM yyyy · HH:mm", { locale: de })}</p>}
              {showBox && <p className="mt-0.5 inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: mb.color }} />{mb.label}</p>}
            </div>
          </div>
          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.map(a => (
                <button key={a.id} onClick={() => download(a.id, a.name)} className="lg inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[13px] text-asphalt transition-transform hover:-translate-y-px">
                  <Paperclip className="h-3.5 w-3.5 text-steel" /><span className="max-w-[220px] truncate">{a.name}</span><span className="text-[11px] text-steel">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                </button>
              ))}
            </div>
          )}
          {hasRemote && !remote && (
            <button onClick={() => setRemote(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1 text-[12px] text-steel hover:text-asphalt">
              <Image className="h-3.5 w-3.5" />Externe Bilder blockiert, anzeigen
            </button>
          )}
          <div className="mail-card mt-5">
            <HtmlFrame html={html} inline={inline.data ?? {}} allowRemote={remote} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
