'use client'

/**
 * StageEditDialog — §10 stage management: rename / recolor / closed flag /
 * move left-right (order_weight renumbers in 1000-gaps) / delete.
 *
 * Split out of DealsDialogs.tsx in 11F (see AddStageDialog.tsx) — this file's
 * own "Save" is its one primary-variant v2 <Button>; "Delete" is danger and
 * "Cancel" is quiet, neither counts toward ci:admin-ui rule C.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Dialog, IconButton, TextField, ToolbarCheck } from '@/components/admin/v2'
import type { BoardPipeline, BoardStage } from '@/lib/data/crm/getDealPipelines'
import { deleteDealStage, moveDealStage, updateDealStage } from '@/app/actions/crm-deal-pipelines'
import { ColorSwatches } from './AddStageDialog'

export function StageEditDialog({
  stage,
  pipeline,
  onClose,
}: {
  stage: BoardStage | null
  pipeline: BoardPipeline
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (stage) {
      setName(stage.name)
      setColor(stage.color)
      setClosed(stage.isClosedStage)
      setError(null)
    }
  }, [stage])

  if (!stage) return null

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'Failed')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit stage · ${stage.name}`}
      footer={
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 'var(--a-s2)' }}>
          <Button variant="danger" disabled={pending} onClick={() => run(() => deleteDealStage(stage.id))}>
            Delete
          </Button>
          <div style={{ display: 'flex', gap: 'var(--a-s2)' }}>
            <Button variant="quiet" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending || !name.trim()}
              onClick={() => run(() => updateDealStage(stage.id, { name: name.trim(), color, isClosedStage: closed }))}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <TextField label="Stage name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="av2-field">
        <span className="av2-field__label">Color</span>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <ToolbarCheck
        label="Mark deals in this stage as closed for reporting"
        checked={closed}
        onChange={(e) => setClosed(e.target.checked)}
      />
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Reorder:</span>
        <IconButton
          label="Move stage left"
          disabled={pending}
          onClick={() => run(() => moveDealStage(stage.id, -1))}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton
          label="Move stage right"
          disabled={pending}
          onClick={() => run(() => moveDealStage(stage.id, 1))}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
      {error ? (
        <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}
    </Dialog>
  )
}
