/**
 * Manual IndexNow submission for a few pages that changed outside the wired
 * paths (lib/seo/indexnow.ts; docs/SEO.md "IndexNow"), for example a post
 * published with scripts/seed-blog-posts.ts.
 *
 *   INDEXNOW_OPT_IN=1 npx tsx scripts/indexnow-submit.ts https://ryan-realty.com/blog/<slug> [more URLs]
 *
 * Without INDEXNOW_OPT_IN=1 (anywhere but production) it sends nothing and
 * prints skipped: "disabled". Only https://ryan-realty.com URLs are sent.
 * Capped at MAX_URLS: this is for changed pages, never the sitemap.
 */
import { submitIndexNow } from '@/lib/seo/indexnow'

const MAX_URLS = 100

async function main(): Promise<number> {
  const urls = process.argv.slice(2)
  if (urls.length === 0) {
    console.error('usage: INDEXNOW_OPT_IN=1 npx tsx scripts/indexnow-submit.ts <url> [url ...]')
    return 2
  }
  if (urls.length > MAX_URLS) {
    console.error(`refusing ${urls.length} URLs: submit only pages that changed (max ${MAX_URLS})`)
    return 2
  }
  const result = await submitIndexNow(urls)
  console.log(JSON.stringify(result, null, 2))
  return result.ok ? 0 : 1
}

main().then((code) => process.exit(code))
