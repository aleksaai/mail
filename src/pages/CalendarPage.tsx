import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDays, addMonths, addWeeks, differenceInMinutes, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  startOfDay, startOfMonth, startOfWeek,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listEvents, type CalEvent } from '@/lib/calendar'
import { EventDialog, type EventDialogState } from '@/components/calendar/EventDialog'

type View = 'day' | 'week' | 'month'
const HOUR = 48 // px pro Stunde
const VIEW_KEY = 'mail-calendar-view'
const readView = (): View => { try { const v = localStorage.getItem(VIEW_KEY); return v === 'day' || v === 'month' ? v : 'week' } catch { return 'week' } }

/** Farbe nach Antwortstatus: eigener/zugesagt = Lila, Vorbehalt = gestreift, offen = hell mit Rand, abgesagt = grau. */
function tone(e: CalEvent) {
  if (e.isCancelled || e.response === 'declined') return 'bg-ice text-light-steel line-through border-l-2 border-light-steel'
  if (e.response === 'notResponded' || e.response === 'none' && !e.isOrganizer) return 'bg-white text-indigo2-900 border border-dashed border-indigo2-500'
  if (e.response === 'tentativelyAccepted') return 'text-indigo2-900 border-l-2 border-indigo2-700 [background:repeating-linear-gradient(45deg,#eceafd,#eceafd_6px,#f6f4fe_6px,#f6f4fe_12px)]'
  if (e.showAs === 'free') return 'bg-indigo2-50 text-indigo2-900 border-l-2 border-indigo2-300'
  return 'bg-indigo2-100 text-indigo2-900 border-l-2 border-indigo2-700'
}

/** Ueberlappende Termine eines Tages nebeneinander legen (Spalten je Cluster). */
function layout(events: CalEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime())
  const placed: { e: CalEvent; col: number; cols: number }[] = []
  let cluster: { e: CalEvent; col: number }[] = []
  let clusterEnd = 0
  const flush = () => {
    const cols = Math.max(1, ...cluster.map(c => c.col + 1))
    cluster.forEach(c => placed.push({ ...c, cols }))
    cluster = []
  }
  for (const e of sorted) {
    if (cluster.length && e.start.getTime() >= clusterEnd) flush()
    const used = new Set(cluster.filter(c => c.e.end > e.start).map(c => c.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ e, col })
    clusterEnd = Math.max(clusterEnd, e.end.getTime())
  }
  flush()
  return placed
}

export function CalendarPage() {
  const qc = useQueryClient()
  const [view, setViewState] = useState<View>(readView)
  const [anchor, setAnchor] = useState(() => new Date())
  const [dialog, setDialog] = useState<EventDialogState | null>(null)
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* egal */ } }

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) }
    if (view === 'week') { const from = startOfWeek(anchor, { weekStartsOn: 1 }); return { from, to: addDays(from, 7) } }
    const from = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    return { from, to: addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1) }
  }, [view, anchor])

  const events = useQuery({
    queryKey: ['events', range.from.toISOString(), range.to.toISOString()],
    queryFn: () => listEvents(range.from, range.to),
    refetchInterval: 60_000,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['events'] })

  const step = (dir: 1 | -1) => setAnchor(a => view === 'day' ? addDays(a, dir) : view === 'week' ? addWeeks(a, dir) : addMonths(a, dir))
  const title = view === 'month'
    ? format(anchor, 'MMMM yyyy', { locale: de })
    : view === 'week'
      ? `${format(range.from, 'd. MMM', { locale: de })} – ${format(addDays(range.to, -1), 'd. MMM yyyy', { locale: de })}`
      : format(anchor, 'EEEE, d. MMMM yyyy', { locale: de })

  // Tastatur: t heute, j/k bzw. Pfeile blaettern, d/w/m Ansicht, n neuer Termin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || (e.target as HTMLElement).closest('input,textarea,[contenteditable],[role=dialog]')) return
      if (e.key === 't') setAnchor(new Date())
      if (e.key === 'ArrowRight' || e.key === 'j') step(1)
      if (e.key === 'ArrowLeft' || e.key === 'k') step(-1)
      if (e.key === 'd') setView('day'); if (e.key === 'w') setView('week'); if (e.key === 'm') setView('month')
      if (e.key === 'n') newAt(new Date(Math.ceil(Date.now() / 1800000) * 1800000))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const newAt = (start: Date, allDay = false) => setDialog({ mode: 'new', start, end: allDay ? start : new Date(start.getTime() + 3600000), allDay })
  const open = (e: CalEvent) => setDialog({ mode: 'view', event: e })
  const list = events.data ?? []

  const seg = (v: View, label: string) => (
    <button onClick={() => setView(v)} className={`px-3 h-7 rounded-md text-[13px] transition-colors ${view === v ? 'bg-white text-ink font-medium shadow-sm' : 'text-steel hover:text-asphalt'}`}>{label}</button>
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="h-14 shrink-0 flex items-center gap-2 pl-14 pr-3 md:px-4 bg-smoke border-b border-line">
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Heute</Button>
        <div className="flex items-center text-steel">
          <button onClick={() => step(-1)} className="p-1.5 rounded-md hover:bg-ice hover:text-asphalt" title="Zurück"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => step(1)} className="p-1.5 rounded-md hover:bg-ice hover:text-asphalt" title="Vor"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <p className="truncate text-sm font-semibold text-ink capitalize">{title}</p>
        {events.isFetching && <span className="text-[11px] text-steel">lädt …</span>}
        <div className="ml-auto hidden sm:flex items-center rounded-lg bg-ice p-0.5">{seg('day', 'Tag')}{seg('week', 'Woche')}{seg('month', 'Monat')}</div>
        <Button size="sm" onClick={() => newAt(new Date(Math.ceil(Date.now() / 1800000) * 1800000))}><Plus className="w-4 h-4 mr-1" />Termin</Button>
      </header>
      {events.isError && <p className="px-4 py-2 text-sm text-destructive">{(events.error as Error).message}</p>}

      {view === 'month'
        ? <MonthGrid from={range.from} to={range.to} anchor={anchor} events={list} onOpen={open} onNew={d => newAt(d, true)} onDay={d => { setAnchor(d); setView('day') }} />
        : <TimeGrid days={Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => addDays(range.from, i))} events={list} onOpen={open} onNew={newAt} />}

      <EventDialog state={dialog} onClose={() => setDialog(null)} onChanged={refresh} />
    </div>
  )
}

