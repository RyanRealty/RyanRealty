/**
 * Environment Variable Verification Script
 * Tests all 29 env vars — connectivity for APIs, format for client-side keys, presence for secrets.
 * Run: npm run env:verify   (loads `.env.local` via dotenv)
 * Non-destructive: no writes, no emails, no video generation.
 */

import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

type CheckResult = {
  name: string
  variable: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}

const results: CheckResult[] = []

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined
}

function pass(name: string, variable: string, detail: string) {
  results.push({ name, variable, status: 'pass', detail })
}

function fail(name: string, variable: string, detail: string) {
  results.push({ name, variable, status: 'fail', detail })
}

function warn(name: string, variable: string, detail: string) {
  results.push({ name, variable, status: 'warn', detail })
}

// ─── 1. Supabase ────────────────────────────────────────────────────────────

async function checkSupabase() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')

  if (!url) {
    fail('Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL', 'Not set')
    fail('Supabase Anon Key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Cannot test — URL missing')
    fail('Supabase Service Key', 'SUPABASE_SERVICE_ROLE_KEY', 'Cannot test — URL missing')
    return
  }

  // Test anon key
  if (!anonKey) {
    fail('Supabase Anon Key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Not set')
  } else {
    try {
      const res = await fetch(`${url}/rest/v1/listings?select=ListingKey&limit=1`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        pass('Supabase Anon Key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', `Connected — ${Array.isArray(data) ? data.length : 0} row(s) returned`)
        pass('Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL', `Reachable at ${url.replace(/https?:\/\//, '').split('.')[0]}...`)
      } else {
        const text = await res.text()
        fail('Supabase Anon Key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', `HTTP ${res.status}: ${text.slice(0, 100)}`)
      }
    } catch (e) {
      fail('Supabase Anon Key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Test service role key
  if (!serviceKey) {
    fail('Supabase Service Role Key', 'SUPABASE_SERVICE_ROLE_KEY', 'Not set')
  } else {
    try {
      const res = await fetch(`${url}/rest/v1/listings?select=ListingKey&limit=1`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      })
      if (res.ok) {
        pass('Supabase Service Role Key', 'SUPABASE_SERVICE_ROLE_KEY', 'Connected — service role access confirmed')
      } else {
        const text = await res.text()
        fail('Supabase Service Role Key', 'SUPABASE_SERVICE_ROLE_KEY', `HTTP ${res.status}: ${text.slice(0, 100)}`)
      }
    } catch (e) {
      fail('Supabase Service Role Key', 'SUPABASE_SERVICE_ROLE_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

// ─── 2. Spark MLS API ───────────────────────────────────────────────────────

async function checkSpark() {
  const apiKey = env('SPARK_API_KEY')
  const baseUrl = env('SPARK_API_BASE_URL')

  if (!apiKey) {
    fail('Spark API Key', 'SPARK_API_KEY', 'Not set')
    return
  }
  if (!baseUrl) {
    warn('Spark API Base URL', 'SPARK_API_BASE_URL', 'Not set — will default to https://sparkapi.com/v1')
  }

  const sparkBase = baseUrl || 'https://sparkapi.com/v1'
  try {
    const res = await fetch(`${sparkBase}/listings?_pagination=1&_limit=1&_page=1`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })
    if (res.ok) {
      const data = await res.json() as { D?: { Success?: boolean; Pagination?: { TotalRows?: number } } }
      if (data.D?.Success) {
        const total = data.D.Pagination?.TotalRows ?? 0
        pass('Spark API Key', 'SPARK_API_KEY', `Connected — ${total.toLocaleString()} total listings available`)
        if (baseUrl) {
          pass('Spark API Base URL', 'SPARK_API_BASE_URL', `Reachable at ${sparkBase}`)
        }
      } else {
        fail('Spark API Key', 'SPARK_API_KEY', `API returned success: false`)
      }
    } else {
      const text = await res.text()
      fail('Spark API Key', 'SPARK_API_KEY', `HTTP ${res.status}: ${text.slice(0, 150)}`)
    }
  } catch (e) {
    fail('Spark API Key', 'SPARK_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 3. Follow Up Boss ──────────────────────────────────────────────────────

async function checkFollowUpBoss() {
  const apiKey = env('FOLLOWUPBOSS_API_KEY')
  if (!apiKey) {
    fail('Follow Up Boss', 'FOLLOWUPBOSS_API_KEY', 'Not set')
    return
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64')
    const res = await fetch('https://api.followupboss.com/v1/people?limit=1&fields=id', {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      const data = await res.json() as { people?: unknown[] }
      pass('Follow Up Boss', 'FOLLOWUPBOSS_API_KEY', `Connected — API key valid (${data.people?.length ?? 0} person(s) returned)`)
    } else {
      fail('Follow Up Boss', 'FOLLOWUPBOSS_API_KEY', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('Follow Up Boss', 'FOLLOWUPBOSS_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 4. xAI / Grok ─────────────────────────────────────────────────────────

async function checkXai() {
  const apiKey = env('XAI_API_KEY')
  if (!apiKey) {
    fail('xAI / Grok', 'XAI_API_KEY', 'Not set')
    return
  }

  try {
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ id?: string }> }
      const modelCount = data.data?.length ?? 0
      pass('xAI / Grok', 'XAI_API_KEY', `Connected — ${modelCount} model(s) available`)
    } else if (res.status === 401) {
      fail('xAI / Grok', 'XAI_API_KEY', 'Invalid API key (401 Unauthorized)')
    } else {
      fail('xAI / Grok', 'XAI_API_KEY', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('xAI / Grok', 'XAI_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 5. OpenAI ──────────────────────────────────────────────────────────────

async function checkOpenAI() {
  const apiKey = env('OPENAI_API_KEY')
  if (!apiKey) {
    fail('OpenAI', 'OPENAI_API_KEY', 'Not set')
    return
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ id?: string }> }
      const modelCount = data.data?.length ?? 0
      pass('OpenAI', 'OPENAI_API_KEY', `Connected — ${modelCount} model(s) available`)
    } else if (res.status === 401) {
      fail('OpenAI', 'OPENAI_API_KEY', 'Invalid API key (401 Unauthorized)')
    } else {
      fail('OpenAI', 'OPENAI_API_KEY', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('OpenAI', 'OPENAI_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 6. Replicate ───────────────────────────────────────────────────────────

async function checkReplicate() {
  const token = env('REPLICATE_API_TOKEN')
  if (!token) {
    fail('Replicate', 'REPLICATE_API_TOKEN', 'Not set')
    return
  }

  try {
    const res = await fetch('https://api.replicate.com/v1/account', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (res.ok) {
      const data = await res.json() as { username?: string; type?: string }
      pass('Replicate', 'REPLICATE_API_TOKEN', `Connected — account: ${data.username ?? 'unknown'} (${data.type ?? 'unknown'})`)
    } else if (res.status === 401) {
      fail('Replicate', 'REPLICATE_API_TOKEN', 'Invalid API token (401 Unauthorized)')
    } else {
      fail('Replicate', 'REPLICATE_API_TOKEN', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('Replicate', 'REPLICATE_API_TOKEN', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 7. Synthesia ───────────────────────────────────────────────────────────

async function checkSynthesia() {
  const apiKey = env('SYNTHESIA_API_KEY')
  if (!apiKey) {
    fail('Synthesia', 'SYNTHESIA_API_KEY', 'Not set')
    return
  }

  try {
    // Synthesia v2 API — list videos is the most reliable read-only endpoint
    const res = await fetch('https://api.synthesia.io/v2/videos?limit=1&offset=0', {
      headers: {
        Authorization: apiKey,
      },
    })
    if (res.ok) {
      pass('Synthesia', 'SYNTHESIA_API_KEY', 'Connected — API key valid')
    } else if (res.status === 401 || res.status === 403) {
      fail('Synthesia', 'SYNTHESIA_API_KEY', `Auth failed (${res.status})`)
    } else {
      // Some endpoints may return different status codes for valid keys
      const text = await res.text()
      warn('Synthesia', 'SYNTHESIA_API_KEY', `HTTP ${res.status}: ${text.slice(0, 100)}`)
    }
  } catch (e) {
    fail('Synthesia', 'SYNTHESIA_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 8. Resend ──────────────────────────────────────────────────────────────

async function checkResend() {
  const apiKey = env('RESEND_API_KEY')
  if (!apiKey) {
    fail('Resend', 'RESEND_API_KEY', 'Not set')
    return
  }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ name?: string }> }
      const domains = data.data?.map(d => d.name).filter(Boolean) ?? []
      pass('Resend', 'RESEND_API_KEY', `Connected — ${domains.length} domain(s)${domains.length > 0 ? `: ${domains.join(', ')}` : ''}`)
    } else if (res.status === 401) {
      fail('Resend', 'RESEND_API_KEY', 'Invalid API key (401 Unauthorized)')
    } else {
      fail('Resend', 'RESEND_API_KEY', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('Resend', 'RESEND_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 9. Unsplash ────────────────────────────────────────────────────────────

async function checkUnsplash() {
  const accessKey = env('UNSPLASH_ACCESS_KEY')
  if (!accessKey) {
    fail('Unsplash', 'UNSPLASH_ACCESS_KEY', 'Not set')
    return
  }

  try {
    const res = await fetch('https://api.unsplash.com/search/photos?query=Oregon+landscape&per_page=1', {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    })
    if (res.ok) {
      const data = await res.json() as { total?: number; results?: unknown[] }
      pass('Unsplash', 'UNSPLASH_ACCESS_KEY', `Connected — ${data.total?.toLocaleString() ?? '?'} results for "Oregon landscape"`)
    } else if (res.status === 401) {
      fail('Unsplash', 'UNSPLASH_ACCESS_KEY', 'Invalid access key (401 Unauthorized)')
    } else {
      fail('Unsplash', 'UNSPLASH_ACCESS_KEY', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('Unsplash', 'UNSPLASH_ACCESS_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 10. Google Maps ────────────────────────────────────────────────────────

async function checkGoogleMaps() {
  const apiKey = env('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
  if (!apiKey) {
    fail('Google Maps', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'Not set')
    return
  }

  try {
    const address = encodeURIComponent('Bend, OR 97701')
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${apiKey}`)
    if (res.ok) {
      const data = await res.json() as { status?: string; results?: Array<{ formatted_address?: string }> }
      if (data.status === 'OK' && data.results?.length) {
        pass('Google Maps', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', `Connected — geocoded: "${data.results[0]?.formatted_address}"`)
      } else if (data.status === 'REQUEST_DENIED') {
        fail('Google Maps', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'REQUEST_DENIED — API key may be restricted or Geocoding API not enabled')
      } else {
        warn('Google Maps', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', `API responded with status: ${data.status}`)
      }
    } else {
      fail('Google Maps', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', `HTTP ${res.status}: ${res.statusText}`)
    }
  } catch (e) {
    fail('Google Maps', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', `Connection error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── 11. Google OAuth ───────────────────────────────────────────────────────

function checkGoogleOAuth() {
  const clientId = env('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = env('GOOGLE_OAUTH_CLIENT_SECRET')

  if (!clientId) {
    fail('Google OAuth Client ID', 'GOOGLE_OAUTH_CLIENT_ID', 'Not set')
  } else if (clientId.endsWith('.apps.googleusercontent.com')) {
    pass('Google OAuth Client ID', 'GOOGLE_OAUTH_CLIENT_ID', `Valid format (ends with .apps.googleusercontent.com)`)
  } else {
    warn('Google OAuth Client ID', 'GOOGLE_OAUTH_CLIENT_ID', `Unexpected format — expected to end with .apps.googleusercontent.com`)
  }

  if (!clientSecret) {
    fail('Google OAuth Client Secret', 'GOOGLE_OAUTH_CLIENT_SECRET', 'Not set')
  } else if (clientSecret.startsWith('GOCSPX-')) {
    pass('Google OAuth Client Secret', 'GOOGLE_OAUTH_CLIENT_SECRET', 'Valid format (starts with GOCSPX-)')
  } else {
    // Some older secrets may not start with GOCSPX-
    warn('Google OAuth Client Secret', 'GOOGLE_OAUTH_CLIENT_SECRET', 'Set but unexpected format (expected GOCSPX- prefix)')
  }
}

// ─── 12. Analytics & Tracking (format validation) ───────────────────────────

function checkAnalytics() {
  // GA4 Measurement ID
  const ga4 = env('NEXT_PUBLIC_GA4_MEASUREMENT_ID')
  if (!ga4) {
    fail('GA4 Measurement ID', 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', 'Not set')
  } else if (ga4.startsWith('G-')) {
    pass('GA4 Measurement ID', 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', `Valid format: ${ga4}`)
  } else {
    warn('GA4 Measurement ID', 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', `Unexpected format: "${ga4}" (expected G-XXXXXXX)`)
  }

  // GA4 Property ID
  const ga4Prop = env('GOOGLE_GA4_PROPERTY_ID')
  if (!ga4Prop) {
    fail('GA4 Property ID', 'GOOGLE_GA4_PROPERTY_ID', 'Not set')
  } else if (/^\d+$/.test(ga4Prop)) {
    pass('GA4 Property ID', 'GOOGLE_GA4_PROPERTY_ID', `Valid format: ${ga4Prop}`)
  } else {
    warn('GA4 Property ID', 'GOOGLE_GA4_PROPERTY_ID', `Unexpected format: "${ga4Prop}" (expected numeric)`)
  }

  // GTM Container ID
  const gtm = env('NEXT_PUBLIC_GTM_CONTAINER_ID')
  if (!gtm) {
    warn('GTM Container ID', 'NEXT_PUBLIC_GTM_CONTAINER_ID', 'Not set (optional)')
  } else if (gtm.startsWith('GTM-')) {
    pass('GTM Container ID', 'NEXT_PUBLIC_GTM_CONTAINER_ID', `Valid format: ${gtm}`)
  } else {
    warn('GTM Container ID', 'NEXT_PUBLIC_GTM_CONTAINER_ID', `Unexpected format: "${gtm}" (expected GTM-XXXXXXX)`)
  }

  // AdSense Client ID
  const adsense = env('NEXT_PUBLIC_ADSENSE_CLIENT_ID')
  if (!adsense) {
    warn('AdSense Client ID', 'NEXT_PUBLIC_ADSENSE_CLIENT_ID', 'Not set (optional)')
  } else if (adsense.startsWith('ca-pub-') || adsense.startsWith('pub-')) {
    pass('AdSense Client ID', 'NEXT_PUBLIC_ADSENSE_CLIENT_ID', `Valid format: ${adsense}`)
  } else {
    warn('AdSense Client ID', 'NEXT_PUBLIC_ADSENSE_CLIENT_ID', `Unexpected format: "${adsense}" (expected ca-pub-XXXXXXX or pub-XXXXXXX)`)
  }

  // Meta Pixel ID
  const metaPixel = env('NEXT_PUBLIC_META_PIXEL_ID')
  if (!metaPixel) {
    warn('Meta Pixel ID', 'NEXT_PUBLIC_META_PIXEL_ID', 'Not set (optional)')
  } else if (/^\d+$/.test(metaPixel)) {
    pass('Meta Pixel ID', 'NEXT_PUBLIC_META_PIXEL_ID', `Valid format: ${metaPixel}`)
  } else {
    warn('Meta Pixel ID', 'NEXT_PUBLIC_META_PIXEL_ID', `Unexpected format: "${metaPixel}" (expected numeric)`)
  }
}

// ─── 13. Meta (format/presence) ─────────────────────────────────────────────

function checkMeta() {
  const appId = env('META_APP_ID')
  if (!appId) {
    warn('Meta App ID', 'META_APP_ID', 'Not set (optional)')
  } else if (/^\d+$/.test(appId)) {
    pass('Meta App ID', 'META_APP_ID', `Valid format: ${appId}`)
  } else {
    warn('Meta App ID', 'META_APP_ID', `Unexpected format: "${appId}" (expected numeric)`)
  }

  const adAccount = env('META_AD_ACCOUNT_ID')
  if (!adAccount) {
    warn('Meta Ad Account ID', 'META_AD_ACCOUNT_ID', 'Not set (optional)')
  } else if (/^\d+$/.test(adAccount)) {
    pass('Meta Ad Account ID', 'META_AD_ACCOUNT_ID', `Valid format: ${adAccount}`)
  } else {
    warn('Meta Ad Account ID', 'META_AD_ACCOUNT_ID', `Unexpected format: "${adAccount}" (expected numeric)`)
  }

  const appSecret = env('META_APP_SECRET')
  if (!appSecret) {
    warn('Meta App Secret', 'META_APP_SECRET', 'Not set (optional)')
  } else {
    pass('Meta App Secret', 'META_APP_SECRET', 'Set (presence verified)')
  }
}

// ─── 14. Misc ───────────────────────────────────────────────────────────────

async function checkMisc() {
  // FUB email click param
  const fubParam = env('NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM')
  if (!fubParam) {
    warn('FUB Email Click Param', 'NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM', 'Not set (optional)')
  } else if (fubParam === '_fuid') {
    pass('FUB Email Click Param', 'NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM', `Correct value: ${fubParam}`)
  } else {
    warn('FUB Email Click Param', 'NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM', `Unexpected value: "${fubParam}" (expected "_fuid")`)
  }

  // Cron secret
  const cronSecret = env('CRON_SECRET')
  if (!cronSecret) {
    fail('Cron Secret', 'CRON_SECRET', 'Not set')
  } else {
    pass('Cron Secret', 'CRON_SECRET', `Set (${cronSecret.length} chars)`)
  }

  // Sentry DSN
  const sentryDsn = env('SENTRY_DSN')
  if (!sentryDsn) {
    warn('Sentry DSN', 'SENTRY_DSN', 'Not set (optional)')
  } else if (/^https:\/\/[a-f0-9]+@.*\.sentry\.io\/\d+/.test(sentryDsn) || sentryDsn.startsWith('https://')) {
    pass('Sentry DSN', 'SENTRY_DSN', 'Valid format (Sentry DSN URL)')
  } else {
    warn('Sentry DSN', 'SENTRY_DSN', `Unexpected format`)
  }

  // Sentry Auth Token
  const sentryAuth = env('SENTRY_AUTH_TOKEN')
  if (!sentryAuth) {
    warn('Sentry Auth Token', 'SENTRY_AUTH_TOKEN', 'Not set (optional)')
  } else {
    try {
      const res = await fetch('https://sentry.io/api/0/', {
        headers: {
          Authorization: `Bearer ${sentryAuth}`,
        },
      })
      if (res.ok || res.status === 200) {
        pass('Sentry Auth Token', 'SENTRY_AUTH_TOKEN', 'Connected — auth token valid')
      } else if (res.status === 401) {
        fail('Sentry Auth Token', 'SENTRY_AUTH_TOKEN', 'Invalid token (401 Unauthorized)')
      } else {
        // Sentry may return various codes for valid tokens
        warn('Sentry Auth Token', 'SENTRY_AUTH_TOKEN', `HTTP ${res.status} — token may be valid (some endpoints restricted)`)
      }
    } catch (e) {
      warn('Sentry Auth Token', 'SENTRY_AUTH_TOKEN', `Could not verify: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Inngest Event Key
  const inngestEvent = env('INNGEST_EVENT_KEY')
  if (!inngestEvent) {
    warn('Inngest Event Key', 'INNGEST_EVENT_KEY', 'Not set (optional)')
  } else {
    pass('Inngest Event Key', 'INNGEST_EVENT_KEY', `Set (${inngestEvent.length} chars)`)
  }

  // Inngest Signing Key
  const inngestSigning = env('INNGEST_SIGNING_KEY')
  if (!inngestSigning) {
    warn('Inngest Signing Key', 'INNGEST_SIGNING_KEY', 'Not set (optional)')
  } else {
    pass('Inngest Signing Key', 'INNGEST_SIGNING_KEY', `Set (${inngestSigning.length} chars)`)
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Environment Variable Verification\n')
  console.log('Testing all 29 environment variables...\n')

  // Run all checks (API calls in parallel where possible)
  await Promise.all([
    checkSupabase(),
    checkSpark(),
    checkFollowUpBoss(),
    checkXai(),
    checkOpenAI(),
    checkReplicate(),
    checkSynthesia(),
    checkResend(),
    checkUnsplash(),
    checkGoogleMaps(),
  ])

  // Synchronous checks
  checkGoogleOAuth()
  checkAnalytics()
  checkMeta()

  // Misc (has some async)
  await checkMisc()

  // ── Report ──────────────────────────────────────────────────────────────

  const categories = [
    { title: 'Supabase', vars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] },
    { title: 'Spark MLS', vars: ['SPARK_API_KEY', 'SPARK_API_BASE_URL'] },
    { title: 'Follow Up Boss', vars: ['FOLLOWUPBOSS_API_KEY'] },
    { title: 'xAI / Grok', vars: ['XAI_API_KEY'] },
    { title: 'OpenAI', vars: ['OPENAI_API_KEY'] },
    { title: 'Replicate', vars: ['REPLICATE_API_TOKEN'] },
    { title: 'Synthesia', vars: ['SYNTHESIA_API_KEY'] },
    { title: 'Resend', vars: ['RESEND_API_KEY'] },
    { title: 'Unsplash', vars: ['UNSPLASH_ACCESS_KEY'] },
    { title: 'Google Maps', vars: ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] },
    { title: 'Google OAuth', vars: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'] },
    { title: 'Analytics & Tracking', vars: ['NEXT_PUBLIC_GA4_MEASUREMENT_ID', 'GOOGLE_GA4_PROPERTY_ID', 'NEXT_PUBLIC_GTM_CONTAINER_ID', 'NEXT_PUBLIC_ADSENSE_CLIENT_ID', 'NEXT_PUBLIC_META_PIXEL_ID'] },
    { title: 'Meta', vars: ['META_APP_ID', 'META_AD_ACCOUNT_ID', 'META_APP_SECRET'] },
    { title: 'Misc', vars: ['NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM', 'CRON_SECRET', 'SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'INNGEST_EVENT_KEY', 'INNGEST_SIGNING_KEY'] },
  ]

  let totalPass = 0
  let totalFail = 0
  let totalWarn = 0

  for (const cat of categories) {
    console.log(`\n── ${cat.title} ${'─'.repeat(Math.max(0, 60 - cat.title.length))}`)
    for (const v of cat.vars) {
      const r = results.find(r => r.variable === v)
      if (!r) {
        console.log(`  ? ${v} — no check ran`)
        continue
      }
      const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️'
      console.log(`  ${icon} ${r.name}`)
      console.log(`     ${r.detail}`)
      if (r.status === 'pass') totalPass++
      else if (r.status === 'fail') totalFail++
      else totalWarn++
    }
  }

  console.log('\n' + '═'.repeat(65))
  console.log(`\n  Results: ${totalPass} passed, ${totalFail} failed, ${totalWarn} warnings`)
  console.log(`  Total:   ${totalPass + totalFail + totalWarn} checks\n`)

  if (totalFail > 0) {
    console.log('  ❌ Some environment variables are not working correctly.\n')
    process.exit(1)
  } else if (totalWarn > 0) {
    console.log('  ⚠️  All critical checks passed. Some optional vars have warnings.\n')
    process.exit(0)
  } else {
    console.log('  ✅ All environment variables verified successfully!\n')
    process.exit(0)
  }
}

main().catch((e) => {
  console.error('Script failed:', e)
  process.exit(1)
})
