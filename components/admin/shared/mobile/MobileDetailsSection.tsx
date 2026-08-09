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
import { Button, SearchField, Sheet } from '@/components/admin/v2'
import { MobilePickerSheet, type PickerOption } from '@/components/admin/shared/mobile/MobilePickerSheet'
import { MobileAssignToSheet } from '@/components/admin/shared/mobile/MobileAssignToSheet'
import {
  updatePersonFieldAction,
  assignPondAction,
  applyAutomationAction,
} from '@/app/actions/crm-person-detail'
import { TIMEFRAME_OPTIONS } from '@/components/admin/shared/people-list/people-list-utils'
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
      <span className="shrink-0 text-[13px]" style={{ color: 'var(--a-text-2)' }}>{label}</span>
      <span
        className="flex min-w-0 items-center gap-1 text-right text-[13px] font-medium"
        style={{ color: 'var(--a-text)' }}
      >
        <span className="truncate">{value}</span>
        {onTap ? (
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} />
        ) : null}
      </span>
    </>
  )
  const cls = 'flex min-h-[44px] w-full items-center justify-between gap-3 border-b px-4 py-2.5 last:border-0'
  const borderStyle = { borderColor: 'var(--a-border)' }
  if (onTap) {
    return (
      // The pressed wash is the only feedback this row gives — a phone has no
      // hover, so without it a tap reads as nothing happening until the sheet
      // animates. --a-inset is this language's press/hover surface (tokens.css:
      // "wells, input bg, hover"; .av2-rail__item, .av2-conv and .av2-menu__item
      // all press to it) and it reads against the --a-surface this card sits on.
      // It stays a CLASS: an inline background would beat the :active rule.
      <button
        type="button"
        onClick={onTap}
        className={cn(cls, 'text-left active:bg-[var(--a-inset)]')}
        style={borderStyle}
      >
        {inner}
      </button>
    )
  }
  return <div className={cls} style={borderStyle}>{inner}</div>
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
    <div style={{ background: 'var(--a-surface)', borderTop: '1px solid var(--a-border)' }}>
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
      <Sheet open={openPicker === 'tags'} onClose={() => setOpenPicker(null)} title="Tags">
        {/*
          One bounded column: add-row and Done pinned, ONLY the tag list scrolls.
          .av2-sheet is itself the scroller (overflow-y:auto, max-height 92dvh
          phone / 85dvh desktop), so an unbounded child stack pushes past that
          height and the whole surface scrolls — carrying the add row, the sheet
          header and Done away with the list. That is what the pre-migration
          SheetContent's `maxHeight: 85dvh` + overflow-hidden prevented.
          96px = the sheet's own chrome at its tallest (12 padding-top + 4 grip
          + 12 grip margin + 36 header button + 12 header margin + 20
          padding-bottom), so the whole sheet stays inside its own max-height in
          both the phone and the ≥768px centred layout.
        */}
        <div className="flex min-h-0 flex-col overflow-hidden" style={{ maxHeight: 'calc(85dvh - 96px)' }}>
          {/* §25.10.3 Add tags row */}
          <form
            className="flex shrink-0 items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--a-border)', background: 'var(--a-bg)' }}
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
            <SearchField
              type="text"
              aria-label="Add tags"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tags"
              className="h-9 flex-1 text-[15px]"
              style={{ maxWidth: 'none', minHeight: 32, background: 'var(--a-surface)' }}
            />
            <Button type="submit" disabled={pending || !newTag.trim()} className="h-9">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>
          {/* §25.10.4 tag rows — alphabetical, remove circle */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px]" style={{ color: 'var(--a-text-2)' }}>
                No tags yet.
              </p>
            ) : (
              [...tags]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                .map((t) => (
                  <div
                    key={t}
                    className="flex h-[52px] items-center gap-3 px-4"
                    style={{ borderBottom: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
                  >
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      disabled={pending}
                      onClick={() => startTransition(async () => { await submit(removeTagAction, { tag: t }) })}
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'var(--a-danger)', color: 'var(--a-bg)' }}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="truncate text-[16px]" style={{ color: 'var(--a-text)' }}>{t}</span>
                  </div>
                ))
            )}
          </div>
          {/* Pinned Done — the pre-migration sheet kept it fixed above the list;
              it stays reachable however long the list grows. The padding floor
              is not decoration: the column clips (overflow-hidden), and a bare
              safe-area inset is 0px on desktop, which would shave the button's
              4px focus ring off the bottom edge. */}
          <div
            className="flex shrink-0 justify-end pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            style={{ borderTop: '1px solid var(--a-border)' }}
          >
            <Button variant="quiet" onClick={() => setOpenPicker(null)}>
              Done
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Collaborators toggle sheet — tap a broker to add/remove */}
      <Sheet open={openPicker === 'collab'} onClose={() => setOpenPicker(null)} title="Collaborators">
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
                  className="flex min-h-[52px] w-full items-center justify-between border-b px-4 text-left"
                  style={{
                    borderColor: 'var(--a-border)',
                    background: isCollab ? 'var(--a-accent-wash)' : 'var(--a-surface)',
                  }}
                >
                  <span className="text-[17px]" style={{ color: 'var(--a-text)' }}>{b.label}</span>
                  <span className="text-[13px]" style={{ color: 'var(--a-accent)' }}>
                    {isCollab ? 'Remove' : 'Add'}
                  </span>
                </button>
              )
            })}
        </div>
        <div className="flex justify-end">
          <Button variant="quiet" onClick={() => setOpenPicker(null)}>
            Done
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
