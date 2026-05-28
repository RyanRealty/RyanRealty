import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const APP_DIR = path.join(ROOT, 'app')
const PAGE_FILE_RE = /[\\/]page\.(tsx|ts|jsx|js)$/
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])

const PUBLIC_ROUTE_PREFIXES = [
  'app/blog',
  'app/cities',
  'app/communities',
  'app/listing',
  'app/open-houses',
  'app/our-homes',
  'app/reports',
  'app/search',
  'app/team',
]

const EXEMPT_PATH_PARTS = [
  '/admin/',
  '/account/',
  '/dashboard/',
  '/login/',
  '/signup/',
  '/forgot-password/',
  '/auth-error/',
]

const REQUIRED_FILE_CONTRACTS = [
  {
    file: 'app/search/[...slug]/page.tsx',
    checks: [
      {
        id: 'search-canonical-alternates',
        pattern: /alternates:\s*\{\s*canonical:/m,
        message: 'Search route metadata must define a canonical URL.',
      },
      {
        id: 'search-noindex-policy',
        pattern: /shouldNoIndexSearchVariant\(/m,
        message: 'Search route metadata must apply noindex policy helper.',
      },
    ],
  },
  {
    file: 'app/blog/page.tsx',
    checks: [
      {
        id: 'blog-canonical-alternates',
        pattern: /alternates:\s*\{\s*canonical:/m,
        message: 'Blog index metadata must define a canonical URL.',
      },
      {
        id: 'blog-noindex-policy',
        pattern: /shouldNoIndexBlogIndex\(/m,
        message: 'Blog index metadata must apply noindex policy helper.',
      },
    ],
  },
  {
    file: 'app/sitemap.ts',
    checks: [
      {
        id: 'sitemap-canonical-listings-helper',
        pattern: /listingsBrowsePath\(\)/m,
        message: 'Sitemap must use listingsBrowsePath() for canonical browse URL.',
      },
      {
        id: 'sitemap-canonical-team-helper',
        pattern: /teamPath\(/m,
        message: 'Sitemap must use teamPath() for canonical team URLs.',
      },
      {
        id: 'sitemap-canonical-valuation-helper',
        pattern: /valuationPath\(\)/m,
        message: 'Sitemap must use valuationPath() for canonical valuation URL.',
      },
    ],
  },
]

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
      continue
    }
    if (CODE_EXTENSIONS.has(path.extname(entry.name))) out.push(full)
  }
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

function isPublicPageRoute(relativePath) {
  if (!PAGE_FILE_RE.test(relativePath)) return false
  if (!PUBLIC_ROUTE_PREFIXES.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))) return false
  return !EXEMPT_PATH_PARTS.some((part) => relativePath.includes(part))
}

function hasMetadataExport(content) {
  return (
    /export\s+const\s+metadata\s*:\s*Metadata/m.test(content) ||
    /export\s+async\s+function\s+generateMetadata/m.test(content)
  )
}

function hasDynamicSegment(relativePath) {
  return relativePath.includes('[') && relativePath.includes(']')
}

function hasCanonicalAlternates(content) {
  return /alternates:\s*\{[^}]*\bcanonical\b/m.test(content)
}

function hasMetadataForwarding(content) {
  // Recognize the legacy `return generateXxxMetadata(...)` forwarding
  // pattern PLUS the canonical Wave 2 Layer 2 helper `pageMetadata(...)`
  // from lib/site/page-metadata, which sets `alternates.canonical` for
  // every caller by construction.
  return (
    /return\s+generate[A-Za-z0-9_]*Metadata\s*\(/m.test(content) ||
    /return\s+pageMetadata\s*\(/m.test(content)
  )
}

const failures = []

if (fs.existsSync(APP_DIR)) {
  const files = []
  walk(APP_DIR, files)
  for (const file of files) {
    const relative = rel(file)
    if (!isPublicPageRoute(relative)) continue

    const content = fs.readFileSync(file, 'utf8')
    if (!hasMetadataExport(content)) {
      failures.push({
        file: relative,
        ruleId: 'missing-metadata-export',
        message: 'Public SEO route page must export `metadata` or `generateMetadata`.',
      })
      continue
    }

    if (hasDynamicSegment(relative) && !hasCanonicalAlternates(content) && !hasMetadataForwarding(content)) {
      failures.push({
        file: relative,
        ruleId: 'missing-canonical-alternates',
        message: 'Dynamic public SEO route must define `alternates.canonical` in metadata.',
      })
    }
  }
}

for (const contract of REQUIRED_FILE_CONTRACTS) {
  const fullPath = path.join(ROOT, contract.file)
  if (!fs.existsSync(fullPath)) {
    failures.push({
      file: contract.file,
      ruleId: 'required-file-missing',
      message: 'Required SEO contract file is missing.',
    })
    continue
  }
  const content = fs.readFileSync(fullPath, 'utf8')
  for (const check of contract.checks) {
    if (!check.pattern.test(content)) {
      failures.push({
        file: contract.file,
        ruleId: check.id,
        message: check.message,
      })
    }
  }
}

if (failures.length > 0) {
  console.error('SEO authoring guardrails failed:\n')
  for (const failure of failures) {
    console.error(`- ${failure.file} [${failure.ruleId}] ${failure.message}`)
  }
  console.error('\nFollow docs/SEO_AUTHORING_CHECKLIST.md before merging.')
  process.exit(1)
}

console.log('SEO authoring guardrails passed.')
