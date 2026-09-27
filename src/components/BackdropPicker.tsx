import { useRef } from 'react'
import { ImageIcon, Check, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BACKDROPS, shrinkImage, useBackdrop } from '@/lib/background'

export function BackdropPicker() {
  const { id, image, choose, setImage } = useBackdrop()
  const file = useRef<HTMLInputElement>(null)

  const upload = async (f?: File) => {
    if (!f) return
    try { setImage(await shrinkImage(f)) }
    catch (e) { toast.error((e as Error).message) }
  }

  const swatch = (active: boolean) =>
    `relative h-14 rounded-lg border transition-shadow ${active ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:shadow-panel'}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button title="Hintergrund" className="p-1.5 rounded-md text-steel hover:bg-ice hover:text-asphalt"><ImageIcon className="w-4 h-4" /></button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72 p-3">
        <p className="text-sm font-semibold text-ink mb-2">Hintergrund</p>
        <div className="grid grid-cols-3 gap-2">
          {BACKDROPS.map(b => (
            <button key={b.id} onClick={() => choose(b.id)} className={swatch(id === b.id)} style={{ background: b.css || '#ebf5ff' }} title={b.label}>
              {id === b.id && <Check className="absolute right-1 top-1 w-3.5 h-3.5 text-primary" />}
              <span className="absolute bottom-1 left-1.5 text-[10px] font-medium text-asphalt/80">{b.label}</span>
            </button>
          ))}
          {image && (
            <button onClick={() => choose('image')} className={swatch(id === 'image')} style={{ background: `center / cover url("${image}")` }} title="Eigenes Bild">
              {id === 'image' && <Check className="absolute right-1 top-1 w-3.5 h-3.5 text-white" />}
            </button>
          )}
          <button onClick={() => file.current?.click()} className="h-14 rounded-lg border border-dashed border-light-steel text-steel hover:bg-ice flex flex-col items-center justify-center gap-0.5">
            <Upload className="w-4 h-4" /><span className="text-[10px]">Eigenes Bild</span>
          </button>
        </div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
      </PopoverContent>
    </Popover>
  )
}
