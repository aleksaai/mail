import { getToken } from './auth'

/**
 * April im Postfach: übersetzen und überarbeiten über den Agent-Gateway
 * (`/api/mail-hilfe`). Als Nachweis geht Aleksas Microsoft-Token mit, der Gateway
 * prüft damit bei Microsoft, wer anfragt. Ein Gateway-Token liegt nie im Browser.
 */
const GATEWAY = (import.meta.env.VITE_GATEWAY_URL || 'https://aleksa-ai-team-production.up.railway.app').replace(/\/$/, '')

export const LANGUAGES = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'Englisch' },
  { id: 'hu', label: 'Ungarisch' },
  { id: 'sr', label: 'Serbisch' },
  { id: 'hr', label: 'Kroatisch' },
] as const
export type LanguageId = (typeof LANGUAGES)[number]['id']

type Request =
  | { action: 'translate'; text: string; target: LanguageId; format: 'html' | 'text' }
  | { action: 'improve'; text: string; instruction: string; target?: LanguageId }

export async function askApril(req: Request): Promise<string> {
  const token = await getToken()
  const t0 = Date.now()
  let r: Response
  try {
    r = await fetch(`${GATEWAY}/api/mail-hilfe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
  } catch (e) {
    // Netzwerkfehler ohne Antwort ("Load failed"): Dauer mitgeben, damit man die Anfrage im Gateway-Trace findet.
    throw new Error(`Keine Verbindung zu April nach ${Math.round((Date.now() - t0) / 100) / 10}s (${(e as Error).message})`)
  }
  const data = await r.json().catch(() => ({})) as { result?: string; error?: string }
  if (!r.ok || !data.result) throw new Error(data.error || `April antwortet nicht (${r.status})`)
  return data.result
}

// ---- April schlägt Antworten vor (Spec docs/SPEC-april-vorschlaege.md) ----

export interface Brief {
  zusammenfassung: string
  antwort_noetig: boolean
  frist: string | null
  vorschlaege: { label: string; absicht: string }[]
}

async function post(body: unknown, signal?: AbortSignal): Promise<Response> {
  const token = await getToken()
  const t0 = Date.now()
  try {
    return await fetch(`${GATEWAY}/api/mail-hilfe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error(`Keine Verbindung zu April nach ${Math.round((Date.now() - t0) / 100) / 10}s (${(e as Error).message})`)
  }
}

const cacheKey = (kind: string, id: string) => `april:${kind}:${id}`
const readCache = <T,>(key: string): T | null => {
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) as T : null } catch { return null }
}
const writeCache = (key: string, v: unknown) => {
  try { sessionStorage.setItem(key, JSON.stringify(v)) } catch { /* voll: dann eben ohne Cache */ }
}

/** Zusammenfassung + Vorschläge zu einer Mail. Je Mail-ID einmal pro Sitzung, damit nichts doppelt kostet. */
export async function brief(messageId: string, kontext: unknown): Promise<Brief> {
  const key = cacheKey('brief', messageId)
  const hit = readCache<Brief>(key)
  if (hit) return hit
  const r = await post({ action: 'brief', kontext })
  const data = await r.json().catch(() => ({})) as { result?: Brief; error?: string }
  if (!r.ok || !data.result) throw new Error(data.error || `April antwortet nicht (${r.status})`)
  writeCache(key, data.result)
  return data.result
}

export const cachedDraft = (messageId: string, absicht: string) => readCache<string>(cacheKey(`draft:${absicht}`, messageId))
export const storeDraft = (messageId: string, absicht: string, html: string) => writeCache(cacheKey(`draft:${absicht}`, messageId), html)

/**
 * Entwurf für eine Absicht, gestreamt. `onText` bekommt den bisher geschriebenen Text.
 * Mit `vorher` + `instruction` überarbeitet April einen vorhandenen Entwurf (Kürzer, Förmlicher …).
 */
export async function draft(o: {
  kontext: unknown; absicht: string; instruction?: string; target?: LanguageId; vorher?: string
  onText: (full: string) => void; signal?: AbortSignal
}): Promise<string> {
  const r = await post({ action: 'draft', kontext: o.kontext, absicht: o.absicht, instruction: o.instruction, target: o.target, vorher: o.vorher }, o.signal)
  if (!r.ok || !r.body) {
    const data = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error || `April antwortet nicht (${r.status})`)
  }
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let full = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
      const line = chunk.split('\n').find(l => l.startsWith('data:'))
      if (!line) continue
      let ev: { t?: string; done?: boolean; error?: string }
      try { ev = JSON.parse(line.slice(5).trim()) } catch { continue }
      if (ev.error) throw new Error(ev.error)
      if (ev.t) { full += ev.t; o.onText(stripFence(full)) }
    }
  }
  return stripFence(full).trim()
}

const stripFence = (s: string) => s.replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '')

/** Nur die Tags, die der Editor kennt; alles andere fliegt raus, bevor es eingesetzt wird. */
export function cleanAprilHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'DIV'])
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      walk(child)
      if (!allowed.has(child.tagName)) { child.replaceWith(...Array.from(child.childNodes)); continue }
      for (const attr of Array.from(child.attributes)) {
        const keep = child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:|tel:)/i.test(attr.value)
        if (!keep) child.removeAttribute(attr.name)
      }
    }
  }
  const root = doc.body.firstElementChild!
  walk(root)
  return root.innerHTML
}
