'use client'

/**
 * SavedSearchControls, the consumer "manage my saved searches" island
 * (CONTACT360 Phase 7.4 + saved-search master goal W3). A signed-in user can
 * pause/resume alerts, change the email cadence, rename, edit the core filters
 * (via EditSearchDialog in ./EditSearchDialog.tsx), and delete each saved
 * search from /account, on mobile.
 *
 * Optimistic + transition shape mirrors components/admin/crm/MembershipToggles:
 * a control flips the UI immediately, fires the matching server action, and
 * reverts + surfaces the reason on failure. The server actions are the auth
 * chokepoint (every one scopes to the session user via user_id = auth.uid()),
 * so this island only renders state and dispatches. Design-system components
 * only (@/components/ui/*), tokens only, cn() for class merges.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  pauseSavedSearch,
  resumeSavedSearch,
  setSavedSearchCadence,
  renameSavedSearch,
  deleteSavedSearch,
  markSavedSearchSeen,
} from '@/app/actions/saved-searches'
import type { SavedSearchRow } from '@/app/actions/saved-searches'
import type { SavedSearchInsight } from '@/app/account/portal-data'
import { formatNewSinceLabel } from '@/lib/data/leads/newSince'
import { SAVED_SEARCH_CADENCES, type SavedSearchCadence } from '@/lib/saved-search-cadence'
import { buildSearchUrlFromFilters, getFiltersSummary } from '@/lib/search-filters'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { EditSearchDialog, type RowState } from './EditSearchDialog'
import AlertPreferences from './AlertPreferences'

type Props = {
  searches: SavedSearchRow[]
  /**
   * Live per-search figures keyed by search id (app/account/portal-data.ts):
   * exact current match count plus "new since last visit". A missing key means
   * the figure could not be produced honestly, and the card renders no number
   * rather than a wrong one (§0).
   */
  insights?: Record<string, SavedSearchInsight>
}

type ActionResult = { error: string | null }

function SavedSearchCard({
  search,
  insight,
  onChanged,
}: {
  search: SavedSearchRow
  insight?: SavedSearchInsight
  onChanged: () => void
}) {
  const [state, setState] = useState<RowState>({
    name: search.name || 'Untitled search',
    paused: search.is_paused,
    cadence: search.notification_frequency,
    filters: search.filters ?? {},
  })
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(state.name)
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err', text: string } | null>(null)
  // "New since last visit" is server-computed; marking it seen clears the
  // badge here first, then writes listing_alerts.last_viewed_at.
  const [seen, setSeen] = useState(false)

  function dispatch(apply: () => void, revert: () => void, action: () => Promise<ActionResult>) {
    apply()
    setNote(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        revert()
        setNote({ tone: 'err', text: result.error })
      } else {
        setNote(null)
        onChanged()
      }
    })
  }

  function onTogglePaused(nextActive: boolean) {
    // Switch on = receiving alerts = not paused.
    const nextPaused = !nextActive
    dispatch(
      () => setState((s) => ({ ...s, paused: nextPaused })),
      () => setState((s) => ({ ...s, paused: !nextPaused })),
      () => (nextPaused ? pauseSavedSearch(search.id) : resumeSavedSearch(search.id)),
    )
  }

  function onCadenceChange(next: string) {
    const prev = state.cadence
    const nextCadence = next as SavedSearchCadence
    dispatch(
      () => setState((s) => ({ ...s, cadence: nextCadence })),
      () => setState((s) => ({ ...s, cadence: prev })),
      () => setSavedSearchCadence(search.id, nextCadence),
    )
  }

  function startRename() {
    setDraftName(state.name)
    setNote(null)
    setEditing(true)
  }

  function saveRename() {
    const next = draftName.trim()
    if (!next) {
      setNote({ tone: 'err', text: 'Give this search a name.' })
      return
    }
    const prev = state.name
    setEditing(false)
    dispatch(
      () => setState((s) => ({ ...s, name: next })),
      () => setState((s) => ({ ...s, name: prev })),
      () => renameSavedSearch(search.id, next),
    )
  }

  function onDelete() {
    dispatch(
      () => {},
      () => {},
      async () => {
        const result = await deleteSavedSearch(search.id)
        return { error: result.error }
      },
    )
  }

  function onMarkSeen() {
    dispatch(
      () => setSeen(true),
      () => setSeen(false),
      () => markSavedSearchSeen(search.id),
    )
  }

  const cadenceId = `cadence-${search.id}`
  const alertsId = `alerts-${search.id}`
  const filtersSummary = getFiltersSummary(state.filters)
  const newSinceLabel = insight && !seen ? formatNewSinceLabel(insight.newSince) : null

  return (
    // The id anchor is the target of getAlertManageUrl (lib/alerts/manage-url.ts)
    // — the email footer's "manage this alert" link lands on this card.
    <Card id={`alert-${search.id}`} className="scroll-mt-24 p-4">
      {/* Name + deep link */}
      {editing ? (
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveRename()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
              }
            }}
            aria-label="Search name"
            maxLength={120}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={saveRename} disabled={pending} className="shrink-0">
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="shrink-0 text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <Link href={buildSearchUrlFromFilters(state.filters)} className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-medium text-foreground">{state.name}</span>
              {newSinceLabel ? (
                <Badge className="tabular-nums">{newSinceLabel}</Badge>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{filtersSummary}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {insight ? (
                <span className="tabular-nums">{insight.totalCount} matches now</span>
              ) : (
                'View results'
              )}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {newSinceLabel ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onMarkSeen}
                disabled={pending}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                Mark as seen
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startRename}
              disabled={pending}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              Rename
            </Button>
            <EditSearchDialog
              search={search}
              state={state}
              onSaved={(next) => {
                setState(next)
                setNote(null)
                onChanged()
              }}
            />
          </div>
        </div>
      )}

      {/* Alert controls */}
      <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <div className="min-w-0">
            <Label htmlFor={alertsId} className="text-sm font-medium text-foreground">
              Email alerts
            </Label>
            <p className="text-xs text-muted-foreground">{state.paused ? 'Paused' : 'On'}</p>
          </div>
          <Switch
            id={alertsId}
            checked={!state.paused}
            disabled={pending}
            onCheckedChange={onTogglePaused}
            aria-label="Email alerts for this search"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={cadenceId} className="text-xs text-muted-foreground">
            How often
          </Label>
          <Select value={state.cadence} onValueChange={onCadenceChange} disabled={pending || state.paused}>
            <SelectTrigger id={cadenceId} size="sm" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAVED_SEARCH_CADENCES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Typed-event preferences: what to watch, weekly days, household recipients */}
      <AlertPreferences
        alertId={search.id}
        cadence={state.cadence}
        events={search.events}
        scheduleDays={search.schedule_days}
        recipients={search.recipients}
        disabled={pending}
      />

      {/* Delete + error */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {note ? (
          <p
            className={cn('text-xs', note.tone === 'ok' ? 'text-success' : 'text-destructive')}
            role="status"
          >
            {note.text}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this saved search?</AlertDialogTitle>
              <AlertDialogDescription>
                You will stop getting alerts for {state.name}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  )
}

export default function SavedSearchControls({ searches, insights }: Props) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-3">
      {searches.map((search) => (
        <SavedSearchCard
          key={search.id}
          search={search}
          insight={insights?.[search.id]}
          onChanged={() => router.refresh()}
        />
      ))}
    </div>
  )
}
