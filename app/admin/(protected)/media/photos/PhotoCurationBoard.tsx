'use client'

/**
 * PhotoCurationBoard — the /admin/media/photos curation gallery.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — curateAssets, the
 * selection set, the URL-param navigation (href/go), the page arithmetic, the
 * Supabase render-endpoint thumb() fallback and every user-visible string are
 * untouched.
 *
 * Substitutions, and why each one:
 *   ToggleGroup / geo pills -> FilterChip. These ARE filters, and FilterChip is
 *                        the language's one pill: it owns aria-pressed, the
 *                        pressed wash and the focus ring, so none of that has
 *                        to be hand-rolled inline.
 *   Select (phone geo)  -> ToolbarSelect (the compact native control).
 *   Badge (approval)    -> StateWord — an artifact STATE, which is what
 *                        .av2-state is for. The geo tags stay .av2-chip: they
 *                        are DATA and .av2-state uppercases.
 *   Pagination          -> the same prev/label/next shape built from Link, so
 *                        middle-click and open-in-new-tab keep working; the
 *                        onClick still preventDefaults into go(), unchanged.
 *   Skeleton            -> a local Shimmer on --a-inset that keeps animate-pulse
 *                        (a non-colour utility), so the loading motion survives.
 *   h1                  -> EntityTitle, the language's only sanctioned h1.
 *
 * Surface stack, checked both ways in design_system/admin/tokens.css so nothing
 * is painted onto its own parent: cards and the sticky bar are --a-bg with a
 * hairline, media wells are --a-inset, chips and quiet buttons are --a-surface.
 * hover:shadow-md stays on the card — it is the only hover that card has, and
 * dropping it would be a lost affordance rather than a migrated one.
 */

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Button,
  EntityTitle,
  FilterChip,
  StateWord,
  ToolbarSelect,
  type AdminState,
} from '@/components/admin/v2'
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

/** approval -> the language's state vocabulary (text + colour, never colour alone). */
function approvalState(approval: string): AdminState {
  if (approval === 'approved') return 'ok'
  if (approval === 'rejected') return 'down'
  return 'waiting'
}

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

/** Loading placeholder — the shadcn Skeleton's shape and pulse, on admin tokens. */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md', className)}
      style={{ background: 'var(--a-inset)' }}
    />
  )
}

/** A DATA chip (a geo tag). Never StateWord — that uppercases. */
function DataChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="av2-chip" style={{ cursor: 'default', fontSize: 'var(--a-text-xs)' }}>
      {children}
    </span>
  )
}

