'use client'

import { useCallback, useEffect, useState } from 'react'

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
  :root { font-family: ui-sans-serif, system-ui, sans-serif; color: #111; background: #fafafa; }
  body { margin: 0; padding: 12px max(12px, env(safe-area-inset-right)) 24px max(12px, env(safe-area-inset-left)); max-width: 1200px; margin-inline: auto; }
  h1 { font-size: 1.35rem; margin: 0 0 8px; }
  @media (min-width: 640px) { h1 { font-size: 1.5rem; } }
  .meta { color: #555; font-size: 0.875rem; margin-bottom: 24px; }
  section { margin-bottom: 40px; }
  h2 { font-size: 1.15rem; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  .grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .grid { gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); } }
  .card { border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 06%); }
  .code { font-size: 12px; font-weight: 600; padding: 6px 10px; background: #f4f4f5; color: #52525b; }
  .card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
  .noimg { aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; background: #f4f4f5; font-size: 12px; color: #71717a; }
  .cap { padding: 10px; font-size: 12px; color: #52525b; line-height: 1.45; }
  .cap a { color: #2563eb; }
  .err { color: #b91c1c; font-size: 13px; }
  @media print { body { background: #fff; } .card { break-inside: avoid; } }
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

  const searchWithQuery = useCallback(async (raw: string) => {
    setLoading(true)
    setErrU(null)
    setErrS(null)
    setErrP(null)
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Stock photos</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:hidden">
          Shutterstock, Pexels, Unsplash — same search. Codes <strong>S-…</strong> <strong>P1</strong> <strong>U1</strong>.
        </p>
        <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
          Same search against <strong>Shutterstock</strong>, <strong>Pexels</strong>, and <strong>Unsplash</strong> (server keys —{' '}
          <code className="rounded bg-muted px-1">SHUTTERSTOCK_*</code>, <code className="rounded bg-muted px-1">PEXELS_API_KEY</code>,{' '}
          <code className="rounded bg-muted px-1">UNSPLASH_ACCESS_KEY</code>). Pick codes: <strong>S-…</strong>, <strong>P1</strong>,{' '}
          <strong>U1</strong>. Shutterstock still needs per-image licensing before publish.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-foreground">
          Search query
          <input
            className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm sm:text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Sunriver Oregon mountain"
            enterKeyHint="search"
          />
        </label>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:shrink-0">
          <button
            type="button"
            onClick={runSearch}
            disabled={loading}
            className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {loading ? 'Loading…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={openHtmlReview}
            disabled={loading}
            className="min-h-11 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50 sm:w-auto"
          >
            HTML review
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Shutterstock</h2>
        {errS && <p className="text-sm text-destructive">{errS}</p>}
        {!errS && shutter.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No results or keys missing.</p>
        )}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {shutter.map((row) => (
            <li key={row.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">S-{row.id}</div>
              {row.previewUrl || row.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.previewUrl || row.thumbUrl || ''}
                  alt={row.description ?? ''}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted text-xs">No preview</div>
              )}
              <p className="line-clamp-3 p-2 text-xs text-muted-foreground">{row.description ?? '—'}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Pexels</h2>
        {errP && <p className="text-sm text-destructive">{errP}</p>}
        {!errP && pexels.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No results or set PEXELS_API_KEY in env.</p>
        )}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {pexels.map((row, i) => (
            <li
              key={row.id}
              className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">P{i + 1}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.thumbUrl || row.url} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-2 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">id</span> {row.id}
                </p>
                <p>
                  Photo by{' '}
                  <a href={row.photographerUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                    {row.photographer}
                  </a>{' '}
                  on Pexels
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Unsplash</h2>
        {errU && <p className="text-sm text-destructive">{errU}</p>}
        {!errU && unsplash.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No results or fix Unsplash key.</p>
        )}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {unsplash.map((row, i) => (
            <li
              key={`${row.url}-${i}`}
              className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">U{i + 1}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.thumbUrl || row.url} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-2 text-xs text-muted-foreground">
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
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
