import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'
import { Clock, MapPin, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { createEvent, deleteEvent, respond, updateEvent, type CalEvent, type EventDraft } from '@/lib/calendar'

export type EventDialogState = { mode: 'new'; start: Date; end: Date; allDay?: boolean } | { mode: 'view'; event: CalEvent }

const dateStr = (d: Date) => format(d, 'yyyy-MM-dd')
const timeStr = (d: Date) => format(d, 'HH:mm')
const combine = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00`)

const RESPONSE: Record<string, string> = {
  accepted: 'Zugesagt', tentativelyAccepted: 'Mit Vorbehalt', declined: 'Abgesagt', notResponded: 'Noch nicht beantwortet', none: 'Noch nicht beantwortet', organizer: 'Organisator',
}

export function EventDialog({ state, onClose, onChanged }: { state: EventDialogState | null; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [subject, setSubject] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [body, setBody] = useState('')
  const [attendees, setAttendees] = useState('')

  useEffect(() => {
    if (!state) return
    if (state.mode === 'new') {
      setEditing(true)
      setSubject(''); setLocation(''); setBody(''); setAttendees('')
      setDate(dateStr(state.start)); setEndDate(dateStr(state.end)); setFrom(timeStr(state.start)); setTo(timeStr(state.end)); setAllDay(!!state.allDay)
    } else {
      const e = state.event
      setEditing(false)
      setSubject(e.subject); setLocation(e.location ?? ''); setBody(e.bodyPreview ?? ''); setAttendees(e.attendees.map(a => a.address).join(', '))
      const end = e.isAllDay ? new Date(e.end.getTime() - 86400000) : e.end
      setDate(dateStr(e.start)); setEndDate(dateStr(end)); setFrom(timeStr(e.start)); setTo(timeStr(e.end)); setAllDay(e.isAllDay)
    }
  }, [state])

  if (!state) return null
  const event = state.mode === 'view' ? state.event : null
  const canEdit = !event || event.isOrganizer

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok); onChanged(); onClose() }
    catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  const save = () => {
    if (!subject.trim()) { toast.error('Titel fehlt'); return }
    const start = allDay ? combine(date, '00:00') : combine(date, from)
    const end = allDay ? combine(endDate || date, '00:00') : combine(endDate || date, to)
    if (!allDay && end <= start) { toast.error('Ende liegt vor dem Beginn'); return }
    const d: EventDraft = { subject: subject.trim(), start, end, isAllDay: allDay, location, body, attendees }
    void run(() => (event ? updateEvent(event.id, d, event.owner) : createEvent(d)), event ? 'Termin gespeichert' : 'Termin angelegt')
  }

  const remove = () => {
    if (!event) return
    const who = event.attendees.length ? ` Die ${event.attendees.length} Teilnehmer bekommen eine Absage.` : ''
    if (!window.confirm(`„${event.subject}“ löschen?${who}`)) return
    void run(() => deleteEvent(event.id, event.owner), 'Termin gelöscht')
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{event && !editing ? event.subject : event ? 'Termin bearbeiten' : 'Neuer Termin'}</DialogTitle></DialogHeader>

        {event && !editing ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2 text-asphalt">
              <Clock className="w-4 h-4 mt-0.5 text-steel shrink-0" />
              {event.isAllDay
                ? `${format(event.start, 'EEEE, d. MMMM yyyy', { locale: de })} · ganztägig`
                : `${format(event.start, 'EEEE, d. MMMM yyyy', { locale: de })} · ${timeStr(event.start)}–${timeStr(event.end)}`}
            </p>
            {event.location && <p className="flex items-start gap-2 text-asphalt"><MapPin className="w-4 h-4 mt-0.5 text-steel shrink-0" />{event.location}</p>}
            {(event.attendees.length > 0 || event.organizer) && (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 mt-0.5 text-steel shrink-0" />
                <div className="space-y-0.5">
                  {event.organizer && <p className="text-asphalt">{event.organizer.name || event.organizer.address} <span className="text-steel">· Organisator</span></p>}
                  {event.attendees.map(a => <p key={a.address} className="text-body">{a.name || a.address} <span className="text-steel">· {RESPONSE[a.response] ?? a.response}</span></p>)}
                </div>
              </div>
            )}
            {event.bodyPreview && <p className="whitespace-pre-wrap text-body border-t border-line pt-3">{event.bodyPreview}</p>}
            {!event.isOrganizer && <p className="text-[12px] text-steel">Deine Antwort: {RESPONSE[event.response] ?? event.response}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Titel" autoFocus />
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Input type="date" value={date} onChange={e => { setDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value) }} />
              {!allDay && <Input type="time" value={from} onChange={e => setFrom(e.target.value)} className="w-28" />}
              {!allDay && <Input type="time" value={to} onChange={e => setTo(e.target.value)} className="w-28" />}
            </div>
            {(allDay || endDate !== date) && (
              <div className="flex items-center gap-2"><span className="w-12 text-sm text-steel">bis</span><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            )}
            <label className="flex items-center gap-2 text-sm text-asphalt"><Checkbox checked={allDay} onCheckedChange={v => setAllDay(!!v)} />Ganztägig</label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ort" />
            <Input value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="Teilnehmer (E-Mail, durch Komma getrennt)" />
            {attendees.trim() && <p className="text-[12px] text-steel">Teilnehmer bekommen beim Speichern eine Einladung.</p>}
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Notiz" />
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {event && canEdit && <Button variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>Löschen</Button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {event && !editing && !event.isOrganizer && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => run(() => respond(event.id, 'decline', '', event.owner), 'Abgesagt')}>Ablehnen</Button>
                <Button variant="outline" disabled={busy} onClick={() => run(() => respond(event.id, 'tentativelyAccept', '', event.owner), 'Mit Vorbehalt zugesagt')}>Vorbehalt</Button>
                <Button disabled={busy} onClick={() => run(() => respond(event.id, 'accept', '', event.owner), 'Zugesagt')}>Annehmen</Button>
              </>
            )}
            {event && !editing && canEdit && <Button onClick={() => setEditing(true)}>Bearbeiten</Button>}
            {editing && <><Button variant="outline" onClick={() => (event ? setEditing(false) : onClose())}>Abbrechen</Button><Button disabled={busy} onClick={save}>{busy ? 'Speichert …' : 'Speichern'}</Button></>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
