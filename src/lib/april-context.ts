import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { graph, type Message } from './graph'
import { listAllEvents } from './calendar'
import type { Mailbox } from '@/config/mailboxes'

/**
 * Was April zu einer geöffneten Mail mitbekommt (Spec §4): die Mail selbst, den Verlauf der
 * Unterhaltung, die letzten Mails, die Aleksa an diesen Absender geschrieben hat, und die
 * belegten Zeiten der nächsten 14 Tage. Alles als kurzer Text, nichts wird gespeichert.
 * Jede Quelle darf einzeln ausfallen, dann fehlt sie eben.
 */
export interface AprilKontext {
  postfach: string
  antwortVon: string
  mail: string
  verlauf?: string
  gesendet?: string
  kalender?: string
}

/** Postfächer mit April-Vorschlägen (Aleksa 02.10.2026). Archiv und April-Postfach bleiben draußen. */
export const APRIL_BOXES = new Set(['info', 'aleksa', 'consulting'])

const BOX_LABEL: Record<string, string> = {
  info: 'info@aleksa.ai (Hauptpostfach, Aleksa AI / Spalevic Consulting Kft.)',
  aleksa: 'aleksa@spalevic-partner.com (persönliches Postfach)',
  consulting: 'aleksa@spalevic-consulting.de (Spalevic Consulting)',
}

/** HTML einer Mail → lesbarer Text, Zitate älterer Mails weg, gekürzt. */
export function plain(html: string, max = 8000): string {
  const marked = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
  const doc = new DOMParser().parseFromString(marked, 'text/html')
  doc.querySelectorAll('style,script,head,blockquote,#divRplyFwdMsg,#appendonsend,.gmail_quote').forEach(n => n.remove())
  let text = (doc.body.textContent ?? '').replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim()
  // Typische Zitat-Einleitungen: alles danach ist die alte Mail.
  const cut = text.search(/\n(Von|From|Am .{5,80} schrieb|On .{5,80} wrote)[: ]/)
  if (cut > 200) text = text.slice(0, cut).trim()
  return text.length > max ? `${text.slice(0, max)} …` : text
}

const name = (a?: { name?: string; address: string }) => a ? (a.name ? `${a.name} <${a.address}>` : a.address) : '?'
const when = (iso?: string) => iso ? format(new Date(iso), 'EEE d.M.yyyy HH:mm', { locale: de }) : ''

function header(m: Message): string {
  return [
    `Von: ${name(m.from?.emailAddress)}`,
    `An: ${(m.toRecipients ?? []).map(r => name(r.emailAddress)).join(', ')}`,
    m.ccRecipients?.length ? `Cc: ${m.ccRecipients.map(r => name(r.emailAddress)).join(', ')}` : '',
    `Datum: ${when(m.receivedDateTime || m.sentDateTime)}`,
    `Betreff: ${m.subject || '(kein Betreff)'}`,
  ].filter(Boolean).join('\n')
}

/** Von welcher Adresse geantwortet wird: die eigene Adresse, an die die Mail ging (Alias bleibt Alias). */
export function replyFrom(mb: Mailbox, m: Message): string {
  const own = new Set(mb.from.map(a => a.toLowerCase()))
  const hit = [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].map(r => r.emailAddress.address).find(a => own.has(a.toLowerCase()))
  return hit ?? mb.from[0] ?? mb.address
}

async function verlauf(mb: Mailbox, m: Message): Promise<string | undefined> {
  if (!m.conversationId) return
  const f = encodeURIComponent(`conversationId eq '${m.conversationId.replace(/'/g, "''")}'`)
  const r = await graph<{ value: Message[] }>(`/${mb.path}/messages?$filter=${f}&$top=15&$select=id,from,toRecipients,ccRecipients,subject,receivedDateTime,sentDateTime,body`)
  const others = r.value
    .filter(x => x.id !== m.id)
    .sort((a, b) => (b.receivedDateTime || b.sentDateTime || '').localeCompare(a.receivedDateTime || a.sentDateTime || ''))
    .slice(0, 5)
    .reverse()
  if (!others.length) return
  return others.map(x => `${header(x)}\n\n${plain(x.body.content, 3000)}`).join('\n\n---\n\n')
}

async function gesendet(mb: Mailbox, m: Message): Promise<string | undefined> {
  const to = m.from?.emailAddress.address
  if (!to) return
  const f = encodeURIComponent(`toRecipients/any(r:r/emailAddress/address eq '${to.replace(/'/g, "''")}')`)
  const r = await graph<{ value: Message[] }>(`/${mb.path}/mailFolders/sentitems/messages?$filter=${f}&$top=10&$select=id,conversationId,toRecipients,subject,sentDateTime,body`)
  const list = r.value
    .filter(x => x.conversationId !== m.conversationId)
    .sort((a, b) => (b.sentDateTime ?? '').localeCompare(a.sentDateTime ?? ''))
    .slice(0, 3)
  if (!list.length) return
  return list.map(x => `Datum: ${when(x.sentDateTime)}\nBetreff: ${x.subject}\n\n${plain(x.body.content, 1500)}`).join('\n\n---\n\n')
}

/** Belegte Zeiten der nächsten 14 Tage, ohne Titel (April braucht nur frei/belegt). */
async function kalender(): Promise<string | undefined> {
  const from = new Date()
  const to = new Date(from.getTime() + 14 * 86400_000)
  const events = (await listAllEvents(from, to)).filter(e => !e.isCancelled && e.showAs !== 'free' && e.response !== 'declined')
  if (!events.length) return 'Keine belegten Termine.'
  return events.map(e => e.isAllDay
    ? `${format(e.start, 'EEE d.M.', { locale: de })} ganztägig belegt`
    : `${format(e.start, 'EEE d.M. HH:mm', { locale: de })}–${format(e.end, 'HH:mm')}${e.showAs === 'tentative' ? ' (vorläufig)' : ''}`).join('\n')
}

const opt = <T,>(p: Promise<T>) => p.catch(err => { console.warn('April-Kontext unvollständig', err); return undefined })

export async function buildKontext(mb: Mailbox, m: Message): Promise<AprilKontext> {
  const [v, g, k] = await Promise.all([opt(verlauf(mb, m)), opt(gesendet(mb, m)), opt(kalender())])
  const body = m.body.contentType === 'html' ? m.body.content : m.body.content.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return {
    postfach: BOX_LABEL[mb.id] ?? mb.address,
    antwortVon: replyFrom(mb, m),
    mail: `${header(m)}\n\n${plain(body, 20_000)}`,
    verlauf: v || undefined,
    gesendet: g || undefined,
    kalender: k || undefined,
  }
}
