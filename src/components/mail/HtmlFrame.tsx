import { useEffect, useMemo, useRef, useState } from 'react'

/** cid-Bilder einsetzen, externe Bilder ohne Freigabe entschaerfen, passende CSP (keine Skripte) liefern. */
export function prepareMailHtml(html: string, inline: Record<string, string>, allowRemote: boolean) {
  let body = html.replace(/cid:([^"'\s)>]+)/gi, (m, id) => inline[id] ?? m)
  if (!allowRemote) body = body.replace(/(<img[^>]+?)\ssrc=(["'])(https?:[^"']+)\2/gi, '$1 data-remote-src=$2$3$2')
  const csp = allowRemote
    ? "default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src *;"
    : "default-src 'none'; img-src data:; style-src 'unsafe-inline';"
  return { body, csp }
}

/**
 * Mail-HTML sicher anzeigen: Sandbox-iframe ohne Skripte, Links oeffnen in neuem Tab,
 * externe Bilder erst auf Klick (Tracking-Pixel verraten sonst, dass die Mail gelesen wurde).
 */
export function HtmlFrame({ html, inline, allowRemote }: { html: string; inline: Record<string, string>; allowRemote: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  const srcDoc = useMemo(() => {
    const { body, csp } = prepareMailHtml(html, inline, allowRemote)
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
<style>html,body{margin:0;padding:0;font-family:Figtree,-apple-system,sans-serif;font-size:14px;color:#161c24;line-height:1.55;word-wrap:break-word}
img{max-width:100%;height:auto}blockquote{margin:0 0 0 .5rem;padding-left:.75rem;border-left:2px solid #dce0e7;color:#68788d}a{color:#6d59d8}pre{white-space:pre-wrap}</style></head><body>${body}</body></html>`
  }, [html, inline, allowRemote])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    const measure = () => {
      const doc = frame.contentDocument
      if (doc?.body) setHeight(Math.max(120, doc.documentElement.scrollHeight + 8))
    }
    frame.addEventListener('load', measure)
    const t = setInterval(measure, 500)
    setTimeout(() => clearInterval(t), 4000)
    return () => { frame.removeEventListener('load', measure); clearInterval(t) }
  }, [srcDoc])

  // allow-same-origin nur zum Messen der Hoehe; ohne allow-scripts kann der Inhalt nichts ausfuehren.
  return <iframe ref={ref} title="Mail" srcDoc={srcDoc} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" className="w-full border-0" style={{ height }} />
}
