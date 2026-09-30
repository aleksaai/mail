/**
 * Feste Signaturen je Absenderadresse. Erscheint im Schreibfenster als Vorschau unter dem
 * Text und wird beim Senden angehaengt (Tiptap wuerde Tabelle und Inline-Styles zerlegen,
 * deshalb nicht im Editor selbst).
 *
 * ⚠️ Aprils Signatur steht ein zweites Mal im Gateway: claude-team
 * `gateway/src/mail-freigabe.ts` (`signatureHtml`) — dort fuer Mails, die April selbst
 * schreibt. Aenderungen an beiden Stellen nachziehen.
 */
const font = "font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"

const APRIL =
  `<table cellpadding="0" cellspacing="0" border="0" style="${font};border-collapse:collapse;margin-top:4px">` +
  `<tr><td style="border-left:3px solid #8b79f0;padding:2px 0 2px 12px">` +
  `<div style="font-size:15px;font-weight:600;color:#111827;line-height:1.4">April</div>` +
  `<div style="font-size:13px;color:#6b7280;line-height:1.5">Digital Assistant to Aleksa Spalevic</div>` +
  `<div style="font-size:13px;color:#374151;line-height:1.5;margin-top:6px">Spalevic Consulting Kft.</div>` +
  `<div style="font-size:13px;line-height:1.5">` +
  `<a href="mailto:april@aleksa.ai" style="color:#6d5bd0;text-decoration:none">april@aleksa.ai</a>` +
  `<span style="color:#9ca3af">&nbsp;&nbsp;·&nbsp;&nbsp;</span>` +
  `<a href="tel:+4922714812990" style="color:#6d5bd0;text-decoration:none">+49 2271 481 2990</a></div>` +
  `</td></tr></table>`

export const SIGNATURES: Record<string, string> = {
  'april@aleksa.ai': APRIL,
}

export const signatureFor = (address: string): string | undefined => SIGNATURES[address.trim().toLowerCase()]
