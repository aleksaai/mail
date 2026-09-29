import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Hintergrund wie in der Outlook-Desktop-App: ein Bild oder Verlauf hinter der Oberflaeche,
 * Leiste und Panel werden dann zu mattem Glas. Gespeichert je Geraet (localStorage) —
 * reine Anzeige-Vorliebe, nichts, was ein anderes Geraet wissen muesste.
 */
export interface Backdrop { id: string; label: string; css: string }

export const BACKDROPS: Backdrop[] = [
  { id: 'none', label: 'Standard', css: 'radial-gradient(at 8% 12%, #dcd5fb 0, transparent 45%), radial-gradient(at 92% 8%, #cfe6ff 0, transparent 45%), radial-gradient(at 78% 92%, #f3dcf3 0, transparent 50%), radial-gradient(at 20% 85%, #d6f0ff 0, transparent 45%), #f1f4fb' },
  { id: 'lavendel', label: 'Lavendel', css: 'radial-gradient(at 12% 18%, #c9bff8 0, transparent 55%), radial-gradient(at 88% 12%, #f5c6ec 0, transparent 50%), radial-gradient(at 70% 88%, #b9d8ff 0, transparent 55%), #eef0ff' },
  { id: 'morgen', label: 'Morgen', css: 'radial-gradient(at 10% 90%, #ffd6c9 0, transparent 55%), radial-gradient(at 85% 15%, #ffe8a8 0, transparent 50%), radial-gradient(at 50% 50%, #fbd3e9 0, transparent 60%), #fff4ef' },
  { id: 'ozean', label: 'Ozean', css: 'radial-gradient(at 15% 20%, #9fd3ff 0, transparent 55%), radial-gradient(at 85% 80%, #7be0d6 0, transparent 55%), radial-gradient(at 60% 10%, #c3c8ff 0, transparent 50%), #e8f6ff' },
  { id: 'wald', label: 'Wald', css: 'radial-gradient(at 20% 80%, #b8e6b0 0, transparent 55%), radial-gradient(at 80% 20%, #e3f5a8 0, transparent 50%), radial-gradient(at 55% 55%, #9ad7c4 0, transparent 60%), #f0f9ef' },
  { id: 'abend', label: 'Abend', css: 'radial-gradient(at 15% 15%, #7b6cf0 0, transparent 55%), radial-gradient(at 85% 25%, #e56bb3 0, transparent 50%), radial-gradient(at 50% 95%, #3d5bd9 0, transparent 60%), #2b2d6e' },
  { id: 'sand', label: 'Sand', css: 'radial-gradient(at 20% 20%, #f3e3cf 0, transparent 55%), radial-gradient(at 80% 80%, #e8d3c0 0, transparent 55%), #faf6f1' },
]

const KEY = 'mail-backdrop'
const IMG_KEY = 'mail-backdrop-image'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* privates Fenster o.ae. */ } }

interface Ctx { id: string; image: string | null; css: string; glass: boolean; choose: (id: string) => void; setImage: (dataUrl: string) => void }
const BackdropContext = createContext<Ctx | null>(null)

export function BackdropProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => read(KEY) || 'none')
  const [image, setImg] = useState<string | null>(() => read(IMG_KEY))

  useEffect(() => { write(KEY, id) }, [id])

  const css = id === 'image' && image
    ? `center / cover no-repeat url("${image}")`
    : BACKDROPS.find(b => b.id === id)?.css ?? ''

  const value: Ctx = {
    id, image, css, glass: !!css,
    choose: setId,
    setImage: (dataUrl) => { setImg(dataUrl); write(IMG_KEY, dataUrl); setId('image') },
  }
  return <BackdropContext.Provider value={value}>{children}</BackdropContext.Provider>
}

export const useBackdrop = () => {
  const ctx = useContext(BackdropContext)
  if (!ctx) throw new Error('BackdropProvider fehlt')
  return ctx
}

/** Eigenes Foto auf max. 2400 px verkleinern, damit es in den localStorage passt. */
export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 2400 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'))
    img.src = URL.createObjectURL(file)
  })
}
