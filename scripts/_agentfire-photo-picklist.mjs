#!/usr/bin/env node
/**
 * Build a visual pick-list (HTML contact sheet) of the real PHOTOS pulled from
 * the old AgentFire site, so Matt can eyeball them and call out keepers.
 *
 * Drops: WordPress -WxH thumbnails, WPL/ listing photos, nsl_avatars/, and
 * obvious icons/logos/brand graphics. Keeps full-size photographs, grouped by
 * source folder, each numbered for easy reference.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.join(process.cwd(), 'out/agentfire-media')
const UPLOADS = path.join(ROOT, 'wp-content/uploads')
const HTML_OUT = path.join(ROOT, 'PHOTO-PICKLIST.html')

const IMG_RE = /\.(jpe?g|png|webp|gif|svg)$/i
const THUMB_RE = /-\d+x\d+\.\w+$/i
const GRAPHIC_NAME_RE = /(icon|favicon|logo|brand|avatar|sprite|placeholder|pattern|loader|spinner|divider|badge|bullet|watermark|stamp|button|bg-pattern|apple-touch)/i

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

// dimensions for many files in one sips call (chunked); svg skipped
function dimsFor(files) {
  const map = new Map()
  const chunkSize = 150
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize).filter((f) => !/\.svg$/i.test(f))
    if (!chunk.length) continue
    let out = ''
    try {
      out = execSync(`sips -g pixelWidth -g pixelHeight ${chunk.map((f) => JSON.stringify(f)).join(' ')}`, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    } catch (e) {
      out = e.stdout || ''
    }
    let cur = null
    for (const line of out.split('\n')) {
      if (line.startsWith('/')) cur = line.trim()
      else if (cur) {
        const w = line.match(/pixelWidth:\s*(\d+)/)
        const h = line.match(/pixelHeight:\s*(\d+)/)
        const d = map.get(cur) || {}
        if (w) d.w = +w[1]
        if (h) d.h = +h[1]
        map.set(cur, d)
      }
    }
  }
  return map
}

const all = walk(UPLOADS).filter((f) => IMG_RE.test(f))

// exclusions
const kept = all.filter((f) => {
  const rel = f.slice(UPLOADS.length + 1)
  if (THUMB_RE.test(f)) return false // -WxH thumbnail
  if (/^WPL\//i.test(rel)) return false // listing photos
  if (/^nsl_avatars\//i.test(rel)) return false // social-login avatars
  return true
})

const dims = dimsFor(kept)

const items = kept.map((f) => {
  const rel = path.relative(ROOT, f) // wp-content/uploads/...
  const folderRel = path.relative(UPLOADS, path.dirname(f)) // 2022/11, elementor, ...
  const top = folderRel.split(path.sep)[0] || '.'
  const name = path.basename(f)
  const d = dims.get(f) || {}
  const maxDim = Math.max(d.w || 0, d.h || 0)
  const size = fs.statSync(f).size
  const isSvg = /\.svg$/i.test(f)
  let kind
  // Logos/icons are caught by name at any size; the size floor only drops tiny
  // UI sprites. Be inclusive — a real area photo at ~600px should land in photos.
  if (isSvg || GRAPHIC_NAME_RE.test(name)) kind = 'graphic'
  else if (maxDim >= 400) kind = 'photo'
  else if (maxDim === 0) kind = size > 80 * 1024 ? 'photo' : 'graphic' // unknown dims: judge by weight
  else kind = 'graphic'
  return { f, rel, top, name, w: d.w, h: d.h, maxDim, size, kind }
})

const photos = items.filter((i) => i.kind === 'photo')
const graphics = items.filter((i) => i.kind === 'graphic')

// group photos: elementor (backgrounds) first, then by year desc, then misc
function groupName(top) {
  if (top === 'elementor') return '1 · Backgrounds & page imagery (elementor)'
  if (/^\d{4}$/.test(top)) return `Year ${top}`
  return `Other · ${top}`
}
const photoGroups = {}
for (const p of photos) (photoGroups[groupName(p.top)] ||= []).push(p)
const orderedGroupKeys = Object.keys(photoGroups).sort((a, b) => {
  const ay = (a.match(/Year (\d{4})/) || [])[1]
  const by = (b.match(/Year (\d{4})/) || [])[1]
  if (a.startsWith('1 ·')) return -1
  if (b.startsWith('1 ·')) return 1
  if (ay && by) return by - ay
  return a.localeCompare(b)
})

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB')

let n = 0
function card(it) {
  n++
  const dimStr = it.w && it.h ? `${it.w}×${it.h}` : 'dims n/a'
  return `<figure class="card" id="n${n}">
    <div class="num">${n}</div>
    <a href="${esc(it.rel)}" target="_blank"><img loading="lazy" src="${esc(it.rel)}" alt="${esc(it.name)}"></a>
    <figcaption><b>#${n}</b> · ${dimStr} · ${kb(it.size)}<br><span class="fn">${esc(it.name)}</span></figcaption>
  </figure>`
}

let body = ''
body += `<h2>Photos — ${photos.length}</h2>`
for (const g of orderedGroupKeys) {
  const arr = photoGroups[g].sort((a, b) => b.maxDim - a.maxDim)
  body += `<h3>${esc(g)} <span class="count">(${arr.length})</span></h3><div class="grid">`
  for (const it of arr) body += card(it)
  body += `</div>`
}
body += `<h2 class="muted">Probably not photos — logos / icons / graphics (${graphics.length})</h2>
<p class="muted">Skim in case one is wanted. These are small images, SVGs, or files named like icon/logo/brand/avatar.</p><div class="grid small">`
for (const it of graphics.sort((a, b) => b.maxDim - a.maxDim)) body += card(it)
body += `</div>`

const html = `<!doctype html><html><head><meta charset="utf-8"><title>AgentFire photos — pick list</title>
<style>
  :root{font-family:-apple-system,Segoe UI,Roboto,sans-serif}
  body{margin:0;background:#faf8f4;color:#102742}
  header{position:sticky;top:0;background:#102742;color:#fff;padding:14px 20px;z-index:5}
  header b{font-size:18px} header p{margin:4px 0 0;font-size:13px;opacity:.85}
  h2{margin:26px 20px 6px} h3{margin:18px 20px 8px;font-weight:600}
  .count,.muted{color:#6b7280} h2.muted{color:#6b7280}
  p.muted{margin:0 20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:8px 20px 24px}
  .grid.small{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
  .card{margin:0;background:#fff;border:1px solid rgba(16,39,66,.1);border-radius:10px;overflow:hidden;position:relative}
  .card img{display:block;width:100%;height:180px;object-fit:cover;background:#eee}
  .grid.small .card img{height:110px}
  .num{position:absolute;top:6px;left:6px;background:rgba(16,39,66,.85);color:#fff;font-weight:700;font-size:12px;padding:2px 7px;border-radius:6px}
  figcaption{padding:6px 8px;font-size:11px;line-height:1.35}
  .fn{color:#6b7280;word-break:break-all}
</style></head>
<body>
<header><b>Old AgentFire photos — pick list</b><p>${photos.length} photos + ${graphics.length} graphics. Tell me the numbers you want (e.g. "keep 3, 7, 12–15, 40" or "drop the graphics section"). Click any image to open full size.</p></header>
${body}
</body></html>`

fs.writeFileSync(HTML_OUT, html)
console.log(`PHOTOS: ${photos.length}  |  GRAPHICS: ${graphics.length}  |  total kept: ${items.length}  (excluded thumbnails/WPL/avatars)`)
console.log('photo groups:')
for (const g of orderedGroupKeys) console.log(`  ${g}: ${photoGroups[g].length}`)
console.log('\nsample photos:')
photos.sort((a, b) => b.maxDim - a.maxDim).slice(0, 12).forEach((p) => console.log(`  ${p.w}x${p.h}  ${kb(p.size).padStart(8)}  ${p.top}/${p.name}`))
console.log('\nsample graphics (excluded from photos):')
graphics.slice(0, 12).forEach((p) => console.log(`  ${p.w || '?'}x${p.h || '?'}  ${p.name}`))
console.log(`\nHTML: ${HTML_OUT}`)
