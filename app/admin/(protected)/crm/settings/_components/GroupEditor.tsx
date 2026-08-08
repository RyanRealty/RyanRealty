'use client'

/**
 * GroupEditor — CRUD editor for crm_groups + their members.
 *
 * Displays all groups in a card list. Each card lets the owner:
 *   - rename the group
 *   - toggle distribution_type (round_robin | first_to_claim)
 *   - add / remove broker members
 *   - delete the group
 *
 * New-group creation is handled by a bottom form. All mutations go through
 * the server actions (crm-groups.ts) passed in as props.
 *
 * Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — group membership and distribution_type decide WHICH
 * broker receives a lead, so every FormData key, every action call and the
 * blur-to-save rename wiring are carried over unchanged. The distribution
 * picker moved from a Radix Select to the platform <select> behind SelectField;
 * it still fires updateGroupAction with the chosen value on change.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, IconButton, SectionHead, SelectField, TextField } from '@/components/admin/v2'
import type { CrmGroup } from '@/lib/data/crm/getCrmGroups'

type Result = { ok: boolean; error?: string; id?: number }
type BrokerOption = { slug: string; name: string }

const DIST_LABELS: Record<string, string> = {
  round_robin:    'Round robin',
  first_to_claim: 'First to claim',
}

/** Uppercase micro-label over a list (matches .av2-lane-head, inside a pane). */
const MICRO_LABEL = {
  margin: 0,
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
} as const

/** Outlined caption pill — pills are reserved for FilterChip, so this is a box. */
const TAG = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
} as const

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
      {error ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}

      {/* Existing groups */}
      {groups.map((g) => {
        const available = brokers.filter((b) => !g.members.some((m) => m.brokerSlug === b.slug))
        const defaultAdd = addMemberSlug[g.id] ?? available[0]?.slug ?? ''
        return (
          <section key={g.id} aria-label={g.name}>
            <SectionHead>{g.name}</SectionHead>
            <div className="av2-pane">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                  {`${g.members.length} member${g.members.length !== 1 ? 's' : ''}`}
                </p>
                <span className="a-num shrink-0" style={TAG}>
                  {DIST_LABELS[g.distributionType] ?? g.distributionType}
                </span>
              </div>

              {/* Rename + distribution type */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
                <div className="sm:col-span-2">
                  <TextField
                    label="Name"
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
                <SelectField
                  label="Distribution"
                  value={g.distributionType}
                  onChange={(e) => {
                    // Captured up front: `run` builds the FormData in a transition
                    // callback, and the controlled <select> is re-driven from
                    // g.distributionType until the refresh lands.
                    const v = e.target.value
                    run(
                      () => { const fd = new FormData(); fd.set('id', String(g.id)); fd.set('distribution_type', v); return fd },
                      updateGroupAction,
                    )
                  }}
                  disabled={pending}
                >
                  <option value="round_robin">Round robin</option>
                  <option value="first_to_claim">First to claim</option>
                </SelectField>
              </div>

              {/* Member list */}
              {g.members.length > 0 ? (
                <div className="space-y-1.5">
                  <p style={MICRO_LABEL}>Members</p>
                  <div className="flex flex-wrap gap-2">
                    {g.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5"
                        style={{
                          border: '1px solid var(--a-border)',
                          background: 'var(--a-inset)',
                          borderRadius: 'var(--a-r-md)',
                          padding: '2px 4px 2px 12px',
                          fontSize: 'var(--a-text-sm)',
                        }}
                      >
                        <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>{brokerName(m.brokerSlug)}</span>
                        <IconButton
                          type="button"
                          label={`Remove ${brokerName(m.brokerSlug)}`}
                          tone="danger"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => { const fd = new FormData(); fd.set('member_id', String(m.id)); return fd },
                              removeGroupMemberAction,
                            )
                          }
                        >
                          ×
                        </IconButton>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>No members yet.</p>
              )}

              {/* Add member */}
              {available.length > 0 && (
                <div className="av2-inline-form">
                  <SelectField
                    label="Add broker"
                    value={defaultAdd}
                    onChange={(e) => setAddMemberSlug((prev) => ({ ...prev, [g.id]: e.target.value }))}
                    disabled={pending}
                  >
                    {available.map((b) => (
                      <option key={b.slug} value={b.slug}>{b.name}</option>
                    ))}
                  </SelectField>
                  <Button
                    type="button"
                    variant="quiet"
                    touch
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
              <div style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s3)' }}>
                <Button
                  type="button"
                  variant="danger"
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
          </section>
        )
      })}

      {/* Create new group */}
      <section aria-label="New group">
        <SectionHead>New group</SectionHead>
        <div className="av2-pane">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
            <div className="sm:col-span-2">
              <TextField
                label="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Seller Leads"
                disabled={pending}
              />
            </div>
            <SelectField
              label="Distribution"
              value={newDist}
              onChange={(e) => setNewDist(e.target.value as typeof newDist)}
              disabled={pending}
            >
              <option value="round_robin">Round robin</option>
              <option value="first_to_claim">First to claim</option>
            </SelectField>
            <div className="sm:col-span-3 sm:w-fit">
              <Button
                type="button"
                touch
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
          </div>
        </div>
      </section>
    </div>
  )
}
