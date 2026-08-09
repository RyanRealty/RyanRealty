'use client'

/**
 * Deals dialogs (spec §10):
 *  - ContactSearchField — shared searchable contact picker (also used by
 *    DealDetailModal for its PEOPLE section).
 *  - AddDealDialog  — §12 Add Deal flow (per-column "+" / empty-state link):
 *    name + stage (required, pre-scoped), price, projected close date,
 *    associated contact (search), commission, assignee (owner picks any broker;
 *    a restricted broker always self-assigns — AC-6).
 *
 * AddStageDialog and StageEditDialog moved to their own files (AddStageDialog.tsx,
 * StageEditDialog.tsx) in the same 11F pass: each carries its own primary submit
 * Button, and ci:admin-ui rule C caps a file at one primary-variant v2 <Button> —
 * the same reason ConfigTableEditor's Add/Rename dialogs live apart from it.
 *
 * 11F: migrated to the admin v2 language. The hand-rolled search input + results
 * list becomes Combobox (a caller-driven/async search is exactly what its
 * onQueryChange mode is for); shadcn Dialog/Input/Label/Select become the v2
 * Dialog/TextField/SelectField.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Button, Combobox, Dialog, IconButton, SelectField, TextField } from '@/components/admin/v2'
import type { BoardPipeline, BoardStage } from '@/lib/data/crm/getDealPipelines'
import { createCrmDeal } from '@/app/actions/crm-deals'
import { searchPeopleForMergeAction, type MergeCandidate } from '@/app/actions/crm-person-gaps'

// ── contact search field (shared with the detail modal) ─────────────────────

export function ContactSearchField({
  selected,
  onSelect,
  excludeIds = [],
  placeholder = 'Search contacts…',
}: {
  selected: { id: number; name: string | null } | null
  onSelect: (p: { id: number; name: string | null } | null) => void
  excludeIds?: number[]
  placeholder?: string
}) {
  const [results, setResults] = useState<MergeCandidate[]>([])
  const [searching, startSearch] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function handleQueryChange(q: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    timerRef.current = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchPeopleForMergeAction(trimmed, -1)
        setResults(rows.filter((r) => !excludeIds.includes(r.id)))
      })
    }, 250)
  }

  if (selected) {
    return (
      <div
        className="flex items-center justify-between"
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-md)',
          padding: '8px 12px',
          fontSize: 'var(--a-text-sm)',
        }}
      >
        <span className="truncate">{selected.name ?? `Contact #${selected.id}`}</span>
        <IconButton label="Remove contact" tone="quiet" onClick={() => onSelect(null)}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
    )
  }

  return (
    <Combobox
      label={placeholder}
      placeholder={placeholder}
      options={results.map((r) => ({
        value: String(r.id),
        label: r.name ?? `Contact #${r.id}`,
        hint: r.stage,
      }))}
      onQueryChange={handleQueryChange}
      onSelect={(v) => {
        const r = results.find((x) => String(x.id) === v)
        if (r) onSelect({ id: r.id, name: r.name })
      }}
      loading={searching}
      emptyText="No matches."
      idleText="Type at least 2 characters to search."
    />
  )
}

// ── AddDealDialog (§12) ──────────────────────────────────────────────────────

export function AddDealDialog({
  stage,
  pipeline,
  brokers,
  isOwner,
  brokerSlug,
  onClose,
  onCreated,
}: {
  stage: BoardStage | null
  pipeline: BoardPipeline
  brokers: Array<{ slug: string; name: string }>
  isOwner: boolean
  brokerSlug: string | null
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [commission, setCommission] = useState('')
  const [contact, setContact] = useState<{ id: number; name: string | null } | null>(null)
  const [assignee, setAssignee] = useState<string>(brokerSlug ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setPrice('')
    setCloseDate('')
    setCommission('')
    setContact(null)
    setAssignee(brokerSlug ?? '')
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed || !stage) {
      setError('Deal name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createCrmDeal({
        name: trimmed,
        pipeline: pipeline.name,
        stage: stage.name,
        value: price.trim() ? Number(price.replace(/[^0-9.]/g, '')) : null,
        close_date: closeDate.trim() || null,
        commission_dollars: commission.trim() ? Number(commission.replace(/[^0-9.]/g, '')) : null,
        person_id: contact?.id ?? null,
        assigned_broker: isOwner ? (assignee || null) : null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      reset()
      onCreated(res.id)
    })
  }

  return (
    <Dialog
      open={stage != null}
      onClose={close}
      title={`Add deal${stage ? ` · ${stage.name}` : ''}`}
      footer={
        <>
          <Button variant="quiet" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? 'Creating…' : 'Create deal'}
          </Button>
        </>
      }
    >
      <TextField
        label="Deal name"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder="Property address, e.g. 2732 NW Ordway"
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Price"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="$"
        />
        <TextField
          label="Commission"
          inputMode="numeric"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          placeholder="$"
        />
      </div>
      <TextField
        label="Projected close date"
        type="date"
        value={closeDate}
        onChange={(e) => setCloseDate(e.target.value)}
      />
      <div className="av2-field">
        <span className="av2-field__label">Contact</span>
        <ContactSearchField selected={contact} onSelect={setContact} />
      </div>
      {isOwner ? (
        <SelectField label="Team member" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="" disabled>
            Assign a broker
          </option>
          {brokers.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      {error ? (
        <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}
    </Dialog>
  )
}
