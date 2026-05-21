#!/usr/bin/env node
/**
 * Build the producer gallery — single page showing the real output of every
 * producer in scripts/run-producer.mjs::PRODUCERS, rendered at proper size
 * (matches the canonical 2026-05-14 contact-sheet style).
 *
 *   node scripts/build-producer-gallery.mjs
 *
 * Output: out/producer-gallery/index.html (single self-contained page that
 * references real artifacts via relative paths into out/<producer>/<slug>/...).
 *
 * What it shows per producer:
 *   - Producer name + script path
 *   - Section badge (A orchestrator / B content / C site / D ops / E comms / F analysis)
 *   - Pass/fail status from the latest test-all-producers run
 *   - The primary artifact embedded at proper size:
 *       MP4  → <video controls preload=none> at 9:16 380px (or 16:9 wide for landscape)
 *       PNG/JPG → <img class=post> at 480px max-width (or carousel grid if multiple)
 *       HTML → <iframe> at 600x600 reasonable preview
 *       MD/TXT → <pre class=caption> showing first 800 chars
 *       JSON → <pre> showing top-level keys + summary
 *       TSX/TS → <pre class=code> first 60 lines
 *   - Sidecar status (citations/provenance/scorecard/card all present + sizes)
 *   - Click-through link to the producer's full output folder
 */

import { readFile, readdir, stat, mkdir, writeFile, copyFile, cp } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PRODUCERS } from './producer-inventory.mjs'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..')
const FIXTURE = path.join(REPO_ROOT, 'tests/fixtures/producer-payload-tumalo.json')
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
const TARGET_SLUG = fixture.target_slug

const GALLERY_DIR = path.join(REPO_ROOT, 'out/producer-gallery')
await mkdir(GALLERY_DIR, { recursive: true })

// Section labels (per REGISTRY.md)
function inferSection(slug, scriptPath) {
  if (slug.startsWith('ops-')) return { id: 'D', label: 'Operational' }
  if (slug.startsWith('site-')) return { id: 'C', label: 'Site (PR)' }
  if (slug.startsWith('comms-')) return { id: 'E', label: 'Communications' }
  if (slug.startsWith('analyze-')) return { id: 'F', label: 'Analysis' }
  return { id: 'B', label: 'Content' }
}

// Latest test report (if available) for pass/fail status
let lastReport = {}
try {
  const r = JSON.parse(readFileSync(path.join(REPO_ROOT, 'out/test-all-producers-report.json'), 'utf8'))
  for (const result of r.results) lastReport[result.slug] = result
} catch {}

const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const VID_EXTS = new Set(['.mp4', '.mov'])
const TEXT_EXTS = new Set(['.md', '.txt'])
const JSON_EXTS = new Set(['.json'])
const CODE_EXTS = new Set(['.tsx', '.ts', '.mjs', '.html'])

async function fileSize(p) {
  try { const s = await stat(p); return s.isFile() ? s.size : 0 } catch { return -1 }
}

