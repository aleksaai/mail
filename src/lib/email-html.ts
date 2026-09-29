/**
 * Editor-HTML in Mail-HTML umwandeln, das bei jedem Empfaenger gleich aussieht.
 *
 * Gmail, Outlook (Windows rendert mit Word!), Apple Mail und Webmailer werfen <style>-Bloecke,
 * CSS-Klassen und manche Tags teils weg. Deshalb bekommt jedes Element seine Gestaltung als
 * Inline-Style, <mark> wird zu <span style="background-color">, leere Absaetze behalten ihre Hoehe.
 */
export const MAIL_FONT = "Aptos, Calibri, 'Segoe UI', Helvetica, Arial, sans-serif"

const STYLES: Record<string, string> = {
  p: 'margin:0 0 10px 0;',
  h2: 'margin:14px 0 8px 0;font-size:18px;font-weight:bold;line-height:1.3;',
  h3: 'margin:12px 0 6px 0;font-size:15px;font-weight:bold;line-height:1.3;',
  ul: 'margin:0 0 10px 0;padding:0 0 0 24px;',
  ol: 'margin:0 0 10px 0;padding:0 0 0 24px;',
  li: 'margin:0 0 4px 0;',
  blockquote: 'margin:0 0 10px 0;padding:0 0 0 12px;border-left:3px solid #d6cffa;color:#555555;',
  a: 'color:#6d59d8;text-decoration:underline;',
  hr: 'border:none;border-top:1px solid #dce0e7;margin:14px 0;',
  code: "font-family:Consolas,'Courier New',monospace;background-color:#f2f4f7;padding:1px 4px;border-radius:3px;",
}

export function toEmailHtml(editorHtml: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${editorHtml}</div>`, 'text/html')
  const root = doc.getElementById('root')!

  root.querySelectorAll('*').forEach(el => {
    const tag = el.tagName.toLowerCase()
    const base = STYLES[tag]
    if (base) el.setAttribute('style', base + (el.getAttribute('style') ?? ''))
    el.removeAttribute('class')
    el.removeAttribute('data-color')
  })
  // Absatz in einem Listenpunkt: ohne eigenen Abstand, sonst stehen die Punkte weit auseinander.
  root.querySelectorAll('li > p').forEach(p => p.setAttribute('style', 'margin:0;' + (p.getAttribute('style') ?? '').replace(STYLES.p, '')))
  // Leere Zeile: ohne Inhalt klappt der Absatz bei vielen Empfaengern auf 0 px zusammen.
  root.querySelectorAll('p').forEach(p => { if (!p.textContent?.trim() && !p.querySelector('img,br')) p.innerHTML = '<br>' })
  // Leere Zeilen am Ende weglassen.
  while (root.lastElementChild?.tagName === 'P' && !root.lastElementChild.textContent?.trim() && !root.lastElementChild.querySelector('img')) root.lastElementChild.remove()
  // <mark> kennt Outlook fuer Windows nicht.
  root.querySelectorAll('mark').forEach(m => {
    const span = doc.createElement('span')
    span.setAttribute('style', m.getAttribute('style') || 'background-color:#fff3a3;')
    span.innerHTML = m.innerHTML
    m.replaceWith(span)
  })
  root.querySelectorAll('a').forEach(a => { a.setAttribute('target', '_blank'); a.removeAttribute('rel') })

  return `<div style="font-family:${MAIL_FONT};font-size:15px;line-height:1.5;color:#161c24;">${root.innerHTML}</div>`
}

/** Ist im Editor wirklich etwas geschrieben (nicht nur leere Absaetze)? */
export const hasContent = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim().length ?? 0
