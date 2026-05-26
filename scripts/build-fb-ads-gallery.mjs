#!/usr/bin/env node
/**
 * build-fb-ads-gallery.mjs
 *
 * Reads out/design-recon/fb-lead-gen-ad/raw.json (built by
 * pull-fb-ads-recon.mjs) and emits gallery.html — a visual grid of
 * competitor FB ads with images, copy, CTAs, and click-throughs to live
 * Ad Library URLs.
 *
 * Designed for fast browsing in any browser tab.
 *
 * Usage:
 *   node scripts/build-fb-ads-gallery.mjs
 *   open out/design-recon/fb-lead-gen-ad/gallery.html
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'out', 'design-recon', 'fb-lead-gen-ad')

const raw = JSON.parse(await readFile(path.join(OUT_DIR, 'raw.json'), 'utf8'))

// Classify each ad as seller-gen vs listing/buyer-gen. Same logic as the
// inline analysis in `docs/SELLER_ACQUISITION_STRATEGY.md`.
const sellerSignals = [
  { re: /what is your home worth|whats your home worth|what.s your home worth/i, w: 5 },
  { re: /home value(?:ation)?|home worth/i, w: 4 },
  { re: /thinking (?:about|of) selling|considering selling|ready to sell/i, w: 5 },
  { re: /sell(?:ing)? your home|list your home/i, w: 4 },
  { re: /free (?:cma|home (?:value|estimate|valuation))|instant.{0,10}value/i, w: 5 },
  { re: /how much (?:is|equity)/i, w: 3 },
  { re: /just sold/i, w: 3 },
  { re: /sold (?:over|above) ask|sold for [\$0-9]+|days on market/i, w: 3 },
  { re: /market report|market update/i, w: 2 },
  { re: /list with us|list with me/i, w: 4 },
]
function sellerScore(it) {
  const body = it.snapshot?.body?.text || ''
  const cta = it.snapshot?.ctaText || ''
  const link = (it.snapshot?.linkUrl || '').toLowerCase()
  let score = 0
  for (const sig of sellerSignals) {
    if (sig.re.test(body)) score += sig.w
    if (sig.re.test(cta)) score += sig.w
  }
  if (/seller|valuation|home-value|cma|sell-your|home-worth|sellmyhome/i.test(link)) score += 3
  if (/\d+ ?(?:br|bd|bed)|\d+ ?(?:ba|bath)|\d+ acres|\d+ sq\.? ?ft/i.test(body)) score -= 2
  return score
}
for (const it of raw) {
  it._seller_score = sellerScore(it)
  it._is_seller_gen = it._seller_score >= 3
}
const sellerCount = raw.filter(it => it._is_seller_gen).length
const sellerRealCount = raw.filter(it => it._is_seller_gen && !it._is_ad_platform).length

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function htmlForAd(it) {
  const broker = it._page_name || it.snapshot?.pageName || it.pageName || '?'
  const days = (it._age_days ?? 0).toFixed(0)
  const fmt = it.snapshot?.displayFormat || '?'
  const cta = it.snapshot?.ctaText || ''
  const body = (it.snapshot?.body?.text || '').replace(/\n/g, ' ')
  const link = it._ad_library_url || `https://www.facebook.com/ads/library/?id=${it.adArchiveID || it.adArchiveId}`
  const landingUrl = it.snapshot?.linkUrl || ''
  const startDate = it.startDateFormatted ? new Date(it.startDateFormatted).toISOString().slice(0, 10) : ''
  const localImg = it._local_image || ''

  // Try multiple image URLs in priority order
  const images = it.snapshot?.images || []
  const cards = it.snapshot?.cards || []
  const videoThumb = it.snapshot?.videos?.[0]?.video_preview_image_url
  const cdnUrls = []
  for (const img of images) {
    if (img.originalImageUrl) cdnUrls.push(img.originalImageUrl)
    if (img.resizedImageUrl) cdnUrls.push(img.resizedImageUrl)
  }
  for (const c of cards) {
    if (c.original_image_url) cdnUrls.push(c.original_image_url)
    if (c.resized_image_url) cdnUrls.push(c.resized_image_url)
  }
  if (videoThumb) cdnUrls.push(videoThumb)

  const isCO = it._is_central_oregon ? 'co' : ''
  const isPlatform = it._is_ad_platform ? 'platform' : ''
  const isSeller = it._is_seller_gen ? 'seller' : ''
  const dataAttrs = `data-co="${isCO ? 1 : 0}" data-platform="${isPlatform ? 1 : 0}" data-seller="${isSeller ? 1 : 0}" data-fmt="${escapeHtml(fmt)}" data-broker="${escapeHtml(broker.toLowerCase())}" data-days="${days}"`

  // Image fallback chain: try CDN URLs, then local downloaded thumb, then placeholder
  const imgHtml = cdnUrls.length > 0 ? `
    <div class="thumb">
      <img src="${escapeHtml(cdnUrls[0])}"
           data-fallbacks='${escapeHtml(JSON.stringify(cdnUrls.slice(1)))}'
           ${localImg ? `data-local="${escapeHtml(localImg)}"` : ''}
           loading="lazy"
           onerror="onImgError(this)" />
      <div class="format-badge">${escapeHtml(fmt)}</div>
    </div>
  ` : `<div class="thumb no-image"><span>${escapeHtml(fmt)}</span><div class="format-badge">${escapeHtml(fmt)}</div></div>`

  return `
    <article class="ad-card ${isCO} ${isPlatform} ${isSeller}" ${dataAttrs}>
      ${imgHtml}
      <div class="meta">
        <div class="header">
          <span class="broker" title="${escapeHtml(broker)}">${escapeHtml(broker.slice(0, 50))}</span>
          <span class="days" title="Days ad has been active on Meta">${days}d</span>
        </div>
        <p class="body">${escapeHtml(body.slice(0, 300))}${body.length > 300 ? '…' : ''}</p>
        ${cta ? `<div class="cta">${escapeHtml(cta)}</div>` : ''}
        <div class="footer">
          ${startDate ? `<span class="date">started ${startDate}</span>` : ''}
          <div class="links">
            <a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="live">view on Meta ↗</a>
            ${landingUrl ? `<a href="${escapeHtml(landingUrl)}" target="_blank" rel="noopener" class="lp">landing page ↗</a>` : ''}
          </div>
        </div>
      </div>
    </article>
  `
}

// Sort: Seller-gen first (Matt's primary need), then CO listing/buyer, then
// the rest of real brokerages by longevity.
const ordered = [...raw].sort((a, b) => {
  if (a._is_seller_gen !== b._is_seller_gen) return a._is_seller_gen ? -1 : 1
  if (a._is_central_oregon !== b._is_central_oregon) return a._is_central_oregon ? -1 : 1
  if (a._is_ad_platform !== b._is_ad_platform) return a._is_ad_platform ? 1 : -1
  return (b._age_days || 0) - (a._age_days || 0)
})

// Cap at top 500 — extra room so all seller-gen + all CO show even with cap
const cap = 500
const shown = ordered.slice(0, cap)
const coCount = ordered.filter(a => a._is_central_oregon).length
const realBrokerCount = ordered.filter(a => !a._is_ad_platform && !a._is_central_oregon).length

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FB Ads Library — Competitor Recon (Ryan Realty)</title>
<style>
  :root {
    --navy: #102742;
    --cream: #faf8f4;
    --ink: #1a1a1a;
    --muted: #6a7280;
    --border: rgba(16, 39, 66, 0.08);
    --shadow: 0 2px 8px rgba(16, 39, 66, 0.08);
    --shadow-hover: 0 6px 20px rgba(16, 39, 66, 0.14);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-feature-settings: "tnum" 1; }
  header {
    position: sticky; top: 0; z-index: 10;
    background: var(--cream);
    border-bottom: 1px solid var(--border);
    padding: 20px 32px 16px;
    box-shadow: 0 1px 0 var(--border);
  }
  h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: var(--navy); letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
  .controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .filter-group { display: flex; gap: 6px; }
  button {
    border: 1px solid var(--border); background: white; color: var(--ink);
    padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px;
    transition: all 0.15s ease;
  }
  button:hover { border-color: var(--navy); }
  button.active { background: var(--navy); color: white; border-color: var(--navy); }
  input.search {
    border: 1px solid var(--border); background: white; padding: 7px 12px;
    border-radius: 8px; font-size: 13px; min-width: 220px; font: inherit;
  }
  input.search:focus { outline: none; border-color: var(--navy); }
  .count { color: var(--muted); font-size: 13px; margin-left: auto; }
  main { padding: 24px 32px 60px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 18px;
  }
  .ad-card {
    background: white; border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column;
    transition: box-shadow 0.18s ease, transform 0.18s ease;
  }
  .ad-card:hover { box-shadow: var(--shadow-hover); transform: translateY(-2px); }
  .ad-card.co { border: 2px solid var(--navy); }
  .ad-card.co::before {
    content: "Central Oregon"; display: block;
    background: var(--navy); color: var(--cream);
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    text-align: center; padding: 4px 0; font-weight: 600;
  }
  .ad-card.seller { border: 2px solid #b8651b; }
  .ad-card.seller::before {
    content: "Seller-gen"; display: block;
    background: #b8651b; color: var(--cream);
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    text-align: center; padding: 4px 0; font-weight: 600;
  }
  .ad-card.seller.co::before {
    content: "Seller-gen · Central Oregon";
    background: linear-gradient(90deg, #b8651b 50%, var(--navy) 50%);
  }
  .thumb {
    position: relative; background: #e8e2d4; aspect-ratio: 1 / 1; overflow: hidden;
  }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb.no-image { display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; }
  .thumb.no-image span { background: rgba(16, 39, 66, 0.06); padding: 8px 14px; border-radius: 999px; font-weight: 500; }
  .format-badge {
    position: absolute; top: 8px; right: 8px;
    background: rgba(16, 39, 66, 0.85); color: var(--cream);
    font-size: 10px; padding: 3px 8px; border-radius: 4px;
    font-weight: 600; letter-spacing: 0.04em;
  }
  .meta { padding: 14px; display: flex; flex-direction: column; flex: 1; gap: 8px; }
  .header { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
  .broker { font-weight: 600; font-size: 13px; color: var(--navy); line-height: 1.3; }
  .days {
    flex-shrink: 0; background: rgba(16, 39, 66, 0.08); color: var(--navy);
    font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;
  }
  .body { margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink); flex: 1; }
  .cta {
    align-self: flex-start;
    background: var(--navy); color: var(--cream); font-size: 11px;
    padding: 4px 10px; border-radius: 4px; font-weight: 600;
    letter-spacing: 0.02em; text-transform: uppercase;
  }
  .footer { border-top: 1px solid var(--border); padding-top: 8px; margin-top: auto;
    font-size: 11px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
  .footer .links { display: flex; gap: 12px; }
  .footer a { color: var(--navy); text-decoration: none; font-weight: 500; }
  .footer a:hover { text-decoration: underline; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>Facebook Ads Library — Competitor Recon</h1>
  <div class="sub">Apify scrape May 18-26, 2026 · ${raw.length.toLocaleString()} unique ads · <strong>${sellerRealCount} seller-gen</strong> · <strong>${coCount} Central Oregon</strong> · showing top ${cap}</div>
  <div class="controls">
    <div class="filter-group">
      <button data-filter="seller" class="active">Seller-gen (${sellerRealCount})</button>
      <button data-filter="co">Central Oregon (${coCount})</button>
      <button data-filter="real">Real brokers (${realBrokerCount.toLocaleString()})</button>
      <button data-filter="all">All (${raw.length.toLocaleString()})</button>
    </div>
    <div class="filter-group">
      <button data-fmt="ALL" class="active">All formats</button>
      <button data-fmt="IMAGE">Image</button>
      <button data-fmt="VIDEO">Video</button>
      <button data-fmt="CAROUSEL">Carousel</button>
      <button data-fmt="DCO">DCO</button>
    </div>
    <input type="text" class="search" placeholder="Search broker or copy…" />
    <span class="count" id="visible-count">${coCount} visible</span>
  </div>
</header>
<main>
  <div class="grid" id="grid">
    ${shown.map(htmlForAd).join('')}
  </div>
</main>
<script>
  // Image fallback chain — try alternate CDN URLs, then local file, then hide
  function onImgError(img) {
    const fallbacks = JSON.parse(img.dataset.fallbacks || '[]')
    if (fallbacks.length > 0) {
      img.src = fallbacks.shift()
      img.dataset.fallbacks = JSON.stringify(fallbacks)
      return
    }
    const local = img.dataset.local
    if (local) {
      img.src = local
      img.dataset.local = ''
      return
    }
    // Final fallback: replace with a placeholder
    const parent = img.parentElement
    if (parent) {
      parent.classList.add('no-image')
      const fmt = parent.querySelector('.format-badge')?.textContent || '?'
      parent.innerHTML = '<span>' + fmt + ' · expired</span>' + (parent.querySelector('.format-badge')?.outerHTML || '')
    }
  }

  const grid = document.getElementById('grid')
  const cards = Array.from(grid.querySelectorAll('.ad-card'))
  const visibleCount = document.getElementById('visible-count')
  let filter = 'seller'  // seller | co | real | all
  let format = 'ALL'
  let search = ''

  function applyFilters() {
    let visible = 0
    for (const c of cards) {
      const isCO = c.dataset.co === '1'
      const isPlatform = c.dataset.platform === '1'
      const fmt = c.dataset.fmt
      const broker = c.dataset.broker
      const bodyText = c.querySelector('.body')?.textContent.toLowerCase() || ''

      const isSeller = c.dataset.seller === '1'
      let show = true
      if (filter === 'seller' && !isSeller) show = false
      if (filter === 'co' && !isCO) show = false
      if (filter === 'real' && isPlatform) show = false
      if (format !== 'ALL' && fmt !== format) show = false
      if (search && !broker.includes(search) && !bodyText.includes(search)) show = false

      c.classList.toggle('hidden', !show)
      if (show) visible++
    }
    visibleCount.textContent = visible + ' visible'
  }

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      filter = btn.dataset.filter
      applyFilters()
    })
  })
  document.querySelectorAll('[data-fmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-fmt]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      format = btn.dataset.fmt
      applyFilters()
    })
  })
  document.querySelector('.search').addEventListener('input', (e) => {
    search = e.target.value.toLowerCase().trim()
    applyFilters()
  })

  applyFilters()
</script>
</body>
</html>`

await writeFile(path.join(OUT_DIR, 'gallery.html'), html)
console.log(`✓ Built gallery.html — ${shown.length} cards`)
console.log(`  Central Oregon: ${coCount}`)
console.log(`  Real brokerages: ${realBrokerCount.toLocaleString()}`)
console.log(`  Total in dataset: ${raw.length.toLocaleString()}`)
console.log(`\nOpen: open ${path.relative(REPO_ROOT, path.join(OUT_DIR, 'gallery.html'))}`)
