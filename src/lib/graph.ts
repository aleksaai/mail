import { getToken } from './auth'
import type { Mailbox } from '@/config/mailboxes'

const BASE = 'https://graph.microsoft.com/v1.0'

export async function graph<T = any>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'outlook.timezone="Europe/Berlin", outlook.body-content-type="html"',
      ...(init.headers ?? {}),
    },
  })
  if (init.raw) return res as unknown as T
  if (res.status === 202 || res.status === 204) return {} as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data?.error?.message ?? `Graph ${res.status}`)
  return data as T
}

export interface Address { name?: string; address: string }
export interface MessageSummary {
  id: string
  conversationId: string
  subject: string
  bodyPreview: string
  receivedDateTime: string
  sentDateTime?: string
  isRead: boolean
  isDraft: boolean
  hasAttachments: boolean
  importance: string
  flag?: { flagStatus: string }
  from?: { emailAddress: Address }
  toRecipients?: { emailAddress: Address }[]
  singleValueExtendedProperties?: { id: string; value: string }[]
}
export interface Message extends MessageSummary {
  body: { contentType: string; content: string }
  ccRecipients?: { emailAddress: Address }[]
  replyTo?: { emailAddress: Address }[]
  webLink?: string
}
export interface Attachment { id: string; name: string; contentType: string; size: number; isInline: boolean; contentId?: string }
export interface Folder { id: string; displayName: string; unreadItemCount: number; totalItemCount: number }

const SUMMARY_FIELDS = 'id,conversationId,subject,bodyPreview,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,importance,flag,from,toRecipients'
const root = (mb: Mailbox) => `/${mb.path}`

/**
 * "Beantwortet/Weitergeleitet" wie in Outlook: Exchange merkt sich das in zwei MAPI-Eigenschaften
 * (PidTagLastVerbExecuted 0x1081 = 102 Antwort, 103 Allen antworten, 104 Weiterleiten; 0x1082 = Zeitpunkt).
 * Graph liefert sie nur auf ausdruecklichen Wunsch per $expand.
 */
