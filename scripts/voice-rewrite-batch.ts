#!/usr/bin/env tsx
/**
 * voice-rewrite-batch.ts — W11.5.
 *
 * Runs the W11.3 advisory Orwell reviewer (reviewProse) over STORED copy —
 * published blog posts (public.blog_posts) and CRM/sequence templates
 * (public.crm_templates) — and writes a REVIEW ARTIFACT for Matt to approve
 * before any republish. It is READ-ONLY on the content: it NEVER writes to
 * blog_posts or crm_templates (no .update/.upsert/.insert/.delete anywhere).
 * "Reviewed before republish" is enforced by that read-only discipline +
 * ci:voice-rewrite-batch.
 *
 * The §0 fact-preservation guard inside reviewProse still applies: any rewrite
 * that drops or alters a number is nulled, so the artifact never suggests a
 * fact-mangling rewrite.
 *
 * Usage:
 *   npx tsx scripts/voice-rewrite-batch.ts [--source blog|templates|all] [--limit N]
 *   (default: --source all --limit 5; pass --all to review every item)
 *
 * Output: out/voice-rewrite-batch/report.json + report.md (gitignored scratch).
 */
import { createClient } from '@supabase/supabase-js'
import { reviewProse } from '@/lib/voice/reviewer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Source = 'blog' | 'templates' | 'all'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const SOURCE = (arg('--source') as Source) || 'all'
const ALL = process.argv.includes('--all')
const LIMIT = ALL ? 1000 : Number(arg('--limit') ?? 5)

/** Strip HTML to plain prose so the reviewer sees the words, not the markup. */
function htmlToText(html: string): string {
  return (html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Item {
  source: 'blog' | 'template'
  id: string
  ref: string
  title: string
  text: string
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cannot read stored copy.')
    process.exit(1)
  }
  const sb = createClient(url, key)
  const items: Item[] = []

  if (SOURCE === 'blog' || SOURCE === 'all') {
    const { data, error } = await sb
      .from('blog_posts')
      .select('id, slug, title, content')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(LIMIT)
    if (error) throw new Error(`blog_posts read: ${error.message}`)
    for (const p of data ?? []) {
      items.push({ source: 'blog', id: String(p.id), ref: p.slug ?? String(p.id), title: p.title ?? '', text: htmlToText(p.content ?? '') })
    }
  }

  if (SOURCE === 'templates' || SOURCE === 'all') {
    const { data, error } = await sb.from('crm_templates').select('id, key, name, body').limit(LIMIT)
    if (error) throw new Error(`crm_templates read: ${error.message}`)
    for (const t of data ?? []) {
      const body = String(t.body ?? '')
      items.push({ source: 'template', id: String(t.id), ref: t.key ?? String(t.id), title: t.name ?? '', text: htmlToText(body) })
    }
  }

  const results = []
  for (const it of items) {
    const review = await reviewProse(it.text, { context: it.source })
    results.push({
      source: it.source,
      id: it.id,
      ref: it.ref,
      title: it.title,
      ran: review.ran,
      violationCount: review.violations.length,
      violations: review.violations,
      factsPreserved: review.factsPreserved,
      rewrite: review.rewrite, // null when facts could not be preserved — never a fact-mangled suggestion
    })
  }

  const outDir = 'out/voice-rewrite-batch'
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'report.json'), JSON.stringify({ source: SOURCE, count: results.length, results }, null, 2))

  const lines: string[] = [
    '# Voice rewrite review — for approval before republish',
    '',
    `Source: ${SOURCE} · ${results.length} item(s). Nothing was written to the database.`,
    '',
  ]
  for (const r of results) {
    lines.push(`## [${r.source}] ${r.title || r.ref} (${r.ref})`)
    lines.push(r.ran ? `${r.violationCount} violation(s).` : 'Reviewer did not run (no API key or empty text).')
    for (const v of r.violations) lines.push(`- ${v.kind}: "${v.span}" -> ${v.suggestion}`)
    if (r.rewrite) {
      lines.push('', '**Suggested rewrite (facts preserved):**', '', r.rewrite, '')
    } else if (r.ran) {
      lines.push('', '_No rewrite offered (facts could not be verified as preserved, or no change needed)._', '')
    }
    lines.push('')
  }
  writeFileSync(join(outDir, 'report.md'), lines.join('\n'))

  console.log(`✓ Wrote review artifact: ${outDir}/report.md (${results.length} item(s)).`)
  console.log('  REVIEW BEFORE REPUBLISH — this tool is read-only, nothing was written to blog_posts or crm_templates.')
}

main().catch((e) => {
  console.error('✗ voice-rewrite-batch failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
