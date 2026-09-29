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
  /** Erkennungsfarbe in Leiste und "Alle Posteingänge" */
  color: string
  /** Kurzbeschreibung unter dem Namen, damit klar ist, was drin landet */
  sub: string
}

export const MAILBOXES: Mailbox[] = [
  {
    id: 'info',
    color: '#8b79f0',
    sub: 'Hauptpostfach',
    label: 'info@aleksa.ai',
    address: 'info@aleksa.ai',
    path: 'users/info@aleksa.ai',
    from: ['info@aleksa.ai'],
  },
  {
    id: 'aleksa',
    color: '#3b82f6',
    sub: 'aleksa@spalevic-partner.com',
    label: 'Aleksa persönlich',
    address: 'aleksa@spalevic-partner.com',
    path: 'me',
    from: ['aleksa@spalevic-partner.com'],
  },
  {
    id: 'consulting',
    color: '#0ea5a4',
    sub: 'aleksa@spalevic-consulting.de',
    label: 'Spalevic Consulting',
    address: 'aleksa@spalevic-consulting.de',
    path: 'users/aleksa@spalevic-consulting.de',
    from: ['aleksa@spalevic-consulting.de'],
  },
  {
    id: 'april',
    color: '#f59e0b',
    sub: 'april@aleksa.ai · nur lesen',
    label: 'April',
    address: 'april@aleksa.ai',
    path: 'users/april@aleksa.ai',
    from: [],
    hint: 'Aprils Postfach — hier sendet sie selbst, du liest mit.',
  },
  {
    id: 'destinymedia',
    color: '#94a3b8',
    sub: 'Archiv · nur lesen',
    label: 'Archiv DestinyMedia',
    address: 'archiv.destinymedia@spalevic-partner.com',
    path: 'users/archiv.destinymedia@spalevic-partner.com',
    from: [],
    hint: 'Archiv von aleksa@destinymedia.de (Domain abgelaufen) — nur lesen, für die Liquidation.',
  },
]

/** Hauptpostfach: steht oben, ist als einziges aufgeklappt und die Startseite (Aleksa 29.09.2026). */
export const PRIMARY_MAILBOX = 'info'

/** Postfaecher in "Alle Posteingänge": alle, in denen Aleksa selbst Post bekommt (nicht April, nicht das Archiv). */
export const INBOX_BOXES = MAILBOXES.filter(m => m.from.length > 0)

export const mailboxById = (id?: string) => MAILBOXES.find(m => m.id === id)

export const FOLDERS = [
  { id: 'inbox', label: 'Posteingang' },
  { id: 'drafts', label: 'Entwürfe' },
  { id: 'sentitems', label: 'Gesendet' },
  { id: 'archive', label: 'Archiv' },
  { id: 'junkemail', label: 'Junk' },
  { id: 'deleteditems', label: 'Gelöscht' },
] as const
