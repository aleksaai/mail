import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { insertRecipient, recipientToken, searchRecipients } from '@/lib/recipients'
import type { Address } from '@/lib/graph'

export function RecipientInput({ id, label, value, onChange, exclude = '' }: {
  id: string; label: string; value: string; onChange: (value: string) => void; exclude?: string
}) {
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [caret, setCaret] = useState(value.length)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const [result, setResult] = useState<{ query: string; people: Address[]; note: string } | null>(null)
  const query = recipientToken(value, caret).query
  const show = focused && !dismissed && query.length > 0
  const selected = new Set(`${value.slice(0, recipientToken(value, caret).start)},${value.slice(recipientToken(value, caret).end)},${exclude}`.toLowerCase().split(/[,;]/).map(s => s.trim()))
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
    const next = insertRecipient(value, caret, person.address)
    onChange(next.value); setCaret(next.caret); setDismissed(true); setActive(0)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.caret, next.caret) })
  }
  return <div className="relative min-w-0 flex-1">
    <Input ref={input} id={id} name={id} aria-label={label} value={value} placeholder="Name oder E-Mail-Adresse …"
      autoComplete="off" autoCapitalize="none" spellCheck={false} role="combobox" aria-autocomplete="list"
      aria-expanded={show} aria-controls={show ? listId : undefined}
      aria-activedescendant={show && people[active] ? `${listId}-${active}` : undefined}
      onFocus={e => { setFocused(true); setCaret(e.target.selectionStart ?? value.length) }}
      onBlur={() => setFocused(false)}
      onSelect={e => { setCaret(e.currentTarget.selectionStart ?? value.length) }}
      onChange={e => { onChange(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); setDismissed(false); setActive(0) }}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Escape' && show) { e.preventDefault(); e.stopPropagation(); setDismissed(true) }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (people.length) { e.preventDefault(); setDismissed(false); setActive(n => (n + (e.key === 'ArrowDown' ? 1 : -1) + people.length) % people.length) }
        }
        if (e.key === 'Enter' && show && people[active]) { e.preventDefault(); e.stopPropagation(); choose(people[active]) }
      }} />
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
