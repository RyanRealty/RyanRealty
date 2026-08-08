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
import { Button } from '@/components/admin/v2'

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
    <div className="av2-composer relative">
      {pickerOpen ? (
        <div
          className="absolute bottom-full left-4 mb-1 w-56 p-1"
          style={{
            borderRadius: 'var(--a-r-lg)',
            border: '1px solid var(--a-border)',
            background: 'var(--a-bg)',
            boxShadow: 'var(--a-shadow-overlay)',
          }}
        >
          <p className="px-2 py-1 font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Mention an agent
          </p>
          {brokers.map((b) => (
            <Button
              key={b.slug}
              type="button"
              variant="quiet"
              className="w-full"
              style={{ justifyContent: 'flex-start', fontWeight: 400 }}
              onClick={() => insertMention(b)}
            >
              @{b.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="av2-composer__box">
        <textarea
          ref={ref}
          rows={1}
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write a note or @mention someone"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <Button type="button" disabled={pending || !body.trim()} onClick={submit}>
          Create Note
        </Button>
        <kbd
          className="hidden px-1.5 py-0.5 lg:inline-block"
          style={{
            borderRadius: 'var(--a-r-sm)',
            background: 'var(--a-inset)',
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
          }}
        >
          N
        </kbd>
      </div>
      {error ? (
        <p className="mt-1 font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
