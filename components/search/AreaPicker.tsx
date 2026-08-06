'use client'

/**
 * AreaPicker — pick a saved named area from inside the map surface
 * (SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4 Phase 2.4, final open item).
 *
 * Named areas shipped with a table, public /areas/<slug> pages and an account
 * manager, but the only way to put one INTO a search was to leave the map and
 * click an /account/areas link. This control closes that loop on the map
 * itself.
 *
 * Contract (the whole point — see components/search/area-picker.ts):
 * applying an area hands MapSearchView a plain DrawnShape[], the exact value a
 * hand-drawn polygon produces. From there the existing machinery does the
 * rest: `?shapes=` is rewritten, the geo scope drops, the viewport refetches,
 * and the resulting URL is shareable and savable as a listing alert with no
 * special case anywhere. Clearing is the same call with an empty set.
 *
 * Placement: bottom-left of the map canvas. Top-left is the draw toolbar,
 * top-center is the search-as-you-move toggle plus the geo-scope chip, and
 * top-right is the Google map-type control plus the boundary controls.
 *
 * Style note: JSX conditions read `x === false` rather than `!x` because the
 * brand-voice punctuation gate treats a bare `!` inside a JSX expression as an
 * exclamation mark (same reason MapSearchView writes `scopeDropped === false`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { DrawnShape } from '@/lib/map-polygon'
import { listPickerAreas } from '@/app/actions/search-area-picker'
import { createArea } from '@/app/actions/search-areas'
import {
  areaCountLabel,
  drawnShapesForArea,
  includeShapeCount,
  matchActiveArea,
  type PickerArea,
} from '@/components/search/area-picker'

type Props = {
  /** The map's live shape set. Drives the active-area readout. */
  shapes: DrawnShape[]
  /** Replace the map's shapes. Same callback a draw commit uses. */
  onApply: (shapes: DrawnShape[]) => void
  className?: string
}

const PANEL_BUTTON =
  'h-auto w-full justify-start rounded-lg px-2.5 py-2 text-left text-sm font-medium'
const SECTION_LABEL =
  'px-1 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'

