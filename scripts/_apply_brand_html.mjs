#!/usr/bin/env node
/**
 * Brand-compliance post-pass for HTML producers.
 *
 * Inserts a canonical brand <head> block (Geist + Amboqia via Google Fonts,
 * brand color variables, brand footer) into every HTML producer output.
 *
 * Idempotent — looks for marker comment <!-- ryan-realty-brand-css --> to skip.
 *
 * Producers covered:
 *   newsletter, agent-coop-eflyer
 * (market-report-blog, listing-description, google-ads-copy are markdown — handled separately)
 */

import { readFileSync, writeFileSync } from 'fs'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..')
const OUT_DIR = path.join(REPO_ROOT, 'out')
const TARGET = '19496-tumalo-reservoir-rd'

const HTML_PRODUCERS = [
  { slug: 'newsletter',         file: 'newsletter.html' },
  { slug: 'agent-coop-eflyer',  file: 'eflyer.html' },
]

const BRAND_CSS = `<!-- ryan-realty-brand-css -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --rr-navy: #102742;
    --rr-cream: #faf8f4;
    --rr-ink: #1a1a1a;
    --rr-muted: rgba(16, 39, 66, 0.55);
    --rr-rule: rgba(16, 39, 66, 0.10);
  }
  html, body, table, td, p, h1, h2, h3, h4, span, a {
    font-family: 'Geist', system-ui, sans-serif !important;
    font-variant-numeric: tabular-nums;
    color: var(--rr-navy);
  }
  h1, h2, h3, .display, .hero {
    font-family: 'Playfair Display', Georgia, serif !important;
    font-weight: 400;
  }
  body { background: var(--rr-cream) !important; }
  a { color: var(--rr-navy); }
</style>`

const BRAND_FOOTER = `<!-- ryan-realty-brand-footer -->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #102742; color: #faf8f4; margin-top: 32px;">
  <tr><td style="padding: 28px 36px; text-align: center; font-family: 'Geist', system-ui, sans-serif;">
    <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin-bottom: 6px;">Ryan Realty</div>
    <div style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; margin-bottom: 12px;">BEND · OREGON</div>
    <div style="font-size: 14px; font-style: italic; opacity: 0.92; margin-bottom: 10px;">It's About Relationships.</div>
    <div style="font-size: 13px;"><strong style="color: #faf8f4;">541.213.6706</strong> &nbsp;·&nbsp; <a href="https://ryan-realty.com" style="color: #faf8f4; text-decoration: underline;">ryan-realty.com</a></div>
  </td></tr>
</table>`

function patchHtml(filePath) {
  if (!existsSync(filePath)) return { ok: false, msg: 'missing' }
  let html = readFileSync(filePath, 'utf8')
  if (html.includes('ryan-realty-brand-css')) return { ok: false, msg: 'already patched' }

  // Inject CSS into <head> (or right after <html> if no <head>)
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${BRAND_CSS}\n</head>`)
  } else if (html.includes('<body')) {
    html = html.replace(/<body([^>]*)>/, `<head>${BRAND_CSS}</head><body$1>`)
  } else {
    html = BRAND_CSS + '\n' + html
  }

  // Append footer before </body>
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${BRAND_FOOTER}\n</body>`)
  } else {
    html = html + '\n' + BRAND_FOOTER
  }

  writeFileSync(filePath, html)
  return { ok: true, msg: `patched ${html.length} bytes` }
}

console.log('HTML brand-compliance pass')
console.log('='.repeat(50))
let total_patched = 0
let total_skipped = 0
for (const { slug, file } of HTML_PRODUCERS) {
  const filePath = path.join(OUT_DIR, slug, TARGET, file)
  const result = patchHtml(filePath)
  if (result.ok) {
    console.log(`  ${slug}/${file}: ${result.msg}`)
    total_patched++
  } else {
    console.log(`  ${slug}/${file}: ${result.msg}`)
    total_skipped++
  }
}
console.log('='.repeat(50))
console.log(`${total_patched} patched · ${total_skipped} skipped`)
