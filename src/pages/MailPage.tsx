import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isToday, isThisYear } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'
import { Archive, ArrowLeft, FileDown, Forward, Image, Mail, MailOpen, Paperclip, PenSquare, Reply, ReplyAll, Search, Trash2, X } from 'lucide-react'
import { FOLDERS, mailboxById } from '@/config/mailboxes'
import { attachmentBlob, getMessage, inlineImages, listAttachments, listMessages, moveMessage, updateMessage, type MessageSummary } from '@/lib/graph'
import { HtmlFrame } from '@/components/mail/HtmlFrame'
import { saveMessageAsPdf } from '@/lib/pdf'
import { Compose, type ComposeMode } from '@/components/mail/Compose'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const when = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isToday(d) ? format(d, 'HH:mm') : isThisYear(d) ? format(d, 'd. MMM', { locale: de }) : format(d, 'dd.MM.yy')
}
const who = (m: MessageSummary, sent: boolean) =>
  sent ? (m.toRecipients?.map(r => r.emailAddress.name || r.emailAddress.address).join(', ') || '(kein Empfänger)')
       : (m.from?.emailAddress.name || m.from?.emailAddress.address || '(unbekannt)')

export function MailPage() {
  const { mailbox = 'aleksa', folder = 'inbox', messageId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mb = mailboxById(mailbox)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [compose, setCompose] = useState<ComposeMode | null>(null)
  const folderLabel = FOLDERS.find(f => f.id === folder)?.label ?? folder
  const sentView = folder === 'sentitems' || folder === 'drafts'

  useEffect(() => { setSearch(''); setQuery('') }, [mailbox, folder])

  const list = useInfiniteQuery({
    queryKey: ['messages', mailbox, folder, query],
    queryFn: ({ pageParam }) => listMessages(mb!, folder, { next: pageParam as string | undefined, search: query || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last['@odata.nextLink'],
    enabled: !!mb,
    refetchInterval: 30_000,
  })
  const messages = useMemo(() => list.data?.pages.flatMap(p => p.value) ?? [], [list.data])

  const open = (m: MessageSummary) => navigate(`/mail/${mailbox}/${folder}/${encodeURIComponent(m.id)}`)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['messages', mailbox] }); qc.invalidateQueries({ queryKey: ['folder', mailbox] }) }

  const act = async (fn: () => Promise<unknown>, ok: string, leave = true) => {
    try { await fn(); toast.success(ok); refresh(); if (leave) navigate(`/mail/${mailbox}/${folder}`) }
    catch (e) { toast.error((e as Error).message) }
  }

  // Tastatur: j/k weiter/zurueck, c neue Mail, / suchen, Esc schliessen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (compose || t.closest('input,textarea,[contenteditable]')) return
      const idx = messages.findIndex(m => m.id === messageId)
      if (e.key === 'j' && messages[idx + 1]) open(messages[idx + 1])
      if (e.key === 'k' && idx > 0) open(messages[idx - 1])
      if (e.key === '/') { e.preventDefault(); document.getElementById('mail-search')?.focus() }
      if (e.key === 'c' && mb?.from.length) setCompose({ kind: 'new' })
      if (e.key === 'Escape' && messageId) navigate(`/mail/${mailbox}/${folder}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!mb) return <div className="p-8 text-sm text-body">Unbekanntes Postfach.</div>

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="h-14 shrink-0 flex items-center gap-3 pl-14 pr-3 md:px-4 bg-smoke border-b border-line">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{folderLabel}</p>
          <p className="truncate text-[11px] text-steel">{mb.address}</p>
        </div>
        <form className="ml-auto flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 h-8 w-full max-w-xs" onSubmit={e => { e.preventDefault(); setQuery(search.trim()) }}>
          <Search className="w-4 h-4 text-steel shrink-0" />
          <input id="mail-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-light-steel" />
          {query && <button type="button" onClick={() => { setSearch(''); setQuery('') }} className="text-steel hover:text-asphalt"><X className="w-3.5 h-3.5" /></button>}
        </form>
        {mb.from.length > 0 && (
          <Button size="sm" onClick={() => setCompose({ kind: 'new' })} className="shrink-0"><PenSquare className="w-4 h-4 mr-1.5" />Neu</Button>
        )}
      </header>
      {mb.hint && <div className="px-4 py-2 text-[12px] text-steel bg-ice border-b border-line">{mb.hint}</div>}

      <div className="flex-1 flex min-h-0">
        <div className={`${messageId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[380px] shrink-0 flex-col border-r border-line min-h-0`}>
          <div className="flex-1 overflow-y-auto aw-scroll">
            {list.isLoading && Array.from({ length: 8 }).map((_, i) => <div key={i} className="px-4 py-3 border-b border-line space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>)}
            {list.isError && <p className="p-4 text-sm text-destructive">{(list.error as Error).message}</p>}
            {!list.isLoading && messages.length === 0 && <p className="p-8 text-center text-sm text-body">{query ? 'Nichts gefunden.' : 'Keine Nachrichten.'}</p>}
            {messages.map(m => {
              const active = m.id === messageId
              return (
                <button key={m.id} onClick={() => open(m)}
                  className={`w-full text-left px-4 py-3 border-b border-line transition-colors ${active ? 'bg-indigo2-50' : 'hover:bg-ice'}`}>
                  <div className="flex items-center gap-2">
                    {!m.isRead && !sentView && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <span className={`truncate text-sm ${!m.isRead && !sentView ? 'font-semibold text-ink' : 'text-asphalt'}`}>{who(m, sentView)}</span>
                    {m.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-steel shrink-0" />}
                    <span className="ml-auto text-[11px] text-steel shrink-0">{when(m.receivedDateTime || m.sentDateTime)}</span>
                  </div>
                  <p className={`truncate text-[13px] mt-0.5 ${!m.isRead && !sentView ? 'text-ink font-medium' : 'text-asphalt'}`}>{m.subject || '(kein Betreff)'}</p>
                  <p className="truncate text-[12px] text-body mt-0.5">{m.bodyPreview}</p>
                </button>
              )
            })}
            {list.hasNextPage && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}</Button>
              </div>
            )}
          </div>
        </div>

        <div className={`${messageId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col min-h-0`}>
          {messageId
            ? <Reader key={messageId} mailboxId={mailbox} folder={folder} id={decodeURIComponent(messageId)} onAct={act} onCompose={setCompose} onBack={() => navigate(`/mail/${mailbox}/${folder}`)} />
            : <div className="flex-1 flex items-center justify-center text-sm text-body"><Mail className="w-4 h-4 mr-2 text-light-steel" />Nachricht auswählen</div>}
        </div>
      </div>

      {compose && <Compose mb={mb} mode={compose} open onClose={() => setCompose(null)} onSent={refresh} />}
    </div>
  )
}

function Reader({ mailboxId, folder, id, onAct, onCompose, onBack }: {
  mailboxId: string; folder: string; id: string
  onAct: (fn: () => Promise<unknown>, ok: string, leave?: boolean) => void
  onCompose: (m: ComposeMode) => void; onBack: () => void
}) {
  const mb = mailboxById(mailboxId)!
  const qc = useQueryClient()
  const [remote, setRemote] = useState(false)
  const msg = useQuery({ queryKey: ['message', mailboxId, id], queryFn: () => getMessage(mb, id) })
  const atts = useQuery({ queryKey: ['atts', mailboxId, id], queryFn: () => listAttachments(mb, id), enabled: !!msg.data?.hasAttachments })
  const inline = useQuery({ queryKey: ['inline', mailboxId, id], queryFn: () => inlineImages(mb, id), enabled: !!msg.data && /cid:/i.test(msg.data.body.content) })

  useEffect(() => {
    if (msg.data && !msg.data.isRead) updateMessage(mb, id, { isRead: true }).then(() => {
      qc.invalidateQueries({ queryKey: ['messages', mailboxId] }); qc.invalidateQueries({ queryKey: ['folder', mailboxId] })
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

  if (msg.isLoading) return <div className="p-6 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-1/3" /><Skeleton className="h-40 w-full" /></div>
  if (msg.isError || !msg.data) return <p className="p-6 text-sm text-destructive">{(msg.error as Error)?.message ?? 'Nicht gefunden'}</p>
  const m = msg.data
  const canSend = mb.from.length > 0
  const hasRemote = /<img[^>]+src=["']https?:/i.test(m.body.content)
  const iconBtn = 'p-2 rounded-md text-steel hover:bg-ice hover:text-asphalt transition-colors'
  const html = m.body.contentType === 'html' ? m.body.content : `<pre>${m.body.content.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 flex items-center gap-0.5 px-2 border-b border-line">
        <button className={`${iconBtn} lg:hidden`} onClick={onBack} title="Zurück"><ArrowLeft className="w-4 h-4" /></button>
        {canSend && <>
          <button className={iconBtn} title="Antworten" onClick={() => onCompose({ kind: 'reply', message: m })}><Reply className="w-4 h-4" /></button>
          <button className={iconBtn} title="Allen antworten" onClick={() => onCompose({ kind: 'replyAll', message: m })}><ReplyAll className="w-4 h-4" /></button>
          <button className={iconBtn} title="Weiterleiten" onClick={() => onCompose({ kind: 'forward', message: m })}><Forward className="w-4 h-4" /></button>
          <span className="w-px h-5 bg-line mx-1" />
        </>}
        {folder !== 'archive' && <button className={iconBtn} title="Archivieren" onClick={() => onAct(() => moveMessage(mb, id, 'archive'), 'Archiviert')}><Archive className="w-4 h-4" /></button>}
        {folder !== 'deleteditems' && <button className={iconBtn} title="Löschen" onClick={() => onAct(() => moveMessage(mb, id, 'deleteditems'), 'In den Papierkorb verschoben')}><Trash2 className="w-4 h-4" /></button>}
        <button className={iconBtn} title="Als ungelesen markieren" onClick={() => onAct(() => updateMessage(mb, id, { isRead: false }), 'Als ungelesen markiert')}><MailOpen className="w-4 h-4" /></button>
        <button className={`${iconBtn} ml-auto`} title="Als PDF speichern" disabled={inline.isLoading || atts.isLoading}
          onClick={() => saveMessageAsPdf(m, html, { inline: inline.data ?? {}, allowRemote: remote, attachments: atts.data ?? [] })}><FileDown className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto aw-scroll">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-bold text-ink leading-snug">{m.subject || '(kein Betreff)'}</h2>
          <div className="mt-2 text-[13px] text-body space-y-0.5">
            <p><span className="text-asphalt font-medium">{m.from?.emailAddress.name}</span> <span className="text-steel">&lt;{m.from?.emailAddress.address}&gt;</span></p>
            <p className="text-steel">An {m.toRecipients?.map(r => r.emailAddress.address).join(', ')}{m.ccRecipients?.length ? ` · Cc ${m.ccRecipients.map(r => r.emailAddress.address).join(', ')}` : ''}</p>
            <p className="text-steel">{m.receivedDateTime && format(new Date(m.receivedDateTime), "EEEE, d. MMMM yyyy 'um' HH:mm", { locale: de })}</p>
          </div>
          {atts.data && atts.data.filter(a => !a.isInline).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {atts.data.filter(a => !a.isInline).map(a => (
                <button key={a.id} onClick={() => download(a.id, a.name)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 h-8 text-[13px] text-asphalt hover:bg-ice">
                  <Paperclip className="w-3.5 h-3.5 text-steel" />{a.name}<span className="text-[11px] text-steel">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                </button>
              ))}
            </div>
          )}
          {hasRemote && !remote && (
            <button onClick={() => setRemote(true)} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-steel hover:text-asphalt">
              <Image className="w-3.5 h-3.5" />Externe Bilder sind blockiert — anzeigen
            </button>
          )}
        </div>
        <div className="px-6 pb-8">
          <div className="mail-card">
          <HtmlFrame html={html} inline={inline.data ?? {}} allowRemote={remote} />
          </div>
        </div>
      </div>
    </div>
  )
}
