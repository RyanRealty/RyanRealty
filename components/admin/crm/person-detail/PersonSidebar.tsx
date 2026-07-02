'use client'

/**
 * PersonSidebar — §07a left meta-sidebar of the person-detail three-column
 * layout (spec docs/fub-crm-spec/07a-person-detail-sidebar-and-inline-edit.md).
 *
 * Section order (§07a §1/§13): Avatar/Header → Contact Info (phones · emails ·
 * address, never collapsible) → Relationships → Details (Stage / Assigned to /
 * Source / Price / Timeframe / Tags / Campaigns) → Financing → Custom Fields →
 * Background → Social Profile → Groups → Delete person.
 *
 * Every scalar field uses the §12 inline-edit pattern (InlineEditField).
 * Phones open the Edit Phone Numbers modal (§7c.6). Collapse state persists
 * per user via localStorage (AC-COLL-2). Drag-reorder of sections (AC-COLL-3)
 * is a logged deferral in CRM_BUILD_MISSION.
 */

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Plus, Users, X, AlertTriangle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { InlineEditText, InlineEditSelect, type InlineOption } from './InlineEditField'
import { EditPhonesDialog, AddRelationshipDialog } from './PersonDialogs'
import { MergeContactDialog } from '@/components/admin/crm/MergeContactDialog'
import {
  updatePersonFieldAction,
  saveEmailRowAction,
  saveAddressRowAction,
  assignPondAction,
  deleteCrmPersonAction,
  type PhoneRow,
} from '@/app/actions/crm-person-detail'
import { updateCrmStageAction, assignCrmBrokerAction, addCrmTagAction, removeCrmTagAction } from '@/app/actions/crm'

export type SidebarEmail = { value: string; isPrimary: boolean; status: string }
export type SidebarAddress = { street: string; city: string; state: string; zip: string }
export type SidebarRelationship = { relatedPersonId: number | null; name: string; label: string }

export type SidebarData = {
  personId: number
  name: string
  firstName: string | null
  lastName: string | null
  pictureUrl: string | null
  lastCommunicationLabel: string | null
  phones: Array<PhoneRow & { display: string }>
  emails: SidebarEmail[]
  address: SidebarAddress | null
  relationships: SidebarRelationship[]
  stage: string
  stageOptions: string[]
  assignedBroker: string | null
  brokerOptions: Array<{ value: string; label: string }>
  pondOptions: Array<{ id: number; name: string }>
  pondId: number | null
  actingBroker: string | null
  source: string | null
  sourceOptions: string[]
  sourceRecency: string | null
  price: number | null
  timeframe: string | null
  tags: string[]
  tagOptions: string[]
  campaigns: string[]
  lenderName: string | null
  background: string | null
  socialLinks: Array<{ platform: string; url: string }>
  groups: string[]
  canDelete: boolean
}

const TIMEFRAME_OPTIONS = ['0-3 Months', '3-6 Months', '6-12 Months', '12+ Months', 'No Plans']

