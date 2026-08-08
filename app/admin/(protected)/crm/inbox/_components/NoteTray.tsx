'use client'

/**
 * NoteTray — the persistent internal-note input at the bottom of the reading
 * pane (spec §08 §10, AC-17/AC-18). Placeholder "Write a note or @mention
 * someone", a Create Note button, and the [N] keyboard shortcut that focuses
 * the input. Typing @ opens the agent mention picker; selecting inserts
 * @Name inline. Notes are internal only — never sent to the contact (§10.3);
 * the bound server action writes the note + emails any @mentioned agents.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export default function NoteTray({
  brokers,
  createNoteAction,
}: {
  brokers: Array<{ slug: string; name: string }>
  createNoteAction: (body: string, mentions: string[]) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // [N] keyboard shortcut — focus the note input (AC-17).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onChange = (v: string) => {
    setBody(v)
    // @ at the caret end opens the mention picker (spec §10.2).
    setPickerOpen(/(^|\s)@[\w]*$/.test(v))
  }

  const insertMention = (b: { slug: string; name: string }) => {
    setBody((prev) => prev.replace(/(^|\s)@[\w]*$/, `$1@${b.name} `))
    setMentions((prev) => (prev.includes(b.slug) ? prev : [...prev, b.slug]))
    setPickerOpen(false)
    ref.current?.focus()
  }

  const submit = () => {
    const text = body.trim()
    if (!text) return
    setError(null)
    startTransition(async () => {
      const res = await createNoteAction(text, mentions)
      if (!res.ok) {
        setError(res.error ?? 'Could not create the note')
        return
      }
      setBody('')
      setMentions([])
      router.refresh()
    })
  }

  return (
    <div className="relative border-t border-border bg-muted/30 px-4 py-2">
      {pickerOpen ? (
        <Card className="absolute bottom-full left-4 mb-1 w-56 p-1 shadow-md">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Mention an agent</p>
          {brokers.map((b) => (
            <Button
              key={b.slug}
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              onClick={() => insertMention(b)}
            >
              @{b.name}
            </Button>
          ))}
        </Card>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          rows={1}
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write a note or @mention someone"
          className="max-h-24 min-h-9 flex-1 resize-none bg-background py-1.5 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <Button type="button" size="sm" disabled={pending || !body.trim()} onClick={submit}>
          Create Note
        </Button>
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground lg:inline-block">
          N
        </kbd>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}
