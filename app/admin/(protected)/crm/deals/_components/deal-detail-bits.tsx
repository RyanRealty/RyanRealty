'use client'

/**
 * Presentational + small-state pieces extracted from DealDetailModal.tsx in
 * 11F so that file stays under the 600-LOC budget (ci:file-size-budget) —
 * the fix the gate asks for, not a re-baseline of a 700+ line component
 * (precedent: crm/inbox/_components/mobile/thread-bits.tsx).
 *
 * Every Button here is variant="quiet" (or "danger" for a destructive
 * remove). The modal has no single dominant action — it is a grid of
 * independent inline-editable fields, each with its own small Save/Add —
 * so nothing here claims the primary variant; ci:admin-ui rule C (one
 * primary-variant v2 <Button> per file) is satisfied by never using it.
 */

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, IconButton, SearchField, TextAreaField, TextField, ToolbarSelect } from '@/components/admin/v2'
import type { CrmDealDetail } from '@/lib/data/crm/getCrmDeal'
import {
  addDealFile,
  addDealPerson,
  addDealSplit,
  removeDealFile,
  removeDealPerson,
  removeDealSplit,
  updateCrmDeal,
  type DealPatch,
} from '@/app/actions/crm-deals'
import { BROKER_LABEL, BROKER_PHOTO, BrokerAvatar, ContactAvatar, dealMoney } from './DealsBoard'
import { ContactSearchField } from './DealsDialogs'

type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>) => void

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 'var(--a-text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--a-text-2)' }}>
      {children}
    </p>
  )
}

