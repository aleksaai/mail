import { useEffect, useState } from 'react'

/**
 * Echtes "Liquid Glass" statt weisser Transparenz (Aleksa 29.09.2026: "das ist nicht Glas").
 *
 * Apples Material lebt von drei Dingen: der Hintergrund ist stark verschwommen, am Rand wird er
 * wie durch eine Linse gebrochen, und eine helle Lichtkante zeichnet die Form. Die Brechung geht
 * im Browser nur als SVG-Filter im backdrop-filter, und den kann nur Chromium (Chrome, Edge, Arc).
 * Safari und Firefox bekommen die CSS-Variante aus `.lg` (Unschaerfe + Lichtkante, ohne Brechung).
 *
 * Je Element entsteht eine Verschiebungskarte passend zu Groesse und Eckenradius:
 * rot = Verschiebung in x, gruen = in y, 128 = keine. Nur im Randband wird nach innen gegriffen,
 * dadurch wirkt der Rand gewoelbt und der Inhalt darunter biegt sich wie unter einem Glastropfen.
 */
const SVG_NS = 'http://www.w3.org/2000/svg'
let host: SVGSVGElement | null = null
let seq = 0

export const refractionSupported = (() => {
  if (typeof navigator === 'undefined') return false
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
  return !!brands?.some(b => /Chromium/i.test(b.brand))
})()

function svgHost() {
  if (host) return host
  host = document.createElementNS(SVG_NS, 'svg')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'absolute', width: '0', height: '0', overflow: 'hidden', pointerEvents: 'none' })
  document.body.appendChild(host)
  return host
}

/** Verschiebungskarte fuer ein abgerundetes Rechteck (Signed Distance Field, Richtung = Normale nach innen). */
function displacementMap(w: number, h: number, radius: number, band: number) {
  const scale = Math.min(1, 320 / Math.max(w, h)) // Karte in halber Aufloesung reicht, wird gestreckt
  const cw = Math.max(8, Math.round(w * scale)), ch = Math.max(8, Math.round(h * scale))
  const c = document.createElement('canvas'); c.width = cw; c.height = ch
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(cw, ch)
  const r = Math.min(radius, w / 2, h / 2)
  const hx = w / 2 - r, hy = h / 2 - r
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0)
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r // < 0 = innen
  }
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const x = (i + 0.5) / scale - w / 2, y = (j + 0.5) / scale - h / 2
      const d = -sdf(x, y) // Abstand zum Rand, innen positiv
      let dx = 0, dy = 0
      if (d > 0 && d < band) {
        const e = 0.75
        let nx = sdf(x + e, y) - sdf(x - e, y), ny = sdf(x, y + e) - sdf(x, y - e)
        const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len // Normale nach aussen
        const t = 1 - d / band
        const s = t * t * (3 - 2 * t) // weich einlaufen
        dx = -nx * s; dy = -ny * s // nach innen greifen
      }
      const k = (j * cw + i) * 4
      img.data[k] = 128 + dx * 127; img.data[k + 1] = 128 + dy * 127; img.data[k + 2] = 128; img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

export interface GlassOptions {
  /** Eckenradius in px (Pille: halbe Hoehe; 999 = automatisch Pille) */
  radius?: number
  /** Unschaerfe in px */
  blur?: number
  /** Staerke der Randbrechung in px */
  refraction?: number
  /** Breite des brechenden Randbands in px */
  band?: number
}

/**
 * Haengt die Brechung an ein Element: `<div ref={useLiquidGlass()} className="lg …">`.
 * Callback-Ref, damit es auch greift, wenn das Element erst spaeter erscheint.
 * Ohne Chromium tut der Hook nichts, dann greift `.lg`.
 */
export function useLiquidGlass({ radius = 999, blur = 7, refraction = 30, band = 22 }: GlassOptions = {}) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!el || !refractionSupported) return
    const id = `lg-${++seq}`
    const filter = document.createElementNS(SVG_NS, 'filter')
    filter.setAttribute('id', id)
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    filter.setAttribute('filterUnits', 'userSpaceOnUse')
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse')
    svgHost().appendChild(filter)

    let timer = 0
    let last = ''
    const build = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w < 4 || h < 4) return
      const key = `${Math.round(w)}x${Math.round(h)}`
      if (key === last) return
      last = key
      const r = radius >= 999 ? h / 2 : radius
      const b = Math.min(band, h / 2 - 1, w / 2 - 1)
      const map = displacementMap(w, h, r, b)
      filter.setAttribute('x', '0'); filter.setAttribute('y', '0')
      filter.setAttribute('width', String(w)); filter.setAttribute('height', String(h))
      filter.innerHTML = `
        <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" edgeMode="duplicate" result="soft"/>
        <feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
        <feDisplacementMap in="soft" in2="map" scale="${refraction}" xChannelSelector="R" yChannelSelector="G" result="bent"/>
        <feColorMatrix in="bent" type="saturate" values="1.7"/>`
      el.style.backdropFilter = `url(#${id})`
    }
    build()
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(build, 90) })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(timer); filter.remove(); el.style.backdropFilter = '' }
  }, [el, radius, blur, refraction, band])
  return setEl
}
