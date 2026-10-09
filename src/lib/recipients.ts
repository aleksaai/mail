import { MAILBOXES } from '@/config/mailboxes'
import { graph, type Address } from './graph'

export type RecipientMessage = {
  from?: { emailAddress: Address }
  toRecipients?: { emailAddress: Address }[]
  ccRecipients?: { emailAddress: Address }[]
}

/** Accept a typed address or a pasted Outlook-style Name <address>. */
export function parseRecipient(text: string): Address | null {
  const match = text.trim().match(/^(.*?)<([^<>]+)>$/)
  const address = (match?.[2] ?? text).trim().toLowerCase()
  if (!/^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(address)) return null
  return { address, ...(match?.[1].trim() ? { name: match[1].trim().replace(/^"|"$/g, '') } : {}) }
}

/** Work on the token under the caret, preserving the other recipients. */
export function recipientToken(value: string, caret: number) {
  const start = Math.max(value.lastIndexOf(',', caret - 1), value.lastIndexOf(';', caret - 1)) + 1
  const rest = value.slice(caret).search(/[,;]/)
  const end = rest < 0 ? value.length : caret + rest
  return { start, end, query: value.slice(start, end).trim() }
}

export function insertRecipient(value: string, caret: number, address: string) {
  const { start, end } = recipientToken(value, caret)
  const prefix = value.slice(0, start)
  const inserted = `${prefix}${start ? ' ' : ''}${address}`
  const suffix = value.slice(end)
  return { value: inserted + (suffix || ', '), caret: inserted.length + (suffix ? 0 : 2) }
}

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export function rankRecipients(messages: RecipientMessage[], query: string): Address[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  const found = new Map<string, { person: Address; count: number }>()
  for (const message of messages) {
    const seen = new Set<string>()
    for (const entry of [message.from, ...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])]) {
      const person = entry?.emailAddress
      if (!person || !/^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(person.address)) continue
      const address = person.address.toLowerCase()
      if (seen.has(address)) continue
      seen.add(address)
      const previous = found.get(address)
      found.set(address, { person: { address, name: previous?.person.name || person.name }, count: (previous?.count ?? 0) + 1 })
    }
  }
  const score = (p: Address) => normalize(p.address).startsWith(normalize(query)) || normalize(p.name ?? '').startsWith(normalize(query)) ? 1 : 0
  return [...found.values()]
    .filter(({ person }) => terms.every(t => normalize(`${person.name ?? ''} ${person.address}`).includes(t)))
    .sort((a, b) => score(b.person) - score(a.person) || b.count - a.count || (a.person.name || a.person.address).localeCompare(b.person.name || b.person.address))
    .map(({ person }) => person)
}

/** Existing mail permissions suffice; only address headers are fetched, never message bodies. */
export async function searchRecipients(query: string, signal: AbortSignal) {
  // Restrict KQL input to literal name/address characters (no operators or quotes).
  const words = query.match(/[\p{L}\p{N}@._+-]+/gu) ?? []
  if (!words.length) return { people: [], partial: false }
  const search = JSON.stringify(words.map(word => `participants:${word}*`).join(' AND '))
  const params = new URLSearchParams({ '$search': search, '$top': '75', '$select': 'from,toRecipients,ccRecipients' })
  const results = await Promise.allSettled(MAILBOXES.map(mb =>
    graph<{ value: RecipientMessage[] }>(`/${mb.path}/messages?${params}`, { signal })))
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError')
  const successful = results.filter((r): r is PromiseFulfilledResult<{ value: RecipientMessage[] }> => r.status === 'fulfilled')
  if (!successful.length) throw new Error('Empfängersuche gerade nicht verfügbar. Adresse bitte direkt eingeben.')
  return { people: rankRecipients(successful.flatMap(r => r.value.value), query), partial: successful.length < results.length }
}
