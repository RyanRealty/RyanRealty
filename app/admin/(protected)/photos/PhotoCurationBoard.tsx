'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { curateAssets, type CurationPatch } from '@/app/actions/asset-curation'

export type CurationAsset = {
  id: string
  type: string
  file_url: string | null
  approval: string
  geo_tags: string[] | null
  subject_tags: string[] | null
  surface_tags: string[] | null
  notes: string | null
  width: number | null
  height: number | null
  duration_sec: string | null
}

type Approval = 'intake' | 'approved' | 'rejected'

type Props = {
  assets: CurationAsset[]
  counts: Record<Approval, number>
  approval: Approval
  type: 'photo' | 'video'
  geo: string
  page: number
  pageSize: number
  totalForView: number
}

const GEO_FILTERS = [
  'central-oregon', 'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'tumalo',
  'prineville', 'terrebonne', 'madras', 'culver', 'powell-butte',
  'tetherow', 'broken-top', 'black-butte-ranch', 'eagle-crest',
]

const ALL_GEOS = '__all__'

// Supabase image transform for a light thumbnail; falls back to the raw object
// URL via onError if the render endpoint isn't enabled on the project.
function thumb(url: string): string {
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=480&quality=70&resize=cover'
}

function fileName(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/\(([^)]+\.(?:mp4|mov|webm|m4v|jpe?g|png))\)/i)
  return m ? m[1] : ''
}

