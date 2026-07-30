'use client'

/**
 * AreaControls — the "My areas" manager island (/account/areas).
 *
 * A signed-in user can rename, delete, and reuse each saved named area in a
 * new search; brokers additionally publish an area as a public landing page
 * (/areas/<slug>). Optimistic + transition shape mirrors
 * app/account/saved-searches/SavedSearchControls: flip the UI, fire the
 * action, revert + surface the reason on failure. The server actions are the
 * auth chokepoint (every write scopes to the session user; publish is broker
 * gated) — this island only renders state and dispatches.
 *
 * Design-system components only (@/components/ui/*), tokens only, cn() merges.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  renameArea,
  deleteArea,
  setAreaPublic,
  type AreaActionResult,
} from '@/app/actions/search-areas'
import { areaSearchHref } from '@/lib/search/area-link'
import type { AreaShape } from '@/lib/data/areas/validation'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

/** Serializable row shape passed down from the server page. */
export type AreaListRow = {
  id: string
  name: string
  slug: string | null
  shapes: AreaShape[]
  is_public: boolean
  updated_at: string
}

type Props = {
  areas: AreaListRow[]
  /** Broker/superuser sessions see the publish controls. */
  isBroker: boolean
}

function shapeSummary(shapes: AreaShape[]): string {
  const total = shapes.length
  const excludes = shapes.filter((s) => s.exclude === true).length
  const base = `${total} ${total === 1 ? 'shape' : 'shapes'}`
  return excludes > 0 ? `${base}, ${excludes} excluded` : base
}

function formatUpdated(iso: string): string {
  const formatted = formatDate(iso)
  return formatted === '\u2014' ? '' : formatted
}

function AreaCard({
  area,
  isBroker,
  onChanged,
}: {
  area: AreaListRow
  isBroker: boolean
  onChanged: () => void
}) {
  const [name, setName] = useState(area.name)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(area.name)
  const [isPublic, setIsPublic] = useState(area.is_public)
  const [slugDraft, setSlugDraft] = useState(area.slug ?? '')
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  function dispatch(apply: () => void, revert: () => void, action: () => Promise<AreaActionResult>) {
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

  function saveRename() {
    const next = draftName.trim()
    if (!next) {
      setNote({ tone: 'err', text: 'Give this area a name.' })
      return
    }
    const prev = name
    setEditing(false)
    dispatch(
      () => setName(next),
      () => setName(prev),
      () => renameArea(area.id, next),
    )
  }

  function onTogglePublic(next: boolean) {
    if (next && !slugDraft.trim()) {
      setNote({ tone: 'err', text: 'Set a URL slug before publishing.' })
      return
    }
    dispatch(
      () => setIsPublic(next),
      () => setIsPublic(!next),
      () => setAreaPublic(area.id, next, slugDraft.trim() || undefined),
    )
  }

  function savePublishedSlug() {
    if (!isPublic) return
    dispatch(
      () => {},
      () => {},
      () => setAreaPublic(area.id, true, slugDraft.trim() || undefined),
    )
  }

  const searchHref = areaSearchHref(area.shapes)
  const slugId = `area-slug-${area.id}`
  const publicId = `area-public-${area.id}`

  return (
    <Card className="p-4">
      {/* Name row */}
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
            aria-label="Area name"
            maxLength={80}
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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="block break-words text-sm font-medium text-foreground">{name}</span>
              {isPublic ? <Badge variant="secondary">Public</Badge> : null}
            </div>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              <span className="tabular-nums">{shapeSummary(area.shapes)}</span>
              {formatUpdated(area.updated_at) ? ` · Updated ${formatUpdated(area.updated_at)}` : ''}
            </span>
            {isPublic && area.slug ? (
              <Link
                href={`/areas/${area.slug}`}
                className="mt-0.5 block truncate text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {`/areas/${area.slug}`}
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftName(name)
                setNote(null)
                setEditing(true)
              }}
              disabled={pending}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              Rename
            </Button>
            {searchHref ? (
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link href={searchHref}>Use in search</Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Broker publish controls */}
      {isBroker ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div className="min-w-0">
              <Label htmlFor={publicId} className="text-sm font-medium text-foreground">
                Public landing page
              </Label>
              <p className="text-xs text-muted-foreground">
                {isPublic ? 'Live on the site' : 'Only you can see this area'}
              </p>
            </div>
            <Switch
              id={publicId}
              checked={isPublic}
              disabled={pending}
              onCheckedChange={onTogglePublic}
              aria-label="Publish this area as a public page"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={slugId} className="text-xs text-muted-foreground">
              URL slug
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={slugId}
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                onBlur={savePublishedSlug}
                placeholder="bend-west-side"
                maxLength={80}
                disabled={pending}
                className="w-full text-sm sm:w-56"
              />
            </div>
          </div>
        </div>
      ) : null}

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
              <AlertDialogTitle>Delete this area?</AlertDialogTitle>
              <AlertDialogDescription>
                Searches and alerts scoped to {name} will stop using it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  dispatch(
                    () => {},
                    () => {},
                    () => deleteArea(area.id),
                  )
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  )
}

export default function AreaControls({ areas, isBroker }: Props) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-3">
      {areas.map((area) => (
        <AreaCard key={area.id} area={area} isBroker={isBroker} onChanged={() => router.refresh()} />
      ))}
    </div>
  )
}
