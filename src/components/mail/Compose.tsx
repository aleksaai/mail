import { useEffect, useRef, useState } from 'react'
import { Languages, Paperclip, Sparkles, Undo2, X } from 'lucide-react'
import { askApril, cleanAprilHtml, LANGUAGES, type LanguageId } from '@/lib/april'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MailEditor } from './MailEditor'
import { RecipientInput } from './RecipientInput'
import { hasContent, toEmailHtml } from '@/lib/email-html'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Mailbox } from '@/config/mailboxes'
import { signatureFor } from '@/config/signatures'
import { MAX_ATTACHMENT, sendNew, sendResponse, type Message } from '@/lib/graph'
import { ScheduleChip, SchedulePicker, whenLabel } from './SchedulePicker'

/** `startHtml`: Starttext im Editor, z. B. Aprils Entwurf (Signatur und Zitat kommen wie gewohnt dazu). */
export type ComposeMode = { kind: 'new' } | { kind: 'reply' | 'replyAll' | 'forward'; message: Message; startHtml?: string }

/** Aprils Platzhalter wie [Uhrzeit?] gelb markieren, damit sie vor dem Senden auffallen. */
const PLACEHOLDER = /\[[^\]\n]{1,60}\?\]/g
export const markPlaceholders = (html: string) =>
  html.replace(PLACEHOLDER, p => `<mark data-color="#fde68a" style="background-color:#fde68a">${p}</mark>`)

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
  const [initial, setInitial] = useState('')
  const [instruction, setInstruction] = useState('')
  const [target, setTarget] = useState<LanguageId>('en')
  const [aprilBusy, setAprilBusy] = useState<'' | 'improve' | 'translate'>('')
  const [before, setBefore] = useState<string | null>(null)
  const [sendAt, setSendAt] = useState<Date | null>(null)
  const signature = signatureFor(from)

  // April schreibt den Entwurf neu; der Editor wird mit dem Ergebnis neu aufgebaut.
  const replaceBody = (next: string) => {
    setBefore(html)
    setHtml(next); setInitial(next); setEditorKey(k => k + 1)
  }
  const runApril = async (kind: 'improve' | 'translate') => {
    if (!hasContent(html)) { toast.error('Schreib zuerst etwas, dann hilft April'); return }
    setAprilBusy(kind)
    try {
      const out = kind === 'translate'
        ? await askApril({ action: 'translate', text: html, target, format: 'html' })
        : await askApril({ action: 'improve', text: html, instruction })
      replaceBody(cleanAprilHtml(out))
      if (kind === 'improve') setInstruction('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setAprilBusy('') }
  }
  const undoApril = () => {
    if (before === null) return
    setHtml(before); setInitial(before); setEditorKey(k => k + 1); setBefore(null)
  }
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
    setInitial('')
    setBefore(null)
    setInstruction('')
    setEditorKey(k => k + 1)
    setFiles([])
    setWithSig(true)
    setSendAt(null)
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
    if (mode.startHtml) {
      const start = markPlaceholders(cleanAprilHtml(mode.startHtml))
      setHtml(start); setInitial(start)
    }
  }, [open, mode, mb])

  const send = async () => {
    if (!to.trim()) { toast.error('Empfänger fehlt'); return }
    const left = (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').match(PLACEHOLDER)
    if (left?.length && !window.confirm(`Im Text steht noch ${left.length === 1 ? 'ein Platzhalter' : `${left.length} Platzhalter`}: ${left.join(', ')}. Trotzdem senden?`)) return
    if (sendAt && sendAt.getTime() < Date.now() + 60_000) { toast.error('Der geplante Zeitpunkt liegt schon in der Vergangenheit'); return }
    setSending(true)
    try {
      const body = hasContent(html) ? toEmailHtml(html) : ''
      const d = { from, to, cc, subject, html: signature && withSig ? `${body}<br>${signature}` : body, files, sendAt }
      if (mode.kind === 'new') await sendNew(mb, d)
      else await sendResponse(mb, mode.message.id, mode.kind, d)
      toast.success(sendAt ? `Geplant für ${whenLabel(sendAt)}` : 'Gesendet')
      onSent(); onClose()
    } catch (e) {
      toast.error(`Senden fehlgeschlagen: ${(e as Error).message}`)
    } finally { setSending(false) }
  }

  const title = mode.kind === 'new' ? 'Neue Mail' : mode.kind === 'forward' ? 'Weiterleiten' : 'Antworten'
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className={`sm:max-w-2xl sm:rounded-[24px] !bg-white/80 backdrop-blur-2xl backdrop-saturate-150 border-white/70 shadow-[0_1px_0_rgba(255,255,255,.9)_inset,0_30px_80px_-20px_rgba(15,40,77,.35)] ${dragging ? 'ring-2 ring-primary' : ''}`}
        onEscapeKeyDown={e => { if (document.activeElement?.getAttribute('aria-expanded') === 'true') e.preventDefault() }}
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
          <div className="flex items-center gap-2"><label htmlFor="compose-to" className="w-12 text-sm text-steel">An</label><RecipientInput id="compose-to" label="An" value={to} onChange={setTo} exclude={cc} /></div>
          <div className="flex items-center gap-2"><label htmlFor="compose-cc" className="w-12 text-sm text-steel">Cc</label><RecipientInput id="compose-cc" label="Cc" value={cc} onChange={setCc} exclude={to} /></div>
          <div className="flex items-center gap-2"><span className="w-12 text-sm text-steel">Betreff</span><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="mt-2">
            <MailEditor key={editorKey} initialHtml={initial} onChange={setHtml} onSubmit={() => void send()} autoFocus={mode.kind !== 'new' || !!initial}
              placeholder={mode.kind === 'new' ? 'Schreib deine Nachricht …' : 'Deine Antwort, der bisherige Verlauf wird automatisch angehängt.'} />
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/60 px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo2-700"><Sparkles className="h-3.5 w-3.5" />April</span>
            <input value={instruction} onChange={e => setInstruction(e.target.value)} disabled={!!aprilBusy}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runApril('improve') } }}
              placeholder="Was soll ich ändern? Leer = Fehler korrigieren"
              className="h-8 min-w-[180px] flex-1 rounded-md border border-line bg-white/80 px-2 text-[13px] outline-none focus:border-indigo2-500" />
            <Button size="sm" variant="ghost" disabled={!!aprilBusy} onClick={() => void runApril('improve')}>
              {aprilBusy === 'improve' ? 'Überarbeitet …' : 'Überarbeiten'}
            </Button>
            <span className="h-5 w-px bg-line" />
            <select value={target} onChange={e => setTarget(e.target.value as LanguageId)} disabled={!!aprilBusy}
              className="h-8 rounded-md bg-transparent px-1 text-[13px] text-asphalt outline-none hover:bg-ice cursor-pointer" title="Zielsprache">
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <Button size="sm" variant="ghost" disabled={!!aprilBusy} onClick={() => void runApril('translate')}>
              <Languages className="mr-1.5 h-4 w-4" />{aprilBusy === 'translate' ? 'Übersetzt …' : 'Übersetzen'}
            </Button>
            {before !== null && !aprilBusy && (
              <button type="button" onClick={undoApril} className="inline-flex items-center gap-1 text-[12px] text-steel hover:text-asphalt">
                <Undo2 className="h-3.5 w-3.5" />Rückgängig
              </button>
            )}
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
            {!sendAt && <span className="hidden sm:inline text-[11px] text-steel">Dateien hierher ziehen · ⌘ + Enter sendet</span>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {sendAt && <ScheduleChip value={sendAt} onClear={() => setSendAt(null)} disabled={sending} />}
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <div className="flex items-center gap-1">
              <Button onClick={send} disabled={sending} className={sendAt ? 'rounded-r-md' : ''}>
                {sending ? (files.length ? 'Lädt Anhänge …' : sendAt ? 'Plant …' : 'Sendet …') : sendAt ? 'Planen' : 'Senden'}
              </Button>
              <SchedulePicker onChange={setSendAt} disabled={sending} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
