import { graph } from './graph'

/**
 * Kalender ueber Graph mit Aleksas delegierten Rechten. Alle Zeiten laufen in Europe/Berlin:
 * graph() schickt `Prefer: outlook.timezone="Europe/Berlin"`, Graph liefert dann Wandzeit ohne Offset,
 * und wir schreiben mit ausdruecklicher Zeitzone zurueck (Lehre aus der Bridge: sonst 2 h Versatz).
 */
export const TZ = 'Europe/Berlin'

export interface CalEvent {
  id: string
  subject: string
  start: Date
  end: Date
  isAllDay: boolean
  location?: string
  bodyPreview?: string
  body?: string
  organizer?: { name?: string; address?: string }
  attendees: { name?: string; address: string; response: string }[]
  isOrganizer: boolean
  response: string // none | organizer | accepted | tentativelyAccepted | declined | notResponded
  showAs: string
  isCancelled: boolean
  seriesMasterId?: string
  type: string
  webLink?: string
  calendarId?: string
}

/** Graph-Wandzeit ('2026-09-28T09:00:00.0000000', Europe/Berlin) → Date. Der Browser laeuft in Mitteleuropa. */
const parse = (v: string) => new Date(v.replace(/\.\d+$/, ''))
/** Date → Wandzeit fuer Graph (lokale Uhrzeit, ohne Offset, Zone kommt separat). */
export const wall = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

const FIELDS = 'id,subject,start,end,isAllDay,location,bodyPreview,organizer,attendees,isOrganizer,responseStatus,showAs,isCancelled,seriesMasterId,type,webLink'

function toEvent(e: any, calendarId?: string): CalEvent {
  return {
    id: e.id,
    subject: e.subject || '(ohne Titel)',
    start: parse(e.start.dateTime),
    end: parse(e.end.dateTime),
    isAllDay: !!e.isAllDay,
    location: e.location?.displayName || undefined,
    bodyPreview: e.bodyPreview,
    body: e.body?.content,
    organizer: e.organizer?.emailAddress,
    attendees: (e.attendees ?? []).map((a: any) => ({ name: a.emailAddress?.name, address: a.emailAddress?.address, response: a.status?.response ?? 'none' })),
    isOrganizer: !!e.isOrganizer,
    response: e.responseStatus?.response ?? 'none',
    showAs: e.showAs ?? 'busy',
    isCancelled: !!e.isCancelled,
    seriesMasterId: e.seriesMasterId,
    type: e.type,
    webLink: e.webLink,
    calendarId,
  }
}

export interface Calendar { id: string; name: string; color: string; hexColor?: string; isDefaultCalendar: boolean; canEdit: boolean }

export const listCalendars = () =>
  graph<{ value: Calendar[] }>('/me/calendars?$select=id,name,color,hexColor,isDefaultCalendar,canEdit&$top=50').then(r => r.value)

/** Termine im Zeitraum, Serien bereits aufgeloest (calendarView). Folgeseiten werden mitgeladen. */
export async function listEvents(from: Date, to: Date, calendarId?: string): Promise<CalEvent[]> {
  const base = calendarId ? `/me/calendars/${calendarId}/calendarView` : '/me/calendarView'
  let url: string | undefined = `${base}?startDateTime=${encodeURIComponent(wall(from))}&endDateTime=${encodeURIComponent(wall(to))}&$top=250&$orderby=start/dateTime&$select=${FIELDS}`
  const out: CalEvent[] = []
  while (url) {
    const r: { value: any[]; '@odata.nextLink'?: string } = await graph(url)
    out.push(...r.value.map(e => toEvent(e, calendarId)))
    url = r['@odata.nextLink']
  }
  return out
}

export const getEvent = (id: string) => graph<any>(`/me/events/${encodeURIComponent(id)}?$select=${FIELDS},body`).then(e => toEvent(e))

export interface EventDraft {
  subject: string
  start: Date
  end: Date
  isAllDay: boolean
  location: string
  body: string
  attendees: string
}

function payload(d: EventDraft) {
  const s = d.isAllDay ? new Date(d.start.getFullYear(), d.start.getMonth(), d.start.getDate()) : d.start
  const e = d.isAllDay ? new Date(d.end.getFullYear(), d.end.getMonth(), d.end.getDate() + 1) : d.end
  return {
    subject: d.subject,
    isAllDay: d.isAllDay,
    start: { dateTime: wall(s), timeZone: TZ },
    end: { dateTime: wall(e), timeZone: TZ },
    location: { displayName: d.location },
    body: { contentType: 'text', content: d.body },
    attendees: d.attendees.split(/[,;]/).map(a => a.trim()).filter(Boolean).map(address => ({ emailAddress: { address }, type: 'required' })),
  }
}

export const createEvent = (d: EventDraft, calendarId?: string) =>
  graph(calendarId ? `/me/calendars/${calendarId}/events` : '/me/events', { method: 'POST', body: JSON.stringify(payload(d)) })

export const updateEvent = (id: string, d: EventDraft) =>
  graph(`/me/events/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload(d)) })

/** Eigener Termin: loeschen (Teilnehmer bekommen eine Absage). Fremde Einladung: ablehnen statt loeschen. */
export const deleteEvent = (id: string) => graph(`/me/events/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const respond = (id: string, answer: 'accept' | 'tentativelyAccept' | 'decline', comment = '') =>
  graph(`/me/events/${encodeURIComponent(id)}/${answer}`, { method: 'POST', body: JSON.stringify({ comment, sendResponse: true }) })
