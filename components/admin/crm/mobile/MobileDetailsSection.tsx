'use client'

/**
 * MobileDetailsSection — the interactive §25.5.7 DETAILS card.
 *
 * Every row behaves like FUB: tapping opens the matching picker/editor —
 *   Assigned to  → broker picker sheet (owner-gated server-side)
 *   Stage        → stage picker sheet (mob-35)
 *   Source       → read-only (system attribution value)
 *   Tags         → tags editor sheet (§25.10: alphabetical rows, add + remove)
 *   Time frame   → read-only for now (FUB custom field, no editor yet)
 *   Collaborators→ broker multi toggle sheet
 *
 * Server actions arrive as props from the page (already scope/compliance
 * gated); this component only renders and submits.
 */

import { useState, useTransition } from 'react'
import { ChevronRight, Minus, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobilePickerSheet, type PickerOption } from '@/components/admin/crm/mobile/MobilePickerSheet'
import { cn } from '@/lib/utils'

export interface MobileDetailsSectionProps {
  personId: number
  assignedTo: string | null
  assignedToSlug: string | null
  stage: string
  source: string | null
  tags: string[]
  timeframe: string | null
  collaborators: { slug: string; name: string }[]
  brokerOptions: PickerOption[]
  stageOptions: string[]
  assignBrokerAction: (fd: FormData) => Promise<void>
  updateStageAction: (fd: FormData) => Promise<void>
  addTagAction: (fd: FormData) => Promise<void>
  removeTagAction: (fd: FormData) => Promise<void>
  addCollaboratorAction: (fd: FormData) => Promise<void>
  removeCollaboratorAction: (fd: FormData) => Promise<void>
}