const VERB = 'Integer 0x1081'
const VERB_TIME = 'SystemTime 0x1082'
const EXPAND_VERB = `$expand=${encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${VERB}')`)}`
/** Mit Markierung laden; lehnt Graph den $expand ab, ohne (die Liste darf daran nie scheitern). */
async function withVerb<T>(url: string): Promise<T> {
  try { return await graph<T>(`${url}&${EXPAND_VERB}`) }
  catch (e) { if (/expand|extended|filter|Invalid/i.test((e as Error).message)) return graph<T>(url); throw e }
}
/**
 * "Senden planen": Exchange haelt eine abgeschickte Mail bis zu diesem Zeitpunkt im Postausgang zurueck
 * (PidTagDeferredSendTime 0x3FEF). Outlook nutzt dieselbe Eigenschaft, der Versand passiert auf dem Server —
 * die App muss dafuer nicht offen sein.
 */
export const DEFERRED = 'SystemTime 0x3FEF'
const EXPAND_DEFERRED = `$expand=${encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${DEFERRED}')`)}`
/** Geplanter Sendezeitpunkt einer Mail im Postausgang, sonst null. */
export function scheduledFor(m: MessageSummary): Date | null {
  const v = (m.singleValueExtendedProperties ?? []).find(p => p.id.toLowerCase() === DEFERRED.toLowerCase())?.value
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
/** Ordner der geplanten Mails (Graph-Name des Postausgangs). */
export const SCHEDULED_FOLDER = 'outbox'

export type Verb = 'reply' | 'replyAll' | 'forward'
export function lastVerb(m: MessageSummary): { kind: Verb } | null {
  const props = m.singleValueExtendedProperties ?? []
  const v = Number(props.find(p => p.id.toLowerCase() === VERB.toLowerCase())?.value)
  const kind: Verb | null = v === 102 ? 'reply' : v === 103 ? 'replyAll' : v === 104 ? 'forward' : null
  if (!kind) return null
  return { kind }
}

export const listFolders = (mb: Mailbox) =>
  graph<{ value: Folder[] }>(`${root(mb)}/mailFolders?$top=100&$select=id,displayName,unreadItemCount,totalItemCount`).then(r => r.value)

export const folderInfo = (mb: Mailbox, folder: string) =>
  graph<Folder>(`${root(mb)}/mailFolders/${folder}?$select=id,displayName,unreadItemCount,totalItemCount`)

export async function listMessages(mb: Mailbox, folder: string, opts: { next?: string; search?: string } = {}) {
  if (opts.next) return graph<{ value: MessageSummary[]; '@odata.nextLink'?: string }>(opts.next)
  if (opts.search) {
    const q = encodeURIComponent(`"${opts.search.replace(/"/g, '')}"`)
    return graph<{ value: MessageSummary[]; '@odata.nextLink'?: string }>(`${root(mb)}/messages?$search=${q}&$top=40&$select=${SUMMARY_FIELDS}`)
  }
  if (folder === SCHEDULED_FOLDER) {
    // Postausgang: nur geplante Mails, mit ihrem Sendezeitpunkt; ohne $expand, falls Graph ihn ablehnt.
    const url = `${root(mb)}/mailFolders/${folder}/messages?$top=40&$select=${SUMMARY_FIELDS}`
    try { return await graph<{ value: MessageSummary[]; '@odata.nextLink'?: string }>(`${url}&${EXPAND_DEFERRED}`) }
    catch { return graph<{ value: MessageSummary[]; '@odata.nextLink'?: string }>(url) }
  }
  const order = folder === 'drafts' || folder === 'sentitems' ? 'sentDateTime desc' : 'receivedDateTime desc'
  return withVerb<{ value: MessageSummary[]; '@odata.nextLink'?: string }>(
    `${root(mb)}/mailFolders/${folder}/messages?$top=40&$orderby=${encodeURIComponent(order)}&$select=${SUMMARY_FIELDS}`,
  )
}

export const getMessage = (mb: Mailbox, id: string, opts: { scheduled?: boolean } = {}) => {
  const url = `${root(mb)}/messages/${encodeURIComponent(id)}?$select=${SUMMARY_FIELDS},body,ccRecipients,replyTo,webLink`
  if (!opts.scheduled) return withVerb<Message>(url)
  return graph<Message>(`${url}&${EXPAND_DEFERRED}`).catch(() => graph<Message>(url))
}

/** Geplante Mail doch nicht senden: zurueck in die Entwuerfe. Der Sendezeitpunkt wird auf die Vergangenheit
 *  gesetzt, damit ein spaeteres Senden aus dem Entwurf sofort rausgeht statt erneut zu warten. */
export async function unschedule(mb: Mailbox, id: string) {
  const moved = await graph<Message>(`${root(mb)}/messages/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify({ destinationId: 'drafts' }) })
  await graph(`${root(mb)}/messages/${encodeURIComponent(moved.id ?? id)}`, { method: 'PATCH', body: JSON.stringify({
    singleValueExtendedProperties: [{ id: DEFERRED, value: '1970-01-01T00:00:00Z' }],
  }) }).catch(() => {})
}

/** Eigene Antworten/Weiterleitungen in derselben Unterhaltung (Gesendet), neueste zuerst. Fallback, falls
 *  die Outlook-Markierung fehlt (z.B. Antwort vom Handy oder aus einem anderen Programm). */
export async function sentInConversation(mb: Mailbox, conversationId: string) {
  const f = encodeURIComponent(`conversationId eq '${conversationId.replace(/'/g, "''")}'`)
  const r = await graph<{ value: MessageSummary[] }>(`${root(mb)}/mailFolders/sentitems/messages?$filter=${f}&$top=10&$select=id,subject,sentDateTime,toRecipients,conversationId`)
  return r.value.sort((a, b) => (b.sentDateTime ?? '').localeCompare(a.sentDateTime ?? ''))
}

export const listAttachments = (mb: Mailbox, id: string) =>
  graph<{ value: Attachment[] }>(`${root(mb)}/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline`).then(r => r.value)

export async function attachmentBlob(mb: Mailbox, messageId: string, attId: string): Promise<Blob> {
  const res = await graph<Response>(`${root(mb)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attId)}/$value`, { raw: true })
  if (!res.ok) throw new Error(`Anhang ${res.status}`)
  return res.blob()
}

/** Inline-Bilder (cid:) als data-URLs, damit der Sandbox-Frame sie ohne Netz zeigen kann. */
export async function inlineImages(mb: Mailbox, messageId: string): Promise<Record<string, string>> {
  const r = await graph<{ value: (Attachment & { contentBytes?: string })[] }>(
    `${root(mb)}/messages/${encodeURIComponent(messageId)}/attachments?$filter=isInline eq true`,
  ).catch(() => ({ value: [] }))
  const map: Record<string, string> = {}
  for (const a of r.value) if (a.contentId && a.contentBytes) map[a.contentId.replace(/[<>]/g, '')] = `data:${a.contentType};base64,${a.contentBytes}`
  return map
}

export const updateMessage = (mb: Mailbox, id: string, patch: Partial<{ isRead: boolean; flag: { flagStatus: string } }>) =>
  graph(`${root(mb)}/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const moveMessage = (mb: Mailbox, id: string, destinationId: string) =>
  graph(`${root(mb)}/messages/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify({ destinationId }) })

const recipients = (list: string) =>
  list.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(address => ({ emailAddress: { address } }))

