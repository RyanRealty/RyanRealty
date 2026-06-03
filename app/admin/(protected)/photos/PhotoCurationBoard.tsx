'use client'

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  const totalPages = Math.max(1, Math.ceil(totalForView / pageSize))

  const tab = (a: Approval, label: string) => (
    <Link
      href={href({ approval: a, page: 0 })}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        approval === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {label} <span className="tabular-nums opacity-80">{counts[a]}</span>
    </Link>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Photo curation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the library and choose what is approved, and where it shows. Approving flips the live
          site imagery. Watermarked and off-brand shots are rejected (reversible). The vision screen
          pre-tags each clean photo with a proposed hero/card surface.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {tab('intake', 'Intake')}
        {tab('approved', 'Approved')}
        {tab('rejected', 'Rejected')}
        <span className="mx-1 h-5 w-px bg-border" />
        <Link href={href({ type: 'photo', page: 0 })}
          className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', type === 'photo' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
          Photos
        </Link>
        <Link href={href({ type: 'video', page: 0 })}
          className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', type === 'video' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
          Videos
        </Link>
      </div>

      {/* Geo filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={href({ geo: '', page: 0 })}
          className={cn('rounded-full border px-2.5 py-0.5 text-xs', !geo ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
          all geos
        </Link>
        {GEO_FILTERS.map((g) => (
          <Link key={g} href={href({ geo: g, page: 0 })}
            className={cn('rounded-full border px-2.5 py-0.5 text-xs', geo === g ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
            {g}
          </Link>
        ))}
      </div>

      {/* Bulk action bar */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <span className="px-1 text-sm text-muted-foreground">
          {selected.size > 0 ? `${selected.size} selected` : `${totalForView} ${type}${totalForView === 1 ? '' : 's'} · ${approval}`}
        </span>
        <Button size="sm" variant="outline" onClick={selectAll} disabled={isPending || assets.length === 0}>Select page</Button>
        {selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={isPending}>Clear</Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button size="sm" onClick={() => apply(selIds, { approval: 'approved' })} disabled={isPending}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => apply(selIds, { approval: 'rejected' })} disabled={isPending}>Reject</Button>
            <Button size="sm" variant="outline" onClick={() => apply(selIds, { approval: 'intake' })} disabled={isPending}>Intake</Button>
            {type === 'photo' && (
              <>
                <span className="mx-1 h-5 w-px bg-border" />
                <Button size="sm" variant="outline" onClick={() => apply(selIds, { surfaceTags: ['hero', 'card'] })} disabled={isPending}>hero+card</Button>
                <Button size="sm" variant="outline" onClick={() => apply(selIds, { surfaceTags: ['card'] })} disabled={isPending}>card only</Button>
                <Button size="sm" variant="outline" onClick={() => apply(selIds, { surfaceTags: [] })} disabled={isPending}>clear surface</Button>
              </>
            )}
          </>
        )}
        {isPending && <span className="text-sm text-muted-foreground">saving…</span>}
      </div>

      {/* Grid */}
      {assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-20 text-center text-muted-foreground">
          Nothing here. Try another tab or geo filter.
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
              disabled={isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {page > 0 && <Link href={href({ page: page - 1 })} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Previous</Link>}
          <span className="text-sm text-muted-foreground tabular-nums">Page {page + 1} of {totalPages}</span>
          {page < totalPages - 1 && <Link href={href({ page: page + 1 })} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Next</Link>}
        </div>
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
        <span className={cn('absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-xs', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card/80')}>
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
          <div className="flex gap-1">
            {(['hero', 'card'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSurface(s)}
                disabled={disabled}
                className={cn('rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
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
            <Button size="sm" variant="outline" className="h-7 flex-1 px-2 text-xs" onClick={() => onPatch({ approval: 'approved' })} disabled={disabled}>Approve</Button>
          )}
          {asset.approval !== 'rejected' && (
            <Button size="sm" variant="outline" className="h-7 flex-1 px-2 text-xs" onClick={() => onPatch({ approval: 'rejected' })} disabled={disabled}>Reject</Button>
          )}
          {asset.approval !== 'intake' && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onPatch({ approval: 'intake' })} disabled={disabled}>↺</Button>
          )}
        </div>
      </div>
    </div>
  )
}
