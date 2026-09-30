import { useEffect, useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MailEditor } from './MailEditor'
import { hasContent, toEmailHtml } from '@/lib/email-html'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Mailbox } from '@/config/mailboxes'
import { signatureFor } from '@/config/signatures'
import { MAX_ATTACHMENT, sendNew, sendResponse, type Message } from '@/lib/graph'

export type ComposeMode = { kind: 'new' } | { kind: 'reply' | 'replyAll' | 'forward'; message: Message }

const addr = (list?: { emailAddress: { address: string } }[]) => (list ?? []).map(r => r.emailAddress.address)

export function Compose({ mb, mode, open, onClose, onSent }: { mb: Mailbox; mode: ComposeMode; open: boolean; onClose: () => void; onSent: () => void }) {
  const [from, setFrom] = useState(mb.from[0] ?? '')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [editorKey, setEditorKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [withSig, setWithSig] = useState(true)
  const signature = signatureFor(from)
  const picker = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | File[] | null) => {
    const incoming = Array.from(list ?? [])
    const tooBig = incoming.filter(f => f.size > MAX_ATTACHMENT)
    if (tooBig.length) toast.error(`Zu groß (max. 150 MB): ${tooBig.map(f => f.name).join(', ')}`)
    setFiles(prev => [...prev, ...incoming.filter(f => f.size <= MAX_ATTACHMENT && !prev.some(p => p.name === f.name && p.size === f.size))])
  }
  const size = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

  useEffect(() => {
    if (!open) return
    setHtml('')
    setEditorKey(k => k + 1)
    setFiles([])
    setWithSig(true)
    if (mode.kind === 'new') { setTo(''); setCc(''); setSubject(''); setFrom(mb.from[0] ?? ''); return }
    const m = mode.message
    const own = new Set(mb.from.map(a => a.toLowerCase()))
    // Antwort geht von der Adresse raus, an die die Mail ging (Alias bleibt Alias).
    const hit = [...addr(m.toRecipients), ...addr(m.ccRecipients)].find(a => own.has(a.toLowerCase()))
    setFrom(hit ?? mb.from[0] ?? '')
    const sender = m.replyTo?.length ? addr(m.replyTo) : m.from ? [m.from.emailAddress.address] : []
    if (mode.kind === 'forward') { setTo(''); setCc(''); setSubject(`WG: ${m.subject.replace(/^(WG|FW|Fwd):\s*/i, '')}`) }
    else {
      setTo(sender.join(', '))
      setCc(mode.kind === 'replyAll' ? [...addr(m.toRecipients), ...addr(m.ccRecipients)].filter(a => !own.has(a.toLowerCase()) && !sender.includes(a)).join(', ') : '')
      setSubject(/^(AW|RE):/i.test(m.subject) ? m.subject : `AW: ${m.subject}`)
    }
  }, [open, mode, mb])

  const send = async () => {
    if (!to.trim()) { toast.error('Empfänger fehlt'); return }
    setSending(true)
    try {
      const body = hasContent(html) ? toEmailHtml(html) : ''
      const d = { from, to, cc, subject, html: signature && withSig ? `${body}<br>${signature}` : body, files }
      if (mode.kind === 'new') await sendNew(mb, d)
      else await sendResponse(mb, mode.message.id, mode.kind, d)
      toast.success('Gesendet')
      onSent(); onClose()
    } catch (e) {
      toast.error(`Senden fehlgeschlagen: ${(e as Error).message}`)
    } finally { setSending(false) }
  }

  const title = mode.kind === 'new' ? 'Neue Mail' : mode.kind === 'forward' ? 'Weiterleiten' : 'Antworten'
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className={`sm:max-w-2xl sm:rounded-[24px] !bg-white/80 backdrop-blur-2xl backdrop-saturate-150 border-white/70 shadow-[0_1px_0_rgba(255,255,255,.9)_inset,0_30px_80px_-20px_rgba(15,40,77,.35)] ${dragging ? 'ring-2 ring-primary' : ''}`}
        onOpenAutoFocus={e => { e.preventDefault(); if (mode.kind === 'new') setTimeout(() => document.getElementById('compose-to')?.focus(), 0) }}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false) }}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-12 text-sm text-steel">Von</span>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>{mb.from.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><span className="w-12 text-sm text-steel">An</span><Input id="compose-to" value={to} onChange={e => setTo(e.target.value)} placeholder="name@firma.de, …" /></div>
          <div className="flex items-center gap-2"><span className="w-12 text-sm text-steel">Cc</span><Input value={cc} onChange={e => setCc(e.target.value)} /></div>
          <div className="flex items-center gap-2"><span className="w-12 text-sm text-steel">Betreff</span><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="mt-2">
            <MailEditor key={editorKey} onChange={setHtml} onSubmit={() => void send()} autoFocus={mode.kind !== 'new'}
              placeholder={mode.kind === 'new' ? 'Schreib deine Nachricht …' : 'Deine Antwort, der bisherige Verlauf wird automatisch angehängt.'} />
          </div>
          {signature && (
            <div className="rounded-xl border border-line bg-white/60 px-3 pt-2 pb-3">
              <label className="flex items-center gap-2 text-[12px] text-steel mb-2 cursor-pointer select-none">
                <input type="checkbox" checked={withSig} onChange={e => setWithSig(e.target.checked)} className="accent-[#8b79f0]" />
                Signatur anhängen
              </label>
              <div className={withSig ? '' : 'opacity-40'} dangerouslySetInnerHTML={{ __html: signature }} />
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {files.map((f, n) => (
                <span key={f.name + n} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ice px-2 h-8 text-[13px] text-asphalt">
                  <Paperclip className="w-3.5 h-3.5 text-steel" />{f.name}<span className="text-[11px] text-steel">{size(f.size)}</span>
                  <button onClick={() => setFiles(prev => prev.filter((_, k) => k !== n))} className="ml-0.5 text-steel hover:text-destructive" title="Entfernen"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
            </div>
          )}
          {mode.kind === 'forward' && <p className="text-[12px] text-steel">Anhänge der Originalmail werden beim Weiterleiten automatisch mitgeschickt.</p>}
          <input ref={picker} type="file" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => picker.current?.click()}><Paperclip className="w-4 h-4 mr-1.5" />Anhang</Button>
            <span className="hidden sm:inline text-[11px] text-steel">Dateien hierher ziehen · ⌘ + Enter sendet</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={send} disabled={sending}>{sending ? (files.length ? 'Lädt Anhänge …' : 'Sendet …') : 'Senden'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
