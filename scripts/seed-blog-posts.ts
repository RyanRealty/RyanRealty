/**
 * Seed blog posts into the database.
 * Run: npx tsx scripts/seed-blog-posts.ts            (every seed file)
 *      npx tsx scripts/seed-blog-posts.ts --only <file-without-.ts>   (one file)
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env or .env.local.
 *
 * Idempotent: uses upsert on slug. Safe to run multiple times.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local if available
try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf8')
    for (const line of contents.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [rawKey, ...rest] = trimmed.split('=')
      const value = rest.join('=').trim()
      if (!rawKey || !value) continue
      if (!process.env[rawKey]) {
        process.env[rawKey] = value
      }
    }
  }
} catch {
  // Ignore
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

export type BlogPostSeed = {
  title: string
  slug: string
  content: string
  excerpt: string
  category: string
  tags: string[]
  hero_image_url: string
  seo_title: string
  seo_description: string
  status: 'published' | 'draft'
  published_at: string
  /** public.brokers.id of the byline broker. Optional so older seeds stay valid. */
  author_broker_id?: string
}

async function seedPosts() {
  // Dynamically import all post files — or only the ones named with --only.
  // Every upsert REPLACES the whole row on its slug, so seeding every file
  // rewrites every post from its seed, including rows edited live since (Broken
  // Top, 2026-09-07). `--only community-guides-2026-09` seeds one file's posts
  // and leaves the rest of the table alone (SITE-31, 2026-09-09).
  const contentDir = path.resolve(__dirname, 'blog-content')
  const onlyArg = process.argv.indexOf('--only')
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null
  if (onlyArg >= 0 && !only) {
    console.error('--only needs a file name (without .ts), e.g. --only community-guides-2026-09')
    process.exit(2)
  }
  const files = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .filter((f) => !only || f === `${only}.ts` || f === only)
  if (only && files.length === 0) {
    console.error(`--only ${only}: no such file in scripts/blog-content/`)
    process.exit(2)
  }

  let allPosts: BlogPostSeed[] = []
  for (const file of files) {
    const mod = await import(path.join(contentDir, file))
    const posts = mod.default || mod.posts
    if (Array.isArray(posts)) {
      allPosts = [...allPosts, ...posts]
    }
  }

  console.log(`Found ${allPosts.length} blog posts to seed`)

  let success = 0
  let errors = 0

  for (const post of allPosts) {
    const { error } = await supabase.from('blog_posts').upsert(
      {
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags,
        hero_image_url: post.hero_image_url,
        seo_title: post.seo_title,
        seo_description: post.seo_description,
        status: post.status,
        published_at: post.published_at,
        ...(post.author_broker_id ? { author_broker_id: post.author_broker_id } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )

    if (error) {
      console.error(`  ✗ ${post.slug}: ${error.message}`)
      errors++
    } else {
      console.log(`  ✓ ${post.slug}`)
      success++
    }
  }

  console.log(`\nDone: ${success} seeded, ${errors} errors`)
}

seedPosts().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
