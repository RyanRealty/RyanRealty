'use client'

/**
 * LeadFlowEditor — editor for lead_flows + their rule rows.
 *
 * One card per flow showing:
 *   - source, display name, default distribution target
 *   - an ordered rule list (FlowRuleRow) with condition badges
 *   - add / remove rule UI (FlowRuleEditor, rendered inline)
 *   - archive / delete actions
 *
 * New-flow creation form at the bottom.
 *
 * Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — a flow rule decides WHICH broker, group or pond receives
 * a lead, so every FormData key, the condition shape, the rule ordering
 * (position '0') and every action call are carried over unchanged.
 *
 * ci:admin-ui rule C allows ONE primary Button per file and this file holds two
 * submits. "Save rule" keeps it: it sits beside its own Cancel, and two quiet
 * buttons side by side name no default. "Create lead flow" is the only control
 * in its section, so it reads unambiguously as quiet.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  FilterChip,
  IconButton,
  SearchField,
  SectionHead,
  TextField,
  ToolbarSelect,
} from '@/components/admin/v2'
import type { LeadFlow, LeadFlowRule } from '@/lib/data/crm/getLeadFlow'
import type { CrmGroup } from '@/lib/data/crm/getCrmGroups'
import type { CrmPond } from '@/lib/data/crm/getCrmPonds'

type Result = { ok: boolean; error?: string; id?: number }
type BrokerOption = { slug: string; name: string }

/** Outlined caption box — pills are reserved for FilterChip. */
const TAG = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
} as const

/** Uppercase micro-label over a list (matches .av2-lane-head, inside a pane). */
const MICRO_LABEL = {
  margin: 0,
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
} as const

/** Field caption for a control that carries its name beside it, not above it. */
const INLINE_LABEL = {
  fontSize: 'var(--a-text-sm)',
  fontWeight: 600,
  color: 'var(--a-text)',
} as const

/** Human-readable summary of what a target points to. */
function targetLabel(
  brokerSlug: string | null,
  groupId: number | null,
  pondId: number | null,
  brokers: BrokerOption[],
  groups: CrmGroup[],
  ponds: CrmPond[],
): string {
  if (brokerSlug) return brokers.find((b) => b.slug === brokerSlug)?.name ?? brokerSlug
  if (groupId != null) return `Group: ${groups.find((g) => g.id === groupId)?.name ?? groupId}`
  if (pondId != null) return `Pond: ${ponds.find((p) => p.id === pondId)?.name ?? pondId}`
  return 'No target'
}

/** Compact representation of a single condition. */
function conditionBadge(cond: { field: string; op: string; value: string }, idx: number) {
  return (
    <span key={idx} className="a-num" style={TAG}>
      {cond.field} {cond.op} {cond.value}
    </span>
  )
}

type TargetFields = {
  broker: string
  groupId: string
  pondId: string
}

