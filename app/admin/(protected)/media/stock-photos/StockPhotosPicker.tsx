'use client'

/**
 * StockPhotosPicker — the /admin/media/stock-photos search.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the three parallel
 * fetches, the per-source error latches, the CAP/showAll expansion, the blob
 * review sheet and its 120s revoke, and every user-visible string are untouched.
 *
 * Substitutions, and why each one:
 *   Card/CardContent -> .av2-pane and hairline boxes (elevation is borders here).
 *   Input + Label    -> TextField, which owns the label-above pairing. No
 *                       className is passed to it on purpose: TextField spreads
 *                       props AFTER its own className, so one would replace
 *                       .av2-input outright. .av2-input already carries the
 *                       44px touch height the h-11 class was there for.
 *   Tabs             -> quiet Buttons carrying aria-pressed, with the panel
 *                       rendered conditionally. Radix unmounts an inactive
 *                       TabsContent, so this is the same mount behaviour.
 *   Badge (count)    -> a plain count chip. A count is DATA and .av2-state
 *                       uppercases, so StateWord is wrong for it.
 *   Skeleton         -> a local Shimmer on --a-inset that keeps animate-pulse.
 *
 * THE REVIEW SHEET (buildStockReviewHtml) is a standalone blob document with no
 * access to the admin stylesheet, so it cannot reach var(--a-*). It used to be
 * typeset in the PUBLIC brand — the display face and the navy/cream literals —
 * which is exactly what the admin's amnesia rule blacklists, and what the gate
 * reads as a brand leak. It now draws on CSS system colors (Canvas / CanvasText
 * / GrayText / ButtonFace / ButtonBorder / LinkText / Mark), which need no
 * palette, follow the reader's OS theme via color-scheme, and invent nothing.
 * Its markup, data and strings are unchanged.
 */

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, EntityTitle, TextField } from '@/components/admin/v2'

type UnsplashRow = {
  id: string | null
  url: string
  thumbUrl: string
  attribution: string
  sourceUrl?: string
}

type ShutterRow = {
  id: string
  description: string | null
  previewUrl: string | null
  thumbUrl: string | null
}

type PexelsRow = {
  id: number
  url: string
  thumbUrl: string
  photographer: string
  photographerUrl: string
  width: number
  height: number
}

const DEFAULT_QUERY = 'Three Sisters Oregon Cascade'

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function buildStockReviewHtml(args: {
  query: string
  generatedAt: string
  shutter: ShutterRow[]
  pexels: PexelsRow[]
  unsplash: UnsplashRow[]
  errS: string | null
  errP: string | null
  errU: string | null
}): string {
  const { query, generatedAt, shutter, pexels, unsplash, errS, errP, errU } = args

  const card = (
    code: string,
    imgSrc: string | null,
    alt: string,
    captionHtml: string,
  ) => {
    const img = imgSrc
      ? `<img src="${escAttr(imgSrc)}" alt="${escAttr(alt)}" width="640" loading="lazy" />`
      : `<div class="noimg">No preview</div>`
    return `<article class="card"><div class="code">${escHtml(code)}</div>${img}<div class="cap">${captionHtml}</div></article>`
  }

  const shutterBlocks = shutter
    .map((row) =>
      card(
        `S-${row.id}`,
        row.previewUrl || row.thumbUrl,
        row.description ?? '',
        `<p>${escHtml(row.description ?? '—')}</p>`,
      ),
    )
    .join('\n')

  const pexelsBlocks = pexels
    .map((row, i) =>
      card(
        `P${i + 1} (id ${row.id})`,
        row.thumbUrl || row.url,
        '',
        `<p>Photo by <a href="${escAttr(row.photographerUrl)}">${escHtml(row.photographer)}</a> on Pexels · id ${row.id}</p>`,
      ),
    )
    .join('\n')

  const unsplashBlocks = unsplash
    .map((row, i) => {
      const profile =
        row.sourceUrl != null
          ? ` <a href="${escAttr(row.sourceUrl)}">Profile</a>`
          : ''
      const idLine = row.id ? `<p>id ${escHtml(row.id)}</p>` : ''
      return card(
        `U${i + 1}`,
        row.thumbUrl || row.url,
        '',
        `${idLine}<p>${escHtml(row.attribution)}</p>${profile ? `<p>${profile}</p>` : ''}`,
      )
    })
    .join('\n')

  const err = (label: string, e: string | null) =>
    e ? `<p class="err"><strong>${escHtml(label)}</strong> ${escHtml(e)}</p>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Stock review — ${escHtml(query)}</title>
<style>
  :root { font-family: system-ui, -apple-system, sans-serif; color: CanvasText; background: Canvas; color-scheme: light dark; }
  body { margin: 0; padding: 12px max(12px, env(safe-area-inset-right)) 24px max(12px, env(safe-area-inset-left)); max-width: 1200px; margin-inline: auto; }
  h1 { font-size: 1.35rem; margin: 0 0 8px; }
  @media (min-width: 640px) { h1 { font-size: 1.5rem; } }
  .meta { color: GrayText; font-size: 0.875rem; margin-bottom: 24px; }
  section { margin-bottom: 40px; }
  h2 { font-size: 1.15rem; border-bottom: 1px solid ButtonBorder; padding-bottom: 6px; }
  .grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .grid { gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); } }
  .card { border: 1px solid ButtonBorder; border-radius: 10px; overflow: hidden; background: Canvas; }
  .code { font-size: 12px; font-weight: 600; padding: 6px 10px; background: ButtonFace; color: GrayText; }
  .card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
  .noimg { aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; background: ButtonFace; font-size: 12px; color: GrayText; }
  .cap { padding: 10px; font-size: 12px; color: GrayText; line-height: 1.45; }
  .cap a { color: LinkText; }
  .err { font-size: 13px; font-weight: 700; background: Mark; color: MarkText; padding: 4px 8px; border-radius: 6px; }
  @media print { .card { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Stock photo review</h1>
  <p class="meta">Query: <strong>${escHtml(query)}</strong> · Generated ${escHtml(generatedAt)} · Shutterstock / Pexels / Unsplash preview URLs only</p>
  ${err('Shutterstock', errS)}
  <section>
    <h2>Shutterstock</h2>
    <div class="grid">${shutterBlocks || '<p class="meta">No rows</p>'}</div>
  </section>
  ${err('Pexels', errP)}
  <section>
    <h2>Pexels</h2>
    <div class="grid">${pexelsBlocks || '<p class="meta">No rows</p>'}</div>
  </section>
  ${err('Unsplash', errU)}
  <section>
    <h2>Unsplash</h2>
    <div class="grid">${unsplashBlocks || '<p class="meta">No rows</p>'}</div>
  </section>
</body>
</html>`
}

