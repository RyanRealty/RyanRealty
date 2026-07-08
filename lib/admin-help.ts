import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { cache } from 'react'
import type { HelpArticleMeta } from '@/components/admin/help/types'

/**
 * Server-side loader for the admin knowledge base.
 *
 * Articles live as markdown files in docs/admin-help/*.md with a simple YAML
 * frontmatter block: { title, area, routes: [...], summary }. gray-matter is
 * not in package.json, so the frontmatter is parsed by hand — the subset we
 * need is scalar keys plus one string list, which the parser below covers.
 * See docs/admin-help/README.md for why the content is repo markdown.
 */

export type HelpArticle = HelpArticleMeta & { body: string }

const HELP_DIR = path.join(process.cwd(), 'docs', 'admin-help')

/** Parse the frontmatter subset used by help articles (scalars + string lists). */
function parseFrontmatter(raw: string): { data: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { data: {}, body: raw }
  const body = raw.slice(match[0].length)
  const data: Record<string, string | string[]> = {}
  let currentListKey: string | null = null
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.*)$/)
    if (listItem && currentListKey) {
      ;(data[currentListKey] as string[]).push(listItem[1].trim())
      continue
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    const [, key, value] = kv
    if (value === '') {
      data[key] = []
      currentListKey = key
    } else {
      data[key] = value.trim().replace(/^["']|["']$/g, '')
      currentListKey = null
    }
  }
  return { data, body }
}

function loadArticleFile(file: string): HelpArticle | null {
  const slug = file.replace(/\.md$/, '')
  const raw = fs.readFileSync(path.join(HELP_DIR, file), 'utf8')
  const { data, body } = parseFrontmatter(raw)
  const title = typeof data.title === 'string' ? data.title : null
  if (!title) return null
  return {
    slug,
    title,
    area: typeof data.area === 'string' ? data.area : 'Admin',
    routes: Array.isArray(data.routes) ? data.routes : [],
    summary: typeof data.summary === 'string' ? data.summary : '',
    body,
  }
}

/** Every article with its full body, sorted by title. Cached per request. */
export const getHelpArticles = cache((): HelpArticle[] => {
  let files: string[] = []
  try {
    files = fs.readdirSync(HELP_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md')
  } catch {
    return []
  }
  return files
    .map(loadArticleFile)
    .filter((a): a is HelpArticle => a !== null)
    .sort((a, b) => a.title.localeCompare(b.title))
})

/** Metadata only — what the Help button needs to suggest articles per page. */
export const getHelpArticleIndex = cache((): HelpArticleMeta[] =>
  getHelpArticles().map(({ body: _body, ...meta }) => meta),
)

export function getHelpArticle(slug: string): HelpArticle | null {
  // Slug comes from the URL — restrict to safe filename characters.
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  return getHelpArticles().find((a) => a.slug === slug) ?? null
}