function TimeGrid({ days, events, onOpen, onNew }: { days: Date[]; events: CalEvent[]; onOpen: (e: CalEvent) => void; onNew: (d: Date, allDay?: boolean) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 7 * HOUR }, [days.length])

  const allDay = (d: Date) => events.filter(e => (e.isAllDay || differenceInMinutes(e.end, e.start) >= 24 * 60) && e.start < addDays(d, 1) && e.end > d)
  const timed = (d: Date) => events.filter(e => !e.isAllDay && differenceInMinutes(e.end, e.start) < 24 * 60 && e.start < addDays(d, 1) && e.end > d)
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map(d => (
          <div key={d.toISOString()} className="px-2 py-2 border-l border-line">
            <p className={`text-[11px] uppercase tracking-wide ${isToday(d) ? 'text-primary font-semibold' : 'text-steel'}`}>{format(d, 'EEE', { locale: de })}</p>
            <p className={`text-lg leading-tight ${isToday(d) ? 'text-primary font-bold' : 'text-ink font-semibold'}`}>{format(d, 'd')}</p>
            <div className="mt-1 space-y-0.5 min-h-[4px]" onDoubleClick={() => onNew(startOfDay(d), true)}>
              {allDay(d).map(e => (
                <button key={e.id + d.toISOString()} onClick={() => onOpen(e)} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[12px] ${tone(e)}`}>{e.subject}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto aw-scroll">
        <div className="grid relative" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-steel" style={{ top: h * HOUR }}>{h ? `${String(h).padStart(2, '0')}:00` : ''}</span>
            ))}
          </div>
          {days.map(d => (
            <div key={d.toISOString()} className="relative border-l border-line"
              onClick={ev => {
                if ((ev.target as HTMLElement).closest('button')) return
                const y = ev.clientY - (ev.currentTarget as HTMLElement).getBoundingClientRect().top
                const minutes = Math.floor(y / HOUR * 2) * 30
                onNew(new Date(startOfDay(d).getTime() + minutes * 60000))
              }}>
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR }} />)}
              {layout(timed(d)).map(({ e, col, cols: n }) => {
                const s = Math.max(0, differenceInMinutes(e.start, startOfDay(d)))
                const en = Math.min(24 * 60, differenceInMinutes(e.end, startOfDay(d)))
                const height = Math.max(20, (en - s) / 60 * HOUR - 2)
                return (
                  <button key={e.id} onClick={() => onOpen(e)} title={e.subject}
                    className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[12px] leading-tight shadow-sm hover:z-10 hover:shadow-panel ${tone(e)}`}
                    style={{ top: s / 60 * HOUR + 1, height, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}>
                    <p className="font-medium truncate">{e.subject}</p>
                    {height > 34 && <p className="opacity-75 truncate">{format(e.start, 'HH:mm')}–{format(e.end, 'HH:mm')}{e.location ? ` · ${e.location}` : ''}</p>}
                  </button>
                )
              })}
              {isSameDay(d, now) && (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: differenceInMinutes(now, startOfDay(now)) / 60 * HOUR }}>
                  <span className="-ml-1 w-2 h-2 rounded-full bg-destructive" /><span className="flex-1 h-px bg-destructive" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({ from, to, anchor, events, onOpen, onNew, onDay }: {
  from: Date; to: Date; anchor: Date; events: CalEvent[]
  onOpen: (e: CalEvent) => void; onNew: (d: Date) => void; onDay: (d: Date) => void
}) {
  const days: Date[] = []
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-line">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <p key={d} className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-steel">{d}</p>)}
      </div>
      <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-0 overflow-y-auto aw-scroll">
        {days.map(d => {
          const day = events.filter(e => e.start < addDays(d, 1) && e.end > d).sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || a.start.getTime() - b.start.getTime())
          return (
            <div key={d.toISOString()} className={`min-h-[96px] border-b border-l border-line p-1 ${isSameMonth(d, anchor) ? '' : 'opacity-50'}`} onDoubleClick={() => onNew(d)}>
              <button onClick={() => onDay(d)} className={`mb-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] ${isToday(d) ? 'bg-primary text-white font-semibold' : 'text-asphalt hover:bg-ice'}`}>{format(d, 'd')}</button>
              <div className="space-y-0.5">
                {day.slice(0, 3).map(e => (
                  <button key={e.id} onClick={() => onOpen(e)} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11.5px] ${tone(e)}`}>
                    {!e.isAllDay && <span className="opacity-70 mr-1">{format(e.start, 'HH:mm')}</span>}{e.subject}
                  </button>
                ))}
                {day.length > 3 && <button onClick={() => onDay(d)} className="px-1.5 text-[11px] text-steel hover:text-asphalt">+{day.length - 3} weitere</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