function usd(n: number | null): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Collapsible sidebar section with a persisted per-user collapse state. */
function SidebarSection({
  id,
  title,
  defaultOpen = true,
  headerExtra,
  children,
}: {
  id: string
  title: string
  defaultOpen?: boolean
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  const storageKey = `crm.sidebar.${id}`
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored !== null) setOpen(stored === '1')
  }, [storageKey])
  function toggle(next: boolean) {
    setOpen(next)
    window.localStorage.setItem(storageKey, next ? '1' : '0')
  }
  return (
    <Collapsible open={open} onOpenChange={toggle} className="border-t border-border">
      <div className="flex items-center justify-between py-2 pr-1">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex flex-1 items-center justify-between gap-2 text-left">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
            {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        {headerExtra}
      </div>
      <CollapsibleContent className="space-y-2 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-2">
      <span className="pt-1 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ── Inline email row (§07a 3.2) ──────────────────────────────────────────────

function EmailRows({ personId, emails }: { personId: number; emails: SidebarEmail[] }) {
  const [adding, setAdding] = useState(false)
  const router = useRouter()
  return (
    <div className="space-y-0.5">
      {emails.map((e) => (
        <div key={e.value} className="flex items-center gap-1.5">
          {e.status === 'bounced' || e.status === 'unsubscribed' ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-label={e.status} />
          ) : null}
          <InlineEditText
            value={e.value}
            placeholder="Add email"
            display={e.value}
            className="flex-1 truncate text-[color:var(--console-info-strong,theme(colors.primary.DEFAULT))]"
            onSave={async (next) => {
              const r = await saveEmailRowAction(personId, e.value, next)
              if (r.ok) router.refresh()
              return r
            }}
          />
        </div>
      ))}
      {emails.length === 0 || adding ? (
        <InlineEditText
          key={`add-${emails.length}`}
          value={null}
          placeholder="Add email"
          onSave={async (next) => {
            const r = await saveEmailRowAction(personId, null, next)
            if (r.ok) {
              setAdding(false)
              router.refresh()
            }
            return r
          }}
        />
      ) : (
        <Button type="button" variant="link" size="sm" className="h-auto p-1 text-xs" onClick={() => setAdding(true)}>
          + add another email
        </Button>
      )}
    </div>
  )
}

// ── Address inline edit (§07a 3.3) ───────────────────────────────────────────

function AddressRow({ personId, address }: { personId: number; address: SidebarAddress | null }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SidebarAddress>({ street: '', city: '', state: '', zip: '' })
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const displayLine = address ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ') : null

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setDraft(address ?? { street: '', city: '', state: '', zip: '' })
          setError(null)
          setEditing(true)
        }}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        className="cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-muted/40"
      >
        {displayLine || <span className="text-muted-foreground">Add address</span>}
      </div>
    )
  }
  return (
    <div className="space-y-1.5 rounded-md bg-muted/30 p-1.5" onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}>
      <Input autoFocus value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} placeholder="Street" className="h-8 text-sm" />
      <div className="grid grid-cols-[1fr_56px_72px] gap-1.5">
        <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="City" className="h-8 text-sm" />
        <Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder="State" className="h-8 text-sm" />
        <Input value={draft.zip} onChange={(e) => setDraft({ ...draft, zip: e.target.value })} placeholder="Zip" className="h-8 text-sm" />
      </div>
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          disabled={pending}
          className="h-7 bg-success text-success-foreground hover:bg-success/90"
          onClick={() =>
            start(async () => {
              const r = await saveAddressRowAction(personId, draft)
              if (r.ok) {
                setEditing(false)
                router.refresh()
              } else setError(r.error)
            })
          }
        >
          Save
        </Button>
        <Button size="sm" variant="destructive" className="h-7" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

// ── Tags chips (§07a 5.6) ────────────────────────────────────────────────────

