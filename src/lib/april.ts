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
  const r = await fetch(`${GATEWAY}/api/mail-hilfe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  const data = await r.json().catch(() => ({})) as { result?: string; error?: string }
  if (!r.ok || !data.result) throw new Error(data.error || `April antwortet nicht (${r.status})`)
  return data.result
}

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