async function listOutputFiles(dir) {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    if (!e.isFile()) continue
    if (['card.json', 'citations.json', 'provenance.json', 'design_scorecard.json'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    const sz = await fileSize(p)
    if (sz > 0) files.push({ name: e.name, path: p, size: sz, ext: path.extname(e.name).toLowerCase() })
  }
  return files
}

function htmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtKb(n) { return n >= 1024*1024 ? `${(n/1024/1024).toFixed(1)} MB` : `${Math.round(n/1024)} KB` }

async function renderMediaForProducer(slug, outDir) {
  // Read card.json to know the primary artifact
  let card = {}
  try { card = JSON.parse(await readFile(path.join(outDir, 'card.json'), 'utf8')) } catch {}
  const files = await listOutputFiles(outDir)
  if (files.length === 0) return { html: '<div class="thumb-stub">No real output</div>', kind: 'stub' }

  // Find primary
  let primary = null
  if (card.primary_artifact) {
    const justName = path.isAbsolute(card.primary_artifact) ? path.basename(card.primary_artifact) : card.primary_artifact
    primary = files.find(f => f.name === justName) || null
  }
  if (!primary) primary = files[0]

  // PROMOTE preview.html — if the producer ships a rendered HTML preview
  // alongside a markdown primary, prefer the HTML in the gallery so Matt
  // sees the visual rendering, not the raw markdown text.
  const previewHtml = files.find(f => f.name === 'preview.html')
  if (previewHtml && primary.ext === '.md') {
    primary = previewHtml
  }

  const relTo = (p) => path.relative(GALLERY_DIR, p)

  if (VID_EXTS.has(primary.ext)) {
    // Video — 9:16 380px or 16:9 wide
    const isLandscape = primary.name.includes('youtube') || primary.name.includes('long_form') || primary.name.includes('clip-compilation')
    const sizeAttr = isLandscape ? 'style="aspect-ratio: 16/9; max-width: 560px;"' : 'style="aspect-ratio: 9/16; max-width: 320px;"'
    // Auto-pick a poster image: prefer frame1.png if present (most Remotion
    // comps ship the first frame as PNG), else any IMG_EXTS file. Without
    // a poster, browsers show a BLACK tile under preload="none". Matt
    // explicitly flagged this 2026-05-20: "the video tile is showing a
    // black first frame — should load with something to see."
    const posterFile = files.find(f => f.name.toLowerCase() === 'frame1.png')
      || files.find(f => f.name.toLowerCase().includes('poster'))
      || files.find(f => IMG_EXTS.has(f.ext) && !f.name.startsWith('frame'))
      || files.find(f => IMG_EXTS.has(f.ext))
    const posterAttr = posterFile ? ` poster="${htmlEscape(relTo(posterFile.path))}"` : ''
    return {
      kind: 'video',
      html: `<video class="reel" ${sizeAttr} controls preload="metadata" muted${posterAttr}><source src="${htmlEscape(relTo(primary.path))}" type="video/mp4"></video>`,
    }
  }

  if (IMG_EXTS.has(primary.ext)) {
    // Image — if multiple, show a grid
    const imageFiles = files.filter(f => IMG_EXTS.has(f.ext))
    if (imageFiles.length >= 4) {
      // Grid layout
      const cells = imageFiles.slice(0, 8).map((f, i) =>
        `<div class="slide-wrap"><span class="num">${i+1}</span><img src="${htmlEscape(relTo(f.path))}" alt="${htmlEscape(f.name)}" loading="lazy"></div>`
      ).join('')
      const cols = Math.min(imageFiles.length, 4)
      return {
        kind: 'image-grid',
        html: `<div class="carousel-grid" style="grid-template-columns: repeat(${cols}, 1fr);">${cells}</div>`,
      }
    }
    return {
      kind: 'image',
      html: `<img class="post" src="${htmlEscape(relTo(primary.path))}" alt="${htmlEscape(primary.name)}" loading="lazy">`,
    }
  }

  if (TEXT_EXTS.has(primary.ext)) {
    const content = (await readFile(primary.path, 'utf8')).slice(0, 1200)
    return {
      kind: 'text',
      html: `<pre class="caption">${htmlEscape(content)}${content.length >= 1200 ? '\n...(truncated)' : ''}</pre>`,
    }
  }

  if (primary.ext === '.html') {
    return {
      kind: 'html',
      html: `<iframe src="${htmlEscape(relTo(primary.path))}" loading="lazy" style="width: 100%; height: 600px; border: 1px solid var(--rule); background: white; border-radius: 4px;"></iframe>`,
    }
  }

  if (JSON_EXTS.has(primary.ext)) {
    try {
      const json = JSON.parse(await readFile(primary.path, 'utf8'))
      const pretty = JSON.stringify(json, null, 2).slice(0, 1500)
      return {
        kind: 'json',
        html: `<pre class="caption">${htmlEscape(pretty)}${pretty.length >= 1500 ? '\n...(truncated)' : ''}</pre>`,
      }
    } catch {
      return { kind: 'stub', html: '<div class="thumb-stub">JSON parse error</div>' }
    }
  }

  if (CODE_EXTS.has(primary.ext)) {
    const content = (await readFile(primary.path, 'utf8')).split('\n').slice(0, 60).join('\n')
    return {
      kind: 'code',
      html: `<pre class="code">${htmlEscape(content)}\n...(showing first 60 lines)</pre>`,
    }
  }

  return { kind: 'stub', html: `<div class="thumb-stub">${htmlEscape(primary.name)} (${fmtKb(primary.size)})</div>` }
}

async function getSidecarStatus(outDir) {
  const checks = []
  for (const name of ['citations.json', 'provenance.json', 'design_scorecard.json', 'card.json']) {
    const sz = await fileSize(path.join(outDir, name))
    checks.push({ name, present: sz > 0, size: sz })
  }
  const scorecard = await (async () => {
    try {
      const sc = JSON.parse(await readFile(path.join(outDir, 'design_scorecard.json'), 'utf8'))
      return { passed: sc.passed, total: sc.total, score: sc.score_pct }
    } catch { return null }
  })()
  return { checks, scorecard }
}

async function renderProducerCard(slug, spec) {
  const section = inferSection(slug, spec.script)
  const outDir = path.join(REPO_ROOT, 'out', slug, TARGET_SLUG)
  const media = await renderMediaForProducer(slug, outDir)
  const sidecars = await getSidecarStatus(outDir)
  const report = lastReport[slug]
  const passed = report && report.ok
  const statusClass = passed ? 'ok' : 'fail'
  const statusText = passed ? '✓ PASS' : (report ? '✗ FAIL' : '?')

  // List all files (non-sidecar) in folder
  const files = await listOutputFiles(outDir)
  const fileListHtml = files.map(f => `<li><code>${htmlEscape(f.name)}</code> · ${fmtKb(f.size)}</li>`).join('')

  // Card from card.json
  let card = {}
  try { card = JSON.parse(await readFile(path.join(outDir, 'card.json'), 'utf8')) } catch {}
  const notes = card.notes || ''
  const dataTraces = card.data_traces || []

  return `
<article class="producer" id="${htmlEscape(slug)}">
  <div class="producer-head">
    <h3>${htmlEscape(slug)}</h3>
    <span class="badge badge-${section.id}">${htmlEscape(section.label)}</span>
    <span class="status ${statusClass}">${statusText}</span>
    ${sidecars.scorecard ? `<span class="scorecard">${sidecars.scorecard.passed}/${sidecars.scorecard.total} checks</span>` : ''}
  </div>
  <div class="sub">
    <code>${htmlEscape(spec.script)}</code>
    ${notes ? ` · ${htmlEscape(notes)}` : ''}
  </div>
  <div class="deliverable">
    ${media.html}
  </div>
  <div class="producer-meta">
    <details>
      <summary>${files.length} output file${files.length === 1 ? '' : 's'} + ${sidecars.checks.filter(c => c.present).length}/4 sidecars</summary>
      <ul class="file-list">${fileListHtml}</ul>
      ${dataTraces.length > 0 ? `
        <div class="trace">
          <strong>Data traces:</strong>
          ${dataTraces.slice(0, 4).map(t => `<div class="row">${htmlEscape(t)}</div>`).join('')}
        </div>
      ` : ''}
      <div class="folder-link">
        <a href="../${slug}/${TARGET_SLUG}/" target="_blank">📁 out/${slug}/${TARGET_SLUG}/</a>
      </div>
    </details>
  </div>
</article>`
}

async function main() {
  const sections = { A: [], B: [], C: [], D: [], E: [], F: [] }
  for (const [slug, spec] of Object.entries(PRODUCERS)) {
    const sec = inferSection(slug, spec.script)
    sections[sec.id].push({ slug, spec, section: sec })
  }
  for (const k of Object.keys(sections)) sections[k].sort((a, b) => a.slug.localeCompare(b.slug))

  const cards = {}
  for (const [secId, entries] of Object.entries(sections)) {
    cards[secId] = []
    for (const { slug, spec } of entries) {
      cards[secId].push(await renderProducerCard(slug, spec))
    }
  }

  const totalProducers = Object.values(sections).reduce((a, b) => a + b.length, 0)
  const passed = Object.values(lastReport).filter(r => r.ok).length
  const failed = Object.values(lastReport).filter(r => !r.ok).length

  const sectionHtml = (id, title, lead, cards) => `
<section class="section" id="section-${id}">
  <div class="section-head">
    <h2><span class="section-tag">Section ${id}</span> ${title}</h2>
    <p class="section-lead">${lead} · <strong>${cards.length}</strong> producers</p>
  </div>
  ${cards.join('\n')}
</section>`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Producer Gallery — Ryan Realty — ${fixture._meta.generated_at}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --navy: #102742;
  --cream: #faf8f4;
  --rule: rgba(16,39,66,0.10);
  --muted: rgba(16,39,66,0.55);
  --green: #1f6a3f;
  --red: #8a2a2a;
  --amber: #9a6a18;
  --card: #ffffff;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--cream);
  color: var(--navy);
  font-family: 'Geist', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.page { max-width: 1280px; margin: 0 auto; padding: 40px 32px 120px; }
.stamp { font-size: 12px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); font-weight: 500; }
h1 { font-family: 'Playfair Display', Georgia, serif; font-weight: 400; font-size: 48px; line-height: 1.04; margin: 8px 0; letter-spacing: -0.005em; }
.lead { font-size: 15px; color: var(--navy); opacity: 0.82; max-width: 880px; margin: 16px 0 0; }
.subject-strip { margin: 20px 0; padding: 16px 20px; background: rgba(16,39,66,0.04); border-radius: 6px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px 24px; font-size: 13px; }
.subject-strip .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); display: block; margin-bottom: 2px; }
.summary-bar { display: flex; gap: 24px; margin: 20px 0 0; padding: 14px 18px; background: rgba(40,120,80,0.08); border-left: 3px solid var(--green); border-radius: 4px; font-size: 14px; }
.summary-bar strong { color: var(--navy); font-weight: 600; }
.toc { position: sticky; top: 0; z-index: 50; margin: 24px -32px 0; padding: 14px 32px; background: rgba(250,248,244,0.94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--rule); display: flex; gap: 22px; flex-wrap: wrap; font-size: 11px; text-transform: uppercase; letter-spacing: 0.10em; font-weight: 500; }
.toc a { color: var(--navy); text-decoration: none; opacity: 0.65; }
.toc a:hover { opacity: 1; }
.section { margin: 44px 0 0; }
.section-head { padding: 24px 0 16px; border-top: 2px solid var(--navy); margin-bottom: 8px; }
.section-head h2 { font-family: 'Playfair Display', Georgia, serif; font-weight: 400; font-size: 32px; line-height: 1.10; display: flex; align-items: baseline; gap: 12px; }
.section-tag { font-family: 'Geist', sans-serif; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); }
.section-lead { color: var(--muted); font-size: 13px; margin: 6px 0 0; }
.producer { margin: 28px 0; padding-top: 18px; border-top: 1px solid var(--rule); }
.producer-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.producer h3 { font-family: 'Playfair Display', Georgia, serif; font-weight: 400; font-size: 22px; line-height: 1.10; }
.producer .sub { color: var(--muted); font-size: 12.5px; margin: 4px 0 12px; }
.producer .sub code { font-size: 11.5px; background: rgba(16,39,66,0.04); padding: 2px 6px; border-radius: 3px; }
.badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; padding: 3px 8px; border-radius: 999px; }
.badge-A { background: rgba(40,120,80,0.14); color: var(--green); }
.badge-B { background: rgba(16,39,66,0.10); color: var(--navy); }
.badge-C { background: rgba(180,140,40,0.14); color: var(--amber); }
.badge-D { background: rgba(180,40,40,0.10); color: var(--red); }
.badge-E { background: rgba(40,120,80,0.10); color: var(--green); }
.badge-F { background: rgba(16,39,66,0.06); color: var(--navy); }
.status { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 4px; }
.status.ok { background: rgba(40,120,80,0.14); color: var(--green); }
.status.fail { background: rgba(180,40,40,0.10); color: var(--red); }
.scorecard { font-size: 11px; color: var(--muted); font-family: ui-monospace, Menlo, monospace; }
.deliverable { background: var(--card); border: 1px solid var(--rule); border-radius: 8px; padding: 22px 26px; margin: 12px 0; }
img.post { display: block; width: 100%; max-width: 480px; height: auto; border-radius: 4px; border: 1px solid var(--rule); }
video.reel { display: block; background: #000; border-radius: 4px; }
.carousel-grid { display: grid; gap: 10px; }
.carousel-grid .slide-wrap { position: relative; }
.carousel-grid img { width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 3px; border: 1px solid var(--rule); }
.carousel-grid .num { position: absolute; top: 6px; left: 8px; background: rgba(16,39,66,0.80); color: var(--cream); font-size: 10px; letter-spacing: 0.10em; padding: 2px 7px; border-radius: 999px; font-weight: 500; }
pre.caption { margin: 0; padding: 16px 20px; background: rgba(16,39,66,0.04); border-radius: 6px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--navy); line-height: 1.6; white-space: pre-wrap; overflow-x: auto; max-height: 480px; }
pre.code { margin: 0; padding: 16px 20px; background: #1e293b; color: #e2e8f0; border-radius: 6px; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; line-height: 1.5; white-space: pre; overflow-x: auto; max-height: 520px; }
.producer-meta { margin: 8px 0 0; }
.producer-meta details { font-size: 12.5px; color: var(--muted); }
.producer-meta summary { cursor: pointer; padding: 6px 0; color: var(--navy); font-weight: 500; }
.file-list { margin: 6px 0 8px 18px; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; }
.file-list code { background: rgba(16,39,66,0.04); padding: 1px 5px; border-radius: 3px; }
.trace { background: rgba(16,39,66,0.04); border-radius: 4px; padding: 10px 14px; margin: 8px 0; font-size: 11.5px; font-family: ui-monospace, Menlo, monospace; }
.trace .row { line-height: 1.5; word-break: break-all; }
.folder-link { margin-top: 8px; }
.folder-link a { color: var(--navy); text-decoration: none; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
.folder-link a:hover { text-decoration: underline; }
.thumb-stub { padding: 40px 20px; text-align: center; color: var(--muted); font-size: 12px; }
footer { margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--rule); font-size: 12px; color: var(--muted); text-align: center; }
</style>
</head>
<body>
<div class="page">
<div class="stamp">Ryan Realty · ${fixture._meta.generated_at} · Producer Gallery · ${totalProducers} producers · ${failed === 0 ? '100% green' : `${passed}/${totalProducers} green`}</div>
<h1>Producer Gallery</h1>
<p class="lead">Every brain-callable producer in <code>marketing_brain_skills/producers/REGISTRY.md</code>, fired end-to-end against the canonical Tumalo fixture. Real artifacts shown at proper size. Each output is on disk at <code>out/&lt;producer&gt;/${TARGET_SLUG}/</code> with the four canonical sidecars (citations, provenance, design_scorecard, card).</p>

<div class="subject-strip">
  <div><span class="label">Subject listing</span><strong>19496 Tumalo Reservoir Rd</strong> · ${fixture.listing.list_price_display} · ${fixture.listing.bedrooms} BD / ${fixture.listing.bathrooms} BA / ${fixture.listing.sqft_display}</div>
  <div><span class="label">Market data</span><strong>Bend SFR rolling-30d</strong> · ${fixture.market.period_start} → ${fixture.market.period_end} · median ${fixture.market.median_sale_price_display} · ${fixture.market.median_dom_display} DOM</div>
  <div><span class="label">Methodology</span><strong>${fixture.market.methodology_version}</strong> · ${fixture.market.sale_to_list_display} sale-to-list</div>
</div>

<div class="summary-bar">
  <div><strong>${passed}</strong> passed</div>
  <div><strong>${failed}</strong> failed</div>
  <div><strong>${totalProducers}</strong> total producers</div>
  <div><strong>${fixture._meta.generated_at}</strong></div>
  <div style="margin-left: auto;"><a href="../test-all-producers-report.json" target="_blank">view full JSON report →</a></div>
</div>

<nav class="toc">
  <a href="#section-A">Section A · Orchestrators</a>
  <a href="#section-B">Section B · Content</a>
  <a href="#section-C">Section C · Site</a>
  <a href="#section-D">Section D · Operational</a>
  <a href="#section-E">Section E · Communications</a>
  <a href="#section-F">Section F · Analysis</a>
</nav>

${sectionHtml('B', 'Content Producers', 'Single-deliverable image, video, text, and email producers. Brand-voice and dimension-checked.', cards.B)}
${sectionHtml('C', 'Site Producers', 'PR-diff stagers. Each script produces TSX + diff-summary + preview that would open a GitHub PR (never auto-pushed).', cards.C)}
${sectionHtml('D', 'Operational Producers', 'Dry-run by default. Pass --live to actually call the API (Meta Ads, FUB, Resend, GBP, ManyChat, Google Ads).', cards.D)}
${sectionHtml('E', 'Communications', 'Internal alert routing + per-client touchpoint emails.', cards.E)}
${sectionHtml('F', 'Analysis', 'Run analysis, write findings to marketing_decisions. Do not publish.', cards.F)}

<footer>
  Producer Gallery built ${new Date().toISOString()} by <code>scripts/build-producer-gallery.mjs</code><br>
  Phone <strong>541.213.6706</strong> · Web <strong>ryan-realty.com</strong> · Matt Ryan, Owner / Principal Broker
</footer>
</div>
</body>
</html>`

  const outPath = path.join(GALLERY_DIR, 'index.html')
  await writeFile(outPath, html)
  const stats = await stat(outPath)
  console.log(`✓ wrote ${outPath} (${Math.round(stats.size/1024)} KB)`)
}

main().catch(e => { console.error(e); process.exit(1) })
