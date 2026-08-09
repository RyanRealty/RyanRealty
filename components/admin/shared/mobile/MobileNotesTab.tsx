'use client'

/**
 * MobileNotesTab — §25.8 Notes tab for the mobile Contact Detail
 *
 * Layout (§25.8.1):
 *   - "Add note" inline action row at top (§25.8.2): accent circle-plus + label
 *   - Note cards below (§25.8.3): broker avatar · author · date · body (5 lines max)
 *   - Empty state (§25.8.4) when notes.length === 0
 *   - Note composer Sheet on FAB / "Add note" row tap (§25.8.6)
 *
 * Note data comes from crm_timeline WHERE kind = 'note'.
 *
 * Client component because it manages the composer sheet open state.
 */

import { useMemo, useState } from 'react'
import { Plus, StickyNote, ChevronDown, ChevronRight } from 'lucide-react'
import { Button, Sheet } from '@/components/admin/v2'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import { partitionNotes } from '@/lib/crm/note-classify'
import { cn } from '@/lib/utils'

export interface MobileNote {
  id: number
  ts: string
  /** Preformatted server-side ("Tue, 8:16pm" this week / "Jun 13" older, §25.8.3)
      — computed on the server so the client render has no now()-dependence. */
  dateLabel: string
  body: string
  broker: string | null
  /** §25.8.3: real broker headshot (null → initials fallback) */
  avatarUrl: string | null
}

export interface MobileNotesTabProps {
  personId: number
  notes: MobileNote[]
  /** Map broker slug → display name for the avatar/author */
  brokerDisplayNames: Record<string, string>
  /** Server action to save a note */
  addNoteAction: (formData: FormData) => Promise<void>
}

