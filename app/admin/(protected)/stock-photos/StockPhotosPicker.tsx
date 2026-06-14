'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  :root { font-family: Geist, sans-serif; color: rgb(16, 39, 66); background: rgb(250, 248, 244); }
  body { margin: 0; padding: 12px max(12px, env(safe-area-inset-right)) 24px max(12px, env(safe-area-inset-left)); max-width: 1200px; margin-inline: auto; }
  h1 { font-size: 1.35rem; margin: 0 0 8px; }
  @media (min-width: 640px) { h1 { font-size: 1.5rem; } }
  .meta { color: rgb(16 39 66 / 0.6); font-size: 0.875rem; margin-bottom: 24px; }
  section { margin-bottom: 40px; }
  h2 { font-size: 1.15rem; border-bottom: 1px solid rgb(16 39 66 / 0.12); padding-bottom: 6px; }
  .grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .grid { gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); } }
  .card { border: 1px solid rgb(16 39 66 / 0.1); border-radius: 10px; overflow: hidden; background: rgb(255, 255, 255); box-shadow: 0 1px 2px rgb(16 39 66 / 0.08); }
  .code { font-size: 12px; font-weight: 600; padding: 6px 10px; background: rgb(16 39 66 / 0.05); color: rgb(16 39 66 / 0.7); }
  .card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
  .noimg { aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; background: rgb(16 39 66 / 0.05); font-size: 12px; color: rgb(16 39 66 / 0.6); }
  .cap { padding: 10px; font-size: 12px; color: rgb(16 39 66 / 0.7); line-height: 1.45; }
  .cap a { color: rgb(16, 39, 66); }
  .err { color: rgb(185, 28, 28); font-size: 13px; }
  @media print { body { background: rgb(255, 255, 255); } .card { break-inside: avoid; } }
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
      generatedAt: new Date().toISOString(),
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
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Stock photos</h1>
        <p className="text-sm text-muted-foreground">
          One search across <strong>Shutterstock</strong>, <strong>Pexels</strong>, and <strong>Unsplash</strong>. Pick by code
          (<strong>S-…</strong>, <strong>P1</strong>, <strong>U1</strong>). Shutterstock still needs per-image licensing before publish.
        </p>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="p-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              runSearch()
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="stock-query">Search query</Label>
              <Input
                id="stock-query"
                className="h-11 text-base sm:h-9 sm:text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Sunriver Oregon mountain"
                enterKeyHint="search"
              />
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:shrink-0">
              <Button type="submit" size="lg" disabled={loading} className="h-11 w-full sm:w-auto">
                {loading ? 'Searching…' : 'Search'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={openHtmlReview}
                disabled={loading || !hasAnyResult}
                className="h-11 w-full sm:w-auto"
              >
                HTML review
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Glanceable summary */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {loading ? (
          <span>Searching all sources…</span>
        ) : hasAnyResult ? (
          <>
            <span className="font-medium text-foreground tabular-nums">{totalResults} results</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{shutter.length} Shutterstock</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{pexels.length} Pexels</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{unsplash.length} Unsplash</span>
          </>
        ) : (
          <span>No results yet. Run a search above.</span>
        )}
      </div>

      {/* Source tabs — one list at a time, each capped + expandable */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-4">
        <TabsList className="h-auto w-full justify-start gap-1 p-1">
          {sources.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="h-9 gap-1.5">
              {s.label}
              {!loading && (
                <Badge variant={s.err ? 'destructive' : 'soft-neutral'} className="tabular-nums">
                  {s.err ? '!' : s.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="shutterstock">
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
                <p className="line-clamp-3 text-xs text-muted-foreground">{row.description ?? '—'}</p>
              </PhotoCard>
            ))}
          </SourceGrid>
        </TabsContent>

        <TabsContent value="pexels">
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
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">id</span> <span className="tabular-nums">{row.id}</span>
                  </p>
                  <p>
                    Photo by{' '}
                    <a href={row.photographerUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                      {row.photographer}
                    </a>{' '}
                    on Pexels
                  </p>
                </div>
              </PhotoCard>
            ))}
          </SourceGrid>
        </TabsContent>

        <TabsContent value="unsplash">
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
                <div className="space-y-1 text-xs text-muted-foreground">
                  {row.id && (
                    <p>
                      <span className="font-medium text-foreground">id</span> {row.id}
                    </p>
                  )}
                  <p>{row.attribution}</p>
                  {row.sourceUrl && (
                    <a href={row.sourceUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                      Profile ↗
                    </a>
                  )}
                </div>
              </PhotoCard>
            ))}
          </SourceGrid>
        </TabsContent>
      </Tabs>
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
      <Card size="sm" className="h-full gap-0">
        <div className="flex items-center justify-between gap-2 bg-muted px-3 py-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{code}</span>
        </div>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={alt} className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">
            No preview
          </div>
        )}
        <CardContent className="p-3">{children}</CardContent>
      </Card>
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
            <Card size="sm" className="gap-0">
              <Skeleton className="h-6 w-full rounded-none" />
              <Skeleton className="aspect-video w-full rounded-none" />
              <CardContent className="space-y-2 p-3">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-destructive">Couldn&apos;t load this source</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (count === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <p className="mx-auto max-w-md">{empty}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">{children}</ul>
      {count > CAP && (
        <div className="flex justify-center">
          <Button variant="outline" size="lg" className="h-11" onClick={onToggle}>
            {showAll ? 'Show fewer' : `See all ${count} →`}
          </Button>
        </div>
      )}
    </div>
  )
}
