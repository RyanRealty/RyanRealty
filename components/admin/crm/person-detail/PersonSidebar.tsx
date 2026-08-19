'use client'

/**
 * PersonSidebar — §07a left meta-sidebar of the person-detail three-column
 * layout (spec docs/crm-spec/07a-person-detail-sidebar-and-inline-edit.md).
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
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler, action and user-visible
 * string is unchanged. Four notes on the swap:
 *  - Radix Collapsible is gone. Each section owns the same `open` state it
 *    already owned and simply does not render its body when closed, which is
 *    what CollapsibleContent did; the trigger keeps aria-expanded.
 *  - Radix AlertDialog is gone. Delete person is the barrel's ConfirmDialog,
 *    whose confirm button carries the verb. It lives in its own local component
 *    so the dialog's state hooks stay out of PersonSidebar's conditional tail.
 *  - The avatar is CrmAvatar, the CRM's one avatar (identity reads by initials
 *    on a neutral fill — §1 reserves colour for action and status).
 *  - Full-row toggles and full-row option rows stay raw <button>s carrying
 *    token classes. The barrel's Button is a centred, chromed control; a
 *    section header and a suggestion row are neither. Same call, same reason,
 *    as MobileEditSheet / MobileNotesTab in components/admin/shared.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Plus, Users, X, AlertTriangle } from 'lucide-react'
import { Button, ConfirmDialog, IconButton, SearchField } from '@/components/admin/v2'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import { cn } from '@/lib/utils'
import { InlineEditText, InlineEditSelect, type InlineOption } from './InlineEditField'
import { EditPhonesDialog, AddRelationshipDialog } from './PersonDialogs'
import { MergeContactDialog } from '@/components/admin/crm/MergeContactDialog'
import { PortalViewLink } from '@/components/admin/crm/portal-view/PortalViewLink'
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
  tagOptions: Array<{ key: string; label: string }>
  campaigns: string[]
  lenderName: string | null
  background: string | null
  socialLinks: Array<{ platform: string; url: string }>
  groups: string[]
  canDelete: boolean
}

const TIMEFRAME_OPTIONS = ['0-3 Months', '3-6 Months', '6-12 Months', '12+ Months', 'No Plans']

const MUTED: React.CSSProperties = { color: 'var(--a-text-2)' }
const HAIRLINE_TOP: React.CSSProperties = { borderTop: '1px solid var(--a-border)' }

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
    <div style={HAIRLINE_TOP}>
      <div className="flex items-center justify-between py-2 pr-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle(!open)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={MUTED}>
            {title}
          </span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" style={MUTED} />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" style={MUTED} />
          )}
        </button>
        {headerExtra}
      </div>
      {open ? <div className="space-y-2 pb-3">{children}</div> : null}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-2">
      <span className="pt-1 text-xs" style={MUTED}>
        {label}
      </span>
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
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--a-warn)' }}
              aria-label={e.status}
            />
          ) : null}
          <InlineEditText
            value={e.value}
            placeholder="Add email"
            display={e.value}
            // A colour CLASS, not a style prop: InlineEditText takes className
            // only, and widening its signature would change an exported API.
            className="flex-1 truncate text-[color:var(--a-accent)]"
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
        <Button variant="quiet" className="av2-textlink" onClick={() => setAdding(true)}>
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
        className="cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-[var(--a-inset)]"
      >
        {displayLine || <span style={MUTED}>Add address</span>}
      </div>
    )
  }
  return (
    <div
      className="space-y-1.5 rounded-md p-1.5"
      style={{ background: 'var(--a-inset)' }}
      onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
    >
      <SearchField
        aria-label="Street"
        type="text"
        autoFocus
        value={draft.street}
        onChange={(e) => setDraft({ ...draft, street: e.target.value })}
        placeholder="Street"
        className="w-full"
        style={{ maxWidth: 'none' }}
      />
      <div className="grid grid-cols-[1fr_56px_72px] gap-1.5">
        <SearchField
          aria-label="City"
          type="text"
          value={draft.city}
          onChange={(e) => setDraft({ ...draft, city: e.target.value })}
          placeholder="City"
          className="w-full"
          style={{ maxWidth: 'none' }}
        />
        <SearchField
          aria-label="State"
          type="text"
          value={draft.state}
          onChange={(e) => setDraft({ ...draft, state: e.target.value })}
          placeholder="State"
          className="w-full"
          style={{ maxWidth: 'none' }}
        />
        <SearchField
          aria-label="Zip"
          type="text"
          value={draft.zip}
          onChange={(e) => setDraft({ ...draft, zip: e.target.value })}
          placeholder="Zip"
          className="w-full"
          style={{ maxWidth: 'none' }}
        />
      </div>
      <div className="flex justify-end gap-1">
        <Button
          disabled={pending}
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
        <Button variant="quiet" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="text-xs" style={{ color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ── Tags chips (§07a 5.6) ────────────────────────────────────────────────────

function TagChips({ personId, tags, tagOptions }: { personId: number; tags: string[]; tagOptions: Array<{ key: string; label: string }> }) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()
  const shown = expanded ? tags : tags.slice(0, 5)
  const overflow = tags.length - shown.length

  // Registry key → friendly label, so chips read "Audience - buyer" while the
  // stored/written value stays the canonical key "audience:buyer".
  const labelByKey = new Map(tagOptions.map((o) => [o.key, o.label]))

  // addTag ALWAYS writes a canonical key. Selecting a suggestion passes its key;
  // "Create New Tag" passes the typed text (the action lowercases it). Writing a
  // display label here would silently break segment/automation/smart-list matching.
  function addTag(tagKey: string) {
    const clean = tagKey.trim().slice(0, 64)
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

  const q = query.trim().toLowerCase()
  const suggestions = q
    ? tagOptions
        .filter((o) => (o.label.toLowerCase().includes(q) || o.key.toLowerCase().includes(q)) && !tags.includes(o.key))
        .slice(0, 8)
    : []
  // Only offer "create" when the typed text is not already a known key/label.
  const isKnown = tagOptions.some((o) => o.key.toLowerCase() === q || o.label.toLowerCase() === q)

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {shown.map((t) => (
          // A tag is broker-typed data, so it is NOT a StateWord: .av2-state
          // uppercases, and "Audience - buyer" must read back as it was written.
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-xs"
            style={{ border: '1px solid var(--a-border)', color: 'var(--a-text)' }}
          >
            {labelByKey.get(t) ?? t}
            <button
              type="button"
              aria-label={`Remove ${labelByKey.get(t) ?? t}`}
              disabled={pending}
              onClick={() => removeTag(t)}
              // Both tones are CLASSES. An inline colour would outrank the
              // :hover rule and leave the control dead on hover.
              className="rounded px-0.5 text-[color:var(--a-text-2)] hover:text-[color:var(--a-text)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {overflow > 0 ? (
          <Button variant="quiet" className="av2-textlink" onClick={() => setExpanded(true)}>
            +{overflow} more
          </Button>
        ) : null}
        <IconButton label="Add tag" onClick={() => setAdding((a) => !a)}>
          <Plus className="h-3 w-3" />
        </IconButton>
      </div>
      {adding ? (
        <div className="space-y-1">
          <SearchField
            aria-label="Search or create tag"
            type="text"
            autoFocus
            value={query}
            maxLength={64}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag(query)
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Search or create tag"
            className="w-full"
            style={{ maxWidth: 'none' }}
          />
          {suggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => addTag(s.key)}
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-[var(--a-inset)]"
            >
              {s.label}
            </button>
          ))}
          {query.trim() && !isKnown ? (
            <button
              type="button"
              onClick={() => addTag(query)}
              className="block w-full rounded px-2 py-1 text-left text-sm font-medium hover:bg-[var(--a-inset)]"
            >
              Create New Tag: {query.trim()}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── Delete person (§07a 11) ──────────────────────────────────────────────────

/**
 * Own component so the confirm dialog's state hooks are not inside
 * PersonSidebar's `canDelete` branch. The delete itself still runs through the
 * server-action form; the dialog's confirm just submits it.
 */