function Row({
  label,
  value,
  onTap,
}: {
  label: string
  value: React.ReactNode
  onTap?: () => void
}) {
  const inner = (
    <>
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-right text-[13px] font-medium text-foreground">
        <span className="truncate">{value}</span>
        {onTap ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : null}
      </span>
    </>
  )
  const cls = 'flex min-h-[44px] w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0'
  if (onTap) {
    return (
      <button type="button" onClick={onTap} className={cn(cls, 'text-left active:bg-secondary')}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}

export function MobileDetailsSection({
  personId,
  assignedTo,
  assignedToSlug,
  stage,
  source,
  tags,
  timeframe,
  collaborators,
  brokerOptions,
  stageOptions,
  assignBrokerAction,
  updateStageAction,
  addTagAction,
  removeTagAction,
  addCollaboratorAction,
  removeCollaboratorAction,
}: MobileDetailsSectionProps) {
  const [openPicker, setOpenPicker] = useState<null | 'assigned' | 'stage' | 'tags' | 'collab'>(null)
  const [newTag, setNewTag] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (action: (fd: FormData) => Promise<void>, fields: Record<string, string>) => {
    const fd = new FormData()
    fd.set('personId', String(personId))
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return action(fd)
  }

  const collabSlugs = new Set(collaborators.map((c) => c.slug))

  return (
    <div className="bg-card shadow-sm">
      <Row label="Assigned to" value={assignedTo ?? '—'} onTap={() => setOpenPicker('assigned')} />
      <Row label="Stage" value={stage || '—'} onTap={() => setOpenPicker('stage')} />
      <Row label="Source" value={source || '—'} />
      <Row
        label="Tags"
        value={tags.length > 0 ? tags.join(', ') : 'Add tags…'}
        onTap={() => setOpenPicker('tags')}
      />
      <Row label="Time frame" value={timeframe || '—'} />
      <Row
        label="Collaborators"
        value={collaborators.length > 0 ? collaborators.map((c) => c.name).join(', ') : 'No collaborators'}
        onTap={() => setOpenPicker('collab')}
      />

      {/* Assigned-to picker (§28 assign-to via the §23.8 sheet) */}
      <MobilePickerSheet
        title="Assign to"
        open={openPicker === 'assigned'}
        onOpenChange={(v) => setOpenPicker(v ? 'assigned' : null)}
        options={brokerOptions}
        selected={assignedToSlug}
        onConfirm={(broker) => submit(assignBrokerAction, { broker })}
      />

      {/* Stage picker (mob-35) */}
      <MobilePickerSheet
        title="Stage"
        open={openPicker === 'stage'}
        onOpenChange={(v) => setOpenPicker(v ? 'stage' : null)}
        options={stageOptions.map((s) => ({ value: s, label: s }))}
        selected={stage}
        onConfirm={(s) => submit(updateStageAction, { stage: s })}
      />

      {/* Tags editor (§25.10: Add tags row + alphabetical rows + remove) */}
      <Sheet open={openPicker === 'tags'} onOpenChange={(v) => setOpenPicker(v ? 'tags' : null)}>
        <SheetContent side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0" style={{ maxHeight: '85dvh' }}>
          <div className="flex h-[50px] shrink-0 items-center justify-between bg-primary px-4">
            <span className="w-14" />
            <SheetTitle className="text-[17px] font-semibold text-primary-foreground">Tags</SheetTitle>
            <button type="button" className="w-14 text-right text-[17px] text-primary-foreground" onClick={() => setOpenPicker(null)}>
              Done
            </button>
          </div>
          {/* §25.10.3 Add tags row */}
          <form
            className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              const t = newTag.trim().toLowerCase()
              if (!t) return
              startTransition(async () => {
                await submit(addTagAction, { tag: t })
                setNewTag('')
              })
            }}
          >
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tags"
              className="h-9 flex-1 bg-card text-[15px]"
            />
            <Button type="submit" size="sm" disabled={pending || !newTag.trim()} className="h-9">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>
          {/* §25.10.4 tag rows — alphabetical, remove circle */}
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: 'calc(85dvh - 100px)' }}>
            {tags.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px] text-muted-foreground">No tags yet.</p>
            ) : (
              [...tags]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                .map((t) => (
                  <div key={t} className="flex h-[52px] items-center gap-3 border-b border-border bg-card px-4">
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      disabled={pending}
                      onClick={() => startTransition(async () => { await submit(removeTagAction, { tag: t }) })}
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="truncate text-[16px] text-foreground">{t}</span>
                  </div>
                ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Collaborators toggle sheet — tap a broker to add/remove */}
      <Sheet open={openPicker === 'collab'} onOpenChange={(v) => setOpenPicker(v ? 'collab' : null)}>
        <SheetContent side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0">
          <div className="flex h-[50px] shrink-0 items-center justify-between bg-primary px-4">
            <span className="w-14" />
            <SheetTitle className="text-[17px] font-semibold text-primary-foreground">Collaborators</SheetTitle>
            <button type="button" className="w-14 text-right text-[17px] text-primary-foreground" onClick={() => setOpenPicker(null)}>
              Done
            </button>
          </div>
          <div className="pb-[env(safe-area-inset-bottom)]">
            {brokerOptions
              .filter((b) => b.value !== assignedToSlug)
              .map((b) => {
                const isCollab = collabSlugs.has(b.value)
                return (
                  <button
                    key={b.value}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const fd = new FormData()
                        fd.set('brokerSlug', b.value)
                        await (isCollab ? removeCollaboratorAction(fd) : addCollaboratorAction(fd))
                      })
                    }
                    className={cn(
                      'flex min-h-[52px] w-full items-center justify-between border-b border-border px-4 text-left',
                      isCollab ? 'bg-primary/5' : 'bg-card',
                    )}
                  >
                    <span className="text-[17px] text-foreground">{b.label}</span>
                    <span className="text-[13px]" style={{ color: 'var(--console-info)' }}>
                      {isCollab ? 'Remove' : 'Add'}
                    </span>
                  </button>
                )
              })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
