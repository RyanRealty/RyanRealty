/**
 * NotesSection (P11B B2) — timeline kind='note' rows as a quiet v2 list, add
 * through addCrmNoteAction (via the people wrapper).
 */
import { Button, SectionHead, TextAreaField } from '@/components/admin/v2'
import { noteToText } from '@/lib/crm/note-text'

function tsLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

export function NotesSection(props: {
  notes: Array<{ id: number; ts: string; body: string; broker: string | null }>
  addNote: (formData: FormData) => Promise<void>
  showForm?: boolean
}) {
  return (
    <section aria-label="Notes">
      <SectionHead>Notes</SectionHead>
      <ul className="av2-quietlist">
        {props.notes.map((n) => (
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
        {props.notes.length === 0 ? (
          <li className="av2-quiet">
            <span style={{ color: 'var(--a-text-2)' }}>No notes yet.</span>
          </li>
        ) : null}
      </ul>
      {props.showForm === false ? null : (
        <form action={props.addNote} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
          <TextAreaField label="Add a note" name="body" rows={3} required placeholder="What happened?" />
          <div>
            <Button type="submit" variant="quiet">
              Save note
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