function TagChips({ personId, tags, tagOptions }: { personId: number; tags: string[]; tagOptions: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()
  const shown = expanded ? tags : tags.slice(0, 5)
  const overflow = tags.length - shown.length

  function addTag(tag: string) {
    const clean = tag.trim().slice(0, 64)
    if (!clean) return
    start(async () => {
      const fd = new FormData()
      fd.set('personId', String(personId))
      fd.set('tag', clean)
      await addCrmTagAction(fd)
      setQuery('')
      setAdding(false)
      router.refresh()
    })
  }
  function removeTag(tag: string) {
    start(async () => {
      const fd = new FormData()
      fd.set('personId', String(personId))
      fd.set('tag', tag)
      await removeCrmTagAction(fd)
      router.refresh()
    })
  }

  const suggestions = query.trim()
    ? tagOptions.filter((t) => t.toLowerCase().includes(query.trim().toLowerCase()) && !tags.includes(t)).slice(0, 8)
    : []

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {shown.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 pr-1 text-xs font-normal">
            {t}
            <button type="button" aria-label={`Remove ${t}`} disabled={pending} onClick={() => removeTag(t)} className="rounded px-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {overflow > 0 ? (
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setExpanded(true)}>
            +{overflow} more
          </Button>
        ) : null}
        <Button type="button" size="icon" variant="outline" aria-label="Add tag" className="h-5 w-5 rounded-full" onClick={() => setAdding((a) => !a)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {adding ? (
        <div className="space-y-1">
          <Input
            autoFocus
            value={query}
            maxLength={64}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag(query)
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Search or create tag"
            className="h-8 text-sm"
          />
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => addTag(s)} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-secondary">
              {s}
            </button>
          ))}
          {query.trim() && !tagOptions.includes(query.trim()) ? (
            <button type="button" onClick={() => addTag(query)} className="block w-full rounded px-2 py-1 text-left text-sm font-medium hover:bg-secondary">
              Create New Tag: {query.trim()}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── The sidebar ──────────────────────────────────────────────────────────────

export function PersonSidebar({ data, customFieldsNode }: { data: SidebarData; customFieldsNode?: React.ReactNode }) {
  const router = useRouter()
  const p = data
  const initials = `${(p.firstName ?? p.name ?? '?')[0] ?? '?'}${(p.lastName ?? '')[0] ?? ''}`.toUpperCase()

  const assignOptions: InlineOption[] = [
    ...(p.actingBroker ? [{ value: p.actingBroker, label: 'Me', group: '' }] : []),
    ...p.pondOptions.map((pond) => ({ value: `pond:${pond.id}`, label: pond.name, group: 'Ponds' })),
    ...p.brokerOptions.map((b) => ({ value: b.value, label: b.label, group: 'Team members' })),
  ]

  async function saveField(field: string, value: string) {
    const r = await updatePersonFieldAction(p.personId, field, value)
    if (r.ok) router.refresh()
    return r
  }

  return (
    <div className="space-y-3 text-sm">
      {/* Avatar / header (§07a 2) */}
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <Avatar className="h-16 w-16">
          {p.pictureUrl ? <AvatarImage src={p.pictureUrl} alt={p.name} /> : null}
          <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-foreground">{p.name}</h2>
          <p className="text-xs text-muted-foreground">{p.lastCommunicationLabel ?? 'No communication yet'}</p>
        </div>
      </div>

      {/* Contact info (§07a 3) — always visible */}
      <div className="space-y-2">
        <div className="space-y-0.5">
          {p.phones.length > 0 ? (
            p.phones.map((ph, i) => (
              <EditPhonesDialog
                key={`${ph.value}-${i}`}
                personId={p.personId}
                phones={p.phones}
                trigger={
                  <button type="button" className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/40">
                    <span className={cn('text-sm', ph.bad && 'text-warning line-through')}>{ph.display}</span>
                    <span className="text-xs text-muted-foreground">{ph.label.toLowerCase()}</span>
                    {ph.isPrimary ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-block h-2 w-2 rounded-full bg-primary" /> best
                      </span>
                    ) : null}
                  </button>
                }
              />
            ))
          ) : (
            <EditPhonesDialog
              personId={p.personId}
              phones={[]}
              trigger={
                <button type="button" className="rounded px-1 py-0.5 text-sm text-muted-foreground hover:bg-muted/40">
                  Add phone
                </button>
              }
            />
          )}
        </div>
        <EmailRows personId={p.personId} emails={p.emails} />
        <AddressRow personId={p.personId} address={p.address} />
      </div>

      {/* Relationships (§07a 4) */}
      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relationships</span>
          <div className="flex items-center gap-1">
            <AddRelationshipDialog
              personId={p.personId}
              trigger={
                <Button type="button" size="icon" variant="ghost" aria-label="Add relationship" className="h-6 w-6 text-primary">
                  <Users className="h-4 w-4" />
                </Button>
              }
            />
            <MergeContactDialog
              survivorId={p.personId}
              trigger={
                <Button type="button" size="icon" variant="ghost" aria-label="Merge existing person" className="h-6 w-6 text-primary">
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
        {p.relationships.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">No relationships</p>
        ) : (
          <div className="space-y-1 py-1">
            {p.relationships.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                {r.relatedPersonId ? (
                  <Link href={`/admin/console/leads/${r.relatedPersonId}`} className="truncate text-sm text-[color:var(--console-info-strong,inherit)] hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm">{r.name}</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">{r.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details (§07a 5) */}
      <SidebarSection id="details" title="Details">
        <FieldRow label="Stage">
          <InlineEditSelect
            value={p.stage}
            options={p.stageOptions.map((s) => ({ value: s, label: s }))}
            placeholder="Set stage"
            onSave={async (next) => {
              if (!next) return { ok: false as const, error: 'Pick a stage.' }
              const fd = new FormData()
              fd.set('personId', String(p.personId))
              fd.set('stage', next)
              const r = await updateCrmStageAction(fd)
              if (r.ok) router.refresh()
              return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? 'Failed to save' }
            }}
          />
        </FieldRow>
        <FieldRow label="Assigned to">
          <InlineEditSelect
            value={p.assignedBroker}
            options={assignOptions}
            readLabel={p.assignedBroker ? p.brokerOptions.find((b) => b.value === p.assignedBroker)?.label ?? p.assignedBroker : null}
            placeholder="Unassigned"
            onSave={async (next) => {
              if (!next) return { ok: false as const, error: 'Pick an assignee.' }
              if (next.startsWith('pond:')) {
                const r = await assignPondAction(p.personId, Number(next.slice(5)))
                if (r.ok) router.refresh()
                return r
              }
              const fd = new FormData()
              fd.set('personId', String(p.personId))
              fd.set('broker', next)
              const r = await assignCrmBrokerAction(fd)
              if (r.ok) router.refresh()
              return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? 'Failed to save' }
            }}
          />
        </FieldRow>
        <FieldRow label="Source">
          <InlineEditSelect
            value={p.source}
            options={p.sourceOptions.map((s) => ({ value: s, label: s }))}
            placeholder="Add source"
            displaySuffix={p.sourceRecency}
            onSave={(next) => saveField('source', next ?? '')}
          />
        </FieldRow>
        <FieldRow label="Price">
          <InlineEditText value={p.price !== null ? String(p.price) : null} display={usd(p.price)} placeholder="Add price" onSave={(v) => saveField('price', v)} />
        </FieldRow>
        <FieldRow label="Timeframe">
          <InlineEditSelect
            value={p.timeframe}
            options={TIMEFRAME_OPTIONS.map((t) => ({ value: t, label: t }))}
            placeholder="Add timeframe"
            onSave={(next) => saveField('timeframe', next ?? '')}
          />
        </FieldRow>
        <FieldRow label="Tags">
          <TagChips personId={p.personId} tags={p.tags} tagOptions={p.tagOptions} />
        </FieldRow>
        {p.campaigns.length > 0 ? (
          <FieldRow label="Campaigns">
            <p className="px-1 py-0.5 text-sm text-muted-foreground">
              {p.campaigns[0]}
              {p.campaigns.length > 1 ? ` | ${p.campaigns.length - 1} more` : ''}
            </p>
          </FieldRow>
        ) : null}
      </SidebarSection>

      {/* Financing (§07a 6) */}
      <SidebarSection id="financing" title="Financing">
        <FieldRow label="Lender">
          <InlineEditText value={p.lenderName} placeholder="Add lender" onSave={(v) => saveField('lender_name', v)} />
        </FieldRow>
      </SidebarSection>

      {/* Custom Fields (§07a 7) — OPEN by default. This is prime lead data
          (BatchData enrichment, expired-listing + homeowner property detail);
          collapsing it hid Matt's most valuable fields behind a click. */}
      {customFieldsNode ? (
        <SidebarSection id="custom-fields" title="Custom Fields" defaultOpen>
          {customFieldsNode}
        </SidebarSection>
      ) : null}

      {/* Background (§07a 8) */}
      <SidebarSection id="background" title="Background">
        <InlineEditText value={p.background} placeholder="Add background" multiline onSave={(v) => saveField('background', v)} />
      </SidebarSection>

      {/* Social Profile (§07a 9) — default collapsed */}
      <SidebarSection id="social" title="Social Profile" defaultOpen={false}>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(p.name)}`}
          target="_blank"
          rel="noreferrer"
          className="block px-1 py-0.5 text-sm hover:underline"
        >
          Google · Search {p.name}
        </a>
        {p.socialLinks.map((s) => (
          <a key={s.platform} href={s.url} target="_blank" rel="noreferrer" className="block truncate px-1 py-0.5 text-sm hover:underline">
            {s.platform} · {s.url}
          </a>
        ))}
      </SidebarSection>

      {/* Groups (§07a 10) — default collapsed */}
      <SidebarSection id="groups" title="Groups" defaultOpen={false}>
        {p.groups.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No groups</p>
        ) : (
          p.groups.map((g) => (
            <p key={g} className="px-1 py-0.5 text-sm">
              {g}
            </p>
          ))
        )}
      </SidebarSection>

      {/* Delete person (§07a 11) — owner/admin only */}
      {p.canDelete ? (
        <div className="border-t border-border pt-3 pb-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className="text-sm text-destructive hover:underline">
                Delete person
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this person?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. This contact and their timeline are removed from every list and report. Deals linked to this contact remain but
                  lose the association.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <form action={deleteCrmPersonAction}>
                  <input type="hidden" name="personId" value={p.personId} />
                  <AlertDialogAction type="submit" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete person
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </div>
  )
}
