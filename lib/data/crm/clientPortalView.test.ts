/**
 * Contract tests for the broker's read-only client-portal mirror
 * (search-optimization plan Phase 4.3).
 *
 * Two halves:
 *   1. The pure mappers, tested directly (no DB).
 *   2. A SOURCE INVARIANT that makes "read only" mechanical rather than a
 *      promise in a comment. The portal view hands one person's private data to
 *      a different user, so the whole surface (the admin route, every component
 *      under components/admin/crm/portal-view/, and the DAL module itself) is
 *      scanned for write verbs, server actions, forms, submit controls, and
 *      action imports. Adding any of them fails this test, which is the point:
 *      the next person to touch this surface cannot quietly make it writable.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  activityLabel,
  collectAreaIds,
  enabledEventTypes,
  filtersToParamMap,
  otherFilterChips,
  summarizeAreaShapes,
  toClientPortalAlert,
} from './getClientPortalView'
import type { ListingAlertRow } from '@/lib/data/leads/listingAlerts'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// 1. Pure mappers
// ---------------------------------------------------------------------------

describe('filtersToParamMap', () => {
  it('emits booleans as 1, arrays as CSV, and keeps geography keys', () => {
    const params = filtersToParamMap({
      city: 'Bend',
      subdivision: 'Awbrey Butte',
      minPrice: 400000,
      maxPrice: 800000,
      beds: 3,
      hasPool: true,
      newConstruction: false,
      viewTypes: ['Mountain', 'Cascade Mountains'],
    })
    expect(params).toMatchObject({
      city: 'Bend',
      subdivision: 'Awbrey Butte',
      minPrice: '400000',
      maxPrice: '800000',
      beds: '3',
      hasPool: '1',
      viewTypes: 'Mountain,Cascade Mountains',
    })
    // A false boolean is absent, never "0" — the consumer URL grammar omits it.
    expect(params.newConstruction).toBeUndefined()
  })

  it('drops nulls, blanks, and unknown keys', () => {
    const params = filtersToParamMap({ city: '  ', minPrice: null, notAFilter: 'x' })
    expect(params).toEqual({})
  })

  it('produces a map activeRegistryFilters can read through URLSearchParams', () => {
    const params = new URLSearchParams(filtersToParamMap({ minPrice: 500000, beds: 3 }))
    expect(params.get('minPrice')).toBe('500000')
    expect(params.get('beds')).toBe('3')
  })
})

describe('otherFilterChips', () => {
  it('skips registry-owned params and renders the rest with human labels', () => {
    const chips = otherFilterChips({
      // registry-owned (rendered by activeRegistryFilters, not here)
      minPrice: '400000',
      hasPool: '1',
      // not registry-owned
      city: 'Bend',
      statusFilter: 'active',
      includeClosed: '1',
    })
    const labels = chips.map((c) => (c.detail ? `${c.label}: ${c.detail}` : c.label))
    expect(labels).toContain('City: Bend')
    expect(labels).toContain('Status: active')
    expect(labels).toContain('Includes sold listings')
    expect(labels.some((l) => l.startsWith('Price'))).toBe(false)
    expect(labels.some((l) => l.includes('Pool'))).toBe(false)
  })

  it('renders a drawn polygon as a label, never as raw coordinates', () => {
    const chips = otherFilterChips({ poly: '-121.3,44.05 -121.2,44.05 -121.2,44.1' })
    expect(chips).toEqual([{ label: 'Drawn map area' }])
  })

  it('resolves named-area ids through the supplied name map', () => {
    const names = new Map([['a1', 'West side pocket']])
    const chips = otherFilterChips({ areaIds: 'a1,a2' }, names)
    expect(chips[0]).toEqual({ label: 'Named areas', detail: 'West side pocket, Saved area' })
  })

  it('omits sort and result-view, which carry no reader value', () => {
    expect(otherFilterChips({ sort: 'price_asc', view: 'map' })).toEqual([])
  })
})

describe('enabledEventTypes', () => {
  it('returns only the toggles that are on, in canonical order', () => {
    expect(
      enabledEventTypes({
        new: true,
        price_change: false,
        status_change: true,
        back_on_market: false,
        sold: true,
        open_house: false,
      }),
    ).toEqual(['new', 'status_change', 'sold'])
  })
})

describe('summarizeAreaShapes', () => {
  it('counts polygons, circles, and excludes', () => {
    const summary = summarizeAreaShapes([
      { type: 'polygon', coords: [] },
      { type: 'circle', center: [0, 0], radius_m: 1000 },
      { type: 'polygon', coords: [], exclude: true },
    ])
    expect(summary.polygonCount).toBe(2)
    expect(summary.circleCount).toBe(1)
    expect(summary.excludeCount).toBe(1)
    expect(summary.shapeSummary).toBe('2 drawn shapes, 1 radius, 1 excluded')
  })

  it('is safe on a null or non-array shapes column', () => {
    expect(summarizeAreaShapes(null).shapeSummary).toBe('No shapes')
    expect(summarizeAreaShapes('nonsense').polygonCount).toBe(0)
  })
})

describe('activityLabel', () => {
  it('maps the tracked event types to reader labels', () => {
    expect(activityLabel('search_save')).toBe('Saved a search')
    expect(activityLabel('listing_view')).toBe('Viewed a listing')
  })

  it('humanizes an unknown event type instead of dropping it', () => {
    expect(activityLabel('some_new_event')).toBe('Some new event')
    expect(activityLabel('')).toBe('Site activity')
  })
})

describe('collectAreaIds', () => {
  it('dedupes area ids across alerts and ignores rows without them', () => {
    expect(
      collectAreaIds([
        { filters: { areaIds: ['a', 'b'] } },
        { filters: { areaIds: ['b', 'c'] } },
        { filters: { city: 'Bend' } },
        { filters: null },
      ]),
    ).toEqual(['a', 'b', 'c'])
  })
})

function alertRow(overrides: Partial<ListingAlertRow> = {}): ListingAlertRow {
  return {
    id: 'alert-1',
    email: 'client@example.com',
    user_id: 'user-1',
    crm_person_id: 42,
    fub_person_id: null,
    name: 'Westside under 800',
    filters: { city: 'Bend', maxPrice: 800000, beds: 3 },
    filters_hash: 's_abc',
    notification_frequency: 'weekly',
    is_active: true,
    origin: 'user',
    assigned_by: null,
    source: 'user',
    unsubscribe_token: 'tok',
    last_notified_at: '2026-07-25T12:00:00.000Z',
    notified_listing_keys: [],
    events: {
      new: true,
      price_change: true,
      status_change: false,
      back_on_market: false,
      sold: true,
      open_house: false,
    },
    schedule_days: [1, 4],
    preview_mode: false,
    recipients: [{ email: 'spouse@example.com' }],
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-07-25T12:00:00.000Z',
    ...overrides,
  }
}

describe('toClientPortalAlert', () => {
  it('carries every field the client can see on their own portal', () => {
    const mapped = toClientPortalAlert(alertRow())
    expect(mapped.name).toBe('Westside under 800')
    expect(mapped.criteria).toContain('Bend')
    expect(mapped.searchUrl).toContain('maxPrice=800000')
    expect(mapped.registryParams.maxPrice).toBe('800000')
    expect(mapped.otherChips.some((c) => c.label === 'City' && c.detail === 'Bend')).toBe(true)
    expect(mapped.cadence).toBe('weekly')
    expect(mapped.scheduleDays).toEqual([1, 4])
    expect(mapped.eventsOn).toEqual(['new', 'price_change', 'sold'])
    expect(mapped.active).toBe(true)
    expect(mapped.recipientCount).toBe(1)
    expect(mapped.previewMode).toBe(false)
    expect(mapped.lastNotifiedAt).toBe('2026-07-25T12:00:00.000Z')
  })

  it('falls back to the humanized criteria when the alert has no name', () => {
    expect(toClientPortalAlert(alertRow({ name: '   ' })).name).toBe('Homes in Bend, under $800k, 3+ beds')
  })

  it('normalizes a row saved before the typed-events migration', () => {
    const mapped = toClientPortalAlert(alertRow({ events: null, schedule_days: null }))
    // Defaults, not an empty map: new + price change + status change.
    expect(mapped.eventsOn).toEqual(['new', 'price_change', 'status_change'])
    expect(mapped.scheduleDays).toBeNull()
  })

  it('marks a paused alert inactive', () => {
    expect(toClientPortalAlert(alertRow({ is_active: false })).active).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Read-only source invariant
// ---------------------------------------------------------------------------

const PORTAL_ROUTE = 'app/admin/(protected)/crm/[id]/portal/page.tsx'
const PORTAL_COMPONENT_DIR = 'components/admin/crm/portal-view'
const PORTAL_DAL = 'lib/data/crm/getClientPortalView.ts'

function portalSurfaceFiles(): string[] {
  const components = readdirSync(path.join(ROOT, PORTAL_COMPONENT_DIR))
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map((f) => `${PORTAL_COMPONENT_DIR}/${f}`)
  expect(components.length).toBeGreaterThan(0)
  return [PORTAL_ROUTE, PORTAL_DAL, ...components]
}

/** Strip block and line comments so prose about writes never trips the scan. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('client portal view is read-only by construction', () => {
  const files = portalSurfaceFiles()

  it.each(files)('%s performs no write against the client data', (rel) => {
    const code = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'))
    expect(code).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/)
    expect(code).not.toMatch(/\brpc\s*\(/)
  })

  it.each(files)('%s declares no server action', (rel) => {
    const code = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'))
    expect(code).not.toMatch(/['"]use server['"]/)
  })

  it.each(files)('%s renders no form and no mutating control', (rel) => {
    const code = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'))
    expect(code).not.toMatch(/<form\b/)
    expect(code).not.toMatch(/\bformAction\s*=/)
    expect(code).not.toMatch(/\baction\s*=\s*\{/)
    expect(code).not.toMatch(/type\s*=\s*['"]submit['"]/)
    // No click handler can reach a write when there is no click handler.
    expect(code).not.toMatch(/\bonClick\s*=/)
    expect(code).not.toMatch(/\bonSubmit\s*=/)
    expect(code).not.toMatch(/\bonChange\s*=/)
    expect(code).not.toMatch(/\bonCheckedChange\s*=/)
  })

  it.each(files)('%s imports no server-action module', (rel) => {
    const code = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'))
    expect(code).not.toMatch(/from\s+['"]@\/app\/actions\//)
    expect(code).not.toMatch(/from\s+['"][^'"]*form-actions['"]/)
  })

  it('never imports the consumer account surface, which is owned elsewhere', () => {
    for (const rel of files) {
      const code = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'))
      expect(code).not.toMatch(/from\s+['"]@\/(app|components)\/account\//)
    }
  })

  it('reuses activeRegistryFilters rather than forking the chip labels', () => {
    const code = readFileSync(path.join(ROOT, PORTAL_COMPONENT_DIR, 'PortalFilterChips.tsx'), 'utf8')
    expect(code).toMatch(/import\s*\{\s*activeRegistryFilters\s*\}\s*from\s+['"]@\/components\/search\/AllFiltersSheet['"]/)
  })
})

describe('client portal view is admin-gated', () => {
  it('guards in the page body, not only in the (protected) layout', () => {
    const code = readFileSync(path.join(ROOT, PORTAL_ROUTE), 'utf8')
    expect(code).toMatch(/from\s+['"]@\/lib\/admin\/require-admin['"]/)
    expect(code).toMatch(/await\s+requireAdminPage\(\s*['"]people\.view['"]\s*\)/)
  })

  it('never caches the per-contact read', () => {
    const code = readFileSync(path.join(ROOT, PORTAL_ROUTE), 'utf8')
    expect(code).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/)
  })
})