export function fmtModalDate(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[2]}/${m[3]}/${m[1]}` // §11: modal dates render MM/DD/YYYY
}

// ── generic click-to-edit field (§11 empty-field UX) ─────────────────────────

export function EditableField({
  dealId,
  label,
  addLabel,
  column,
  kind,
  value,
  display,
  onSaved,
}: {
  dealId: number
  label: string
  addLabel: string
  column: keyof DealPatch
  kind: 'currency' | 'date' | 'text' | 'textarea'
  value: string | number | null
  display?: string | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function begin() {
    setDraft(value == null ? '' : String(value))
    setError(null)
    setEditing(true)
  }

  function save() {
    startTransition(async () => {
      let v: string | number | null = draft.trim() || null
      if (kind === 'currency' && v != null) {
        const n = Number(String(v).replace(/[^0-9.]/g, ''))
        if (!Number.isFinite(n)) {
          setError('Enter a number')
          return
        }
        v = n
      }
      const res = await updateCrmDeal(dealId, { [column]: v } as DealPatch)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(false)
      onSaved()
    })
  }

  return (
    <div className="space-y-1">
      {/* While editing, TextField/TextAreaField render their OWN associated
          <label> (real accessible name) — showing FieldLabel too would
          duplicate it, so it only appears in the display state. */}
      {editing ? null : <FieldLabel>{label}</FieldLabel>}
      {editing ? (
        <div className="flex items-end gap-2">
          {kind === 'textarea' ? (
            <TextAreaField
              label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              style={{ fontSize: 'var(--a-text-sm)' }}
            />
          ) : (
            <TextField
              label={label}
              type={kind === 'date' ? 'date' : 'text'}
              inputMode={kind === 'currency' ? 'numeric' : undefined}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') setEditing(false)
              }}
              style={{ minHeight: 32, fontSize: 'var(--a-text-sm)' }}
            />
          )}
          <Button variant="quiet" onClick={save} disabled={pending}>
            Save
          </Button>
          <Button variant="quiet" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      ) : (
        // The accent link color applied in every original state, only the
        // WEIGHT dropped for an empty value ("font-normal") — color stays
        // var(--a-accent) both ways here too, matching the original exactly.
        <Button
          variant="quiet"
          onClick={begin}
          className="av2-textlink"
          style={{ fontSize: 'var(--a-text-sm)', fontWeight: value == null ? 400 : 500 }}
        >
          {value != null ? (display ?? String(value)) : addLabel}
        </Button>
      )}
      {error ? <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p> : null}
    </div>
  )
}

/**
 * Deal name — click-to-edit (§11 header). The v2 Dialog primitive's `title`
 * prop is typed as a plain string (not a clickable node), so the modal now
 * shows the deal name there — real, accurate a11y content, an improvement
 * on the original's visually-hidden DialogTitle workaround. This component
 * keeps the SAME capability (rename via the same updateCrmDeal call) as a
 * "Rename" trigger next to it rather than duplicating the name as giant
 * clickable text right under a native header already showing it.
 */
export function EditableTitle({ deal, onSaved }: { deal: CrmDealDetail; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(deal.name ?? '')
  const [pending, startTransition] = useTransition()

  function save() {
    const v = draft.trim()
    if (!v) return
    startTransition(async () => {
      const res = await updateCrmDeal(deal.id, { name: v })
      if (res.ok) {
        setEditing(false)
        onSaved()
      }
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <TextField
          label="Deal name"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          style={{ fontSize: 'var(--a-text-lg)', fontWeight: 700 }}
        />
        <Button variant="quiet" onClick={save} disabled={pending || !draft.trim()}>
          Save
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="quiet"
      onClick={() => {
        setDraft(deal.name ?? '')
        setEditing(true)
      }}
      className="av2-textlink"
      style={{ fontSize: 'var(--a-text-sm)' }}
    >
      Rename
    </Button>
  )
}

// ── PEOPLE (§20.4 junction; AC-5 #22) ────────────────────────────────────────

export function PeopleSection({ dealId, people, pending, run }: {
  dealId: number
  people: CrmDealDetail['people']
  pending: boolean
  run: RunFn
}) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-1.5">
      <FieldLabel>People</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {people.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2"
            style={{ background: 'var(--a-inset)', fontSize: 'var(--a-text-xs)' }}
          >
            <ContactAvatar id={p.id} name={p.name} size={20} />
            {p.name ?? `Contact #${p.id}`}
            <IconButton
              label={`Remove ${p.name ?? 'contact'}`}
              tone="quiet"
              disabled={pending}
              onClick={() => run(() => removeDealPerson(dealId, p.id))}
              style={{ width: 18, height: 18 }}
            >
              <X className="h-3 w-3" aria-hidden />
            </IconButton>
          </span>
        ))}
        <IconButton label="Link a contact" onClick={() => setAdding((v) => !v)} className="av2-addbtn" style={{ width: 24, height: 24 }}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
      {adding ? (
        <ContactSearchField
          selected={null}
          excludeIds={people.map((p) => p.id)}
          onSelect={(p) => {
            if (p) {
              setAdding(false)
              run(() => addDealPerson(dealId, p.id))
            }
          }}
        />
      ) : null}
    </div>
  )
}

// ── FILES ─────────────────────────────────────────────────────────────────────

