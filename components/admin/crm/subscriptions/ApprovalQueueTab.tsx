'use client'

/**
 * ApprovalQueueTab — the "Listings to approve" tab of the Alerts & reports
 * hub. Pending listing_alert_queue rows (typed events held by preview-mode
 * alerts) grouped by alert: alert name + contact, event type state word,
 * listing card snippet from the queued payload, per-item + per-group + page-wide
 * selection, and approve / reject wired to approveAlertQueueItems /
 * rejectAlertQueueItems (app/actions/saved-search-alerts.ts — approval sends
 * immediately through the same compliance-gated path the cron uses).
 *
 * Optimistic refresh: a decision removes the decided items from local state,
 * then a refetch reconciles.
 *
 * P11F: on the LOCKED admin v2 language. shadcn Badge/Button/Card/Checkbox are
 * gone — StateWord, v2 Button, the av2-pane surface and ToolbarCheck take their
 * places, and colour comes only from var(--a-*). "Approve and send" keeps the
 * file's ONE primary Button; everything else is quiet.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import {
  approveAlertQueueItems,
  rejectAlertQueueItems,
} from '@/app/actions/saved-search-alerts'
import { listPendingAlertApprovalsAction } from '@/app/actions/alert-admin'
import type { PendingApprovalGroup } from '@/lib/data/leads/listingAlertApprovals'
import { Button, StateWord, ToolbarCheck } from '@/components/admin/v2'
import { formatSubscriptionDate } from '@/components/admin/crm/subscriptions/subscriptions-shared'
import AlertEngineSettingsDialog from '@/components/admin/crm/subscriptions/AlertEngineSettingsDialog'

/** Visible badge label per queued event type (sentence case). */
const EVENT_BADGE_LABELS: Record<string, string> = {
  new: 'New listing',
  price_change: 'Price change',
  status_change: 'Pending',
  back_on_market: 'Back on market',
  sold: 'Sold',
  open_house: 'Open house',
}

function eventBadgeLabel(type: string): string {
  return EVENT_BADGE_LABELS[type] ?? type
}

function formatPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return 'Price on request'
  return `$${Math.round(price).toLocaleString('en-US')}`
}

