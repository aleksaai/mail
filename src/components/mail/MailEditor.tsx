import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, Highlighter, Italic, Link2, List, ListOrdered,
  Quote, RemoveFormatting, Strikethrough, Underline as UnderlineIcon,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const TEXT_COLORS = ['#161c24', '#68788d', '#d92d20', '#e8590c', '#2f9e44', '#1971c2', '#7a66ec', '#c2255c']
const MARKS = ['#fff3a3', '#d3f9d8', '#d0ebff', '#ffe3e3', '#eceafd']
const SIZES = [{ label: 'Klein', v: '12px' }, { label: 'Normal', v: '' }, { label: 'Groß', v: '19px' }, { label: 'Riesig', v: '26px' }]

/**
 * Formatierter Mail-Editor (wie Outlook): fett, kursiv, unterstrichen, durchgestrichen, Groesse, Farbe,
 * Markieren, Listen, Ausrichtung, Zitat, Link. Tastenkuerzel ⌘B/⌘I/⌘U, ⌘⇧8 Liste, ⌘⇧7 Nummern, ⌘K Link.
 * Das Umwandeln in empfaengerfestes Mail-HTML macht `toEmailHtml` beim Senden.
 */
export function MailEditor({ onChange, onSubmit, placeholder, autoFocus, initialHtml = '' }: {
  onChange: (html: string) => void; onSubmit?: () => void; placeholder?: string; autoFocus?: boolean; initialHtml?: string
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  // Tiptap haelt editorProps fest; ueber die Ref sieht ⌘Enter immer den aktuellen Stand.
  const submit = useRef(onSubmit)
  submit.current = onSubmit
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      TextStyle, Color, FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: initialHtml,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'mail-editor outline-none min-h-[220px] px-4 py-3 text-[15px] leading-relaxed text-ink' },
      handleKeyDown: (_v, e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { submit.current?.(); return true }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { setLinkOpen(true); return true }
        return false
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null
  return (
    <div className="mail-editor-shell rounded-xl border border-line bg-white/80 focus-within:border-indigo2-500 focus-within:ring-2 focus-within:ring-indigo2-100 transition-shadow">
      <Toolbar editor={editor} linkOpen={linkOpen} setLinkOpen={setLinkOpen} />
      <div className="max-h-[46vh] overflow-y-auto aw-scroll">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function Toolbar({ editor, linkOpen, setLinkOpen }: { editor: Editor; linkOpen: boolean; setLinkOpen: (o: boolean) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'), link: e.isActive('link'),
      center: e.isActive({ textAlign: 'center' }), right: e.isActive({ textAlign: 'right' }),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? '',
      size: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      href: (e.getAttributes('link').href as string | undefined) ?? '',
    }),
  })
  const c = () => editor.chain().focus()

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
      <select value={s.size} onChange={e => { const v = e.target.value; if (v) c().setFontSize(v).run(); else c().unsetFontSize().run() }}
        className="h-7 rounded-md bg-transparent px-1.5 text-[12px] text-asphalt hover:bg-ice outline-none cursor-pointer" title="Schriftgröße">
        {SIZES.map(z => <option key={z.label} value={z.v}>{z.label}</option>)}
      </select>
      <Sep />
      <Btn on={s.bold} title="Fett (⌘B)" onClick={() => c().toggleBold().run()}><Bold /></Btn>
      <Btn on={s.italic} title="Kursiv (⌘I)" onClick={() => c().toggleItalic().run()}><Italic /></Btn>
      <Btn on={s.underline} title="Unterstrichen (⌘U)" onClick={() => c().toggleUnderline().run()}><UnderlineIcon /></Btn>
      <Btn on={s.strike} title="Durchgestrichen" onClick={() => c().toggleStrike().run()}><Strikethrough /></Btn>
      <Swatches title="Schriftfarbe" icon={<Baseline />} bar={s.color || '#161c24'} colors={TEXT_COLORS}
        onPick={v => c().setColor(v).run()} onReset={() => c().unsetColor().run()} />
      <Swatches title="Markieren" icon={<Highlighter />} colors={MARKS}
        onPick={v => c().setHighlight({ color: v }).run()} onReset={() => c().unsetHighlight().run()} />
      <Sep />
      <Btn on={s.bullet} title="Aufzählung (⌘⇧8)" onClick={() => c().toggleBulletList().run()}><List /></Btn>
      <Btn on={s.ordered} title="Nummerierung (⌘⇧7)" onClick={() => c().toggleOrderedList().run()}><ListOrdered /></Btn>
      <Btn on={s.quote} title="Zitat" onClick={() => c().toggleBlockquote().run()}><Quote /></Btn>
      <Sep />
      <Btn on={!s.center && !s.right} title="Links" onClick={() => c().setTextAlign('left').run()}><AlignLeft /></Btn>
      <Btn on={s.center} title="Zentriert" onClick={() => c().setTextAlign('center').run()}><AlignCenter /></Btn>
      <Btn on={s.right} title="Rechts" onClick={() => c().setTextAlign('right').run()}><AlignRight /></Btn>
      <Sep />
      <LinkButton editor={editor} active={s.link} href={s.href} open={linkOpen} setOpen={setLinkOpen} />
      <Btn title="Formatierung entfernen" onClick={() => c().unsetAllMarks().clearNodes().unsetTextAlign().run()}><RemoveFormatting /></Btn>
    </div>
  )
}