/** Sub-form for adding a rule to a flow. */
function FlowRuleEditor({
  flowId,
  groups,
  ponds,
  brokers,
  upsertRuleAction,
  onDone,
  pending,
}: {
  flowId: number
  groups: CrmGroup[]
  ponds: CrmPond[]
  brokers: BrokerOption[]
  upsertRuleAction: (fd: FormData) => Promise<Result>
  onDone: () => void
  pending: boolean
}) {
  const router = useRouter()
  const [localPending, startTransition] = useTransition()
  const [conditionMatch, setConditionMatch] = useState<'all' | 'any'>('all')
  const [conditions, setConditions] = useState<Array<{ field: string; op: string; value: string }>>([])
  const [targetKind, setTargetKind] = useState<'broker' | 'group' | 'pond'>('broker')
  const [target, setTarget] = useState<TargetFields>({ broker: brokers[0]?.slug ?? '', groupId: String(groups[0]?.id ?? ''), pondId: String(ponds[0]?.id ?? '') })
  const [localError, setLocalError] = useState<string | null>(null)

  const addCond = () => setConditions((c) => [...c, { field: 'price', op: 'gt', value: '' }])
  const removeCond = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i))
  const updateCond = (i: number, key: string, val: string) =>
    setConditions((c) => c.map((item, idx) => idx === i ? { ...item, [key]: val } : item))

  const save = () => {
    setLocalError(null)
    const fd = new FormData()
    fd.set('flow_id', String(flowId))
    fd.set('position', '0')
    fd.set('condition_match', conditionMatch)
    fd.set('conditions', JSON.stringify(conditions))
    if (targetKind === 'broker') fd.set('assigned_broker_slug', target.broker)
    else if (targetKind === 'group') fd.set('assigned_group_id', target.groupId)
    else if (targetKind === 'pond') fd.set('assigned_pond_id', target.pondId)
    startTransition(async () => {
      const res = await upsertRuleAction(fd)
      if (!res.ok) { setLocalError(res.error ?? 'Could not save'); return }
      onDone()
      router.refresh()
    })
  }

  return (
    <div
      className="space-y-3"
      style={{
        border: '1px solid var(--a-border)',
        background: 'var(--a-inset)',
        borderRadius: 'var(--a-r-md)',
        padding: 'var(--a-s3)',
      }}
    >
      <p style={{ ...MICRO_LABEL, color: 'var(--a-text)' }}>New rule</p>
      {localError && <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{localError}</p>}

      {/* Conditions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span style={INLINE_LABEL}>Match</span>
          <ToolbarSelect
            aria-label="Match conditions"
            value={conditionMatch}
            onChange={(e) => setConditionMatch(e.target.value as 'all' | 'any')}
            disabled={localPending || pending}
          >
            <option value="all">All</option>
            <option value="any">Any</option>
          </ToolbarSelect>
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>conditions</span>
        </div>
        {conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap gap-1.5 items-end">
            <ToolbarSelect
              aria-label={`Condition ${i + 1} field`}
              value={c.field}
              onChange={(e) => updateCond(i, 'field', e.target.value)}
              disabled={localPending || pending}
            >
              <option value="price">Price</option>
              <option value="area">Area</option>
              <option value="tag">Tag</option>
            </ToolbarSelect>
            <ToolbarSelect
              aria-label={`Condition ${i + 1} operator`}
              value={c.op}
              onChange={(e) => updateCond(i, 'op', e.target.value)}
              disabled={localPending || pending}
            >
              {c.field === 'price' && <>
                <option value="gt">{'>'}</option>
                <option value="lt">{'<'}</option>
                <option value="eq">{'='}</option>
              </>}
              {(c.field === 'area' || c.field === 'tag') && <>
                <option value="eq">equals</option>
                <option value="contains">contains</option>
              </>}
            </ToolbarSelect>
            <SearchField
              type="text"
              aria-label={`Condition ${i + 1} value`}
              placeholder={c.field === 'price' ? '750000' : 'value'}
              value={c.value}
              onChange={(e) => updateCond(i, 'value', e.target.value)}
              disabled={localPending || pending}
            />
            <IconButton type="button" label={`Remove condition ${i + 1}`} tone="danger" onClick={() => removeCond(i)}>×</IconButton>
          </div>
        ))}
        <Button type="button" variant="quiet" onClick={addCond} disabled={localPending || pending}>
          + Add condition
        </Button>
        {conditions.length === 0 && (
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            No conditions — rule always matches.
          </p>
        )}
      </div>

      {/* Distribution target */}
      <div className="space-y-2">
        <p style={{ ...INLINE_LABEL, margin: 0 }}>Route to</p>
        <div className="flex flex-wrap gap-1.5">
          {(['broker', 'group', 'pond'] as const).map((k) => (
            <FilterChip key={k} pressed={targetKind === k} onClick={() => setTargetKind(k)} disabled={localPending || pending}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </FilterChip>
          ))}
        </div>
        {targetKind === 'broker' && (
          <ToolbarSelect
            aria-label="Route to broker"
            value={target.broker}
            onChange={(e) => { const v = e.target.value; setTarget((t) => ({ ...t, broker: v })) }}
            disabled={localPending || pending}
          >
            {brokers.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </ToolbarSelect>
        )}
        {targetKind === 'group' && (
          <ToolbarSelect
            aria-label="Route to group"
            value={target.groupId}
            onChange={(e) => { const v = e.target.value; setTarget((t) => ({ ...t, groupId: v })) }}
            disabled={localPending || pending}
          >
            {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
          </ToolbarSelect>
        )}
        {targetKind === 'pond' && (
          <ToolbarSelect
            aria-label="Route to pond"
            value={target.pondId}
            onChange={(e) => { const v = e.target.value; setTarget((t) => ({ ...t, pondId: v })) }}
            disabled={localPending || pending}
          >
            {ponds.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </ToolbarSelect>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={localPending || pending}>Save rule</Button>
        <Button type="button" variant="quiet" onClick={onDone} disabled={localPending || pending}>Cancel</Button>
      </div>
    </div>
  )
}

export default function LeadFlowEditor({
  flows,
  groups,
  ponds,
  brokers,
  createLeadFlowAction,
  updateLeadFlowAction,
  archiveLeadFlowAction,
  deleteLeadFlowAction,
  upsertLeadFlowRuleAction,
  deleteLeadFlowRuleAction,
}: {
  flows: LeadFlow[]
  groups: CrmGroup[]
  ponds: CrmPond[]
  brokers: BrokerOption[]
  createLeadFlowAction: (fd: FormData) => Promise<Result>
  updateLeadFlowAction: (fd: FormData) => Promise<Result>
  archiveLeadFlowAction: (fd: FormData) => Promise<Result>
  deleteLeadFlowAction: (fd: FormData) => Promise<Result>
  upsertLeadFlowRuleAction: (fd: FormData) => Promise<Result>
  deleteLeadFlowRuleAction: (fd: FormData) => Promise<Result>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [addingRuleTo, setAddingRuleTo] = useState<number | null>(null)

  // New flow form state
  const [newSource, setNewSource] = useState('')
  const [newDisplay, setNewDisplay] = useState('')
  const [newTargetKind, setNewTargetKind] = useState<'broker' | 'group' | 'pond'>('broker')
  const [newBroker, setNewBroker] = useState(brokers[0]?.slug ?? '')
  const [newGroupId, setNewGroupId] = useState(String(groups[0]?.id ?? ''))
  const [newPondId, setNewPondId] = useState(String(ponds[0]?.id ?? ''))

  const run = (build: () => FormData, action: (fd: FormData) => Promise<Result>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await action(build())
      if (!res.ok) { setError(res.error ?? 'Could not save'); return }
      after?.()
      router.refresh()
    })
  }

  const buildNewFlowFd = () => {
    const fd = new FormData()
    fd.set('source', newSource.trim())
    fd.set('display_name', newDisplay.trim() || newSource.trim())
    if (newTargetKind === 'broker') fd.set('assigned_broker_slug', newBroker)
    else if (newTargetKind === 'group' && newGroupId) fd.set('assigned_group_id', newGroupId)
    else if (newTargetKind === 'pond' && newPondId) fd.set('assigned_pond_id', newPondId)
    return fd
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}

      {flows.length === 0 && (
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
          No lead flows yet. Create one below.
        </p>
      )}

      {/* Existing flows */}
      {flows.map((flow) => (
        <section key={flow.id} aria-label={flow.displayName}>
          <SectionHead>{flow.displayName}</SectionHead>
          <div className="av2-pane">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {flow.archived ? (
                <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>archived</span>
              ) : (
                <span />
              )}
              <span className="a-num shrink-0" style={{ ...TAG, fontFamily: 'var(--a-font-mono)' }}>
                {flow.source}
              </span>
            </div>

            {/* Default target */}
            <div className="flex items-center gap-2" style={{ fontSize: 'var(--a-text-md)' }}>
              <span style={{ color: 'var(--a-text-2)' }}>Default target:</span>
              <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>
                {targetLabel(flow.assignedBrokerSlug, flow.assignedGroupId, flow.assignedPondId, brokers, groups, ponds)}
              </span>
            </div>

            {/* Rules */}
            {flow.rules.length > 0 && (
              <div className="space-y-1.5">
                <p style={MICRO_LABEL}>Rules</p>
                <div className="space-y-2">
                  {flow.rules.map((rule: LeadFlowRule, idx: number) => (
                    <div
                      key={rule.id}
                      className="flex flex-wrap items-start justify-between gap-2"
                      style={{
                        border: '1px solid var(--a-border)',
                        borderRadius: 'var(--a-r-md)',
                        padding: '10px',
                      }}
                    >
                      <div className="min-w-0 space-y-1">
                        <div
                          className="flex flex-wrap items-center gap-1"
                          style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                        >
                          <span className="a-num">#{idx + 1}</span>
                          <span>·</span>
                          <span>{rule.conditionMatch === 'all' ? 'All' : 'Any'} of:</span>
                        </div>
                        {rule.conditions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rule.conditions.map((c, ci) => conditionBadge(c, ci))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Always matches</span>
                        )}
                        <div style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text)' }}>
                          <span style={{ color: 'var(--a-text-2)' }}>Route to: </span>
                          <span style={{ fontWeight: 500 }}>
                            {targetLabel(rule.assignedBrokerSlug, rule.assignedGroupId, rule.assignedPondId, brokers, groups, ponds)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        className="shrink-0"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => { const fd = new FormData(); fd.set('id', String(rule.id)); return fd },
                            deleteLeadFlowRuleAction,
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add rule toggle */}
            {addingRuleTo === flow.id ? (
              <FlowRuleEditor
                flowId={flow.id}
                groups={groups}
                ponds={ponds}
                brokers={brokers}
                upsertRuleAction={upsertLeadFlowRuleAction}
                onDone={() => setAddingRuleTo(null)}
                pending={pending}
              />
            ) : (
              <div>
                <Button
                  type="button"
                  variant="quiet"
                  disabled={pending || flow.archived}
                  onClick={() => setAddingRuleTo(flow.id)}
                >
                  Add rule
                </Button>
              </div>
            )}

            {/* Archive / Delete */}
            <div
              className="flex flex-wrap items-center gap-2"
              style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s3)' }}
            >
              {!flow.archived ? (
                <Button
                  type="button"
                  variant="quiet"
                  disabled={pending}
                  onClick={() =>
                    run(() => { const fd = new FormData(); fd.set('id', String(flow.id)); return fd }, archiveLeadFlowAction)
                  }
                >
                  Archive
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="quiet"
                  disabled={pending}
                  onClick={() =>
                    run(() => { const fd = new FormData(); fd.set('id', String(flow.id)); fd.set('archived', 'false'); return fd }, updateLeadFlowAction)
                  }
                >
                  Restore
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete flow for source "${flow.source}"? This cannot be undone.`)) return
                  run(() => { const fd = new FormData(); fd.set('id', String(flow.id)); return fd }, deleteLeadFlowAction)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </section>
      ))}

      {/* Create new flow */}
      <section aria-label="New lead flow">
        <SectionHead>New lead flow</SectionHead>
        <div className="av2-pane">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
            <TextField
              label="Source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="seller-lp"
              disabled={pending}
            />
            <TextField
              label="Display name"
              value={newDisplay}
              onChange={(e) => setNewDisplay(e.target.value)}
              placeholder="Seller landing page"
              disabled={pending}
            />
          </div>

          {/* Target kind */}
          <div className="space-y-2">
            <p style={{ ...INLINE_LABEL, margin: 0 }}>Route to</p>
            <div className="flex flex-wrap gap-1.5">
              {(['broker', 'group', 'pond'] as const).map((k) => (
                <FilterChip key={k} pressed={newTargetKind === k} onClick={() => setNewTargetKind(k)} disabled={pending}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </FilterChip>
              ))}
            </div>
            {newTargetKind === 'broker' && (
              <ToolbarSelect
                aria-label="Route to broker"
                value={newBroker}
                onChange={(e) => setNewBroker(e.target.value)}
                disabled={pending}
              >
                {brokers.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </ToolbarSelect>
            )}
            {newTargetKind === 'group' && (
              <ToolbarSelect
                aria-label="Route to group"
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value)}
                disabled={pending}
              >
                {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </ToolbarSelect>
            )}
            {newTargetKind === 'pond' && (
              <ToolbarSelect
                aria-label="Route to pond"
                value={newPondId}
                onChange={(e) => setNewPondId(e.target.value)}
                disabled={pending}
              >
                {ponds.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </ToolbarSelect>
            )}
          </div>

          <div>
            <Button
              type="button"
              variant="quiet"
              touch
              disabled={pending || !newSource.trim()}
              onClick={() =>
                run(buildNewFlowFd, createLeadFlowAction, () => {
                  setNewSource('')
                  setNewDisplay('')
                })
              }
            >
              Create lead flow
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
