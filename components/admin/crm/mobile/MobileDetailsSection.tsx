'use client'

/**
 * MobileDetailsSection — the interactive §25.5.7 DETAILS card, with the full
 * §28 picker set (mobile-pickers, docs/fub-crm-spec/28-mobile-pickers-modals-
 * and-action-sheets.md).
 *
 * Every row behaves like FUB: tapping opens the matching picker/editor —
 *   Assigned to  → §28 §5 Assign-To sheet (Currently banner · search · Me /
 *                  PONDS / TEAM MEMBERS, tap = instant assign)
 *   Stage        → §28 §2 stage picker (mob-35)
 *   Source       → §28 §3 source picker (mob-54: <unspecified> pinned first,
 *                  account source strings verbatim)
 *   Tags         → tags editor sheet (§25.10: alphabetical rows, add + remove)
 *   Time frame   → §28 §4 five-option picker (mob-36)
 *   Collaborators→ broker multi toggle sheet
 *   Automations  → §28 §6 automations picker (mob-15: text-only rows,
 *                  Select → enroll via the compliance-gated manual path)
 *
 * Broker-scoped writes arrive as bound form actions from the page; the §28
 * field writes call the §07 person-detail actions directly (same gated
 * server actions the desktop sidebar uses).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Minus, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobilePickerSheet, type PickerOption } from '@/components/admin/crm/mobile/MobilePickerSheet'
import { MobileAssignToSheet } from '@/components/admin/crm/mobile/MobileAssignToSheet'
import {
  updatePersonFieldAction,
  assignPondAction,
  applyAutomationAction,
} from '@/app/actions/crm-person-detail'
import { TIMEFRAME_OPTIONS } from '@/components/admin/crm/people-list/people-list-utils'
import { cn } from '@/lib/utils'

/** §28 picker data bundle — assembled by the route (mobile-detail.tsx). */
export interface MobilePickersData {
  /** Account source vocabulary, verbatim (mob-54). */
  sources: string[]
  ponds: Array<{ id: number; name: string }>
  /** Active automations, alphabetical (mob-15). */
  sequences: Array<{ id: number; name: string }>
  /** Names of automations this contact is currently enrolled in. */
  enrolledNames: string[]
  currentBrokerSlug: string
  currentBrokerName: string
}

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
  pickers: MobilePickersData
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
  pickers,
  assignBrokerAction,
  updateStageAction,
  addTagAction,
  removeTagAction,
  addCollaboratorAction,
  removeCollaboratorAction,
}: MobileDetailsSectionProps) {
  const router = useRouter()
  const [openPicker, setOpenPicker] = useState<null | 'assigned' | 'stage' | 'source' | 'timeframe' | 'tags' | 'collab' | 'automations'>(null)
  const [newTag, setNewTag] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (action: (fd: FormData) => Promise<void>, fields: Record<string, string>) => {
    const fd = new FormData()
    fd.set('personId', String(personId))
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return action(fd)
  }

  /** §28 field write via the §07 gated action, then refresh the server tree. */
  const saveField = async (field: 'source' | 'timeframe', value: string) => {
    const r = await updatePersonFieldAction(personId, field, value)
    if (!r.ok) console.error('[mobile-pickers] save', field, r.error)
    router.refresh()
  }

  const collabSlugs = new Set(collaborators.map((c) => c.slug))

  // §3.4 — <unspecified> pinned first (the clear option); every stored string
  // verbatim. A literal stored '<unspecified>' string (FUB import artifact)
  // would duplicate the clear row, so it folds into it. The contact's current
  // value joins the list even if it fell out of the account vocabulary (so the
  // checkmark still lands somewhere true).
  const vocab = pickers.sources.filter((s) => s !== '<unspecified>')
  const sourceOptions: PickerOption[] = [
    { value: '', label: '<unspecified>' },
    ...(source && !vocab.includes(source) ? [{ value: source, label: source }] : []),
    ...vocab.map((s) => ({ value: s, label: s })),
  ]

  return (
    <div className="bg-card shadow-sm">
      <Row label="Assigned to" value={assignedTo ?? '—'} onTap={() => setOpenPicker('assigned')} />
      <Row label="Stage" value={stage || '—'} onTap={() => setOpenPicker('stage')} />
      <Row label="Source" value={source || '—'} onTap={() => setOpenPicker('source')} />
      <Row
        label="Tags"
        value={tags.length > 0 ? tags.join(', ') : 'Add tags…'}
        onTap={() => setOpenPicker('tags')}
      />
      <Row label="Time frame" value={timeframe || '—'} onTap={() => setOpenPicker('timeframe')} />
      <Row
        label="Collaborators"
        value={collaborators.length > 0 ? collaborators.map((c) => c.name).join(', ') : 'No collaborators'}
        onTap={() => setOpenPicker('collab')}
      />
      <Row
        label="Automations"
        value={pickers.enrolledNames.length > 0 ? pickers.enrolledNames.join(', ') : 'Add to Automation'}
        onTap={() => setOpenPicker('automations')}
      />

      {/* §28 §5 Assign-To sheet (mob-34): banner · search · Me / PONDS / TEAM */}
      <MobileAssignToSheet
        open={openPicker === 'assigned'}
        onOpenChange={(v) => setOpenPicker(v ? 'assigned' : null)}
        currentAssigneeName={assignedTo}
        currentBrokerSlug={pickers.currentBrokerSlug}
        currentBrokerName={pickers.currentBrokerName}
        brokers={brokerOptions.map((b) => ({ slug: b.value, name: b.label }))}
        ponds={pickers.ponds}
        onAssignBroker={(broker) => submit(assignBrokerAction, { broker })}
        onAssignPond={async (pondId) => {
          const r = await assignPondAction(personId, pondId)
          if (!r.ok) console.error('[mobile-pickers] assignPond:', r.error)
          router.refresh()
        }}
      />

      {/* §28 §3 Source picker (mob-54) */}
      <MobilePickerSheet
        title="Source"
        open={openPicker === 'source'}
        onOpenChange={(v) => setOpenPicker(v ? 'source' : null)}
        options={sourceOptions}
        selected={source ?? ''}
        onConfirm={(v) => saveField('source', v)}
      />

      {/* §28 §4 Time frame picker (mob-36) */}
      <MobilePickerSheet
        title="Time frame"
        open={openPicker === 'timeframe'}
        onOpenChange={(v) => setOpenPicker(v ? 'timeframe' : null)}
        options={TIMEFRAME_OPTIONS.map((t) => ({ value: t, label: t }))}
        selected={timeframe}
        onConfirm={(v) => saveField('timeframe', v)}
      />

      {/* §28 §6 Automations picker (mob-15): text-only rows, Select → enroll */}
      <MobilePickerSheet
        title="Automations"
        open={openPicker === 'automations'}
        onOpenChange={(v) => setOpenPicker(v ? 'automations' : null)}
        options={pickers.sequences.map((s) => ({ value: String(s.id), label: s.name }))}
        selected={null}
        onConfirm={async (v) => {
          const r = await applyAutomationAction(personId, Number(v))
          if (!r.ok) console.error('[mobile-pickers] enroll:', r.error)
          router.refresh()
        }}
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
        <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0" style={{ maxHeight: '85dvh' }}>
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
        <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0">
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