/** Loading placeholder — the shadcn Skeleton's shape and pulse, on admin tokens. */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={className ? `animate-pulse rounded-md ${className}` : 'animate-pulse rounded-md'}
      style={{ background: 'var(--a-inset)' }}
    />
  )
}

/** A per-source result count (or "!"): DATA, so never StateWord. */
function CountChip({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <span
      className="a-num"
      style={{
        fontSize: 'var(--a-text-xs)',
        fontWeight: 600,
        borderRadius: 'var(--a-r-sm)',
        padding: '1px 6px',
        background: tone === 'danger' ? 'var(--a-danger-wash)' : 'var(--a-inset)',
        color: tone === 'danger' ? 'var(--a-danger)' : 'var(--a-text-2)',
      }}
    >
      {children}
    </span>
  )
}

export default function StockPhotosPicker() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(false)
  const [unsplash, setUnsplash] = useState<UnsplashRow[]>([])
  const [shutter, setShutter] = useState<ShutterRow[]>([])
  const [pexels, setPexels] = useState<PexelsRow[]>([])
  const [errU, setErrU] = useState<string | null>(null)
  const [errS, setErrS] = useState<string | null>(null)
  const [errP, setErrP] = useState<string | null>(null)
  const [tab, setTab] = useState<'shutterstock' | 'pexels' | 'unsplash'>('shutterstock')
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})

  const searchWithQuery = useCallback(async (raw: string) => {
    setLoading(true)
    setErrU(null)
    setErrS(null)
    setErrP(null)
    setShowAll({})
    const q = encodeURIComponent(raw.trim() || DEFAULT_QUERY)
    try {
      const [sRes, pRes, uRes] = await Promise.all([
        fetch(`/api/admin/stock/shutterstock/search?query=${q}&per_page=12`, { credentials: 'include' }),
        fetch(`/api/admin/stock/pexels/search?query=${q}&per_page=12`, { credentials: 'include' }),
        fetch(`/api/admin/stock/unsplash/search?query=${q}&count=10`, { credentials: 'include' }),
      ])
      const sJson = (await sRes.json().catch(() => ({}))) as {
        error?: string
        data?: ShutterRow[]
      }
      const pJson = (await pRes.json().catch(() => ({}))) as {
        error?: string
        data?: PexelsRow[]
      }
      const uJson = (await uRes.json().catch(() => ({}))) as {
        error?: string
        data?: UnsplashRow[]
      }
      if (!sRes.ok) setErrS(sJson.error ?? `Shutterstock HTTP ${sRes.status}`)
      else setShutter(sJson.data ?? [])
      if (!pRes.ok) setErrP(pJson.error ?? `Pexels HTTP ${pRes.status}`)
      else setPexels(pJson.data ?? [])
      if (!uRes.ok) setErrU(uJson.error ?? `Unsplash HTTP ${uRes.status}`)
      else setUnsplash(uJson.data ?? [])
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setErrS(m)
      setErrP(m)
      setErrU(m)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void searchWithQuery(DEFAULT_QUERY)
  }, [searchWithQuery])

  const runSearch = () => void searchWithQuery(query)

  const openHtmlReview = () => {
    const html = buildStockReviewHtml({
      query: query.trim() || DEFAULT_QUERY,
      generatedAt: new Date().toISOString(), // hydration-safe: click handler, never a render body
      shutter,
      pexels,
      unsplash,
      errS,
      errP,
      errU,
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  }

  const totalResults = shutter.length + pexels.length + unsplash.length
  const hasAnyResult = totalResults > 0

  const sources = useMemo(
    () =>
      [
        { key: 'shutterstock' as const, label: 'Shutterstock', count: shutter.length, err: errS },
        { key: 'pexels' as const, label: 'Pexels', count: pexels.length, err: errP },
        { key: 'unsplash' as const, label: 'Unsplash', count: unsplash.length, err: errU },
      ],
    [shutter.length, pexels.length, unsplash.length, errS, errP, errU],
  )

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <EntityTitle>Stock photos</EntityTitle>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          One search across <strong>Shutterstock</strong>, <strong>Pexels</strong>, and <strong>Unsplash</strong>. Pick by code
          (<strong>S-…</strong>, <strong>P1</strong>, <strong>U1</strong>). Shutterstock still needs per-image licensing before publish.
        </p>
      </div>

      {/* Search bar */}
      <div className="av2-pane">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            runSearch()
          }}
        >
          <div className="min-w-0 flex-1">
            <TextField
              label="Search query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Sunriver Oregon mountain"
              enterKeyHint="search"
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:shrink-0">
            <Button type="submit" touch disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Searching…' : 'Search'}
            </Button>
            <Button
              type="button"
              variant="quiet"
              touch
              onClick={openHtmlReview}
              disabled={loading || !hasAnyResult}
              className="w-full sm:w-auto"
            >
              HTML review
            </Button>
          </div>
        </form>
      </div>

      {/* Glanceable summary */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
        style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}
      >
        {loading ? (
          <span>Searching all sources…</span>
        ) : hasAnyResult ? (
          <>
            <span className="a-num" style={{ fontWeight: 500, color: 'var(--a-text)' }}>{totalResults} results</span>
            <span aria-hidden>·</span>
            <span className="a-num">{shutter.length} Shutterstock</span>
            <span aria-hidden>·</span>
            <span className="a-num">{pexels.length} Pexels</span>
            <span aria-hidden>·</span>
            <span className="a-num">{unsplash.length} Unsplash</span>
          </>
        ) : (
          <span>No results yet. Run a search above.</span>
        )}
      </div>

      {/* Source tabs — one list at a time, each capped + expandable */}
      <div className="flex flex-col gap-4">
        <div className="flex w-full flex-wrap justify-start gap-1" role="group" aria-label="Stock source">
          {sources.map((s) => {
            const active = tab === s.key
            return (
              <Button
                key={s.key}
                variant="quiet"
                type="button"
                aria-pressed={active}
                onClick={() => setTab(s.key)}
                className="h-9 gap-1.5"
                // The pressed look comes from
                // .av2-btn--quiet[aria-pressed="true"] in admin-v2.css, NOT from
                // an inline style: inline outranks the :hover rule, which froze
                // the selected tab while every inactive sibling still responded.
                style={active ? { fontWeight: 600 } : { color: 'var(--a-text-2)' }}
              >
                {s.label}
                {!loading && (
                  <CountChip tone={s.err ? 'danger' : 'neutral'}>{s.err ? '!' : s.count}</CountChip>
                )}
              </Button>
            )
          })}
        </div>

        {tab === 'shutterstock' && (
          <SourceGrid
            empty="No results, or Shutterstock keys are missing. Check SHUTTERSTOCK_* env vars, then search again."
            error={errS}
            loading={loading}
            count={shutter.length}
            showAll={showAll.shutterstock ?? false}
            onToggle={() => setShowAll((p) => ({ ...p, shutterstock: !p.shutterstock }))}
          >
            {shutter.slice(0, showAll.shutterstock ? shutter.length : CAP).map((row) => (
              <PhotoCard
                key={row.id}
                code={`S-${row.id}`}
                imgSrc={row.previewUrl || row.thumbUrl}
                alt={row.description ?? ''}
              >
                <p className="line-clamp-3" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {row.description ?? '—'}
                </p>
              </PhotoCard>
            ))}
          </SourceGrid>
        )}

        {tab === 'pexels' && (
          <SourceGrid
            empty="No results, or PEXELS_API_KEY is not set. Add it to the env, then search again."
            error={errP}
            loading={loading}
            count={pexels.length}
            showAll={showAll.pexels ?? false}
            onToggle={() => setShowAll((p) => ({ ...p, pexels: !p.pexels }))}
          >
            {pexels.slice(0, showAll.pexels ? pexels.length : CAP).map((row, i) => (
              <PhotoCard key={row.id} code={`P${i + 1}`} imgSrc={row.thumbUrl || row.url} alt="">
                <div className="space-y-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  <p>
                    <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>id</span>{' '}
                    <span className="a-num">{row.id}</span>
                  </p>
                  <p>
                    Photo by{' '}
                    <a
                      href={row.photographerUrl}
                      className="underline"
                      style={{ color: 'var(--a-accent)' }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {row.photographer}
                    </a>{' '}
                    on Pexels
                  </p>
                </div>
              </PhotoCard>
            ))}
          </SourceGrid>
        )}

        {tab === 'unsplash' && (
          <SourceGrid
            empty="No results, or the Unsplash key needs attention. Check UNSPLASH_ACCESS_KEY, then search again."
            error={errU}
            loading={loading}
            count={unsplash.length}
            showAll={showAll.unsplash ?? false}
            onToggle={() => setShowAll((p) => ({ ...p, unsplash: !p.unsplash }))}
          >
            {unsplash.slice(0, showAll.unsplash ? unsplash.length : CAP).map((row, i) => (
              <PhotoCard key={`${row.url}-${i}`} code={`U${i + 1}`} imgSrc={row.thumbUrl || row.url} alt="">
                <div className="space-y-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {row.id && (
                    <p>
                      <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>id</span> {row.id}
                    </p>
                  )}
                  <p>{row.attribution}</p>
                  {row.sourceUrl && (
                    <a
                      href={row.sourceUrl}
                      className="underline"
                      style={{ color: 'var(--a-accent)' }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Profile ↗
                    </a>
                  )}
                </div>
              </PhotoCard>
            ))}
          </SourceGrid>
        )}
      </div>
    </div>
  )
}

