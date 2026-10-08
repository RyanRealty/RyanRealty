#!/usr/bin/env node
/**
 * Blog market-report period lock.
 *
 * When the title names month M and the body opens "The N numbers", the
 * visible H1 / meta / JSON-LD publish N. Founding cases: June 2026 issue
 * with May closings, July 2026 issue with June closings.
 *
 *   node scripts/check-publish-blog-report-period.mjs
 */
import { readFileSync } from 'node:fs'
import { routeRenderSource } from './lib/route-render-source.mjs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/blog/publish-blog-report-period.ts')
checks.push({
  label: 'publishBlogReportPeriod rewrites a mismatched title month',
  ok:
    /export function publishBlogReportPeriod/.test(helper) &&
    /export function extractTitlePeriod/.test(helper) &&
    /export function extractDataPeriod/.test(helper) &&
    helper.includes('The\\\\s+(${MONTH_RE})(?:\\\\s+(20\\\\d{2}))?\\\\s+numbers') &&
    helper.includes('inferDataYear') &&
    helper.includes('closings. Published'),
})

// The post body renders in app/blog/[slug]/_v3/render-blog-post.tsx (one render path
// shared with the admin draft preview, 2026-10-05); the route file keeps metadata + ISR.
// routeRenderSource reads the route plus the render module it imports.
const page = routeRenderSource(new URL('../app/blog/[slug]/page.tsx', import.meta.url).pathname)
checks.push({
  label: 'blog post page publishes H1, meta, and JSON-LD through the period helper',
  ok:
    /from ['"]@\/lib\/blog\/publish-blog-report-period['"]/.test(page) &&
    /publishBlogReportPeriod\(/.test(page) &&
    /period\.displayTitle/.test(page) &&
    /period\.metaTitle/.test(page) &&
    /period\.periodNote/.test(page),
})

checks.push({
  label: 'JSON-LD and Open Graph use the published display title',
  ok:
    /generateBlogSchema\(\{[\s\S]*title:\s*period\.displayTitle/.test(page) &&
    /openGraph:[\s\S]*title,\s*[\s\S]*images:[\s\S]*alt: period\.displayTitle/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-blog-report-period: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-blog-report-period: ${checks.length}/${checks.length}`)
