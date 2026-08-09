'use client'

/**
 * MobileAssignToSheet — the §28 §5 Assign-To picker (mob-34).
 *
 * Extends the base picker pattern: the sheet's own head ("Assign To" + its
 * dismiss control), a "Currently: {name}" banner, a live search field, and a
 * sectioned list — Me (headshot) · PONDS (initials avatars) · TEAM MEMBERS
 * (broker headshots). Tap = INSTANT assignment + dismiss (AC-ASST-MOB-5 — no
 * Select button).
 *
 * GROUPS (§5.6) are intentionally absent: crm_groups distribute leads at
 * intake (lead-flow round robin) — the backend has no manual assign-to-group
 * write path, so a Groups section here would be dead UI.
 */

import { useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { SearchField, Sheet } from '@/components/admin/v2'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import { BROKER_HEADSHOTS } from '@/components/admin/shared/mobile/task-type-icons'

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="flex h-7 items-center"
      style={{ borderTop: '1px solid var(--a-border)', borderBottom: '1px solid var(--a-border)', background: 'var(--a-inset)' }}
    >
      <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--a-text-2)' }}>{label}</span>
    </div>
  )
}

function AssigneeRow({
  avatar,
  label,
  sublabel,
  disabled,
  onPress,
}: {
  avatar: React.ReactNode
  label: string
  sublabel?: string | null
  disabled: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      // active:opacity-70 is the phone pressed state the shadcn original had
      // and the migration dropped. It is an opacity, not a background, because
      // the row paints its background inline and an inline style outranks any
      // :active background rule a stylesheet could carry.
      className="flex min-h-[60px] w-full items-center gap-3 text-left active:opacity-70 disabled:opacity-60"
      style={{ borderBottom: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
    >
      {avatar}
      <span className="min-w-0">
        <span className="block truncate text-[16px]" style={{ color: 'var(--a-text)' }}>{label}</span>
        {sublabel ? <span className="block text-[13px]" style={{ color: 'var(--a-text-2)' }}>{sublabel}</span> : null}
      </span>
    </button>
  )
}

export function MobileAssignToSheet({
  open,
  onOpenChange,
  currentAssigneeName,
  currentBrokerSlug,
  currentBrokerName,
  brokers,
  ponds,
  onAssignBroker,
  onAssignPond,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** The contact's current assignee display name (the "Currently:" banner). */
  currentAssigneeName: string | null
  /** The logged-in broker (the "Me" row). */
  currentBrokerSlug: string
  currentBrokerName: string
  brokers: Array<{ slug: string; name: string }>
  ponds: Array<{ id: number; name: string }>
  onAssignBroker: (slug: string) => Promise<void> | void
  onAssignPond: (pondId: number) => Promise<void> | void
}) {
  const [q, setQ] = useState('')
  const [pending, startTransition] = useTransition()

  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase())
  const filteredPonds = ponds.filter((p) => match(p.name))
  const filteredBrokers = brokers.filter((b) => match(b.name))
  const showMe = match('Me') || match(currentBrokerName)

  const run = (fn: () => Promise<void> | void) => {
    startTransition(async () => {
      await fn()
      setQ('')
      onOpenChange(false) // AC-ASST-MOB-5: tap = instant action + dismiss
    })
  }

  return (
    <Sheet
      open={open}
      onClose={() => { setQ(''); onOpenChange(false) }}
      title="Assign To"
    >
      {/* One flex child: av2-sheet__body gaps its children, and the banner,
          search and list stack flush (the shadcn original set gap-0).
          §5.3's own header row is gone — the sheet's head already names the
          surface and carries its dismiss control, and rendering both stacked
          two headers with two dismiss controls. Nothing re-applies px-4
          either: .av2-sheet supplies the horizontal padding, so the file's
          own inset doubled it and held every hairline off the edge. */}
      <div>
        {/* §5.4 "Currently:" banner */}
        <div className="flex h-9 shrink-0 items-center" style={{ background: 'var(--a-inset)' }}>
          <span className="text-[15px] font-semibold" style={{ color: 'var(--a-text)' }}>
            Currently: {currentAssigneeName ?? 'Unassigned'}
          </span>
        </div>

        {/* §5.5 search */}
        <div className="shrink-0 pb-2" style={{ background: 'var(--a-inset)' }}>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--a-text-2)' }}
            />
            <SearchField
              aria-label="Search assignees"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full"
              style={{ maxWidth: 'none', minHeight: 36, paddingLeft: 36, fontSize: 16, background: 'var(--a-surface)' }}
            />
          </div>
        </div>

        {/* §5.6 sectioned list. No max-height: .av2-sheet caps itself at 92dvh
            and scrolls, so calc(92dvh - 130px) here (carried over from the
            shadcn SheetContent that OWNED the 92dvh) constrained the list a
            second time against a height this element no longer sets. */}
        <div className="pb-[env(safe-area-inset-bottom)]">
          {showMe ? (
            <AssigneeRow
              avatar={<CrmAvatar name={currentBrokerName} src={BROKER_HEADSHOTS[currentBrokerSlug] ?? null} size={40} />}
              label="Me"
              disabled={pending}
              onPress={() => run(() => onAssignBroker(currentBrokerSlug))}
            />
          ) : null}

          {filteredPonds.length > 0 ? (
            <>
              <SectionHeader label="Ponds" />
              {filteredPonds.map((p) => (
                <AssigneeRow
                  key={p.id}
                  avatar={<CrmAvatar name={p.name} size={40} />}
                  label={p.name}
                  disabled={pending}
                  onPress={() => run(() => onAssignPond(p.id))}
                />
              ))}
            </>
          ) : null}

          {filteredBrokers.length > 0 ? (
            <>
              <SectionHeader label="Team members" />
              {filteredBrokers.map((b) => (
                <AssigneeRow
                  key={b.slug}
                  avatar={<CrmAvatar name={b.name} src={BROKER_HEADSHOTS[b.slug] ?? null} size={40} />}
                  label={b.name}
                  disabled={pending}
                  onPress={() => run(() => onAssignBroker(b.slug))}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </Sheet>
  )
}
