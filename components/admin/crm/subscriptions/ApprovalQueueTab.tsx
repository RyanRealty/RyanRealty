'use client'

/**
 * ApprovalQueueTab — the "Listings to approve" tab of the Alerts & reports
 * hub. Pending listing_alert_queue rows (typed events held by preview-mode
 * alerts) grouped by alert: alert name + contact, event type badge, listing
 * card snippet from the queued payload, per-item + per-group + page-wide
 * selection, and approve / reject wired to approveAlertQueueItems /
 * rejectAlertQueueItems (app/actions/saved-search-alerts.ts — approval sends
 * immediately through the same compliance-gated path the cron uses).
 *
 * Optimistic refresh: a decision removes the decided items from local state,
 * then a refetch reconciles.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import {
  approveAlertQueueItems,
  rejectAlertQueueItems,
} from '@/app/actions/saved-search-alerts'
import {
  listPendingAlertApprovalsAction,
  type PendingApprovalGroup,
} from '@/app/actions/alert-admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
      <Card className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Nothing waiting for approval.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          When an alert is in preview mode, its matches hold here until you approve or reject
          them. Turn preview mode on from an alert&apos;s settings.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Page-wide toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select every pending listing"
        />
        <span className="text-sm tabular-nums text-foreground">
          {selected.size.toLocaleString('en-US')} of {allItemIds.length.toLocaleString('en-US')} selected
        </span>
        <Button
          size="sm"
          disabled={isPending || selected.size === 0}
          onClick={() => decide('approve')}
        >
          Approve and send
        </Button>
        <Button
          size="sm"
          variant="outline"
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
          <Card key={group.alert.id} className="p-4">
            {/* Group header: alert + contact + settings */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Checkbox
                  checked={groupAllSelected}
                  onCheckedChange={() => toggleGroup(group)}
                  aria-label={`Select every listing for ${group.alert.name}`}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{group.alert.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.alert.email}
                    {group.alert.filtersSummary ? ` · ${group.alert.filtersSummary}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {group.alert.previewMode ? <Badge variant="secondary">Preview mode</Badge> : null}
                {!group.alert.isActive ? <Badge variant="outline">Paused</Badge> : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
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
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  data-state={selected.has(item.id) ? 'selected' : undefined}
                >
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggleOne(item.id)}
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
                    <div className="size-12 shrink-0 rounded-md bg-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    {item.card ? (
                      <a
                        href={item.card.detailUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {item.card.address}
                        {item.card.city ? `, ${item.card.city}` : ''}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-medium text-foreground">
                        MLS #{item.listingKey}
                      </p>
                    )}
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {item.card ? formatPrice(item.card.price) : 'No card snapshot'}
                      {item.card?.beds != null ? ` · ${item.card.beds} bd` : ''}
                      {item.card?.baths != null ? ` · ${item.card.baths} ba` : ''}
                      {item.card?.sqft != null
                        ? ` · ${Math.round(item.card.sqft).toLocaleString('en-US')} sqft`
                        : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {eventBadgeLabel(item.eventType)}
                  </Badge>
                  <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                    {formatSubscriptionDate(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
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
