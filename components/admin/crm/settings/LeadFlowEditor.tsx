'use client'

/**
 * LeadFlowEditor — FUB-style editor for lead_flows + their rule rows.
 *
 * One card per flow showing:
 *   - source, display name, default distribution target
 *   - an ordered rule list (FlowRuleRow) with condition badges
 *   - add / remove rule UI (FlowRuleEditor, rendered inline)
 *   - archive / delete actions
 *
 * New-flow creation form at the bottom.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { cn } from '@/lib/utils'
import type { LeadFlow, LeadFlowRule } from '@/lib/data/crm/getLeadFlow'
import type { CrmGroup } from '@/lib/data/crm/getCrmGroups'
import type { CrmPond } from '@/lib/data/crm/getCrmPonds'

type Result = { ok: boolean; error?: string; id?: number }
type BrokerOption = { slug: string; name: string }

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
    <Badge key={idx} variant="outline" className="text-xs font-normal tabular-nums">
      {cond.field} {cond.op} {cond.value}
    </Badge>
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
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-foreground uppercase tracking-widest">New rule</p>
      {localError && <p className="text-xs text-destructive">{localError}</p>}

      {/* Conditions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Match</Label>
          <Select value={conditionMatch} onValueChange={(v) => setConditionMatch(v as 'all' | 'any')} disabled={localPending || pending}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">conditions</span>
        </div>
        {conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap gap-1.5 items-end">
            <Select value={c.field} onValueChange={(v) => updateCond(i, 'field', v)} disabled={localPending || pending}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
              </SelectContent>
            </Select>
            <Select value={c.op} onValueChange={(v) => updateCond(i, 'op', v)} disabled={localPending || pending}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {c.field === 'price' && <>
                  <SelectItem value="gt">{'>'}</SelectItem>
                  <SelectItem value="lt">{'<'}</SelectItem>
                  <SelectItem value="eq">{'='}</SelectItem>
                </>}
                {(c.field === 'area' || c.field === 'tag') && <>
                  <SelectItem value="eq">equals</SelectItem>
                  <SelectItem value="contains">contains</SelectItem>
                </>}
              </SelectContent>
            </Select>
            <Input
              className="h-8 w-32 text-xs"
              placeholder={c.field === 'price' ? '750000' : 'value'}
              value={c.value}
              onChange={(e) => updateCond(i, 'value', e.target.value)}
              disabled={localPending || pending}
            />
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeCond(i)}>×</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={addCond} disabled={localPending || pending}>
          + Add condition
        </Button>
        {conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions — rule always matches.</p>}
      </div>

      {/* Distribution target */}
      <div className="space-y-2">
        <Label className="text-xs">Route to</Label>
        <div className="flex flex-wrap gap-1.5">
          {(['broker', 'group', 'pond'] as const).map((k) => (
            <Button key={k} type="button" size="sm" variant={targetKind === k ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setTargetKind(k)} disabled={localPending || pending}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </Button>
          ))}
        </div>
        {targetKind === 'broker' && (
          <Select value={target.broker} onValueChange={(v) => setTarget((t) => ({ ...t, broker: v }))} disabled={localPending || pending}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Select broker" />
            </SelectTrigger>
            <SelectContent>
              {brokers.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {targetKind === 'group' && (
          <Select value={target.groupId} onValueChange={(v) => setTarget((t) => ({ ...t, groupId: v }))} disabled={localPending || pending}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {targetKind === 'pond' && (
          <Select value={target.pondId} onValueChange={(v) => setTarget((t) => ({ ...t, pondId: v }))} disabled={localPending || pending}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Select pond" />
            </SelectTrigger>
            <SelectContent>
              {ponds.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-9" onClick={save} disabled={localPending || pending}>Save rule</Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onDone} disabled={localPending || pending}>Cancel</Button>
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
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      {flows.length === 0 && (
        <p className="text-sm text-muted-foreground">No lead flows yet. Create one below.</p>
      )}

      {/* Existing flows */}
      {flows.map((flow) => (
        <ConsoleSection
          key={flow.id}
          title={flow.displayName}
          count={flow.archived ? 'archived' : undefined}
          action={
            <Badge variant="outline" className="text-xs font-mono tabular-nums">
              {flow.source}
            </Badge>
          }
        >
          <div className="space-y-4">
            {/* Default target */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Default target:</span>
              <span className="font-medium text-foreground">
                {targetLabel(flow.assignedBrokerSlug, flow.assignedGroupId, flow.assignedPondId, brokers, groups, ponds)}
              </span>
            </div>

            {/* Rules */}
            {flow.rules.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Rules</p>
                <div className="space-y-2">
                  {flow.rules.map((rule, idx) => (
                    <div
                      key={rule.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-2.5"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span>#{idx + 1}</span>
                          <span>·</span>
                          <span>{rule.conditionMatch === 'all' ? 'All' : 'Any'} of:</span>
                        </div>
                        {rule.conditions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rule.conditions.map((c, ci) => conditionBadge(c, ci))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Always matches</span>
                        )}
                        <div className="text-xs text-foreground">
                          <span className="text-muted-foreground">Route to: </span>
                          <span className="font-medium">
                            {targetLabel(rule.assignedBrokerSlug, rule.assignedGroupId, rule.assignedPondId, brokers, groups, ponds)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive shrink-0"
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn('h-9', flow.archived && 'opacity-50')}
                disabled={pending || flow.archived}
                onClick={() => setAddingRuleTo(flow.id)}
              >
                Add rule
              </Button>
            )}

            {/* Archive / Delete */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {!flow.archived ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2.5 text-muted-foreground"
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
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2.5 text-foreground"
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
                size="sm"
                variant="ghost"
                className="h-9 px-2.5 text-destructive hover:text-destructive"
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
        </ConsoleSection>
      ))}

      {/* Create new flow */}
      <ConsoleSection title="New lead flow">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="new-flow-source">Source</Label>
              <Input
                id="new-flow-source"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="seller-lp"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-flow-display">Display name</Label>
              <Input
                id="new-flow-display"
                value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                placeholder="Seller landing page"
                disabled={pending}
              />
            </div>
          </div>

          {/* Target kind */}
          <div className="space-y-2">
            <Label className="text-xs">Route to</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['broker', 'group', 'pond'] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={newTargetKind === k ? 'default' : 'outline'}
                  className="h-9"
                  onClick={() => setNewTargetKind(k)}
                  disabled={pending}
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </Button>
              ))}
            </div>
            {newTargetKind === 'broker' && (
              <Select value={newBroker} onValueChange={setNewBroker} disabled={pending}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select broker" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {newTargetKind === 'group' && (
              <Select value={newGroupId} onValueChange={setNewGroupId} disabled={pending}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {newTargetKind === 'pond' && (
              <Select value={newPondId} onValueChange={setNewPondId} disabled={pending}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select pond" />
                </SelectTrigger>
                <SelectContent>
                  {ponds.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            className="h-10 sm:h-9"
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
      </ConsoleSection>
    </div>
  )
}