/** `sendAt`: Mail erst zu diesem Zeitpunkt senden (Exchange haelt sie im Postausgang zurueck). */
export interface Draft { from: string; to: string; cc: string; subject: string; html: string; files?: File[]; sendAt?: Date | null }

/** Grenze fuer den direkten Upload; darueber Upload-Sitzung in Stuecken (Graph erlaubt bis 150 MB je Anhang). */
const SMALL = 3 * 1024 * 1024
export const MAX_ATTACHMENT = 150 * 1024 * 1024

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf); let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function attach(mb: Mailbox, draftId: string, file: File) {
  const base = `${root(mb)}/messages/${encodeURIComponent(draftId)}/attachments`
  if (file.size <= SMALL) {
    await graph(base, { method: 'POST', body: JSON.stringify({
      '@odata.type': '#microsoft.graph.fileAttachment', name: file.name, contentType: file.type || 'application/octet-stream',
      contentBytes: toBase64(await file.arrayBuffer()),
    }) })
    return
  }
  const session = await graph<{ uploadUrl: string }>(`${base}/createUploadSession`, { method: 'POST', body: JSON.stringify({
    AttachmentItem: { attachmentType: 'file', name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' },
  }) })
  const CHUNK = 4 * 1024 * 1024
  for (let start = 0; start < file.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, file.size)
    // Die uploadUrl ist vorab autorisiert — ohne Authorization-Header senden, sonst lehnt Graph ab.
    const res = await fetch(session.uploadUrl, { method: 'PUT', body: file.slice(start, end), headers: { 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` } })
    if (!res.ok) throw new Error(`Anhang „${file.name}“: Upload ${res.status}`)
  }
}

const fields = (mb: Mailbox, d: Draft) => ({
  subject: d.subject,
  toRecipients: recipients(d.to),
  ccRecipients: recipients(d.cc),
  ...(d.from !== mb.address ? { from: { emailAddress: { address: d.from } } } : {}),
})

async function finish(mb: Mailbox, draftId: string, d: Draft) {
  for (const f of d.files ?? []) await attach(mb, draftId, f)
  if (d.sendAt && d.sendAt.getTime() > Date.now() + 30_000) {
    await graph(`${root(mb)}/messages/${encodeURIComponent(draftId)}`, { method: 'PATCH', body: JSON.stringify({
      singleValueExtendedProperties: [{ id: DEFERRED, value: d.sendAt.toISOString() }],
    }) })
  }
  await graph(`${root(mb)}/messages/${encodeURIComponent(draftId)}/send`, { method: 'POST', body: '{}' })
}

/** Neue Mail: Entwurf anlegen, Anhaenge dran, senden — aus dem Bereich des Postfachs, mit gewaehlter Absenderadresse. */
export async function sendNew(mb: Mailbox, d: Draft) {
  const draft = await graph<Message>(`${root(mb)}/messages`, { method: 'POST', body: JSON.stringify({ ...fields(mb, d), body: { contentType: 'HTML', content: d.html } }) })
  await finish(mb, draft.id, d)
}

/** Eigene Antwort an den Anfang des Microsoft-Entwurfs setzen, und zwar hinter <body>, nicht vor <html>. */
const withReply = (mine: string, quoted: string) => {
  const m = quoted.match(/<body[^>]*>/i)
  return m ? quoted.replace(m[0], `${m[0]}${mine}<br>`) : mine + quoted
}

/** Antworten/Weiterleiten: Entwurf von Microsoft erzeugen lassen (Zitat + Verlauf, beim Weiterleiten samt Original-Anhaengen), anpassen, Anhaenge dran, senden. */
export async function sendResponse(mb: Mailbox, messageId: string, kind: 'reply' | 'replyAll' | 'forward', d: Draft) {
  const action = kind === 'reply' ? 'createReply' : kind === 'replyAll' ? 'createReplyAll' : 'createForward'
  const draft = await graph<Message>(`${root(mb)}/messages/${encodeURIComponent(messageId)}/${action}`, { method: 'POST', body: '{}' })
  await graph(`${root(mb)}/messages/${encodeURIComponent(draft.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...fields(mb, d), body: { contentType: 'HTML', content: withReply(d.html, draft.body?.content ?? '') } }),
  })
  await finish(mb, draft.id, d)
  // Wie Outlook markieren, damit Liste, Lesebereich (und Outlook selbst) "beantwortet" zeigen. Scheitert still.
  const verb = kind === 'reply' ? 102 : kind === 'replyAll' ? 103 : 104
  await graph(`${root(mb)}/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: JSON.stringify({
    singleValueExtendedProperties: [{ id: VERB, value: String(verb) }, { id: VERB_TIME, value: new Date().toISOString() }],
  }) }).catch(() => {})
}

export const me = () => graph<{ displayName: string; mail: string; userPrincipalName: string }>('/me?$select=displayName,mail,userPrincipalName')
