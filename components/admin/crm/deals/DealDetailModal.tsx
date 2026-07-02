'use client'

/**
 * DealDetailModal — the §11 deal detail as a CENTERED MODAL over the Kanban
 * (not a page navigation). Mounted by the deals page when ?deal=<id> is set;
 * the board stays rendered (dimmed behind the scrim); dismiss = X or scrim
 * click, which strips the param (no data changed by dismissing — AC-5 #26).
 *
 * Header: deal name (click-to-edit) · "Created <Month D, YYYY> at <h:mm am>" ·
 * pipeline > ● stage breadcrumb (dot = the stage's accent color).
 *
 * Body, two columns (§11 field inventory):
 *   LEFT:  PRICE · EARNEST MONEY DUE · DUE DILIGENCE · POSSESSION · COMMISSION ·
 *          PEOPLE (junction contacts + search-to-link) · PROPERTY ADDRESS ·
 *          DESCRIPTION · CUSTOM FIELDS ("Show all fields") · FILES
 *   RIGHT: CLOSE DATE · MUTUAL ACCEPTANCE · FINAL WALK THROUGH ·
 *          SPLITS (+ Add team split) · TEAM (assigned broker)
 *
 * Empty fields render as primary-colored "Add <field>" links (never grayed
 * inputs); populated values render as primary links; both click-to-edit inline
 * (AC-5 #20). FUB teal → Ryan Realty primary token.
 *
 * §13 archiving: Archive / Restore action in the header row (archive, not
 * delete, is how a lost deal leaves the board).
 */

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'
import { crmAvatarColor, crmInitials } from '@/components/admin/crm/mobile/avatar-utils'
import type { CrmDealDetail } from '@/lib/data/crm/getCrmDeal'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import {
  updateCrmDeal,
  addDealPerson,
  removeDealPerson,
  addDealSplit,
  removeDealSplit,
  addDealFile,
  removeDealFile,
  setDealStatus,
  type DealPatch,
} from '@/app/actions/crm-deals'
import { BROKER_LABEL, BROKER_PHOTO, dealMoney } from './DealsBoard'
import { ContactSearchField } from './DealsDialogs'

// ── field-row primitives ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  )
}

/**
 * Generic click-to-edit field (§11 empty-field UX): value or "Add <label>" as a
 * primary link; click swaps in the matching input; save patches the deal.
 */
