import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GA4_PARAMS_KEY } from '@/lib/analytics/ga4-browser-events'
import { alertSignupPayload, trackAlertSignup } from '@/lib/analytics/form-conversion'

const g = globalThis as unknown as { window?: { dataLayer?: unknown[] } }

afterEach(() => {
  delete g.window
})

describe('alertSignupPayload', () => {
  it('is sign_up with method, form_id, and lead_type buyer_alerts', () => {
    expect(alertSignupPayload({ method: 'search_alert', form_id: 'search_alert' })).toEqual({
      event: 'sign_up',
      method: 'search_alert',
      form_id: 'search_alert',
      lead_type: 'buyer_alerts',
    })
    expect(alertSignupPayload({ method: 'listing_alert', form_id: 'listing_save' })).toEqual({
      event: 'sign_up',
      method: 'listing_alert',
      form_id: 'listing_save',
      lead_type: 'buyer_alerts',
    })
    expect(alertSignupPayload({ method: 'listing_alert', form_id: 'listing_price_watch' })).toMatchObject({
      event: 'sign_up',
      method: 'listing_alert',
      form_id: 'listing_price_watch',
    })
  })

  it('does not put value or currency on sign_up', () => {
    const p = alertSignupPayload({ method: 'search_alert', form_id: 'search_alert' })
    expect(p).not.toHaveProperty('value')
    expect(p).not.toHaveProperty('currency')
  })
})

describe('trackAlertSignup pushes the GTM shape', () => {
  it('pushes sign_up through ga4_params including lead_type', () => {
    g.window = { dataLayer: [] }
    trackAlertSignup({ method: 'search_alert', form_id: 'search_alert' })
    expect(g.window.dataLayer).toEqual([
      { [GA4_PARAMS_KEY]: null },
      {
        event: 'sign_up',
        method: 'search_alert',
        form_id: 'search_alert',
        lead_type: 'buyer_alerts',
        [GA4_PARAMS_KEY]: {
          method: 'search_alert',
          form_id: 'search_alert',
          lead_type: 'buyer_alerts',
        },
      },
    ])
  })
})

describe('alert clients except /buy go through the counted sign_up wrapper', () => {
  const ROOT = process.cwd()

  function sourceFiles(dir: string): string[] {
    const out: string[] = []
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) out.push(...sourceFiles(full))
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
    }
    return out
  }

  const files = ['app', 'components', 'lib']
    .flatMap((d) => sourceFiles(join(ROOT, d)))
    .map((f) => ({
      rel: relative(ROOT, f),
      src: readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, ''),
    }))

  it('does not push browser generate_lead', () => {
    const SEND = [
      /trackEvent\(\s*['"`]generate_lead['"`]/,
      /pushDataLayerEvent\(\s*['"`]generate_lead['"`]/,
      /\bevent:\s*['"`]generate_lead['"`]/,
    ]
    const hits = files.filter((f) => SEND.some((re) => re.test(f.src))).map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('alert clients except /buy import the counted sign_up wrapper', () => {
    const raw = files.filter(
      (f) =>
        f.src.includes("from '@/app/actions/search-alert-capture'") &&
        /submitSearchAlertSignup|submitListingSaveCapture|submitListingPriceDropWatch/.test(f.src),
    )
    expect(raw.map((f) => f.rel).sort()).toEqual([
      'app/buy/_v3/BuyAlertsSheet.client.tsx',
      'lib/analytics/submit-alert-signup.ts',
    ])
  })
})
