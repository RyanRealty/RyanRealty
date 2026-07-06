// Temp helper: build the draft contact sheet for the resort-community SEO batch,
// matching the section-1f format (out/community-seo-drafts/index.html).
// Usage: node scripts/_seo-contact-sheet.mjs out/community-seo-batch.json out/community-seo-drafts-2/index.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [, , inFile, outFile] = process.argv
if (!inFile || !outFile) { console.error('usage: node _seo-contact-sheet.mjs <batch.json> <out.html>'); process.exit(2) }
const data = JSON.parse(readFileSync(inFile, 'utf8'))
const entries = Array.isArray(data) ? data : (data.entries ?? [])

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const wordCount = (paras) => paras.join(' ').trim().split(/\s+/).filter(Boolean).length

const CITY = {
  'eagle-crest': 'Redmond', pronghorn: 'Bend', 'caldera-springs': 'Sunriver', sunriver: 'Sunriver',
  'awbrey-glen': 'Bend', 'northwest-crossing': 'Bend', crosswater: 'Sunriver', 'widgi-creek': 'Bend',
  'vandevert-ranch': 'Sunriver', 'three-rivers': 'Sunriver',
}
const NAME = {
  'eagle-crest': 'Eagle Crest', pronghorn: 'Pronghorn', 'caldera-springs': 'Caldera Springs', sunriver: 'Sunriver',
  'awbrey-glen': 'Awbrey Glen', 'northwest-crossing': 'NorthWest Crossing', crosswater: 'Crosswater',
  'widgi-creek': 'Widgi Creek', 'vandevert-ranch': 'Vandevert Ranch', 'three-rivers': 'Three Rivers',
}
const BASE = 'https://ryan-realty.com'

let html = `<!doctype html><meta charset=utf-8><title>Resort-community SEO drafts (batch 2)</title>
<style>body{font:16px/1.6 Geist,system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#102742;background:#faf8f4}
h1{font-size:28px} h2{margin-top:42px;border-bottom:3px solid #102742;padding-bottom:6px}
.meta{font-size:13px;color:#102742aa;margin:6px 0 14px} .prose p{margin:0 0 14px}
a{color:#102742} details{margin-top:10px;font-size:13px;color:#102742cc} .omit{font-style:italic} summary{cursor:pointer;font-weight:600}</style>
<h1>Resort-community SEO content drafts (batch 2)</h1>
<p>Ten sourced, brand-voice-checked deep "About" sections for the remaining curated resort communities, extending the four approved on 2026-06-28. Each deepens a 110-185 word blurb to a 350-500 word sourced overview, rendered through the proven <code>richContent.aboutProse</code> override path. Every claim is cited (expand the source trace). Facts that could not be verified were deliberately omitted, not invented.</p>
`

for (const e of entries) {
  const name = NAME[e.slug] ?? e.slug
  const city = CITY[e.slug] ?? ''
  const words = wordCount(e.paragraphs ?? [])
  const liveUrl = `${BASE}/communities/${e.slug}`
  html += `<section><h2>${esc(name)}</h2>
    <div class=meta>Live page: <a href="${liveUrl}"><b>/communities/${e.slug}</b></a> &nbsp;·&nbsp; SEO title: <i>${esc(name)} Homes for Sale | ${esc(city)}, OR</i> &nbsp;·&nbsp; ${words} words</div>
    <div class=prose>${(e.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <details><summary>Source trace (${(e.sources ?? []).length})</summary><ul>${(e.sources ?? []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>${e.omitted ? `<p class=omit>Omitted (unverified): ${esc(e.omitted)}</p>` : ''}</details></section>
`
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, html)
console.log(`Wrote ${outFile} (${entries.length} communities)`)
