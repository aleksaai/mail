import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, CornerDownLeft, RotateCcw, Scissors, X } from 'lucide-react'
import { toast } from 'sonner'
import { brief, cachedDraft, cleanAprilHtml, draft, storeDraft, LANGUAGES, type Brief, type LanguageId } from '@/lib/april'
import { buildKontext, type AprilKontext } from '@/lib/april-context'
import type { Mailbox } from '@/config/mailboxes'
import type { Message } from '@/lib/graph'

type AvatarState = 'idle' | 'thinking' | 'writing' | 'done'

/**
 * Platzhalter für April (Phase 1): ein lila Leuchtkreis. In Phase 2 kommt hier die
 * Plüsch-April mit Schleife hin, dieselben Zustände.
 */
export function AprilOrb({ state, size = 28 }: { state: AvatarState; size?: number }) {
  const reduce = useReducedMotion()
  const anim = reduce ? {} : state === 'thinking'
    ? { scale: [1, 1.08, 1], rotate: [0, 8, -8, 0] }
    : state === 'writing'
      ? { y: [0, -2.5, 0], scale: [1, 1.03, 1] }
      : state === 'done'
        ? { scaleX: [1, 1.15, 0.94, 1], scaleY: [1, 0.85, 1.06, 1] }
        : { scale: [1, 1.02, 1] }
  const transition = state === 'done'
    ? { duration: 0.55, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] }
    : { duration: state === 'writing' ? 0.45 : state === 'thinking' ? 1.6 : 3.2, repeat: Infinity, ease: 'easeInOut' as const }
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {state === 'thinking' && !reduce && (
        <motion.span className="absolute inset-[-6px] rounded-full bg-[#b9a8ff]/50 blur-md"
          animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <motion.span key={state} animate={anim} transition={transition}
        className="relative h-full w-full rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,.7),inset_0_-3px_6px_rgba(91,63,214,.35),0_4px_14px_-4px_rgba(139,121,240,.8)]"
        style={{ background: 'radial-gradient(circle at 35% 30%, #e9e2ff 0%, #b9a8ff 38%, #8b79f0 75%, #6d5ae0 100%)' }} />
    </span>
  )
}

const collapsedKey = (id: string) => `april:zu:${id}`

