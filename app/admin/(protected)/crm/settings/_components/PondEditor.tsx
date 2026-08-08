'use client'

/**
 * PondEditor — FUB-style CRUD editor for crm_ponds + their members.
 *
 * Displays all ponds in a card list. Each card lets the owner:
 *   - rename the pond and set pond_lead_slug
 *   - add / remove broker members (who can claim leads from this pond)
 *   - delete the pond
 *
 * New-pond creation is handled by a bottom form.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import type { CrmPond } from '@/lib/data/crm/getCrmPonds'

type Result = { ok: boolean; error?: string; id?: number }
type BrokerOption = { slug: string; name: string }

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
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      {/* Existing ponds */}
      {ponds.map((p) => {
        const available = brokers.filter((b) => !p.members.some((m) => m.brokerSlug === b.slug))
        const defaultAdd = addMemberSlug[p.id] ?? available[0]?.slug ?? ''
        return (
          <ConsoleSection
            key={p.id}
            title={p.name}
            count={`${p.members.length} member${p.members.length !== 1 ? 's' : ''}`}
          >
            <div className="space-y-4">
              {/* Name + slug */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={`pond-name-${p.id}`}>Name</Label>
                  <Input
                    id={`pond-name-${p.id}`}
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
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pond-slug-${p.id}`}>Lead source slug</Label>
                  <Input
                    id={`pond-slug-${p.id}`}
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
              </div>

              {/* Member list */}
              {p.members.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Members who can claim</p>
                  <div className="flex flex-wrap gap-2">
                    {p.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm"
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
                              removePondMemberAction,
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
                    <Label htmlFor={`add-pond-member-${p.id}`}>Add broker</Label>
                    <Select
                      value={defaultAdd}
                      onValueChange={(v) => setAddMemberSlug((prev) => ({ ...prev, [p.id]: v }))}
                      disabled={pending}
                    >
                      <SelectTrigger id={`add-pond-member-${p.id}`} className="w-48">
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
              <div className="border-t border-border pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2.5 text-destructive hover:text-destructive"
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
          </ConsoleSection>
        )
      })}

      {/* Create new pond */}
      <ConsoleSection title="New pond">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="new-pond-name">Name</Label>
            <Input
              id="new-pond-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Out Of State Home Owners"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pond-slug">Lead source slug</Label>
            <Input
              id="new-pond-slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="out-of-state"
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-10 sm:col-span-2 sm:h-9 sm:w-fit"
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
      </ConsoleSection>
    </div>
  )
}