export function FilesSection({ dealId, files, pending, run }: {
  dealId: number
  files: CrmDealDetail['files']
  pending: boolean
  run: RunFn
}) {
  const [addingFile, setAddingFile] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState('')

  return (
    <div className="space-y-1.5">
      <FieldLabel>Files</FieldLabel>
      {files.length > 0 ? (
        <ul className="space-y-1" style={{ fontSize: 'var(--a-text-sm)' }}>
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="av2-textlink truncate"
                  style={{ fontWeight: 500 }}
                >
                  {f.name}
                </a>
              ) : (
                <span className="truncate">{f.name}</span>
              )}
              <IconButton
                label={`Remove ${f.name}`}
                tone="quiet"
                disabled={pending}
                onClick={() => run(() => removeDealFile(dealId, f.id))}
              >
                <X className="h-3 w-3" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      {addingFile ? (
        <div className="space-y-1.5">
          <SearchField type="text" aria-label="File name" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="File name" style={{ width: '100%' }} />
          <SearchField type="text" aria-label="File URL" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" style={{ width: '100%' }} />
          <div className="flex gap-2">
            <Button
              variant="quiet"
              disabled={pending || !fileName.trim() || !fileUrl.trim()}
              onClick={() => {
                setAddingFile(false)
                run(() => addDealFile(dealId, { name: fileName.trim(), url: fileUrl.trim() }))
                setFileName('')
                setFileUrl('')
              }}
            >
              Add
            </Button>
            <Button variant="quiet" onClick={() => setAddingFile(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="quiet" onClick={() => setAddingFile(true)} className="av2-textlink" style={{ fontSize: 'var(--a-text-sm)' }}>
          Upload file(s) or add a link
        </Button>
      )}
    </div>
  )
}

// ── SPLITS ────────────────────────────────────────────────────────────────────

export function SplitsSection({ dealId, splits, brokers, pending, run }: {
  dealId: number
  splits: CrmDealDetail['splits']
  brokers: Array<{ slug: string; name: string }>
  pending: boolean
  run: RunFn
}) {
  const [addingSplit, setAddingSplit] = useState(false)
  const [splitBroker, setSplitBroker] = useState('')
  const [splitPct, setSplitPct] = useState('')

  return (
    <div className="space-y-1.5">
      <FieldLabel>Splits</FieldLabel>
      {splits.length > 0 ? (
        <ul className="space-y-1" style={{ fontSize: 'var(--a-text-sm)' }}>
          {splits.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-medium" style={{ color: 'var(--a-accent)' }}>
                  {s.split_dollars != null ? dealMoney(s.split_dollars) : `${s.split_pct}%`}
                </span>{' '}
                <span style={{ color: 'var(--a-text-2)' }}>
                  ({BROKER_LABEL[s.broker_slug] ?? s.broker_slug} split)
                </span>
              </span>
              <IconButton label="Remove split" tone="quiet" disabled={pending} onClick={() => run(() => removeDealSplit(dealId, s.id))}>
                <X className="h-3 w-3" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      {addingSplit ? (
        <div className="space-y-1.5">
          <ToolbarSelect aria-label="Broker" value={splitBroker} onChange={(e) => setSplitBroker(e.target.value)} style={{ width: '100%' }}>
            <option value="" disabled>
              Broker
            </option>
            {brokers.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </ToolbarSelect>
          <SearchField type="text" aria-label="Split percent" value={splitPct} onChange={(e) => setSplitPct(e.target.value)} inputMode="numeric" placeholder="Split %" style={{ width: '100%' }} />
          <div className="flex gap-2">
            <Button
              variant="quiet"
              disabled={pending || !splitBroker || !splitPct.trim()}
              onClick={() => {
                const pct = Number(splitPct.replace(/[^0-9.]/g, ''))
                if (!Number.isFinite(pct)) return
                setAddingSplit(false)
                run(() => addDealSplit(dealId, { broker_slug: splitBroker, split_pct: pct }))
                setSplitPct('')
              }}
            >
              Add
            </Button>
            <Button variant="quiet" onClick={() => setAddingSplit(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="quiet" onClick={() => setAddingSplit(true)} className="av2-textlink" style={{ fontSize: 'var(--a-text-sm)' }}>
          Add team split
        </Button>
      )}
    </div>
  )
}

// ── TEAM — assigned broker (photo avatar; §11 TEAM section) ─────────────────

export function TeamSection({ dealId, broker, brokers, isOwner, run }: {
  dealId: number
  broker: string | null
  brokers: Array<{ slug: string; name: string }>
  isOwner: boolean
  run: RunFn
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>Team</FieldLabel>
      <div className="flex items-center gap-2">
        {broker ? (
          <>
            <BrokerAvatar src={BROKER_PHOTO[broker]} label={BROKER_LABEL[broker] ?? broker} size={28} />
            <span style={{ fontSize: 'var(--a-text-sm)' }}>{BROKER_LABEL[broker] ?? broker}</span>
          </>
        ) : (
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Unassigned</span>
        )}
      </div>
      {isOwner ? (
        <ToolbarSelect
          aria-label="Assign a broker"
          value={broker ?? ''}
          onChange={(e) => run(() => updateCrmDeal(dealId, { assigned_broker: e.target.value }))}
          style={{ width: '100%' }}
        >
          <option value="" disabled>
            Assign a broker
          </option>
          {brokers.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </ToolbarSelect>
      ) : null}
    </div>
  )
}
