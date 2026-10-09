import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { parseRecipient, searchRecipients } from '@/lib/recipients'
import type { Address } from '@/lib/graph'

export function RecipientInput({ id, label, value, onChange, exclude = '' }: {
  id: string; label: string; value: string; onChange: (value: string) => void; exclude?: string
}) {
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const decode = (text: string) => {
    const chips: Address[] = []
    const pending: string[] = []
    for (const part of text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)) {
      const person = parseRecipient(part)
      if (person) { if (!chips.some(p => p.address === person.address)) chips.push(person) }
      else pending.push(part)
    }
    return { value: text, chips, draft: pending.join(', ') }
  }
  const [model, setModel] = useState(() => decode(value))
  // Replies and a newly opened composer can replace the parent value.
  if (value !== model.value) setModel(decode(value))
  const { chips, draft } = model
  const update = (nextChips: Address[], nextDraft: string) => {
    const nextValue = [...nextChips.map(p => p.address), nextDraft].filter(Boolean).join(', ')
    setModel({ value: nextValue, chips: nextChips, draft: nextDraft })
    onChange(nextValue)
  }
  const commit = (text = draft) => {
    const parsed = decode(text)
    const next = [...chips]
    for (const person of parsed.chips) if (!next.some(p => p.address === person.address)) next.push(person)
    update(next, parsed.draft)
    setDismissed(true)
  }
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const [result, setResult] = useState<{ query: string; people: Address[]; note: string } | null>(null)
  const query = draft.trim()
  const show = focused && !dismissed && query.length > 0
  const selected = new Set([...chips.map(p => p.address), ...exclude.toLowerCase().split(/[,;]/).map(s => s.trim())])
  const people = result?.query === query ? result.people.filter(p => !selected.has(p.address.toLowerCase())).slice(0, 8) : []
  const loading = show && result?.query !== query

  useEffect(() => {
    if (!show) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchRecipients(query, controller.signal).then(({ people, partial }) => {
        if (!controller.signal.aborted) setResult({ query, people, note: partial ? 'Einige Postfächer sind gerade nicht erreichbar.' : '' })
      }).catch(e => {
        if (!controller.signal.aborted) setResult({ query, people: [], note: (e as Error).message })
      })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, show])

  useEffect(() => {
    if (show) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId, show])

  const choose = (person: Address) => {
    update([...chips, person], '')
    setDismissed(true); setActive(0)
    input.current?.focus()
  }
  return <div className="relative min-w-0 flex-1">
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-white px-2 py-1.5 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {chips.map(person => <span key={person.address} className="inline-flex max-w-full items-center gap-1 rounded-md border border-indigo2-200 bg-indigo2-50 pl-2 text-indigo2-700" title={person.address}>
        <Check aria-hidden="true" className="h-3 w-3 shrink-0" />
        <span className="min-w-0 py-1 text-xs leading-tight">
          {person.name && <span className="block truncate font-semibold">{person.name}</span>}
          <span className="block truncate">{person.address}</span>
        </span>
        <button type="button" aria-label={`${person.address} entfernen`} className="shrink-0 rounded p-1.5 hover:bg-indigo2-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => { update(chips.filter(p => p.address !== person.address), draft); input.current?.focus() }}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </span>)}
      <input ref={input} id={id} name={id} aria-label={label} value={draft} placeholder={chips.length ? 'Weitere Empfänger …' : 'Name oder E-Mail-Adresse …'}
        className="h-7 w-40 min-w-[150px] max-w-full flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        autoComplete="off" autoCapitalize="none" spellCheck={false} role="combobox" aria-autocomplete="list"
        aria-expanded={show} aria-controls={show ? listId : undefined}
        aria-activedescendant={show && people[active] ? `${listId}-${active}` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commit() }}
        onChange={e => {
          const text = e.target.value
          if (/[,;\n]/.test(text)) commit(text)
          else update(chips, text)
          setDismissed(false); setActive(0)
        }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Escape' && show) { e.preventDefault(); e.stopPropagation(); setDismissed(true) }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (people.length) { e.preventDefault(); setDismissed(false); setActive(n => (n + (e.key === 'ArrowDown' ? 1 : -1) + people.length) % people.length) }
          }
          if (e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation()
            if (show && people[active]) choose(people[active])
            else commit()
          }
          if (e.key === 'Tab' && draft.trim()) commit()
        }} />
    </div>
    {!focused && draft.trim() && <p className="mt-1 text-xs text-destructive" role="status">Bitte „{draft}“ auswählen oder als vollständige E-Mail-Adresse eingeben.</p>}
    {show && <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
      <div className="px-3 py-2 text-[11px] font-medium text-steel">Kontakte aus deinen Mails</div>
      <ul id={listId} role="listbox" aria-label="Empfängervorschläge" className="max-h-60 overflow-y-auto">
        {people.map((person, i) => <li key={person.address} id={`${listId}-${i}`} role="option" aria-selected={i === active}
          className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-ice' : 'hover:bg-ice/60'}`}
          onPointerDown={e => e.preventDefault()} onClick={() => choose(person)} onPointerMove={() => setActive(i)}>
          <div className="truncate text-sm font-medium text-asphalt">{person.name || person.address}</div>
          {person.name && <div className="truncate text-xs text-steel">{person.address}</div>}
        </li>)}
      </ul>
      <div role="status" className="px-3 py-2 text-xs text-steel">
        {loading ? 'Suche …' : result?.note || (!people.length ? 'Keine passenden Kontakte. Du kannst die Adresse direkt eingeben.' : '↑ ↓ auswählen · Enter übernehmen')}
      </div>
    </div>}
  </div>
}
