import { useState } from 'react'
import { addDays, format, nextMonday, set, startOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronDown, Clock, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

/** Lesbarer Sendezeitpunkt, z. B. „Do, 9. Okt · 08:00“. */
export const whenLabel = (d: Date) => format(d, "EEE, d. MMM · HH:mm", { locale: de })

const at = (day: Date, h: number) => set(startOfDay(day), { hours: h, minutes: 0 })
/** Vorschlaege wie in Outlook/Gmail: nur Zeitpunkte, die noch in der Zukunft liegen. */
function presets(now = new Date()): { label: string; date: Date }[] {
  const list = [
    { label: 'Heute Abend', date: at(now, 18) },
    { label: 'Morgen früh', date: at(addDays(now, 1), 8) },
    { label: 'Morgen Nachmittag', date: at(addDays(now, 1), 14) },
    { label: 'Montag früh', date: at(nextMonday(now), 8) },
  ]
  return list.filter(p => p.date.getTime() > now.getTime() + 60_000)
}
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

/**
 * „Senden planen“: Pfeil neben dem Senden-Knopf. Gewaehlter Zeitpunkt steht als Kapsel daneben und laesst
 * sich mit einem Klick wieder loeschen. Der Versand selbst passiert in Exchange (siehe graph.ts, DEFERRED).
 */
/** Gewaehlter Zeitpunkt als Kapsel mit „x“; steht im Schreibfenster links neben den Knoepfen. */
export function ScheduleChip({ value, onClear, disabled }: { value: Date; onClear: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-indigo2-200 bg-indigo2-50 pl-2.5 pr-1 text-[12.5px] font-medium text-indigo2-700">
      <Clock className="h-3.5 w-3.5" />{whenLabel(value)}
      <button type="button" onClick={onClear} disabled={disabled} title="Doch sofort senden"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/70"><X className="h-3.5 w-3.5" /></button>
    </span>
  )
}

export function SchedulePicker({ onChange, disabled }: { onChange: (d: Date | null) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(() => toLocalInput(at(addDays(new Date(), 1), 8)))
  const pick = (d: Date) => { onChange(d); setOpen(false) }
  const customDate = new Date(custom)
  const customOk = !isNaN(customDate.getTime()) && customDate.getTime() > Date.now() + 60_000

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" disabled={disabled} title="Senden planen" aria-label="Senden planen" className="h-9 w-9">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[280px] rounded-[18px] border-white/70 !bg-white/85 p-2 backdrop-blur-2xl">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-steel/80">Senden planen</p>
          <div className="space-y-0.5">
            {presets().map(p => (
              <button key={p.label} type="button" onClick={() => pick(p.date)}
                className="flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-left text-[13px] text-asphalt hover:bg-ice">
                <span>{p.label}</span><span className="text-[12px] text-steel">{format(p.date, 'EEE HH:mm', { locale: de })}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-line pt-2">
            <label className="block px-2.5 pb-1 text-[12px] text-steel">Eigener Zeitpunkt</label>
            <div className="flex items-center gap-1.5 px-1">
              <input type="datetime-local" value={custom} min={toLocalInput(new Date())} onChange={e => setCustom(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-white/80 px-2 text-[13px] text-asphalt outline-none focus:border-indigo2-500" />
              <Button size="sm" disabled={!customOk} onClick={() => pick(customDate)}>Planen</Button>
            </div>
            {!customOk && <p className="px-2.5 pt-1 text-[11px] text-destructive">Der Zeitpunkt muss in der Zukunft liegen.</p>}
          </div>
          <p className="px-2.5 pt-2 text-[11px] leading-snug text-steel">Der Server schickt die Mail zum gewählten Zeitpunkt, die App muss dafür nicht offen sein. Bis dahin liegt sie unter „Geplant“.</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