function DeletePersonBlock({ personId }: { personId: number }) {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <div className="pt-3 pb-1" style={HAIRLINE_TOP}>
      <Button
        variant="quiet"
        className="av2-textlink"
        style={{ color: 'var(--a-danger)' }}
        onClick={() => setOpen(true)}
      >
        Delete person
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this person?"
        description="This cannot be undone. This contact and their timeline are removed from every list and report. Deals linked to this contact remain but lose the association."
        confirmLabel="Delete person"
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        <form ref={formRef} action={deleteCrmPersonAction}>
          <input type="hidden" name="personId" value={personId} />
        </form>
      </ConfirmDialog>
    </div>
  )
}

// ── The sidebar ──────────────────────────────────────────────────────────────

export function PersonSidebar({ data, customFieldsNode }: { data: SidebarData; customFieldsNode?: React.ReactNode }) {
  const router = useRouter()
  const p = data

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
        <CrmAvatar name={p.name} src={p.pictureUrl} size={64} />
        <div>
          <h2 className="text-lg font-semibold leading-tight" style={{ color: 'var(--a-text)' }}>
            {p.name}
          </h2>
          <p className="text-xs" style={MUTED}>
            {p.lastCommunicationLabel ?? 'No communication yet'}
          </p>
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
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--a-inset)]"
                  >
                    <span className={cn('text-sm', ph.bad && 'line-through')} style={ph.bad ? { color: 'var(--a-warn)' } : undefined}>
                      {ph.display}
                    </span>
                    <span className="text-xs" style={MUTED}>
                      {ph.label.toLowerCase()}
                    </span>
                    {ph.isPrimary ? (
                      <span className="inline-flex items-center gap-1 text-xs" style={MUTED}>
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: 'var(--a-accent)' }}
                        />{' '}
                        best
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
                <button
                  type="button"
                  className="rounded px-1 py-0.5 text-sm hover:bg-[var(--a-inset)]"
                  style={MUTED}
                >
                  Add phone
                </button>
              }
            />
          )}
        </div>
        <EmailRows personId={p.personId} emails={p.emails} />
        <AddressRow personId={p.personId} address={p.address} />
      </div>

      {/* Read-only mirror of this contact's signed-in portal (Phase 4.3). Sits
          high in the profile column so it is reachable without scrolling the
          rail, and it is a link, never an impersonation. */}
      <PortalViewLink personId={p.personId} />

      {/* Relationships (§07a 4) */}
      <div className="pt-2" style={HAIRLINE_TOP}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide" style={MUTED}>
            Relationships
          </span>
          <div className="flex items-center gap-1">
            <AddRelationshipDialog
              personId={p.personId}
              trigger={
                <IconButton label="Add relationship">
                  <Users className="h-4 w-4" />
                </IconButton>
              }
            />
            <MergeContactDialog
              survivorId={p.personId}
              trigger={
                <IconButton label="Merge existing person">
                  <Plus className="h-4 w-4" />
                </IconButton>
              }
            />
          </div>
        </div>
        {p.relationships.length === 0 ? (
          <p className="py-1 text-sm" style={MUTED}>
            No relationships
          </p>
        ) : (
          <div className="space-y-1 py-1">
            {p.relationships.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                {r.relatedPersonId ? (
                  <Link
                    href={`/admin/people/${r.relatedPersonId}`}
                    className="truncate text-sm text-[color:var(--a-accent)] hover:underline"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm">{r.name}</span>
                )}
                <span className="shrink-0 text-xs" style={MUTED}>
                  {r.label}
                </span>
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
            <p className="px-1 py-0.5 text-sm" style={MUTED}>
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
          <p className="px-1 text-sm" style={MUTED}>
            No groups
          </p>
        ) : (
          p.groups.map((g) => (
            <p key={g} className="px-1 py-0.5 text-sm">
              {g}
            </p>
          ))
        )}
      </SidebarSection>

      {/* Delete person (§07a 11) — owner/admin only */}
      {p.canDelete ? <DeletePersonBlock personId={p.personId} /> : null}
    </div>
  )
}