const Sep = () => <span className="mx-1 h-4 w-px bg-line" />

function Btn({ on, title, onClick, children }: { on?: boolean; title: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors [&_svg]:h-[15px] [&_svg]:w-[15px] ${on ? 'bg-indigo2-100 text-indigo2-700' : 'text-steel hover:bg-ice hover:text-asphalt'}`}>
      {children}
    </button>
  )
}

function Swatches({ title, icon, bar, colors, onPick, onReset }: { title: string; icon: ReactNode; bar?: string; colors: string[]; onPick: (c: string) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()}
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-md text-steel hover:bg-ice hover:text-asphalt [&_svg]:h-[15px] [&_svg]:w-[15px]">
          {icon}{bar && <span className="absolute bottom-1 left-1.5 right-1.5 h-[2px] rounded-full" style={{ background: bar }} />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" onOpenAutoFocus={e => e.preventDefault()}>
        <div className="flex items-center gap-1.5">
          {colors.map(col => (
            <button key={col} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(col); setOpen(false) }}
              className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110" style={{ background: col }} title={col} />
          ))}
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onReset(); setOpen(false) }} className="ml-1 text-[11px] text-steel hover:text-asphalt">Zurück</button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LinkButton({ editor, active, href, open, setOpen }: { editor: Editor; active: boolean; href: string; open: boolean; setOpen: (o: boolean) => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => { if (open) setUrl(href) }, [open, href])
  const apply = () => {
    const v = url.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!v) chain.unsetLink().run()
    else {
      const full = /^(https?:|mailto:|tel:)/i.test(v) ? v : v.includes('@') && !v.includes('/') ? `mailto:${v}` : `https://${v}`
      if (editor.state.selection.empty && !active) editor.chain().focus().insertContent(`<a href="${full.replace(/"/g, '&quot;')}">${v.replace(/</g, '&lt;')}</a> `).run()
      else chain.setLink({ href: full }).run()
    }
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Link (⌘K)" aria-label="Link" onMouseDown={e => e.preventDefault()}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md [&_svg]:h-[15px] [&_svg]:w-[15px] ${active ? 'bg-indigo2-100 text-indigo2-700' : 'text-steel hover:bg-ice hover:text-asphalt'}`}>
          <Link2 />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); apply() }}>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… oder name@firma.de"
            className="h-8 flex-1 rounded-md border border-line px-2 text-sm outline-none focus:border-indigo2-500" />
          <button type="submit" className="h-8 rounded-md bg-primary px-2.5 text-[12px] font-medium text-white">OK</button>
          {active && <button type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setOpen(false) }} className="h-8 px-1.5 text-[12px] text-steel hover:text-destructive">Entfernen</button>}
        </form>
      </PopoverContent>
    </Popover>
  )
}