const CAP = 6

function PhotoCard({
  code,
  imgSrc,
  alt,
  children,
}: {
  code: string
  imgSrc: string | null | undefined
  alt: string
  children: ReactNode
}) {
  return (
    <li>
      <div
        className="flex h-full flex-col overflow-hidden"
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-bg)',
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-1.5"
          style={{ background: 'var(--a-inset)' }}
        >
          <span style={{ fontSize: 'var(--a-text-xs)', fontWeight: 600, color: 'var(--a-text-2)' }}>
            {code}
          </span>
        </div>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={alt} className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="flex aspect-video items-center justify-center"
            style={{ background: 'var(--a-inset)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          >
            No preview
          </div>
        )}
        <div className="p-3">{children}</div>
      </div>
    </li>
  )
}

function SourceGrid({
  loading,
  error,
  count,
  empty,
  showAll,
  onToggle,
  children,
}: {
  loading: boolean
  error: string | null
  count: number
  empty: string
  showAll: boolean
  onToggle: () => void
  children: ReactNode
}) {
  if (loading) {
    return (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <div
              className="flex flex-col overflow-hidden"
              style={{
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-lg)',
                background: 'var(--a-bg)',
              }}
            >
              <Shimmer className="h-6 w-full rounded-none" />
              <Shimmer className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Shimmer className="h-3 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (error) {
    return (
      <div className="av2-pane">
        <div className="space-y-1 py-8 text-center">
          <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>
            Couldn&apos;t load this source
          </p>
          <p
            className="mx-auto max-w-md"
            style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}
          >
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (count === 0) {
    return (
      <div className="av2-pane">
        <div
          className="py-10 text-center"
          style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}
        >
          <p className="mx-auto max-w-md">{empty}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">{children}</ul>
      {count > CAP && (
        <div className="flex justify-center">
          <Button variant="quiet" touch onClick={onToggle}>
            {showAll ? 'Show fewer' : `See all ${count} →`}
          </Button>
        </div>
      )}
    </div>
  )
}
