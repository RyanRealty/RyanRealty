'use client'

/**
 * MembershipToggles — the one-click assign/unassign island for the Contact-360
 * view (CONTACT360 Phase 3.3, UI). Matt's ask: "one click assign or unassign
 * from workflow, newsletter, saved search/listing alerts by toggling."
 *
 * Each row is a design-system <Switch>. A flip optimistically updates the UI,
 * calls the matching server action, and reverts + surfaces the reason on
 * failure (e.g. a consent hard-stop refusing a re-subscribe). The actions are
 * the consent chokepoint — this island only renders state and dispatches.
 */
import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  setSequenceEnrollment,
  setNewsletterSubscription,
  setListingAlertsPaused,
} from '@/app/actions/crm-membership'
import type { ContactMemberships } from '@/lib/data/crm/getContactMemberships'

type Result = { ok: true; message?: string } | { ok: false; error: string }

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 min-h-12">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onToggle} aria-label={label} />
    </div>
  )
}

export function MembershipToggles({
  personId,
  memberships,
}: {
  personId: number
  memberships: ContactMemberships
}) {
  const [seqOn, setSeqOn] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(memberships.sequences.map((s) => [s.id, s.enrolled])),
  )
  const [newsletterOn, setNewsletterOn] = useState(memberships.newsletter.subscribed)
  const [alertsOn, setAlertsOn] = useState(memberships.listingAlerts.active > 0)
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  function dispatch(apply: () => void, revert: () => void, action: () => Promise<Result>) {
    apply()
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: r.message ?? 'Saved' })
      } else {
        revert()
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  return (
    <div className="space-y-4">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Workflows</h4>
        {memberships.sequences.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No active workflows.</p>
        ) : (
          <div className="divide-y divide-border">
            {memberships.sequences.map((s) => (
              <ToggleRow
                key={s.id}
                label={s.name}
                hint={seqOn[s.id] && s.status ? s.status.replace(/_/g, ' ') : undefined}
                checked={!!seqOn[s.id]}
                disabled={pending}
                onToggle={(next) =>
                  dispatch(
                    () => setSeqOn((m) => ({ ...m, [s.id]: next })),
                    () => setSeqOn((m) => ({ ...m, [s.id]: !next })),
                    () => setSequenceEnrollment({ personId, sequenceId: s.id, enrolled: next }),
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Newsletter &amp; alerts</h4>
        <div className="divide-y divide-border">
          <ToggleRow
            label="Newsletter"
            hint={newsletterOn ? 'Subscribed' : 'Not subscribed'}
            checked={newsletterOn}
            disabled={pending}
            onToggle={(next) =>
              dispatch(
                () => setNewsletterOn(next),
                () => setNewsletterOn(!next),
                () => setNewsletterSubscription({ personId, subscribed: next }),
              )
            }
          />
          <ToggleRow
            label="Listing alerts"
            hint={`${memberships.listingAlerts.count} saved ${memberships.listingAlerts.count === 1 ? 'search' : 'searches'}`}
            checked={alertsOn}
            disabled={pending || memberships.listingAlerts.count === 0}
            onToggle={(next) =>
              dispatch(
                () => setAlertsOn(next),
                () => setAlertsOn(!next),
                () => setListingAlertsPaused({ personId, paused: !next }),
              )
            }
          />
        </div>
      </section>

      {note ? (
        <p className={cn('text-xs', note.tone === 'ok' ? 'text-success' : 'text-destructive')} role="status">
          {note.text}
        </p>
      ) : null}
    </div>
  )
}