export default function AreaPicker({ shapes, onApply, className }: Props) {
  const [open, setOpen] = useState(false)
  const [areas, setAreas] = useState<PickerArea[] | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const result = await listPickerAreas()
      setAreas(result.areas)
      setSignedIn(result.signedIn)
    } catch {
      // Never strand the control on a transient action failure: the panel
      // says so and offers a retry.
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on FIRST open only. A visitor who never opens the picker never pays
  // for the query, which is why the server page does not preload it.
  useEffect(() => {
    if (open && areas == null && loading === false && loadError === false) void load()
  }, [open, areas, loading, loadError, load])

  // Close on Escape and on a click outside, the two behaviors a disclosure
  // over a map has to get right (the map swallows most stray clicks).
  useEffect(() => {
    if (open === false) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (root && e.target instanceof Node && root.contains(e.target) === false) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const activeArea = areas ? matchActiveArea(areas, shapes) : null
  const mine = (areas ?? []).filter((a) => a.scope === 'mine')
  const shared = (areas ?? []).filter((a) => a.scope === 'shared')
  const drawnIncludeCount = includeShapeCount(shapes)
  const isEmpty =
    loading === false && loadError === false && areas != null && areas.length === 0

  const applyArea = useCallback(
    (area: PickerArea) => {
      const next = drawnShapesForArea(area)
      if (next.length === 0) return
      onApply(next)
      setOpen(false)
    },
    [onApply],
  )

  const clearArea = useCallback(() => {
    onApply([])
    setOpen(false)
  }, [onApply])

  const saveCurrentShapes = useCallback(async () => {
    const name = saveName.trim()
    if (name.length === 0 || shapes.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await createArea(
        name,
        // The stored contract is [lng,lat] tuples plus an optional exclude
        // flag, validated by lib/data/areas/validation.ts.
        shapes.map((shape) =>
          shape.type === 'circle'
            ? {
                type: 'circle' as const,
                center: [shape.center.lng, shape.center.lat],
                radius_m: shape.radiusM,
                exclude: shape.exclude,
              }
            : {
                type: 'polygon' as const,
                coords: shape.points.map((p) => [p.lng, p.lat]),
                exclude: shape.exclude,
              },
        ),
      )
      if (result.error) {
        setSaveError(result.error)
        return
      }
      setSaveName('')
      await load()
    } catch {
      setSaveError('That area did not save. Try again.')
    } finally {
      setSaving(false)
    }
  }, [saveName, shapes, load])

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute bottom-16 left-3 z-[100] flex flex-col items-start gap-2 lg:bottom-4',
        className,
      )}
    >
      {open && (
        <Card id="area-picker-panel" data-testid="area-picker-panel" className="w-72 p-3 shadow-lg">
          <p className="text-sm font-semibold text-foreground">Saved areas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Applying an area replaces the shapes on the map.
          </p>

          <div className="mt-3 max-h-64 overflow-y-auto">
            {loading && <p className="py-2 text-xs text-muted-foreground">Loading your areas…</p>}

            {loadError && (
              <div className="py-2">
                <p className="text-xs text-muted-foreground">Your areas did not load.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void load()}
                >
                  Try again
                </Button>
              </div>
            )}

            {isEmpty && (
              <div className="py-1" data-testid="area-picker-empty">
                <p className="text-xs text-muted-foreground">
                  {signedIn
                    ? 'You have no saved areas yet. Draw one with the Draw tool at the top left of the map, then name it here to reuse it in any search or listing alert.'
                    : 'Saved areas live in your account. Draw one with the Draw tool at the top left of the map, then sign in to name it and reuse it.'}
                </p>
                {signedIn === false && (
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href="/login?next=/homes-for-sale">Sign in</Link>
                  </Button>
                )}
              </div>
            )}

            {mine.length > 0 && (
              <div className="space-y-0.5">
                <p className={SECTION_LABEL}>Yours</p>
                {mine.map((area) => (
                  <AreaRow
                    key={area.id}
                    area={area}
                    active={activeArea?.id === area.id}
                    onSelect={applyArea}
                  />
                ))}
              </div>
            )}

            {shared.length > 0 && (
              <div className={cn('space-y-0.5', mine.length > 0 && 'mt-3')}>
                <p className={SECTION_LABEL}>From Ryan Realty</p>
                {shared.map((area) => (
                  <AreaRow
                    key={area.id}
                    area={area}
                    active={activeArea?.id === area.id}
                    onSelect={applyArea}
                  />
                ))}
              </div>
            )}
          </div>

          {shapes.length > 0 && (
            <>
              <Separator className="my-3" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                data-testid="area-picker-clear-all"
                onClick={clearArea}
              >
                Clear {areaCountLabel(shapes.length)} from this search
              </Button>
            </>
          )}

          {signedIn && drawnIncludeCount > 0 && activeArea == null && (
            <>
              <Separator className="my-3" />
              <Label htmlFor="area-picker-name" className="text-xs font-medium text-foreground">
                Save these shapes as an area
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="area-picker-name"
                  value={saveName}
                  maxLength={80}
                  placeholder="Bend west side"
                  onChange={(e) => setSaveName(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || saveName.trim().length === 0}
                  onClick={() => void saveCurrentShapes()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
              {saveError && <p className="mt-1.5 text-xs text-destructive">{saveError}</p>}
            </>
          )}

          {signedIn && (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link
                href="/account/areas"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Manage your areas
              </Link>
            </p>
          )}
        </Card>
      )}

      <div
        className={cn(
          'flex items-center gap-0.5 rounded-lg border bg-card shadow-md',
          activeArea ? 'border-primary' : 'border-border',
        )}
      >
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          onClick={() => setOpen((v) => v === false)}
          aria-expanded={open}
          aria-controls="area-picker-panel"
          data-testid="area-picker-trigger"
          className="h-auto max-w-48 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          <span className="truncate">{activeArea ? activeArea.name : 'Saved areas'}</span>
          {activeArea == null && areas != null && areas.length > 0 && (
            <Badge variant="outline" className="ml-2 px-1.5 tabular-nums">
              {areas.length}
            </Badge>
          )}
        </Button>
        {activeArea && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearArea}
            data-testid="area-picker-clear"
            aria-label={`Clear ${activeArea.name} from this search`}
            className="mr-1 h-6 w-6 rounded-full p-0 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

function AreaRow({
  area,
  active,
  onSelect,
}: {
  area: PickerArea
  active: boolean
  onSelect: (area: PickerArea) => void
}) {
  const applicable = drawnShapesForArea(area).length > 0
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      onClick={() => onSelect(area)}
      disabled={applicable === false}
      data-testid="area-picker-option"
      data-area-name={area.name}
      className={cn(PANEL_BUTTON, active && 'ring-1 ring-primary')}
    >
      <span className="truncate">{area.name}</span>
      {active && <span className="ml-auto shrink-0 text-xs text-muted-foreground">On the map</span>}
    </Button>
  )
}
