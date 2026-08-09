'use client'

/**
 * GCI + broker splits for /admin/crm/deals/[id]. 11F: taken off shadcn onto the
 * locked admin v2 language.
 *
 * §0 note: presentation only. No figure moves through this change — the splits
 * grid prints the same `${s.split_pct}%` and
 * `$${Math.round(s.split_dollars).toLocaleString()}` strings the shadcn table
 * printed, the GCI fields carry the same save-on-blur patch keys
 * (`commission_dollars`, `commission_percent`), and BROKER_SLUGS, the 0–100
 * split validation and every error string are untouched.
 *
 * The splits Table becomes ReportGrid — the admin's one tabular reader.
 * ReportGrid is stateless and takes ReactNode cells, so the per-row remove
 * control (now an IconButton, which keeps the muted→danger hover the ghost
 * button had) lives in the last cell, whose header label stays empty exactly as
 * the old TableHead w-8 column was.
 *
 * The literal ids (`comm-dollars`, `comm-pct`) are gone because TextField owns
 * the label→input association through its own useId; a repo-wide grep finds
 * them nowhere but this file's former Label/Input pair.
 *
 * ci:admin-ui rule C: exactly one primary <Button> here — "Save split". The
 * remove control is an IconButton, which the rule does not count.
 */

import { useTransition, useState } from 'react'
import {
  Button,
  IconButton,
  ReportGrid,
  SelectField,
  TextField,
  type ReportColumn,
} from '@/components/admin/v2'
import { updateCrmDeal, addDealSplit, removeDealSplit } from '@/app/actions/crm-deals'
import type { CrmDealSplit } from '@/lib/data/crm/getCrmDeal'

const BROKER_SLUGS = ['matt', 'paul', 'rebecca']

/** Last column carries the row's remove control — headerless, as before. */
const SPLIT_COLUMNS: ReportColumn[] = [
  { key: 'broker', label: 'Broker' },
  { key: 'pct', label: 'Split %', numeric: true },
  { key: 'dollars', label: 'Split $', numeric: true },
  { key: 'notes', label: 'Notes' },
  { key: 'remove', label: '' },
]

type Props = {
  dealId: number
  initialCommissionDollars: number | null
  initialCommissionPercent: number | null
  splits: CrmDealSplit[]
}

export function DealCommission({
  dealId,
  initialCommissionDollars,
  initialCommissionPercent,
  splits,
}: Props) {
  const [dollars, setDollars] = useState(
    initialCommissionDollars != null ? String(initialCommissionDollars) : '',
  )
  const [pct, setPct] = useState(
    initialCommissionPercent != null ? String(initialCommissionPercent) : '',
  )
  const [gciError, setGciError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Add split form state
  const [newSlug, setNewSlug] = useState(BROKER_SLUGS[0])
  const [newPct, setNewPct] = useState('100')
  const [newDollars, setNewDollars] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [splitError, setSplitError] = useState<string | null>(null)

  function saveGci(field: 'dollars' | 'pct') {
    startTransition(async () => {
      const patch =
        field === 'dollars'
          ? { commission_dollars: dollars ? Number(dollars) : null }
          : { commission_percent: pct ? Number(pct) : null }
      const res = await updateCrmDeal(dealId, patch)
      if (!res.ok) setGciError(res.error)
      else setGciError(null)
    })
  }

  function handleAddSplit() {
    setSplitError(null)
    const pctNum = Number(newPct)
    if (!newPct.trim() || isNaN(pctNum) || pctNum <= 0 || pctNum > 100) {
      setSplitError('Split % must be between 0 and 100')
      return
    }
    startTransition(async () => {
      const res = await addDealSplit(dealId, {
        broker_slug: newSlug,
        split_pct: pctNum,
        split_dollars: newDollars ? Number(newDollars) : null,
        notes: newNotes || null,
      })
      if (!res.ok) {
        setSplitError(res.error)
      } else {
        setNewPct('100')
        setNewDollars('')
        setNewNotes('')
      }
    })
  }

  function handleRemoveSplit(splitId: number) {
    startTransition(async () => {
      await removeDealSplit(dealId, splitId)
    })
  }

  return (
    <div className="space-y-5">
      {/* GCI fields */}
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="GCI ($)"
          type="number"
          min="0"
          step="100"
          value={dollars}
          disabled={isPending}
          onChange={(e) => setDollars(e.target.value)}
          onBlur={() => saveGci('dollars')}
          placeholder="e.g. 18000"
        />
        <TextField
          label="Commission (%)"
          type="number"
          min="0"
          max="10"
          step="0.01"
          value={pct}
          disabled={isPending}
          onChange={(e) => setPct(e.target.value)}
          onBlur={() => saveGci('pct')}
          placeholder="e.g. 3.0"
        />
      </div>
      {gciError ? (
        <p className="text-xs" style={{ color: 'var(--a-danger)' }}>
          {gciError}
        </p>
      ) : null}

      {/* Splits grid */}
      {splits.length > 0 ? (
        <ReportGrid
          label="Broker splits"
          columns={SPLIT_COLUMNS}
          template="minmax(0,1fr) 90px 110px minmax(0,1.4fr) 44px"
          minWidth={560}
          empty="No splits yet."
          rows={splits.map((s) => ({
            key: String(s.id),
            cells: [
              <span key="broker" className="capitalize">
                {s.broker_slug}
              </span>,
              `${s.split_pct}%`,
              s.split_dollars != null ? `$${Math.round(s.split_dollars).toLocaleString()}` : '—',
              s.notes ?? '—',
              <IconButton
                key="remove"
                label="Remove split"
                tone="danger"
                disabled={isPending}
                onClick={() => handleRemoveSplit(s.id)}
              >
                ✕
              </IconButton>,
            ],
          }))}
        />
      ) : (
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
          No splits yet.
        </p>
      )}

      {/* Add split form */}
      <details className="group">
        <summary
          className="cursor-pointer select-none text-xs font-medium hover:underline"
          style={{ color: 'var(--a-accent)' }}
        >
          + Add split
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Broker"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            disabled={isPending}
          >
            {BROKER_SLUGS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Split %"
            type="number"
            min="0"
            max="100"
            step="1"
            value={newPct}
            onChange={(e) => setNewPct(e.target.value)}
            disabled={isPending}
          />
          <TextField
            label="Split $ (opt)"
            type="number"
            min="0"
            value={newDollars}
            onChange={(e) => setNewDollars(e.target.value)}
            disabled={isPending}
            placeholder="—"
          />
          <TextField
            label="Notes (opt)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            disabled={isPending}
            placeholder="—"
          />
        </div>
        {splitError ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--a-danger)' }}>
            {splitError}
          </p>
        ) : null}
        <Button type="button" className="mt-3" disabled={isPending} onClick={handleAddSplit}>
          Save split
        </Button>
      </details>
    </div>
  )
}