function EditableField({
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
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        <div className="flex items-start gap-2">
          {kind === 'textarea' ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="text-sm"
            />
          ) : (
            <Input
              type={kind === 'date' ? 'date' : 'text'}
              inputMode={kind === 'currency' ? 'numeric' : undefined}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="h-8 text-sm"
            />
          )}
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={begin}
          className={cn(
            'text-left text-sm font-medium text-primary underline-offset-2 hover:underline',
            value == null && 'font-normal',
          )}
        >
          {value != null ? (display ?? String(value)) : addLabel}
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function fmtModalDate(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[2]}/${m[3]}/${m[1]}` // §11: modal dates render MM/DD/YYYY
}

// ── the modal ────────────────────────────────────────────────────────────────

export function DealDetailModal({
  deal,
  pipelines,
  brokers,
  isOwner,
}: {
  deal: CrmDealDetail
  pipelines: BoardPipeline[]
  brokers: Array<{ slug: string; name: string }>
  isOwner: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [addingPerson, setAddingPerson] = useState(false)
  const [addingSplit, setAddingSplit] = useState(false)
  const [splitBroker, setSplitBroker] = useState('')
  const [splitPct, setSplitPct] = useState('')
  const [addingFile, setAddingFile] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [showAllFields, setShowAllFields] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const stage = pipelines
    .find((p) => p.name === deal.pipeline)
    ?.stages.find((s) => s.name === deal.stage)

  function close() {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('deal')
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const refresh = () => router.refresh()

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Failed')
      else refresh()
    })
  }

  // §11 header: "Created Aug 27, 2025 at 7:39 am" (brand-timezone helper).
  const createdLine = deal.created_at
    ? `Created ${formatDate(deal.created_at)} at ${formatDate(deal.created_at, { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`
    : null

  const isArchived = (deal.status ?? '').trim().toLowerCase() === 'archived'
  const broker = deal.assigned_broker

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton
        aria-describedby={undefined}
      >
        {/* Radix a11y: a title must ALWAYS exist, even while the visible name is in edit mode. */}
        <DialogTitle className="sr-only">{deal.name ?? `Deal #${deal.id}`}</DialogTitle>
        {/* Header (§11) */}
        <div className="pr-6">
          <EditableTitle deal={deal} onSaved={refresh} />
          {createdLine ? <p className="mt-0.5 text-xs text-muted-foreground">{createdLine}</p> : null}
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{deal.pipeline ?? 'No pipeline'}</span>
            <span aria-hidden>›</span>
            {stage ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
                {stage.name}
              </span>
            ) : (
              <span className="font-medium text-foreground">{deal.stage ?? 'No stage'}</span>
            )}
            {isArchived ? (
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Archived</span>
            ) : null}
          </p>
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setDealStatus(deal.id, isArchived ? 'active' : 'archived'))}
            >
              {isArchived ? 'Restore deal' : 'Archive deal'}
            </Button>
          </div>
        </div>

        <Separator />

        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}

        {/* Body — two-column field layout (§11) */}
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {/* LEFT column */}
          <div className="space-y-4">
            <EditableField
              dealId={deal.id}
              label="Price"
              addLabel="Add price"
              column="value"
              kind="currency"
              value={deal.value}
              display={dealMoney(deal.value)}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Earnest money due"
              addLabel="Add earnest money due date"
              column="earnest_money_due"
              kind="date"
              value={deal.earnest_money_due}
              display={fmtModalDate(deal.earnest_money_due)}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Due diligence"
              addLabel="Add due diligence date"
              column="due_diligence"
              kind="date"
              value={deal.due_diligence}
              display={fmtModalDate(deal.due_diligence)}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Possession"
              addLabel="Add possession date"
              column="possession"
              kind="date"
              value={deal.possession}
              display={fmtModalDate(deal.possession)}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Commission"
              addLabel="Add commission"
              column="commission_dollars"
              kind="currency"
              value={deal.commission_dollars}
              display={dealMoney(deal.commission_dollars)}
              onSaved={refresh}
            />

            {/* PEOPLE (§20.4 junction; AC-5 #22) */}
            <div className="space-y-1.5">
              <FieldLabel>People</FieldLabel>
              <div className="flex flex-wrap items-center gap-1.5">
                {deal.people.map((p) => (
                  <span
                    key={p.id}
                    className="group inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: crmAvatarColor(p.name ?? String(p.id)), color: 'rgb(255 255 255)' }}
                    >
                      {crmInitials(p.name ?? '?')}
                    </span>
                    {p.name ?? `Contact #${p.id}`}
                    <button
                      type="button"
                      aria-label={`Remove ${p.name ?? 'contact'}`}
                      disabled={pending}
                      onClick={() => run(() => removeDealPerson(deal.id, p.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
                <Button
                  type="button"
                  size="icon-xs"
                  className="rounded-full"
                  aria-label="Link a contact"
                  onClick={() => setAddingPerson((v) => !v)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              {addingPerson ? (
                <ContactSearchField
                  selected={null}
                  excludeIds={deal.people.map((p) => p.id)}
                  onSelect={(p) => {
                    if (p) {
                      setAddingPerson(false)
                      run(() => addDealPerson(deal.id, p.id))
                    }
                  }}
                />
              ) : null}
            </div>

            <EditableField
              dealId={deal.id}
              label="Property address"
              addLabel="Add property address"
              column="property_address"
              kind="text"
              value={deal.property_address}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Description"
              addLabel="Add description"
              column="description"
              kind="textarea"
              value={deal.description}
              onSaved={refresh}
            />

            {/* CUSTOM FIELDS (§14) — collapsed behind "Show all fields" */}
            <div className="space-y-1">
              <FieldLabel>Custom fields</FieldLabel>
              <button
                type="button"
                onClick={() => setShowAllFields((v) => !v)}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {showAllFields ? 'Hide fields' : 'Show all fields'}
              </button>
              {showAllFields ? (
                <p className="text-xs text-muted-foreground">No custom deal fields defined.</p>
              ) : null}
            </div>

            {/* FILES */}
            <div className="space-y-1.5">
              <FieldLabel>Files</FieldLabel>
              {deal.files.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {deal.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      {f.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {f.name}
                        </a>
                      ) : (
                        <span className="truncate">{f.name}</span>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        disabled={pending}
                        onClick={() => run(() => removeDealFile(deal.id, f.id))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {addingFile ? (
                <div className="space-y-1.5">
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="File name"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://…"
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !fileName.trim() || !fileUrl.trim()}
                      onClick={() => {
                        setAddingFile(false)
                        run(() => addDealFile(deal.id, { name: fileName.trim(), url: fileUrl.trim() }))
                        setFileName('')
                        setFileUrl('')
                      }}
                    >
                      Add
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAddingFile(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingFile(true)}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  Upload file(s) or add a link
                </button>
              )}
            </div>
          </div>

          {/* RIGHT column */}
          <div className="space-y-4">
            <EditableField
              dealId={deal.id}
              label="Close date"
              addLabel="Add close date"
              column="close_date"
              kind="date"
              value={deal.close_date}
              display={fmtModalDate(deal.close_date)}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Mutual acceptance"
              addLabel="Add mutual acceptance date"
              column="mutual_acceptance"
              kind="date"
              value={deal.mutual_acceptance}
              display={fmtModalDate(deal.mutual_acceptance)}
              onSaved={refresh}
            />
            <EditableField
              dealId={deal.id}
              label="Final walk through"
              addLabel="Add final walk through date"
              column="final_walkthrough"
              kind="date"
              value={deal.final_walkthrough}
              display={fmtModalDate(deal.final_walkthrough)}
              onSaved={refresh}
            />

            {/* SPLITS */}
            <div className="space-y-1.5">
              <FieldLabel>Splits</FieldLabel>
              {deal.splits.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {deal.splits.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="font-medium text-primary">
                          {s.split_dollars != null ? dealMoney(s.split_dollars) : `${s.split_pct}%`}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          ({BROKER_LABEL[s.broker_slug] ?? s.broker_slug} split)
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Remove split"
                        disabled={pending}
                        onClick={() => run(() => removeDealSplit(deal.id, s.id))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {addingSplit ? (
                <div className="space-y-1.5">
                  <Select value={splitBroker} onValueChange={setSplitBroker}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Broker" />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.map((b) => (
                        <SelectItem key={b.slug} value={b.slug}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={splitPct}
                    onChange={(e) => setSplitPct(e.target.value)}
                    placeholder="Split %"
                    inputMode="numeric"
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !splitBroker || !splitPct.trim()}
                      onClick={() => {
                        const pct = Number(splitPct.replace(/[^0-9.]/g, ''))
                        if (!Number.isFinite(pct)) return
                        setAddingSplit(false)
                        run(() => addDealSplit(deal.id, { broker_slug: splitBroker, split_pct: pct }))
                        setSplitPct('')
                      }}
                    >
                      Add
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAddingSplit(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSplit(true)}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  Add team split
                </button>
              )}
            </div>

            {/* TEAM — assigned broker (photo avatar; §11 TEAM section) */}
            <div className="space-y-1.5">
              <FieldLabel>Team</FieldLabel>
              <div className="flex items-center gap-2">
                {broker ? (
                  <>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={BROKER_PHOTO[broker]} alt={BROKER_LABEL[broker] ?? broker} />
                      <AvatarFallback className="text-xs">
                        {crmInitials(BROKER_LABEL[broker] ?? broker)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{BROKER_LABEL[broker] ?? broker}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
              {isOwner ? (
                <Select
                  value={broker ?? ''}
                  onValueChange={(v) => run(() => updateCrmDeal(deal.id, { assigned_broker: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Assign a broker" />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.slug} value={b.slug}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Deal name — H1-weight, click-to-edit (§11 header). */
function EditableTitle({ deal, onSaved }: { deal: CrmDealDetail; onSaved: () => void }) {
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
        <Input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="h-9 text-lg font-semibold"
        />
        <Button type="button" size="sm" onClick={save} disabled={pending || !draft.trim()}>
          Save
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(deal.name ?? '')
        setEditing(true)
      }}
      className="text-left text-xl font-bold text-foreground underline-offset-4 hover:underline"
    >
      {deal.name ?? `Deal #${deal.id}`}
    </button>
  )
}
