/**
 * The detail route must paint owner email and live status even when an
 * optional source hangs or throws, and that failure is an inline error —
 * never a 404, and never "no listing history" for a read that did not finish.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProspectDetail } from '@/lib/data/prospecting/types'

const resolveDocsBatch = vi.fn()
const resolveComplianceBatch = vi.fn()
const getProspectEngagement = vi.fn()
const getProspectDripState = vi.fn()
const getBpoListingCyclesByAddress = vi.fn()

vi.mock('server-only', () => ({}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  notFound() {
    throw new Error('NOT_FOUND')
  },
  unstable_rethrow() {},
}))

vi.mock('next/link', () => {
  const { createElement: h } = require('react') as typeof import('react')
  return {
    default: (props: { href?: string; children?: import('react').ReactNode; className?: string }) =>
      h('a', { href: props.href, className: props.className }, props.children),
  }
})

vi.mock('sonner', () => ({
  toast: { success() {}, error() {} },
}))

vi.mock('@/components/admin/prospecting/ProspectMap.client', () => ({
  ProspectMap: () => null,
}))

vi.mock('@/app/actions/prospecting', () => ({
  attachProspectPersonAction: async () => ({ data: null, error: null }),
  enrollProspectInDripAction: async () => ({ ok: false, error: 'no' }),
  searchProspectPersonAction: async () => ({ data: [], error: null }),
}))

vi.mock('@/lib/data/prospecting/batch', () => ({
  resolveDocsBatch: (...args: unknown[]) => resolveDocsBatch(...args),
  resolveComplianceBatch: (...args: unknown[]) => resolveComplianceBatch(...args),
}))

vi.mock('@/lib/data/prospecting/drip', () => ({
  getProspectDripState: (...args: unknown[]) => getProspectDripState(...args),
}))

vi.mock('@/lib/data/prospecting/engagement', () => ({
  getProspectEngagement: (...args: unknown[]) => getProspectEngagement(...args),
  EMPTY_ENGAGEMENT: {
    reportViews: 0,
    linkTaps: 0,
    emailOpens: 0,
    emailClicks: 0,
    lastActivityAt: null,
  },
}))

vi.mock('@/lib/data/bpo/reads', () => ({
  getBpoListingCyclesByAddress: (...args: unknown[]) => getBpoListingCyclesByAddress(...args),
}))

type Mode = 'ok' | 'missing' | 'hang' | 'error'

let expiredMode: Mode = 'ok'
let listingsMode: 'ok' | 'hang' = 'ok'

const expiredRow = {
  listing_key: '22884',
  street_address: '22884 Moss Rock',
  city: 'Bend',
  postal_code: '97701',
  full_address: '22884 Moss Rock, Bend, OR 97701',
  owner_name: 'Moss Rock Trust',
  contact_phone: '5415550199',
  contact_email: 'trustee@mossrock.example',
  standard_status: 'Expired',
  expired_at: '2026-01-15',
  list_price: 725000,
  compliance_hard_stop: false,
  compliance_flags: [],
}

const listingRow = {
  ListingKey: '22884',
  PhotoURL: null,
  Latitude: 44.06,
  Longitude: -121.3,
  ListDate: '2025-06-01',
  StandardStatus: 'Active',
  public_remarks: null,
  year_built: 1998,
  lot_size_acres: 0.2,
  garage_spaces: 2,
  view_description: null,
  PropertyType: 'Residential',
}

function builder(table: string) {
  const api = {
    select() {
      return api
    },
    eq() {
      return api
    },
    in() {
      return api
    },
    maybeSingle() {
      if (table === 'expired_listings') {
        if (expiredMode === 'hang') return new Promise(() => {})
        if (expiredMode === 'error') return Promise.resolve({ data: null, error: { message: 'db down' } })
        if (expiredMode === 'missing') return Promise.resolve({ data: null, error: null })
        return Promise.resolve({ data: expiredRow, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
    then(onFulfilled: (v: { data: unknown; error: null }) => unknown, onRejected?: (e: unknown) => unknown) {
      if (table === 'listings' && listingsMode === 'hang') return new Promise(() => {})
      const value = table === 'listings' ? { data: [listingRow], error: null } : { data: [], error: null }
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
  return api
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => builder(table) }),
}))

import { ProspectDetailPanel } from '@/components/admin/prospecting/ProspectDetailPanel.client'
import {
  attachProspectOptionalPanels,
  getProspectDetailCore,
  PROSPECT_DETAIL_LOAD_ERRORS,
} from '@/lib/data/prospecting/get'

function paint(detail: ProspectDetail): string {
  return renderToStaticMarkup(
    createElement(ProspectDetailPanel, {
      detail,
      onBuild: () => {},
      onSend: () => {},
      onOpenSend: () => {},
    }),
  )
}

beforeEach(() => {
  expiredMode = 'ok'
  listingsMode = 'ok'
  resolveDocsBatch.mockReset()
  resolveComplianceBatch.mockReset()
  getProspectEngagement.mockReset()
  getProspectDripState.mockReset()
  getBpoListingCyclesByAddress.mockReset()
  resolveDocsBatch.mockResolvedValue(new Map())
  resolveComplianceBatch.mockResolvedValue(new Map())
  getProspectEngagement.mockResolvedValue({})
  getProspectDripState.mockResolvedValue({ sequenceId: null, sequenceName: null, enrolled: false })
  getBpoListingCyclesByAddress.mockResolvedValue([])
})

describe('prospect detail page data path', () => {
  it('paints email and live status while the listings join hangs, and does not 404', async () => {
    listingsMode = 'hang'
    vi.useFakeTimers()
    try {
      const pending = getProspectDetailCore('expired', '22884')
      await vi.advanceTimersByTimeAsync(4_000)
      const core = await pending
      expect(core.outcome).toBe('ok')
      if (core.outcome !== 'ok') return
      expect(resolveComplianceBatch).not.toHaveBeenCalled()
      expect(resolveDocsBatch).not.toHaveBeenCalled()
      expect(core.detail.contactEmail).toBe('trustee@mossrock.example')
      expect(core.detail.standardStatus).toBe('Expired')
      expect(core.detail.liveStatusLoadError).toBe(PROSPECT_DETAIL_LOAD_ERRORS.liveStatus)
      expect(core.detail.optionalPending).toBe(true)
      const html = paint(core.detail)
      expect(html).toContain('Owner email')
      expect(html).toContain('trustee@mossrock.example')
      expect(html).toContain('Live status')
      expect(html).toContain('Expired')
      expect(html).toContain(PROSPECT_DETAIL_LOAD_ERRORS.liveStatus)
      expect(html).toContain('Loading listing history.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails a hanging and a throwing optional source in a few seconds, with an inline error', async () => {
    const core = await getProspectDetailCore('expired', '22884')
    expect(core.outcome).toBe('ok')
    if (core.outcome !== 'ok') return
    expect(core.detail.standardStatus).toBe('Active')
    resolveComplianceBatch.mockImplementation(() => new Promise(() => {}))
    getBpoListingCyclesByAddress.mockImplementation(() => new Promise(() => {}))
    resolveDocsBatch.mockRejectedValue(new Error('cmas down'))
    vi.useFakeTimers()
    try {
      const pending = attachProspectOptionalPanels(core)
      await vi.advanceTimersByTimeAsync(4_000)
      const detail = await pending
      expect(detail.contactEmail).toBe('trustee@mossrock.example')
      expect(detail.standardStatus).toBe('Active')
      expect(detail.optionalPending).toBe(false)
      expect(detail.complianceLoadError).toBe(PROSPECT_DETAIL_LOAD_ERRORS.compliance)
      expect(detail.historyLoadError).toBe(PROSPECT_DETAIL_LOAD_ERRORS.history)
      expect(detail.docLoadError).toBe(PROSPECT_DETAIL_LOAD_ERRORS.docs)
      const html = paint(detail)
      expect(html).toContain('Owner email')
      expect(html).toContain('trustee@mossrock.example')
      expect(html).toContain('Live status')
      expect(html).toContain('Active')
      expect(html).toContain(PROSPECT_DETAIL_LOAD_ERRORS.history)
      expect(html).toContain(PROSPECT_DETAIL_LOAD_ERRORS.compliance)
      expect(html).toContain(PROSPECT_DETAIL_LOAD_ERRORS.docs)
      expect(html).not.toContain('No prior MLS listing history on file.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('404s only when the prospect row is actually missing', async () => {
    expiredMode = 'missing'
    const missing = await getProspectDetailCore('expired', '22884')
    expect(missing.outcome).toBe('missing')

    expiredMode = 'hang'
    vi.useFakeTimers()
    try {
      const pending = getProspectDetailCore('expired', '22884')
      await vi.advanceTimersByTimeAsync(4_000)
      const hung = await pending
      expect(hung.outcome).toBe('unavailable')
      if (hung.outcome === 'unavailable') expect(hung.message).toBe(PROSPECT_DETAIL_LOAD_ERRORS.core)
    } finally {
      vi.useRealTimers()
    }

    const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
    expect(page).toContain('getProspectDetailCore')
    expect(page).toContain('<Suspense')
    expect(page).toContain("core.outcome === 'missing'")
    expect(page).not.toContain('getProspectDetail(')
    expect(page).not.toMatch(/outcome === 'unavailable'[\s\S]{0,40}notFound/)
  })
})
