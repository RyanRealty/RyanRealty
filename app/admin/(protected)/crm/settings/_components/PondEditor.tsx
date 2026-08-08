'use client'

/**
 * PondEditor — CRUD editor for crm_ponds + their members.
 *
 * Displays all ponds in a card list. Each card lets the owner:
 *   - rename the pond and set pond_lead_slug
 *   - add / remove broker members (who can claim leads from this pond)
 *   - delete the pond
 *
 * New-pond creation is handled by a bottom form.
 *
 * Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — pond membership decides who may CLAIM a lead, so every
 * FormData key, every action call, the blur-to-save rename wiring and the
 * `available` / `defaultAdd` derivation are carried over unchanged. Each
 * ConsoleSection (a shadcn Card underneath, drawn in the PUBLIC palette) is now
 * a SectionHead over an av2-pane; the member "×" is an IconButton whose
 * accessible name is the same "Remove <broker>" string it always was.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, IconButton, SectionHead, SelectField, TextField } from '@/components/admin/v2'
import type { CrmPond } from '@/lib/data/crm/getCrmPonds'

type Result = { ok: boolean; error?: string; id?: number }
type BrokerOption = { slug: string; name: string }

/** Uppercase micro-label over a list (matches .av2-lane-head, inside a pane). */
const MICRO_LABEL = {
  margin: 0,
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
} as const

export default function PondEditor({
  ponds,
  brokers,
  createPondAction,
  updatePondAction,
  deletePondAction,
  addPondMemberAction,
  removePondMemberAction,
}: {
  ponds: CrmPond[]
  brokers: BrokerOption[]
  createPondAction: (fd: FormData) => Promise<Result>
  updatePondAction: (fd: FormData) => Promise<Result>
  deletePondAction: (fd: FormData) => Promise<Result>
  addPondMemberAction: (fd: FormData) => Promise<Result>
  removePondMemberAction: (fd: FormData) => Promise<Result>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
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

      {/* Existing ponds */}
      {ponds.map((p) => {
        const available = brokers.filter((b) => !p.members.some((m) => m.brokerSlug === b.slug))
        const defaultAdd = addMemberSlug[p.id] ?? available[0]?.slug ?? ''
        return (
          <section key={p.id} aria-label={p.name}>
            <SectionHead>{p.name}</SectionHead>
            <div className="av2-pane">
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                {`${p.members.length} member${p.members.length !== 1 ? 's' : ''}`}
              </p>

              {/* Name + slug */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
                <TextField
                  label="Name"
                  defaultValue={p.name}
                  key={`name-${p.id}-${p.updatedAt}`}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim()
                    if (val && val !== p.name) {
                      run(() => { const fd = new FormData(); fd.set('id', String(p.id)); fd.set('name', val); return fd }, updatePondAction)
                    }
                  }}
                  disabled={pending}
                />
                <TextField
                  label="Lead source slug"
                  defaultValue={p.pondLeadSlug}
                  key={`slug-${p.id}-${p.updatedAt}`}
                  placeholder="out-of-state"
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim()
                    if (val !== p.pondLeadSlug) {
                      run(() => { const fd = new FormData(); fd.set('id', String(p.id)); fd.set('pond_lead_slug', val); return fd }, updatePondAction)
                    }
                  }}
                  disabled={pending}
                />
              </div>

              {/* Member list */}
              {p.members.length > 0 ? (
                <div className="space-y-1.5">
                  <p style={MICRO_LABEL}>Members who can claim</p>
                  <div className="flex flex-wrap gap-2">
                    {p.members.map((m) => (
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
                              removePondMemberAction,
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
                    onChange={(e) => setAddMemberSlug((prev) => ({ ...prev, [p.id]: e.target.value }))}
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
                        () => { const fd = new FormData(); fd.set('pond_id', String(p.id)); fd.set('broker_slug', defaultAdd); return fd },
                        addPondMemberAction,
                        () => setAddMemberSlug((prev) => ({ ...prev, [p.id]: available[1]?.slug ?? '' })),
                      )
                    }
                  >
                    Add
                  </Button>
                </div>
              )}

              {/* Delete */}
              <div style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s3)' }}>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete pond "${p.name}"? Leads waiting in it will have their pond_id cleared.`)) return
                    run(() => { const fd = new FormData(); fd.set('id', String(p.id)); return fd }, deletePondAction)
                  }}
                >
                  Delete pond
                </Button>
              </div>
            </div>
          </section>
        )
      })}

      {/* Create new pond */}
      <section aria-label="New pond">
        <SectionHead>New pond</SectionHead>
        <div className="av2-pane">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
            <TextField
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Out Of State Home Owners"
              disabled={pending}
            />
            <TextField
              label="Lead source slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="out-of-state"
              disabled={pending}
            />
            <div className="sm:col-span-2 sm:w-fit">
              <Button
                type="button"
                touch
                disabled={pending || !newName.trim()}
                onClick={() =>
                  run(
                    () => { const fd = new FormData(); fd.set('name', newName.trim()); fd.set('pond_lead_slug', newSlug.trim()); return fd },
                    createPondAction,
                    () => { setNewName(''); setNewSlug('') },
                  )
                }
              >
                Create pond
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