/** The thin vertical rule between button groups in the bulk bar. */
function BarDivider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('h-6 w-px', className)}
      style={{ background: 'var(--a-border)' }}
    />
  )
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
    return `/admin/media/photos?${sp.toString()}`
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
        <EntityTitle>Photo curation</EntityTitle>
        <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Review the library and choose what is approved, and where it shows. Approving flips the live
          site imagery. Watermarked and off-brand shots are rejected (reversible). The vision screen
          pre-tags each clean photo with a proposed hero/card surface.
        </p>
      </div>

      {/* Approval + type filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex w-full gap-1.5 sm:w-auto" role="group" aria-label="Approval status">
          {(['intake', 'approved', 'rejected'] as const).map((a) => (
            <FilterChip
              key={a}
              pressed={approval === a}
              onClick={() => go({ approval: a, page: 0 })}
              className="h-11 flex-1 px-4 capitalize sm:h-9 sm:flex-none"
            >
              {a}{' '}
              <span className="a-num" style={{ color: 'var(--a-text-2)' }}>{counts[a]}</span>
            </FilterChip>
          ))}
        </div>

        <BarDivider className="hidden sm:block" />

        <div className="flex w-full gap-1.5 sm:w-auto" role="group" aria-label="Media type">
          <FilterChip
            pressed={type === 'photo'}
            onClick={() => go({ type: 'photo', page: 0 })}
            className="h-11 flex-1 px-4 sm:h-9 sm:flex-none"
          >
            Photos
          </FilterChip>
          <FilterChip
            pressed={type === 'video'}
            onClick={() => go({ type: 'video', page: 0 })}
            className="h-11 flex-1 px-4 sm:h-9 sm:flex-none"
          >
            Videos
          </FilterChip>
        </div>
      </div>

      {/* Geo filter — one compact control on mobile, chips on desktop */}
      <div>
        <div className="sm:hidden">
          <ToolbarSelect
            aria-label="Filter by geo"
            className="h-11 w-full"
            style={{ maxWidth: 'none' }}
            value={geo || ALL_GEOS}
            onChange={(e) => go({ geo: e.target.value === ALL_GEOS ? '' : e.target.value, page: 0 })}
          >
            <option value={ALL_GEOS}>All geos</option>
            {GEO_FILTERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </ToolbarSelect>
        </div>
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          <FilterChip pressed={!geo} onClick={() => go({ geo: '', page: 0 })}>
            all geos
          </FilterChip>
          {GEO_FILTERS.map((g) => (
            <FilterChip key={g} pressed={geo === g} onClick={() => go({ geo: g, page: 0 })}>
              {g}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <div
        className="sticky top-2 z-10 flex flex-wrap items-center gap-2 p-2"
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-bg)',
        }}
      >
        <span
          className="a-num px-1"
          style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}
        >
          {selected.size > 0 ? `${selected.size} selected` : `${totalForView} ${type}${totalForView === 1 ? '' : 's'} · ${approval}`}
        </span>
        <Button variant="quiet" className="h-11 sm:h-8" onClick={selectAll} disabled={busy || assets.length === 0}>Select page</Button>
        {selected.size > 0 && (
          <>
            <Button variant="quiet" className="h-11 sm:h-8" onClick={() => setSelected(new Set())} disabled={busy}>Clear</Button>
            <BarDivider className="mx-1" />
            <Button className="h-11 sm:h-8" onClick={() => apply(selIds, { approval: 'approved' })} disabled={busy}>Approve</Button>
            <Button variant="danger" className="h-11 sm:h-8" onClick={() => apply(selIds, { approval: 'rejected' })} disabled={busy}>Reject</Button>
            <Button variant="quiet" className="h-11 sm:h-8" onClick={() => apply(selIds, { approval: 'intake' })} disabled={busy}>Intake</Button>
            {type === 'photo' && (
              <>
                <BarDivider className="mx-1" />
                <Button variant="quiet" className="h-11 sm:h-8" onClick={() => apply(selIds, { surfaceTags: ['hero', 'card'] })} disabled={busy}>hero+card</Button>
                <Button variant="quiet" className="h-11 sm:h-8" onClick={() => apply(selIds, { surfaceTags: ['card'] })} disabled={busy}>card only</Button>
                <Button variant="quiet" className="h-11 sm:h-8" onClick={() => apply(selIds, { surfaceTags: [] })} disabled={busy}>clear surface</Button>
              </>
            )}
          </>
        )}
        {busy && (
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }} role="status">
            saving…
          </span>
        )}
      </div>

      {/* Grid */}
      {isNavigating ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden"
              style={{
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-lg)',
                background: 'var(--a-bg)',
              }}
            >
              <Shimmer className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-2.5">
                <Shimmer className="h-4 w-2/3" />
                <Shimmer className="h-4 w-1/2" />
                <Shimmer className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div
          className="px-6 py-20 text-center"
          style={{
            border: '1px dashed var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            background: 'var(--a-bg)',
          }}
        >
          <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)', margin: 0 }}>
            No {type}s in {approval}
          </p>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            {geo
              ? `Nothing tagged ${geo} here. Clear the geo filter or try another tab.`
              : 'Try another tab or media type, or run the ingest sweep to bring in new assets.'}
          </p>
          {geo && (
            <Button variant="quiet" touch className="mt-4" onClick={() => go({ geo: '', page: 0 })}>
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
        <nav
          role="navigation"
          aria-label="pagination"
          className="mx-auto flex w-full justify-center pt-2"
        >
          <div className="flex flex-row items-center gap-2">
            {page > 0 ? (
              <Link
                href={href({ page: page - 1 })}
                aria-label="Go to previous page"
                className="av2-btn av2-btn--quiet h-11 sm:h-9"
                style={{ textDecoration: 'none' }}
                onClick={(e) => {
                  e.preventDefault()
                  go({ page: page - 1 })
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                <span className="hidden sm:block">Previous</span>
              </Link>
            ) : (
              <span
                aria-label="Go to previous page"
                aria-disabled="true"
                className="av2-btn av2-btn--quiet pointer-events-none h-11 opacity-50 sm:h-9"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                <span className="hidden sm:block">Previous</span>
              </span>
            )}

            <span
              aria-current="page"
              className="av2-btn av2-btn--quiet a-num pointer-events-none h-11 w-auto px-3 sm:h-9"
            >
              {page + 1} / {totalPages}
            </span>

            {page < totalPages - 1 ? (
              <Link
                href={href({ page: page + 1 })}
                aria-label="Go to next page"
                className="av2-btn av2-btn--quiet h-11 sm:h-9"
                style={{ textDecoration: 'none' }}
                onClick={(e) => {
                  e.preventDefault()
                  go({ page: page + 1 })
                }}
              >
                <span className="hidden sm:block">Next</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <span
                aria-label="Go to next page"
                aria-disabled="true"
                className="av2-btn av2-btn--quiet pointer-events-none h-11 opacity-50 sm:h-9"
              >
                <span className="hidden sm:block">Next</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            )}
          </div>
        </nav>
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
    <div
      className="group overflow-hidden transition-shadow hover:shadow-md"
      style={{
        border: '1px solid',
        borderColor: selected ? 'var(--a-accent)' : 'var(--a-border)',
        borderRadius: 'var(--a-r-lg)',
        background: 'var(--a-bg)',
        // outline, not boxShadow: an inline box-shadow OUTRANKS the
        // `hover:shadow-md` class on the same element, so a selected card
        // stopped lifting on hover while its neighbours still did. outline
        // draws the same 2px ring on a different property, so both compose.
        ...(selected ? { outline: '2px solid var(--a-accent)', outlineOffset: '-2px' } : null),
      }}
    >
      <div className="relative">
        <Button
          variant="quiet"
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={selected ? 'Deselect asset' : 'Select asset'}
          className="w-full"
          style={{
            display: 'block',
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            padding: 0,
            minHeight: 'auto',
          }}
        >
          {isVideo && asset.file_url ? (
            <video
              src={asset.file_url}
              preload="metadata"
              muted
              playsInline
              className="aspect-video w-full object-cover"
              style={{ background: 'var(--a-inset)' }}
            />
          ) : imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={asset.notes ?? ''}
              loading="lazy"
              onError={() => asset.file_url && imgSrc !== asset.file_url && setImgSrc(asset.file_url)}
              className="aspect-video w-full object-cover"
              style={{ background: 'var(--a-inset)' }}
            />
          ) : (
            <div className="aspect-video w-full" style={{ background: 'var(--a-inset)' }} />
          )}
        </Button>
        <span
          className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center"
          style={{
            border: '1px solid',
            borderColor: selected ? 'var(--a-accent)' : 'var(--a-border)',
            borderRadius: 'var(--a-r-sm)',
            fontSize: 'var(--a-text-xs)',
            background: selected ? 'var(--a-btn-bg)' : 'var(--a-surface)',
            color: selected ? 'var(--a-btn-fg)' : 'var(--a-text-2)',
          }}
        >
          {selected ? '✓' : ''}
        </span>
        <span className="absolute right-2 top-2">
          <StateWord state={approvalState(asset.approval)}>{asset.approval}</StateWord>
        </span>
      </div>

      <div className="space-y-2 p-2.5">
        <div className="flex flex-wrap gap-1">
          {(asset.geo_tags ?? []).slice(0, 4).map((g) => (
            <DataChip key={g}>{g}</DataChip>
          ))}
        </div>

        {!isVideo && (
          <div className="flex gap-1.5">
            {(['hero', 'card'] as const).map((s) => (
              <FilterChip
                key={s}
                pressed={surfaces.has(s)}
                onClick={() => toggleSurface(s)}
                disabled={disabled}
                className="flex-1 px-2 py-1.5 disabled:opacity-50"
                style={{ fontSize: 'var(--a-text-xs)' }}
              >
                {s}
              </FilterChip>
            ))}
          </div>
        )}

        {isVideo && (
          <p
            className="truncate"
            title={name}
            style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          >
            {name || (asset.subject_tags ?? []).join(', ')}
            {asset.duration_sec ? ` · ${Math.round(Number(asset.duration_sec))}s` : ''}
            {asset.width && asset.height ? ` · ${asset.width > asset.height ? 'landscape' : '9:16'}` : ''}
          </p>
        )}

        {asset.notes && (
          <p
            className="line-clamp-2"
            style={{ fontSize: 'var(--a-text-xs)', lineHeight: 1.375, color: 'var(--a-text-2)' }}
          >
            {asset.notes}
          </p>
        )}

        <div className="flex gap-1.5 pt-0.5">
          {asset.approval !== 'approved' && (
            <Button variant="quiet" className="h-9 flex-1 px-2" onClick={() => onPatch({ approval: 'approved' })} disabled={disabled}>Approve</Button>
          )}
          {asset.approval !== 'rejected' && (
            <Button variant="quiet" className="h-9 flex-1 px-2" onClick={() => onPatch({ approval: 'rejected' })} disabled={disabled}>Reject</Button>
          )}
          {asset.approval !== 'intake' && (
            <Button variant="quiet" className="h-9 px-2.5" onClick={() => onPatch({ approval: 'intake' })} disabled={disabled} aria-label="Move back to intake">↺</Button>
          )}
        </div>
      </div>
    </div>
  )
}