export function MobileNotesTab({
  personId,
  notes,
  brokerDisplayNames,
  addNoteAction,
}: MobileNotesTabProps) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  // Tap-to-expand: the 5-line clamp (§25.8.3) left long notes UNREADABLE on
  // mobile — no affordance showed the rest (2026-07-02 mobile audit).
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  // "Automated activity" (system-note) section collapsed by default so a
  // broker's own notes sit above the automation firehose (parity w/ desktop).
  const [showSystem, setShowSystem] = useState(false)
  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Display-only ranking: broker-written notes first, auto-generated below.
  const { human, system } = useMemo(() => partitionNotes(notes), [notes])

  function renderNoteCard(note: MobileNote) {
    const authorSlug = note.broker ?? 'matt'
    const authorName = brokerDisplayNames[authorSlug] ?? authorSlug
    return (
      <div
        key={note.id}
        role="button"
        tabIndex={0}
        aria-expanded={expanded.has(note.id)}
        onClick={() => toggleExpanded(note.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggleExpanded(note.id)
        }}
        className="mx-4 mb-2 cursor-pointer overflow-hidden rounded-xl border shadow-sm"
        style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface)' }}
      >
        <div className="p-3">
          <div className="flex items-start gap-3">
            {/* §25.8.3: broker headshot 36 pt (initials fallback) */}
            <CrmAvatar name={authorName} src={note.avatarUrl} size={36} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold" style={{ color: 'var(--a-text)' }}>{authorName}</span>
                <span className="shrink-0 text-[12px]" style={{ color: 'var(--a-text-2)' }}>{note.dateLabel}</span>
              </div>
              {/* Body — 5-line clamp (§25.8.3), tap the card to read it all */}
              <p
                className={cn(
                  'whitespace-pre-line text-[13px] leading-5',
                  !expanded.has(note.id) && 'line-clamp-5',
                )}
                style={{ color: 'var(--a-text)' }}
              >
                {note.body}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24" style={{ background: 'var(--a-inset)' }}>
      {/* §25.8.2 "Add note" inline action row — always at top */}
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3"
        style={{ minHeight: 44 }}
      >
        {/* Filled accent circle with + glyph — the solid-button pair, which is the
            one token pair proven legible as a fill (ADMIN_UI §4) */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--a-btn-bg)' }}
        >
          <Plus size={14} style={{ color: 'var(--a-btn-fg)' }} strokeWidth={3} />
        </span>
        <span className="text-[16px]" style={{ color: 'var(--a-accent)' }}>Add note</span>
      </button>

      {/* §25.8.4 Empty state */}
      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <StickyNote className="mb-3" style={{ color: 'var(--a-text-2)' }} size={48} strokeWidth={1.5} />
          <p className="text-[16px] font-medium" style={{ color: 'var(--a-text-2)' }}>No notes yet</p>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--a-text-2)' }}>Tap + to add the first note</p>
        </div>
      )}

      {/* §25.8.3 Broker-written notes first */}
      {human.map(renderNoteCard)}
      {notes.length > 0 && human.length === 0 && (
        <p className="px-4 py-6 text-center text-[14px]" style={{ color: 'var(--a-text-2)' }}>No notes from your team yet.</p>
      )}

      {/* Auto-generated notes, collapsed below (display-only de-emphasis) */}
      {system.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowSystem((v) => !v)}
            aria-expanded={showSystem}
            className="mx-4 mt-1 flex w-[calc(100%-2rem)] items-center gap-1.5 border-t py-3 text-[13px] font-medium"
            style={{ borderColor: 'var(--a-border)', color: 'var(--a-text-2)' }}
          >
            {showSystem ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            Automated activity
            {/* The count carries the WELL'S OWN fill — the same token as the tab
                container above, which is what the pre-migration pair was: one
                class on both, so the number read as padded text and never as a
                filled badge. The two must stay the same token. A step off the
                well here is a badge nobody asked for, and --a-surface over
                --a-inset is a ~1.05 step that only reads as a smudge. */}
            <span
              className="ml-0.5 rounded-full px-1.5 text-[11px] tabular-nums"
              style={{ background: 'var(--a-inset)', color: 'var(--a-text-2)' }}
            >
              {system.length}
            </span>
          </button>
          {showSystem && <div className="opacity-70">{system.map(renderNoteCard)}</div>}
        </>
      )}

      {/* §25.8.6 Note composer sheet. The title belongs to the Sheet, which draws
          the head row (title + Close) itself — a title inside the children would
          print the heading twice. */}
      <Sheet open={composerOpen} onClose={() => setComposerOpen(false)} title="Add note">
        <form
          action={async (fd: FormData) => {
            fd.set('personId', String(personId))
            fd.set('body', noteBody)
            await addNoteAction(fd)
            setNoteBody('')
            setComposerOpen(false)
          }}
          // The composer is a FIXED panel, not a sheet that hugs its content: it
          // opens at a known height and the input fills it, so a long note has
          // room and the panel never re-flows as you type. That used to ride on
          // SheetContent's h-[60vh]; .av2-sheet is auto-height, so the height
          // lives here and the textarea flexes inside it. 96px is the sheet's own
          // chrome (12 pad-top + 4/12 grip + 36/12 head + 20 pad-bottom) — the
          // same arithmetic MobileDetailsSection uses to clamp its tags sheet.
          // (MobileAssignToSheet used to be the example; its clamp was removed
          // when the sheet stopped double-constraining its own height.)
          className="flex flex-col gap-3 pt-3"
          style={{ height: 'calc(60dvh - 96px)' }}
        >
          {/* Placeholder-only by contract: the labelled TextAreaField prints a
              visible "Note" heading above the box that this composer never had.
              Raw control + av2-input + aria-label is the folder's pattern for an
              unlabelled field (MobileEditSheet, MobileCalendarTab) — dropping the
              visible label never drops the accessible one. It is also a DIRECT
              flex child here, which the field wrapper's own auto-height column
              would have swallowed. */}
          <textarea
            className="av2-input"
            aria-label="Note"
            autoFocus
            placeholder="Add notes or type @name to notify"
            // 16px because iOS Safari zooms the page on focusing any control
            // under 16px, and this composer only ever runs on a phone. The old
            // control carried text-base for the same reason (md:text-sm above
            // the fold); av2-input is 14px everywhere. Folder precedent:
            // MobileEditSheet, MobileAssignToSheet.
            style={{ flex: 1, minHeight: 120, resize: 'none', fontSize: 16 }}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="quiet" type="button" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!noteBody.trim()}>
              Create Note
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
