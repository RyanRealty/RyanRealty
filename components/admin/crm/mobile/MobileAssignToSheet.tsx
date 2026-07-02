'use client'

/**
 * MobileAssignToSheet — the §28 §5 Assign-To picker (mob-34).
 *
 * Extends the base picker pattern: navy header (Cancel · "Assign To" · no
 * right control), a "Currently: {name}" banner, a live search field, and a
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
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import { BROKER_HEADSHOTS } from '@/components/admin/crm/mobile/task-type-icons'

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex h-7 items-center border-y border-border bg-muted px-4">
      <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
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
      className="flex min-h-[60px] w-full items-center gap-3 border-b border-border bg-card px-4 text-left active:bg-secondary disabled:opacity-60"
    >
      {avatar}
      <span className="min-w-0">
        <span className="block truncate text-[16px] text-foreground">{label}</span>
        {sublabel ? <span className="block text-[13px] text-muted-foreground">{sublabel}</span> : null}
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
    <Sheet open={open} onOpenChange={(v) => { if (!v) setQ(''); onOpenChange(v) }}>
      <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0" style={{ maxHeight: '92dvh' }}>
        {/* §5.3 header — Cancel · Assign To · (no right control) */}
        <div className="flex h-[50px] shrink-0 items-center bg-primary px-4">
          <button
            type="button"
            className="w-16 text-left text-[17px] text-primary-foreground"
            onClick={() => { setQ(''); onOpenChange(false) }}
          >
            Cancel
          </button>
          <SheetTitle className="flex-1 text-center text-[17px] font-semibold text-primary-foreground">
            Assign To
          </SheetTitle>
          <span className="w-16" />
        </div>

        {/* §5.4 "Currently:" banner */}
        <div className="flex h-9 shrink-0 items-center bg-muted px-4">
          <span className="text-[15px] font-semibold text-foreground">
            Currently: {currentAssigneeName ?? 'Unassigned'}
          </span>
        </div>

        {/* §5.5 search */}
        <div className="shrink-0 bg-muted px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="h-9 rounded-[10px] bg-card pl-9 text-[16px]"
            />
          </div>
        </div>

        {/* §5.6 sectioned list */}
        <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: 'calc(92dvh - 130px)' }}>
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
      </SheetContent>
    </Sheet>
  )
}
