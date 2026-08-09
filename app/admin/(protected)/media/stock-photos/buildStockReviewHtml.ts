/** Standalone stock-review HTML blob (system colors only). */
export type UnsplashRow = {
  id: string | null
  url: string
  thumbUrl: string
  attribution: string
  sourceUrl?: string
}

export type ShutterRow = {
  id: string
  description: string | null
  previewUrl: string | null
  thumbUrl: string | null
}

export type PexelsRow = {
  id: number
  url: string
  thumbUrl: string
  photographer: string
  photographerUrl: string
  width: number
  height: number
}

export const DEFAULT_QUERY = 'Three Sisters Oregon Cascade'

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function buildStockReviewHtml(args: {
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