export default function ApprovalQueueTab({ initial }: { initial: PendingApprovalGroup[] }) {
  const [groups, setGroups] = useState<PendingApprovalGroup[]>(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [settingsAlertId, setSettingsAlertId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const allItemIds = groups.flatMap((g) => g.items.map((i) => i.id))
  const allSelected = allItemIds.length > 0 && allItemIds.every((id) => selected.has(id))

  const refetch = async () => {
    const res = await listPendingAlertApprovalsAction()
    if (res.data) {
      setGroups(res.data)
      setSelected(new Set())
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (group: PendingApprovalGroup) => {
    const ids = group.items.map((i) => i.id)
    const everySelected = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (everySelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allItemIds))
  }

  const decide = (decision: 'approve' | 'reject') => {
    const ids = [...selected]
    if (ids.length === 0) return
    // Optimistic: drop the decided items now; the refetch reconciles.
    const prevGroups = groups
    setGroups((gs) =>
      gs
        .map((g) => ({ ...g, items: g.items.filter((i) => !selected.has(i.id)) }))
        .filter((g) => g.items.length > 0),
    )
    setSelected(new Set())
    startTransition(async () => {
      const res =
        decision === 'approve'
          ? await approveAlertQueueItems(ids)
          : await rejectAlertQueueItems(ids)
      if (!res.ok && res.decided === 0) {
        setGroups(prevGroups)
        toast.error(res.error ?? 'Could not update the queue')
        return
      }
      if (decision === 'approve') {
        toast.success(
          `Approved ${res.decided.toLocaleString('en-US')} ${res.decided === 1 ? 'listing' : 'listings'}, sent ${res.sent.toLocaleString('en-US')} ${res.sent === 1 ? 'email' : 'emails'}`,
        )
        if (res.error) toast.error(res.error)
      } else {
        toast.success(
          `Rejected ${res.decided.toLocaleString('en-US')} ${res.decided === 1 ? 'listing' : 'listings'}`,
        )
      }
      await refetch()
    })
  }

  if (groups.length === 0) {
    return (
      // av2-pane owns the surface; padding is inline because the class sets it
      // un-layered and would win over px-4/py-10.
      <div className="av2-pane text-center" style={{ alignItems: 'center', gap: 8, padding: '40px 16px' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>Nothing waiting for approval.</p>
        <p className="max-w-md text-sm" style={{ color: 'var(--a-text-2)' }}>
          When an alert is in preview mode, its matches hold here until you approve or reject
          them. Turn preview mode on from an alert&apos;s settings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Page-wide toolbar */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
        style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}
      >
        <ToolbarCheck
          label=""
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Select every pending listing"
        />
        <span className="text-sm tabular-nums" style={{ color: 'var(--a-text)' }}>
          {selected.size.toLocaleString('en-US')} of {allItemIds.length.toLocaleString('en-US')} selected
        </span>
        <Button
          disabled={isPending || selected.size === 0}
          onClick={() => decide('approve')}
        >
          Approve and send
        </Button>
        <Button
          variant="quiet"
          disabled={isPending || selected.size === 0}
          onClick={() => decide('reject')}
        >
          Reject
        </Button>
      </div>

      {groups.map((group) => {
        const groupIds = group.items.map((i) => i.id)
        const groupAllSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id))
        return (
          <div key={group.alert.id} className="av2-pane">
            {/* Group header: alert + contact + settings */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ToolbarCheck
                  label=""
                  checked={groupAllSelected}
                  onChange={() => toggleGroup(group)}
                  aria-label={`Select every listing for ${group.alert.name}`}
                  labelStyle={{ marginTop: 4 }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>{group.alert.name}</p>
                  <p className="truncate text-xs" style={{ color: 'var(--a-text-2)' }}>
                    {group.alert.email}
                    {group.alert.filtersSummary ? ` · ${group.alert.filtersSummary}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {group.alert.previewMode ? <StateWord state="waiting">Preview mode</StateWord> : null}
                {!group.alert.isActive ? <StateWord state="waiting">Paused</StateWord> : null}
                <Button
                  variant="quiet"
                  onClick={() => setSettingsAlertId(group.alert.id)}
                >
                  <Settings2 className="mr-1 size-4" />
                  Alert settings
                </Button>
              </div>
            </div>

            {/* Held events */}
            <ul className="mt-3 flex flex-col gap-2">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{
                    border: '1px solid var(--a-border)',
                    background: selected.has(item.id) ? 'var(--a-accent-wash)' : undefined,
                  }}
                  data-state={selected.has(item.id) ? 'selected' : undefined}
                >
                  <ToolbarCheck
                    label=""
                    checked={selected.has(item.id)}
                    onChange={() => toggleOne(item.id)}
                    aria-label={`Select ${item.card?.address ?? item.listingKey}`}
                  />
                  {item.card?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.card.photoUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className="size-12 shrink-0 rounded-md"
                      style={{ background: 'var(--a-inset)' }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {item.card ? (
                      <a
                        href={item.card.detailUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                        style={{ color: 'var(--a-text)' }}
                      >
                        {item.card.address}
                        {item.card.city ? `, ${item.card.city}` : ''}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>
                        MLS #{item.listingKey}
                      </p>
                    )}
                    <p className="truncate text-xs tabular-nums" style={{ color: 'var(--a-text-2)' }}>
                      {item.card ? formatPrice(item.card.price) : 'No card snapshot'}
                      {item.card?.beds != null ? ` · ${item.card.beds} bd` : ''}
                      {item.card?.baths != null ? ` · ${item.card.baths} ba` : ''}
                      {item.card?.sqft != null
                        ? ` · ${Math.round(item.card.sqft).toLocaleString('en-US')} sqft`
                        : ''}
                    </p>
                  </div>
                  <span className="shrink-0">
                    <StateWord state="waiting">{eventBadgeLabel(item.eventType)}</StateWord>
                  </span>
                  <span className="hidden shrink-0 text-xs tabular-nums sm:block" style={{ color: 'var(--a-text-2)' }}>
                    {formatSubscriptionDate(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {settingsAlertId ? (
        <AlertEngineSettingsDialog
          alertId={settingsAlertId}
          onClose={() => setSettingsAlertId(null)}
          onSaved={() => startTransition(refetch)}
        />
      ) : null}
    </div>
  )
}
