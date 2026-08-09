'use client'

/**
 * AddStageDialog — §10 Add-a-stage: name + accent color from the predefined
 * palette + is_closed_stage toggle. Owner only (action enforces).
 *
 * Split out of DealsDialogs.tsx in 11F so its "Add stage" submit keeps that
 * file's own "Create deal" as the ONE primary-variant v2 <Button> ci:admin-ui
 * rule C allows per file. ColorSwatches lives here (exported) and is reused
 * by StageEditDialog.tsx rather than duplicated.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, IconButton, TextField, ToolbarCheck } from '@/components/admin/v2'
import { STAGE_COLOR_PALETTE } from '@/lib/crm/deal-pipelines'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import { createDealStage } from '@/app/actions/crm-deal-pipelines'

// ── color swatch row (shared by add + edit stage) ────────────────────────────
// Each swatch is an IconButton (icon-only action, aria-label REQUIRED) rather
// than a raw <button> — ci:admin-ui rule A bans the intrinsic element under
// app/admin regardless of context, swatches included.

export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGE_COLOR_PALETTE.map((c) => (
        <IconButton
          key={c}
          label={`Stage color ${c}`}
          tone="quiet"
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: c,
            border: value === c ? '2px solid var(--a-accent)' : '1px solid var(--a-border)',
          }}
        >
          <span aria-hidden />
        </IconButton>
      ))}
    </div>
  )
}

// ── AddStageDialog (§10) ─────────────────────────────────────────────────────

export function AddStageDialog({
  open,
  pipeline,
  onClose,
}: {
  open: boolean
  pipeline: BoardPipeline
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(STAGE_COLOR_PALETTE[0])
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) {
      setError('Stage name is required')
      return
    }
    startTransition(async () => {
      const res = await createDealStage(pipeline.id, {
        name: name.trim(),
        color,
        isClosedStage: closed,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setName('')
      setClosed(false)
      setError(null)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add a stage · ${pipeline.name}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? 'Adding…' : 'Add stage'}
          </Button>
        </>
      }
    >
      <TextField
        label="Stage name"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      <div className="av2-field">
        <span className="av2-field__label">Color</span>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <ToolbarCheck
        label="Mark deals in this stage as closed for reporting"
        checked={closed}
        onChange={(e) => setClosed(e.target.checked)}
      />
      {error ? (
        <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}
    </Dialog>
  )
}
