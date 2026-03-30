#!/usr/bin/env tsx
/**
 * Documentation Freshness Checker
 *
 * Scans all markdown files in docs/ and checks for:
 * - Files with "Last updated" older than 90 days
 * - Broken internal links between docs
 * - References to files/paths that no longer exist in the codebase
 *
 * Usage:
 *   npx tsx scripts/check-docs-freshness.ts           — Full report
 *   npx tsx scripts/check-docs-freshness.ts --summary  — Summary only
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(
  typeof import.meta.dirname === 'string' ? import.meta.dirname : path.dirname(new URL(import.meta.url).pathname),
  '..',
)
const DOCS_DIR = path.join(ROOT, 'docs')
const STALE_DAYS = 90

interface DocIssue {
  file: string
  type: 'stale' | 'broken-link' | 'missing-reference' | 'no-date'
  detail: string
}

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.md')) {
        results.push(full)
      }
    }
  }
  walk(dir)
  return results
}

function extractDate(content: string): Date | null {
  // Look for patterns like "Last updated: March 2025", "Date: 2025-03-12", etc.
  const patterns = [
    /last\s+updated?:?\s*(\w+\s+\d{4})/i,
    /date:?\s*(\d{4}-\d{2}-\d{2})/i,
    /updated:?\s*(\d{4}-\d{2}-\d{2})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      const date = new Date(match[1])
      if (!isNaN(date.getTime())) return date
    }
  }
  return null
}

function extractLinks(content: string): string[] {
  const links: string[] = []
  // Markdown links: [text](path)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[2]
    // Only check internal links (not http/https)
    if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
      links.push(href)
    }
  }
  return links
}

function extractCodeReferences(content: string): string[] {
  const refs: string[] = []
  // Look for file path references in backticks or code blocks
  const pathRegex = /`((?:app|components|lib|scripts|supabase)\/[^`]+)`/g
  let match
  while ((match = pathRegex.exec(content)) !== null) {
    refs.push(match[1])
  }
  return refs
}

function checkFreshness(): DocIssue[] {
  const issues: DocIssue[] = []
  const docFiles = findMarkdownFiles(DOCS_DIR)

  // Also check root-level markdown files
  const rootMd = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.md') && !f.startsWith('node_modules'))
    .map(f => path.join(ROOT, f))

  const allFiles = [...docFiles, ...rootMd]
  const now = new Date()
  const staleThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000)

  for (const file of allFiles) {
    const relPath = path.relative(ROOT, file)
    const content = fs.readFileSync(file, 'utf8')

    // Check date freshness
    const date = extractDate(content)
    if (date) {
      if (date < staleThreshold) {
        const daysOld = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        issues.push({
          file: relPath,
          type: 'stale',
          detail: `Last updated ${daysOld} days ago (${date.toISOString().slice(0, 10)})`,
        })
      }
    } else {
      // Only flag docs/ files without dates, not every markdown file
      if (relPath.startsWith('docs/')) {
        issues.push({
          file: relPath,
          type: 'no-date',
          detail: 'No "Last updated" date found',
        })
      }
    }

    // Check internal links
    const links = extractLinks(content)
    for (const link of links) {
      // Resolve relative to the file's directory
      const linkPath = link.split('#')[0] // Remove anchors
      if (!linkPath) continue

      const resolvedPath = path.resolve(path.dirname(file), linkPath)
      if (!fs.existsSync(resolvedPath)) {
        issues.push({
          file: relPath,
          type: 'broken-link',
          detail: `Broken link: ${link}`,
        })
      }
    }

    // Check code references (only for docs/ files)
    if (relPath.startsWith('docs/')) {
      const codeRefs = extractCodeReferences(content)
      for (const ref of codeRefs) {
        // Strip wildcards and optional parts
        const cleanRef = ref.replace(/\*/g, '').replace(/\[.*?\]/g, '_placeholder_')
        const refPath = path.join(ROOT, cleanRef)

        // Check if the base directory exists at minimum
        const baseDir = path.dirname(refPath)
        if (!fs.existsSync(baseDir) && !cleanRef.includes('_placeholder_')) {
          issues.push({
            file: relPath,
            type: 'missing-reference',
            detail: `References non-existent path: ${ref}`,
          })
        }
      }
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const summaryOnly = process.argv.includes('--summary')
const issues = checkFreshness()

const stale = issues.filter(i => i.type === 'stale')
const brokenLinks = issues.filter(i => i.type === 'broken-link')
const missingRefs = issues.filter(i => i.type === 'missing-reference')
const noDates = issues.filter(i => i.type === 'no-date')

console.log(`\n📋 Documentation Freshness Report`)
console.log('─'.repeat(60))
console.log(`Total issues: ${issues.length}`)
console.log(`  📅 Stale docs (>${STALE_DAYS} days): ${stale.length}`)
console.log(`  🔗 Broken links: ${brokenLinks.length}`)
console.log(`  📁 Missing references: ${missingRefs.length}`)
console.log(`  ⚠️  No date found: ${noDates.length}`)
console.log()

if (!summaryOnly) {
  if (stale.length > 0) {
    console.log('📅 Stale Documents:')
    for (const issue of stale) {
      console.log(`  ⚠️  ${issue.file} — ${issue.detail}`)
    }
    console.log()
  }

  if (brokenLinks.length > 0) {
    console.log('🔗 Broken Links:')
    for (const issue of brokenLinks) {
      console.log(`  ❌ ${issue.file} — ${issue.detail}`)
    }
    console.log()
  }

  if (missingRefs.length > 0) {
    console.log('📁 Missing Code References:')
    for (const issue of missingRefs) {
      console.log(`  ❌ ${issue.file} — ${issue.detail}`)
    }
    console.log()
  }

  if (noDates.length > 0) {
    console.log('⚠️  Documents Without Dates (top 10):')
    for (const issue of noDates.slice(0, 10)) {
      console.log(`  ○ ${issue.file}`)
    }
    if (noDates.length > 10) {
      console.log(`  ... and ${noDates.length - 10} more`)
    }
    console.log()
  }
}

if (issues.length === 0) {
  console.log('✅ All documentation is fresh and links are valid!\n')
}

// Exit with error code if there are broken links or missing references
const criticalCount = brokenLinks.length + missingRefs.length
if (criticalCount > 0) {
  process.exit(1)
}
