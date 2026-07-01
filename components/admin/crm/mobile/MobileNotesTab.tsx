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

import { useState } from 'react'
import { Plus, StickyNote } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
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

  return (
    <div className="bg-secondary pb-24">
      {/* §25.8.2 "Add note" inline action row — always at top */}
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3"
        style={{ minHeight: 44 }}
      >
        {/* Filled accent circle with + glyph (console link accent — console-root's
            --accent is a near-white neutral, unusable as a fill on bg-secondary) */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--console-info)' }}
        >
          <Plus size={14} className="text-white" strokeWidth={3} />
        </span>
        <span className="text-[16px]" style={{ color: 'var(--console-info)' }}>Add note</span>
      </button>

      {/* §25.8.4 Empty state */}
      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <StickyNote className="mb-3 text-muted-foreground" size={48} strokeWidth={1.5} />
          <p className="text-[16px] font-medium text-muted-foreground">No notes yet</p>
          <p className="mt-1 text-[14px] text-muted-foreground">Tap + to add the first note</p>
        </div>
      )}

      {/* §25.8.3 Note cards */}
      {notes.map((note) => {
        const authorSlug = note.broker ?? 'matt'
        const authorName = brokerDisplayNames[authorSlug] ?? authorSlug
        return (
          <div
            key={note.id}
            className="mx-4 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="p-3">
              <div className="flex items-start gap-3">
                {/* §25.8.3: broker headshot 36 pt (initials fallback) */}
                <CrmAvatar name={authorName} src={note.avatarUrl} size={36} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold text-foreground">{authorName}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {note.dateLabel}
                    </span>
                  </div>
                  {/* Body — truncated at 5 lines (§25.8.3) */}
                  <p
                    className={cn(
                      'whitespace-pre-line text-[13px] leading-5 text-foreground',
                      'line-clamp-5',
                    )}
                  >
                    {note.body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* §25.8.6 Note composer sheet */}
      <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
        <SheetContent side="bottom" className="h-[60vh]">
          <SheetHeader>
            <SheetTitle>Add note</SheetTitle>
          </SheetHeader>
          <form
            action={async (fd: FormData) => {
              fd.set('personId', String(personId))
              fd.set('body', noteBody)
              await addNoteAction(fd)
              setNoteBody('')
              setComposerOpen(false)
            }}
            className="flex flex-1 flex-col gap-3 pt-3"
          >
            <Textarea
              autoFocus
              placeholder="Add notes or type @name to notify"
              className="min-h-[120px] flex-1 resize-none"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setComposerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!noteBody.trim()}>
                Create Note
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
