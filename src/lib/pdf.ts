import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { prepareMailHtml } from '@/components/mail/HtmlFrame'
import type { Address, Attachment, Message } from '@/lib/graph'

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const addr = (a?: Address) => (a ? (a.name && a.name !== a.address ? `${esc(a.name)} &lt;${esc(a.address)}&gt;` : esc(a.address)) : '')
const list = (r?: { emailAddress: Address }[]) => (r ?? []).map(x => addr(x.emailAddress)).join(', ')

/** Dateiname, den "Als PDF sichern" vorschlaegt: 2026-09-29 Absender - Betreff */
export function pdfTitle(m: Message) {
  const d = m.receivedDateTime || m.sentDateTime
  const sender = m.from?.emailAddress.name || m.from?.emailAddress.address || ''
  const raw = `${d ? format(new Date(d), 'yyyy-MM-dd') : ''} ${sender} - ${m.subject || 'ohne Betreff'}`
  return raw.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

/**
 * Mail als PDF sichern: Druckvorlage in einem unsichtbaren iframe, danach der Druckdialog des Browsers
 * ("Als PDF sichern"). Ergibt ein echtes Text-PDF (durchsuchbar, Links klickbar) statt eines Bildschirmfotos.
 * Der Mail-Inhalt bleibt ohne Skripte: sandbox ohne allow-scripts plus CSP.
 */
export function saveMessageAsPdf(m: Message, html: string, opts: { inline: Record<string, string>; allowRemote: boolean; attachments: Attachment[] }) {
  const { body, csp } = prepareMailHtml(html, opts.inline, opts.allowRemote)
  const d = m.receivedDateTime || m.sentDateTime
  const title = pdfTitle(m)
  const files = opts.attachments.filter(a => !a.isInline)
  const row = (k: string, v: string) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '')

  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${esc(title)}</title>
<style>
@page{size:A4;margin:16mm 15mm}
html,body{margin:0;padding:0;font-family:Figtree,-apple-system,Helvetica,Arial,sans-serif;font-size:11pt;color:#161c24;line-height:1.5;word-wrap:break-word;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.head{border-bottom:1px solid #dce0e7;padding-bottom:10px;margin-bottom:16px}
.head h1{font-size:15pt;line-height:1.3;margin:0 0 8px}
.head table{border-collapse:collapse;font-size:9.5pt}
.head th{text-align:left;font-weight:600;color:#68788d;padding:1px 12px 1px 0;vertical-align:top;white-space:nowrap}
.head td{padding:1px 0;color:#161c24}
img{max-width:100%;height:auto}blockquote{margin:0 0 0 .5rem;padding-left:.75rem;border-left:2px solid #dce0e7;color:#68788d}a{color:#6d59d8}pre{white-space:pre-wrap;font-family:inherit}
table{max-width:100%}
</style></head><body>
<div class="head"><h1>${esc(m.subject || '(kein Betreff)')}</h1><table>
${row('Von', addr(m.from?.emailAddress))}
${row('An', list(m.toRecipients))}
${row('Cc', list(m.ccRecipients))}
${row('Datum', d ? esc(format(new Date(d), "EEEE, d. MMMM yyyy 'um' HH:mm", { locale: de })) : '')}
${row('Anhänge', files.map(a => esc(a.name)).join(', '))}
</table></div>
<div class="body">${body}</div>
</body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' })

  const prevTitle = document.title
  const cleanup = () => { document.title = prevTitle; frame.remove() }
  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) return cleanup()
    // Manche Browser nehmen den Titel der Hauptseite als Dateinamen, andere den des iframes: beide setzen.
    document.title = title
    win.addEventListener('afterprint', () => setTimeout(cleanup, 100))
    setTimeout(() => { win.focus(); win.print() }, 150)
    setTimeout(cleanup, 5 * 60_000)
  }
  frame.srcdoc = doc
  document.body.appendChild(frame)
}