export function AprilCard({ mb, message, canSend, onInsert }: {
  mb: Mailbox; message: Message; canSend: boolean
  onInsert: (html: string) => void
}) {
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem(collapsedKey(message.id)) === '1')
  const [b, setB] = useState<Brief | null>(null)
  const [error, setError] = useState('')
  const [chosen, setChosen] = useState<{ label: string; absicht: string } | null>(null)
  const [text, setText] = useState('')
  const [writing, setWriting] = useState(false)
  const [justDone, setJustDone] = useState(false)
  const [lang, setLang] = useState<LanguageId | ''>('')
  const [instruction, setInstruction] = useState('')
  const kontext = useRef<Promise<AprilKontext> | null>(null)
  const abort = useRef<AbortController | null>(null)

  const getKontext = () => (kontext.current ??= buildKontext(mb, message))

  useEffect(() => {
    let alive = true
    setB(null); setError(''); setChosen(null); setText(''); setLang('')
    kontext.current = null
    getKontext()
      .then(k => brief(message.id, k))
      .then(r => { if (alive) setB(r) })
      .catch(e => { if (alive) setError((e as Error).message) })
    return () => { alive = false; abort.current?.abort() }
  }, [mb.id, message.id])

  const toggle = () => setCollapsed(c => {
    const next = !c
    if (next) sessionStorage.setItem(collapsedKey(message.id), '1'); else sessionStorage.removeItem(collapsedKey(message.id))
    return next
  })

  const write = async (v: { label: string; absicht: string }, opts: { instruction?: string; target?: LanguageId; revise?: boolean } = {}) => {
    abort.current?.abort()
    const ctl = new AbortController(); abort.current = ctl
    setChosen(v)
    const plainChip = !opts.revise && !opts.instruction && !opts.target
    if (plainChip) {
      const hit = cachedDraft(message.id, v.absicht)
      if (hit) { setText(hit); return }
    }
    const vorher = opts.revise ? text : undefined
    setWriting(true); setJustDone(false)
    if (!opts.revise) setText('')
    try {
      const out = await draft({
        kontext: await getKontext(), absicht: v.absicht, instruction: opts.instruction, target: opts.target, vorher,
        signal: ctl.signal, onText: t => setText(t),
      })
      setText(out)
      if (plainChip) storeDraft(message.id, v.absicht, out)
      setJustDone(true); setTimeout(() => setJustDone(false), 900)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error((e as Error).message)
    } finally {
      if (abort.current === ctl) setWriting(false)
    }
  }

  const revise = (instr: string, target?: LanguageId) => { if (chosen) void write(chosen, { instruction: instr, target, revise: true }) }

  const state: AvatarState = writing ? 'writing' : justDone ? 'done' : !b && !error ? 'thinking' : 'idle'
  const chip = 'lg lg-pill inline-flex h-8 items-center px-3.5 text-[12.5px] font-medium text-asphalt transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-50'
  const small = 'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-asphalt/80 hover:bg-white/70 hover:text-ink transition-colors disabled:opacity-40'

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="lg mt-5 rounded-[20px] px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <AprilOrb state={state} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-indigo2-700">April</span>
            {b?.frist && <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-800">{b.frist}</span>}
            <button onClick={toggle} className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-steel hover:bg-white/60 hover:text-asphalt"
              title={collapsed ? 'Aufklappen' : 'Zuklappen'}>
              <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          </div>
          {error
            ? <p className="mt-0.5 text-[13px] text-steel">April kommt gerade nicht an die Mail ran. <button className="underline hover:text-asphalt" onClick={() => { setError(''); getKontext().then(k => brief(message.id, k)).then(setB).catch(e => setError((e as Error).message)) }}>Nochmal</button></p>
            : !b
              ? <p className="mt-0.5 text-[13px] text-steel">liest die Mail …</p>
              : <p className="mt-0.5 text-[14px] leading-snug text-ink">{b.zusammenfassung}</p>}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && b && canSend && b.vorschlaege.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }} className="overflow-hidden">
            <div className="mt-3 flex flex-wrap gap-2 pl-[40px]">
              {b.vorschlaege.map((v, i) => (
                <motion.button key={v.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                  className={`${chip} ${chosen?.absicht === v.absicht ? 'lg-selected !text-indigo2-700' : ''}`} title={v.absicht}
                  disabled={writing && chosen?.absicht === v.absicht} onClick={() => void write(v)}>
                  {v.label}
                </motion.button>
              ))}
            </div>

            {chosen && (
              <div className="mt-3 sm:pl-[40px]">
                <div className="mail-card !px-4 !py-3 text-[14px] leading-relaxed text-ink [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                  {text
                    ? <div dangerouslySetInnerHTML={{ __html: highlight(cleanAprilHtml(text)) }} />
                    : <p className="text-steel">schreibt …</p>}
                  {writing && text && <motion.span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-indigo2-700"
                    animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button disabled={writing || !text} onClick={() => onInsert(text)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-b from-indigo2-900 to-indigo2-700 px-3.5 text-[12.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_16px_-6px_rgba(122,102,236,.7)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50">
                    <CornerDownLeft className="h-3.5 w-3.5" />Einsetzen
                  </button>
                  <button className={small} disabled={writing || !text} onClick={() => revise('Mach den Entwurf deutlich kürzer, gleicher Inhalt.')}><Scissors className="h-3.5 w-3.5" />Kürzer</button>
                  <button className={small} disabled={writing || !text} onClick={() => revise('Etwas förmlicher formulieren.')}>Förmlicher</button>
                  <button className={small} disabled={writing || !text} onClick={() => revise('Etwas lockerer und wärmer formulieren.')}>Lockerer</button>
                  <select value={lang} disabled={writing || !text} title="Sprache"
                    onChange={e => { const l = e.target.value as LanguageId; setLang(l); if (l) revise('Übertrage den Entwurf in diese Sprache, Inhalt gleich.', l) }}
                    className="h-7 cursor-pointer rounded-full bg-transparent px-2 text-[12px] text-asphalt/80 outline-none hover:bg-white/70 disabled:opacity-40">
                    <option value="">Sprache</option>
                    {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                  {writing
                    ? <button className={small} onClick={() => { abort.current?.abort(); setWriting(false) }}><X className="h-3.5 w-3.5" />Stopp</button>
                    : <button className={small} disabled={!text} title="Neu schreiben" onClick={() => void write(chosen, { instruction: 'Schreib eine neue Fassung.' })}><RotateCcw className="h-3.5 w-3.5" /></button>}
                </div>
                <form className="lg-well mt-2 flex h-9 items-center gap-2 rounded-full px-3"
                  onSubmit={e => { e.preventDefault(); const t = instruction.trim(); if (!t || !text) return; setInstruction(''); revise(t) }}>
                  <input value={instruction} onChange={e => setInstruction(e.target.value)} disabled={writing || !text}
                    placeholder="Sag April, was anders sein soll, z. B. „ich kann erst ab 15 Uhr“"
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-steel/70" />
                  <button type="submit" disabled={writing || !text || !instruction.trim()} className="text-[12px] font-medium text-indigo2-700 disabled:opacity-40">Ändern</button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Platzhalter wie [Uhrzeit?] in der Vorschau gelb hervorheben. */
const highlight = (html: string) => html.replace(/\[[^\]<\n]{1,60}\?\]/g, p => `<mark style="background:#fde68a;border-radius:3px;padding:0 2px">${p}</mark>`)