export function PhotoCurationBoard({
  assets, counts, approval, type, geo, page, pageSize, totalForView,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isNavigating, startNav] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const apply = useCallback(
    (ids: string[], patch: CurationPatch) => {
      if (ids.length === 0) return
      startTransition(async () => {
        await curateAssets(ids, patch)
        setSelected(new Set())
        router.refresh()
      })
    },
    [router],
  )

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectAll = () => setSelected(new Set(assets.map((a) => a.id)))
  const selIds = [...selected]

  const href = (next: Partial<{ approval: string; type: string; geo: string; page: number }>) => {
    const sp = new URLSearchParams()
    sp.set('approval', next.approval ?? approval)
    sp.set('type', next.type ?? type)
    const g = next.geo ?? geo
    if (g) sp.set('geo', g)
    const p = next.page ?? 0
    if (p) sp.set('page', String(p))
    return `/admin/photos?${sp.toString()}`
  }

  const go = (next: Partial<{ approval: string; type: string; geo: string; page: number }>) => {
    setSelected(new Set())
    startNav(() => router.push(href(next)))
  }

  const totalPages = Math.max(1, Math.ceil(totalForView / pageSize))
  const busy = isPending || isNavigating

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Photo curation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the library and choose what is approved, and where it shows. Approving flips the live
          site imagery. Watermarked and off-brand shots are rejected (reversible). The vision screen
          pre-tags each clean photo with a proposed hero/card surface.
        </p>
      </div>

      {/* Approval + type filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ToggleGroup
          type="single"
          value={approval}
          spacing={6}
          onValueChange={(v) => v && go({ approval: v, page: 0 })}
          aria-label="Approval status"
          className="w-full sm:w-auto"
        >
          {(['intake', 'approved', 'rejected'] as const).map((a) => (
            <ToggleGroupItem
              key={a}
              value={a}
              variant="outline"
              className="h-11 flex-1 px-4 capitalize sm:h-9 sm:flex-none"
            >
              {a}{' '}
              <span className="tabular-nums text-muted-foreground">{counts[a]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="hidden h-6 w-px bg-border sm:block" />

        <ToggleGroup
          type="single"
          value={type}
          spacing={6}
          onValueChange={(v) => v && go({ type: v, page: 0 })}
          aria-label="Media type"
          className="w-full sm:w-auto"
        >
          <ToggleGroupItem value="photo" variant="outline" className="h-11 flex-1 px-4 sm:h-9 sm:flex-none">
            Photos
          </ToggleGroupItem>
          <ToggleGroupItem value="video" variant="outline" className="h-11 flex-1 px-4 sm:h-9 sm:flex-none">
            Videos
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Geo filter — Select on mobile (one clean control), chips on desktop */}
      <div>
        <div className="sm:hidden">
          <Select value={geo || ALL_GEOS} onValueChange={(v) => go({ geo: v === ALL_GEOS ? '' : v, page: 0 })}>
            <SelectTrigger className="h-11 w-full" aria-label="Filter by geo">
              <SelectValue placeholder="All geos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GEOS}>All geos</SelectItem>
              {GEO_FILTERS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => go({ geo: '', page: 0 })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              !geo ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            all geos
          </button>
          {GEO_FILTERS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => go({ geo: g, page: 0 })}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                geo === g ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <span className="px-1 text-sm font-medium text-foreground tabular-nums">
          {selected.size > 0 ? `${selected.size} selected` : `${totalForView} ${type}${totalForView === 1 ? '' : 's'} · ${approval}`}
        </span>
        <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={selectAll} disabled={busy || assets.length === 0}>Select page</Button>
        {selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => setSelected(new Set())} disabled={busy}>Clear</Button>
            <span className="mx-1 h-6 w-px bg-border" />
            <Button size="sm" className="h-11 sm:h-8" onClick={() => apply(selIds, { approval: 'approved' })} disabled={busy}>Approve</Button>
            <Button size="sm" variant="destructive" className="h-11 sm:h-8" onClick={() => apply(selIds, { approval: 'rejected' })} disabled={busy}>Reject</Button>
            <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => apply(selIds, { approval: 'intake' })} disabled={busy}>Intake</Button>
            {type === 'photo' && (
              <>
                <span className="mx-1 h-6 w-px bg-border" />
                <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => apply(selIds, { surfaceTags: ['hero', 'card'] })} disabled={busy}>hero+card</Button>
                <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => apply(selIds, { surfaceTags: ['card'] })} disabled={busy}>card only</Button>
                <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => apply(selIds, { surfaceTags: [] })} disabled={busy}>clear surface</Button>
              </>
            )}
          </>
        )}
        {busy && <span className="text-sm text-muted-foreground" role="status">saving…</span>}
      </div>

      {/* Grid */}
      {isNavigating ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <p className="text-sm font-medium text-foreground">No {type}s in {approval}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {geo
              ? `Nothing tagged ${geo} here. Clear the geo filter or try another tab.`
              : 'Try another tab or media type, or run the ingest sweep to bring in new assets.'}
          </p>
          {geo && (
            <Button variant="outline" className="mt-4 h-11" onClick={() => go({ geo: '', page: 0 })}>
              Clear geo filter
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              selected={selected.has(a.id)}
              onToggle={() => toggleSel(a.id)}
              onPatch={(patch) => apply([a.id], patch)}
              disabled={busy}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !isNavigating && (
        <Pagination className="pt-2">
          <PaginationContent className="gap-2">
            <PaginationItem>
              <PaginationPrevious
                href={page > 0 ? href({ page: page - 1 }) : undefined}
                aria-disabled={page === 0}
                className={cn('h-11 sm:h-9', page === 0 && 'pointer-events-none opacity-50')}
                onClick={(e) => {
                  e.preventDefault()
                  if (page > 0) go({ page: page - 1 })
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive className="pointer-events-none h-11 w-auto px-3 text-sm tabular-nums sm:h-9">
                {page + 1} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href={page < totalPages - 1 ? href({ page: page + 1 }) : undefined}
                aria-disabled={page >= totalPages - 1}
                className={cn('h-11 sm:h-9', page >= totalPages - 1 && 'pointer-events-none opacity-50')}
                onClick={(e) => {
                  e.preventDefault()
                  if (page < totalPages - 1) go({ page: page + 1 })
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

function AssetCard({
  asset, selected, onToggle, onPatch, disabled,
}: {
  asset: CurationAsset
  selected: boolean
  onToggle: () => void
  onPatch: (patch: CurationPatch) => void
  disabled: boolean
}) {
  const [imgSrc, setImgSrc] = useState(asset.file_url ? thumb(asset.file_url) : '')
  const surfaces = new Set(asset.surface_tags ?? [])
  const isVideo = asset.type === 'video'
  const name = fileName(asset.notes)

  const toggleSurface = (s: 'hero' | 'card') => {
    const next = new Set(surfaces)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    onPatch({ surfaceTags: [...next] })
  }

  return (
    <div className={cn('group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md', selected ? 'border-primary ring-2 ring-primary' : 'border-border')}>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={selected ? 'Deselect asset' : 'Select asset'}
          className="block w-full"
        >
          {isVideo && asset.file_url ? (
            <video src={asset.file_url} preload="metadata" muted playsInline className="aspect-video w-full bg-muted object-cover" />
          ) : imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={asset.notes ?? ''}
              loading="lazy"
              onError={() => asset.file_url && imgSrc !== asset.file_url && setImgSrc(asset.file_url)}
              className="aspect-video w-full bg-muted object-cover"
            />
          ) : (
            <div className="aspect-video w-full bg-muted" />
          )}
        </button>
        <span className={cn('absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border text-xs', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card/80')}>
          {selected ? '✓' : ''}
        </span>
        <Badge
          variant={asset.approval === 'approved' ? 'default' : asset.approval === 'rejected' ? 'destructive' : 'secondary'}
          className="absolute right-2 top-2 capitalize"
        >
          {asset.approval}
        </Badge>
      </div>

      <div className="space-y-2 p-2.5">
        <div className="flex flex-wrap gap-1">
          {(asset.geo_tags ?? []).slice(0, 4).map((g) => (
            <Badge key={g} variant="outline" className="text-xs font-normal">{g}</Badge>
          ))}
        </div>

        {!isVideo && (
          <div className="flex gap-1.5">
            {(['hero', 'card'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSurface(s)}
                disabled={disabled}
                aria-pressed={surfaces.has(s)}
                className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                  surfaces.has(s) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {isVideo && (
          <p className="truncate text-xs text-muted-foreground" title={name}>
            {name || (asset.subject_tags ?? []).join(', ')}
            {asset.duration_sec ? ` · ${Math.round(Number(asset.duration_sec))}s` : ''}
            {asset.width && asset.height ? ` · ${asset.width > asset.height ? 'landscape' : '9:16'}` : ''}
          </p>
        )}

        {asset.notes && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{asset.notes}</p>}

        <div className="flex gap-1.5 pt-0.5">
          {asset.approval !== 'approved' && (
            <Button size="sm" variant="outline" className="h-9 flex-1 px-2 text-xs" onClick={() => onPatch({ approval: 'approved' })} disabled={disabled}>Approve</Button>
          )}
          {asset.approval !== 'rejected' && (
            <Button size="sm" variant="outline" className="h-9 flex-1 px-2 text-xs" onClick={() => onPatch({ approval: 'rejected' })} disabled={disabled}>Reject</Button>
          )}
          {asset.approval !== 'intake' && (
            <Button size="sm" variant="ghost" className="h-9 px-2.5 text-xs" onClick={() => onPatch({ approval: 'intake' })} disabled={disabled} aria-label="Move back to intake">↺</Button>
          )}
        </div>
      </div>
    </div>
  )
}
