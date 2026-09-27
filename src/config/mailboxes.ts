/**
 * Die Postfaecher, jedes als eigener Bereich (Aleksa 27.09.2026: „alle getrennt halten").
 * `path` ist der Graph-Pfad: `me` fuer das eigene Postfach, sonst `users/<adresse>` (freigegeben).
 * `from` = Adressen, mit denen aus diesem Bereich gesendet werden darf. Leer = nur lesen.
 */
export interface Mailbox {
  id: string
  label: string
  address: string
  path: string
  from: string[]
  hint?: string
}

export const MAILBOXES: Mailbox[] = [
  {
    id: 'aleksa',
    label: 'Aleksa',
    address: 'aleksa@spalevic-partner.com',
    path: 'me',
    // Aliase im selben Postfach — Senden als Alias braucht SendFromAliasesEnabled im Mandanten.
    from: ['aleksa@spalevic-partner.com', 'aleksa@spalevic-consulting.de'],
  },
  {
    id: 'info',
    label: 'info@aleksa.ai',
    address: 'info@aleksa.ai',
    path: 'users/info@aleksa.ai',
    from: ['info@aleksa.ai'],
  },
  {
    id: 'april',
    label: 'April',
    address: 'april@aleksa.ai',
    path: 'users/april@aleksa.ai',
    from: [],
    hint: 'Aprils Postfach — hier sendet sie selbst, du liest mit.',
  },
]

export const mailboxById = (id?: string) => MAILBOXES.find(m => m.id === id)

export const FOLDERS = [
  { id: 'inbox', label: 'Posteingang' },
  { id: 'drafts', label: 'Entwürfe' },
  { id: 'sentitems', label: 'Gesendet' },
  { id: 'archive', label: 'Archiv' },
  { id: 'junkemail', label: 'Junk' },
  { id: 'deleteditems', label: 'Gelöscht' },
] as const
