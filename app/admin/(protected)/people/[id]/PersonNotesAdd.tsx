'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { noteToText } from '@/lib/crm/note-text'
import { savePersonNoteAction } from '../actions'
import { Button, SectionHead, TextAreaField } from '@/components/admin/v2'

export type PersonNoteView = {
  id: number
  ts: string
  body: string
  broker: string | null
}

function tsLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function PersonNotesAdd({
  personId,
  notes,
}: {
  personId: number
  notes: PersonNoteView[]
}) {
  const [rows, setRows] = useState(notes)
  const [body, setBody] = useState('')
  const [saving, startSave] = useTransition()

  return (
    <section aria-label="Notes" style={{ margin: '0 0 20px' }}>
      <SectionHead>Notes</SectionHead>
      <ul className="av2-quietlist">
        {rows.map((n) => (
          <li key={n.id} className="av2-quiet" style={{ display: 'block' }}>
            <div style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {tsLabel(n.ts)}
              {n.broker ? ` · ${n.broker}` : ''}
            </div>
            <div style={{ color: 'var(--a-text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {noteToText(n.body)}
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="av2-quiet">
            <span style={{ color: 'var(--a-text-2)' }}>No notes yet.</span>
          </li>
        ) : null}
      </ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
        <TextAreaField
          label="Add a note"
          name="body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened?"
        />
        <div>
          <Button
            type="button"
            variant="quiet"
            disabled={saving || !body.trim()}
            onClick={() =>
              startSave(async () => {
                const text = body.trim()
                if (!text) return
                const r = await savePersonNoteAction(personId, text)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                setBody('')
                setRows((prev) => [r.note, ...prev])
                toast.success('Note saved')
              })
            }
          >
            {saving ? 'Saving note' : 'Save note'}
          </Button>
        </div>
      </div>
    </section>
  )
}
