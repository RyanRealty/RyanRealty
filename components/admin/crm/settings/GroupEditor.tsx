'use client'

/**
 * GroupEditor — FUB-style CRUD editor for crm_groups + their members.
 *
 * Displays all groups in a card list. Each card lets the owner:
 *   - rename the group
 *   - toggle distribution_type (round_robin | first_to_claim)
 *   - add / remove broker members
 *   - delete the group
 *
 * New-group creation is handled by a bottom form. All mutations go through
 * the server actions (crm-groups.ts) passed in as props.
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
import type { CrmGroup } from '@/lib/data/crm/getCrmGroups'

type Result = { ok: boolean; error?: string; id?: number }
type BrokerOption = { slug: string; name: string }

const DIST_LABELS: Record<string, string> = {
  round_robin:    'Round robin',
  first_to_claim: 'First to claim',
}

export default function GroupEditor({
  groups,
  brokers,
  createGroupAction,
  updateGroupAction,
  deleteGroupAction,
  addGroupMemberAction,
  removeGroupMemberAction,
}: {
  groups: CrmGroup[]
  brokers: BrokerOption[]
  createGroupAction: (fd: FormData) => Promise<Result>
  updateGroupAction: (fd: FormData) => Promise<Result>
  deleteGroupAction: (fd: FormData) => Promise<Result>
  addGroupMemberAction: (fd: FormData) => Promise<Result>
  removeGroupMemberAction: (fd: FormData) => Promise<Result>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDist, setNewDist] = useState<'round_robin' | 'first_to_claim'>('round_robin')
  // Per-group "add member" slug state keyed by group id.
  const [addMemberSlug, setAddMemberSlug] = useState<Record<number, string>>({})

  const run = (build: () => FormData, action: (fd: FormData) => Promise<Result>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await action(build())
      if (!res.ok) { setError(res.error ?? 'Could not save'); return }
      after?.()
      router.refresh()
    })
  }

  const brokerName = (slug: string) => brokers.find((b) => b.slug === slug)?.name ?? slug

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      {/* Existing groups */}
      {groups.map((g) => {
        const available = brokers.filter((b) => !g.members.some((m) => m.brokerSlug === b.slug))
        const defaultAdd = addMemberSlug[g.id] ?? available[0]?.slug ?? ''
        return (
          <ConsoleSection
            key={g.id}
            title={g.name}
            count={`${g.members.length} member${g.members.length !== 1 ? 's' : ''}`}
            action={
              <Badge variant="outline" className="text-xs tabular-nums">
                {DIST_LABELS[g.distributionType] ?? g.distributionType}
              </Badge>
            }
          >
            <div className="space-y-4">
              {/* Rename + distribution type */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`group-name-${g.id}`}>Name</Label>
                  <Input
                    id={`group-name-${g.id}`}
                    defaultValue={g.name}
                    key={`name-${g.id}-${g.updatedAt}`}
                    onBlur={(e) => {
                      const val = e.currentTarget.value.trim()
                      if (val && val !== g.name) {
                        run(() => { const fd = new FormData(); fd.set('id', String(g.id)); fd.set('name', val); return fd }, updateGroupAction)
                      }
                    }}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`group-dist-${g.id}`}>Distribution</Label>
                  <Select
                    value={g.distributionType}
                    onValueChange={(v) =>
                      run(
                        () => { const fd = new FormData(); fd.set('id', String(g.id)); fd.set('distribution_type', v); return fd },
                        updateGroupAction,
                      )
                    }
                    disabled={pending}
                  >
                    <SelectTrigger id={`group-dist-${g.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin">Round robin</SelectItem>
                      <SelectItem value="first_to_claim">First to claim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Member list */}
              {g.members.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Members</p>
                  <div className="flex flex-wrap gap-2">
                    {g.members.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm',
                        )}
                      >
                        <span className="font-medium text-foreground">{brokerName(m.brokerSlug)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${brokerName(m.brokerSlug)}`}
                          disabled={pending}
                          className="ml-0.5 h-5 w-5 p-0 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() =>
                            run(
                              () => { const fd = new FormData(); fd.set('member_id', String(m.id)); return fd },
                              removeGroupMemberAction,
                            )
                          }
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}

              {/* Add member */}
              {available.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`add-member-${g.id}`}>Add broker</Label>
                    <Select
                      value={defaultAdd}
                      onValueChange={(v) => setAddMemberSlug((prev) => ({ ...prev, [g.id]: v }))}
                      disabled={pending}
                    >
                      <SelectTrigger id={`add-member-${g.id}`} className="w-48">
                        <SelectValue placeholder="Select broker" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((b) => (
                          <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10 sm:h-9"
                    disabled={pending || !defaultAdd}
                    onClick={() =>
                      run(
                        () => { const fd = new FormData(); fd.set('group_id', String(g.id)); fd.set('broker_slug', defaultAdd); return fd },
                        addGroupMemberAction,
                        () => setAddMemberSlug((prev) => ({ ...prev, [g.id]: available[1]?.slug ?? '' })),
                      )
                    }
                  >
                    Add
                  </Button>
                </div>
              )}

              {/* Delete group */}
              <div className="border-t border-border pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2.5 text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete group "${g.name}"? Lead flows that target it will lose their assignment.`)) return
                    run(
                      () => { const fd = new FormData(); fd.set('id', String(g.id)); return fd },
                      deleteGroupAction,
                    )
                  }}
                >
                  Delete group
                </Button>
              </div>
            </div>
          </ConsoleSection>
        )
      })}

      {/* Create new group */}
      <ConsoleSection title="New group">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="new-group-name">Name</Label>
            <Input
              id="new-group-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Seller Leads"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-group-dist">Distribution</Label>
            <Select value={newDist} onValueChange={(v) => setNewDist(v as typeof newDist)} disabled={pending}>
              <SelectTrigger id="new-group-dist">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round robin</SelectItem>
                <SelectItem value="first_to_claim">First to claim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-10 sm:col-span-3 sm:h-9 sm:w-fit"
            disabled={pending || !newName.trim()}
            onClick={() =>
              run(
                () => { const fd = new FormData(); fd.set('name', newName.trim()); fd.set('distribution_type', newDist); return fd },
                createGroupAction,
                () => setNewName(''),
              )
            }
          >
            Create group
          </Button>
        </div>
      </ConsoleSection>
    </div>
  )
}
