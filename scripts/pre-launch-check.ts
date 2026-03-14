/**
 * Pre-launch checklist. Step 23 Task 7.
 * Run: npx tsx scripts/pre-launch-check.ts
 * Verifies env, Supabase, Spark, public pages, sitemap, OG, etc.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SPARK_API_KEY',
] as const

interface Check { name: string; pass: boolean; detail?: string }

async function main() {
  const checks: Check[] = []

  for (const key of requiredEnv) {
    const v = process.env[key]?.trim()
    checks.push({ name: `Env: ${key}`, pass: !!v, detail: v ? 'set' : 'missing' })
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (url && key) {
      const supabase = createClient(url, key)
      const list = await supabase.from('listings').select('listing_key').limit(1)
      checks.push({ name: 'Supabase: reachable + tables', pass: !list.error, detail: list.error?.message ?? 'ok' })
    } else {
      checks.push({ name: 'Supabase: reachable', pass: false, detail: 'missing env' })
    }
  } catch (e) {
    checks.push({ name: 'Supabase: reachable', pass: false, detail: String(e) })
  }

  const publicPages = ['/', '/homes-for-sale', '/communities', '/cities', '/agents', '/blog', '/about', '/contact', '/privacy', '/terms']
  for (const path of publicPages) {
    try {
      const res = await fetch(`${SITE_URL}${path}`, { redirect: 'manual' })
      checks.push({ name: `Page ${path}`, pass: res.status === 200 || res.status === 307, detail: String(res.status) })
    } catch (e) {
      checks.push({ name: `Page ${path}`, pass: false, detail: String(e) })
    }
  }

  try {
    const res = await fetch(`${SITE_URL}/robots.txt`)
    checks.push({ name: 'robots.txt', pass: res.ok, detail: String(res.status) })
  } catch (e) {
    checks.push({ name: 'robots.txt', pass: false, detail: String(e) })
  }

  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`)
    checks.push({ name: 'sitemap.xml', pass: res.ok, detail: String(res.status) })
  } catch (e) {
    checks.push({ name: 'sitemap.xml', pass: false, detail: String(e) })
  }

  try {
    const res = await fetch(`${SITE_URL}/api/og?type=default`)
    checks.push({ name: 'OG image endpoint', pass: res.ok, detail: String(res.status) })
  } catch (e) {
    checks.push({ name: 'OG image endpoint', pass: false, detail: String(e) })
  }

  console.log('\nPre-launch check results:\n')
  let passed = 0
  for (const c of checks) {
    const icon = c.pass ? '✓' : '✗'
    console.log(`  ${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
    if (c.pass) passed++
  }
  console.log(`\n${passed}/${checks.length} passed.\n`)
  process.exit(passed === checks.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
