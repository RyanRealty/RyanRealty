import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCmaServeHead = vi.fn()
const getCmaStoredHtmlBySlug = vi.fn()
const getCmaRenderSourceBySlug = vi.fn()
const getCmaAccessIdentity = vi.fn()
const renderImmersiveCmaHtml = vi.fn(() => '<html><body>DRAFT CMA FROM RENDER_ARGS</body></html>')
const getCmaCityClosedDuring = vi.fn(async () => [] as unknown[])
const getLikeHomeSales = vi.fn(async () => [] as unknown[])
const BROKER_ROW = {
  id: 'broker-1',
  slug: 'matthew-ryan',
  display_name: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  license_number: '201212345',
  email: 'matt@ryan-realty.com',
  twilio_number: '5415550100',
  photo_url: null,
}
const getCmaBrokerBySlugOrEmail = vi.fn(async () => BROKER_ROW)
const buildCmaMapDataUri = vi.fn(async () => ({ dataUri: 'data:image/png;base64,MAP' }))
const cmaMapOptionsFromArgs = vi.fn(() => ({}))

vi.mock('@/lib/data', () => ({
  getCmaServeHead: (...args: unknown[]) => getCmaServeHead(...args),
  getCmaStoredHtmlBySlug: (...args: unknown[]) => getCmaStoredHtmlBySlug(...args),
  getCmaRenderSourceBySlug: (...args: unknown[]) => getCmaRenderSourceBySlug(...args),
  getCmaAccessIdentity: (...args: unknown[]) => getCmaAccessIdentity(...args),
}))

vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaCityClosedDuring: () => getCmaCityClosedDuring(),
  getLikeHomeSales: () => getLikeHomeSales(),
  getCmaBrokerBySlugOrEmail: (...args: unknown[]) => getCmaBrokerBySlugOrEmail(...args),
}))

vi.mock('@/lib/cma/immersive', () => ({
  renderImmersiveCmaHtml: (...args: unknown[]) =>
    (renderImmersiveCmaHtml as (...inner: unknown[]) => string)(...args),
}))

vi.mock('@/lib/cma/map', () => ({
  buildCmaMapDataUri: (...args: unknown[]) => buildCmaMapDataUri(...args),
  cmaMapOptionsFromArgs: (...args: unknown[]) => cmaMapOptionsFromArgs(...args),
}))

vi.mock('@/lib/cma/market-area-hydrate', () => ({
  hydrateCmaMarketArea: vi.fn(async (args: unknown) => args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))

import { serveCmaDocument } from './serve-document'

const DRAFT_SLUG = 'cma-850-quince-redmond-97756'

const draftHead = {
  html_path: 'pending:cma-850-quince-redmond-97756',
  status: 'draft',
  broker_slug: 'matthew-ryan',
}

const draftFromRenderArgs = {
  html_path: 'pending:cma-850-quince-redmond-97756',
  status: 'draft',
  render_args: { comps: [], subject: { address: '850 Quince Ave' } },
  broker_slug: 'matthew-ryan',
  build_summary: null,
}

describe('serveCmaDocument', () => {
  beforeEach(() => {
    getCmaServeHead.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    getCmaAccessIdentity.mockReset()
    renderImmersiveCmaHtml.mockClear()
    renderImmersiveCmaHtml.mockImplementation(() => '<html><body>DRAFT CMA FROM RENDER_ARGS</body></html>')
    getCmaBrokerBySlugOrEmail.mockReset()
    getCmaBrokerBySlugOrEmail.mockImplementation(async () => BROKER_ROW)
    buildCmaMapDataUri.mockReset()
    buildCmaMapDataUri.mockImplementation(async () => ({ dataUri: 'data:image/png;base64,MAP' }))
    getCmaCityClosedDuring.mockReset()
    getCmaCityClosedDuring.mockResolvedValue([])
    getLikeHomeSales.mockReset()
    getLikeHomeSales.mockResolvedValue([])
  })

  // Matt 2026-10-07: "Don't require a sign in to view the report."
  it('opens a delivered report for an anonymous visitor, with no sign-in door', async () => {
    getCmaServeHead.mockResolvedValue({ html_path: 'db:cmas.html_content:cma-2566-keats', status: 'delivered', broker_slug: 'matthew-ryan' })
    getCmaRenderSourceBySlug.mockResolvedValue({ ...draftFromRenderArgs, status: 'delivered' })
    getCmaAccessIdentity.mockResolvedValue({
      personId: 12959,
      clientEmail: 'owner@msn.com',
      clientName: 'Owner',
      subjectAddress: '2566 Keats, Bend, OR 97701',
      personEmails: ['owner@msn.com'],
      claimedBy: null,
      consentRecorded: false,
    })
    const result = await serveCmaDocument({
      slug: 'cma-2566-keats',
      requestUrl: 'https://ryan-realty.com/cma/cma-2566-keats?utm_source=cma',
      isAdmin: false,
      viewerEmail: null,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.status).toBe(200)
    expect(result.html).toContain('DRAFT CMA FROM RENDER_ARGS')
    expect(result.html).not.toMatch(/Continue with Google|Sign in to open/i)
    // A stranger is not the recipient, so no consent bar either.
    expect(result.html).not.toContain('rr-consent-bar')
  })

  it('opens a delivered report for someone signed in as a different person', async () => {
    getCmaServeHead.mockResolvedValue({ html_path: 'db:cmas.html_content:cma-2566-keats', status: 'delivered', broker_slug: 'matthew-ryan' })
    getCmaRenderSourceBySlug.mockResolvedValue({ ...draftFromRenderArgs, status: 'delivered' })
    getCmaAccessIdentity.mockResolvedValue({
      personId: 12959,
      clientEmail: 'owner@msn.com',
      clientName: 'Owner',
      subjectAddress: '2566 Keats',
      personEmails: ['owner@msn.com'],
      claimedBy: null,
      consentRecorded: true,
    })
    const result = await serveCmaDocument({
      slug: 'cma-2566-keats',
      requestUrl: 'https://ryan-realty.com/cma/cma-2566-keats',
      isAdmin: false,
      viewerEmail: 'someone-else@gmail.com',
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.status).toBe(200)
    expect(result.html).toContain('DRAFT CMA FROM RENDER_ARGS')
  })

  it('still 404s a draft for the public', async () => {
    getCmaServeHead.mockResolvedValue(draftHead)
    const result = await serveCmaDocument({
      slug: DRAFT_SLUG,
      requestUrl: `https://ryan-realty.com/cma/${DRAFT_SLUG}`,
      isAdmin: false,
      viewerEmail: null,
    })
    expect(result.kind).toBe('json')
    if (result.kind !== 'json') return
    expect(result.status).toBe(404)
  })

  it('lets a broker GET a draft from render_args when html_content is missing', async () => {
    getCmaServeHead.mockResolvedValue(draftHead)
    getCmaStoredHtmlBySlug.mockResolvedValue(null)
    getCmaRenderSourceBySlug.mockResolvedValue(draftFromRenderArgs)
    const result = await serveCmaDocument({
      slug: DRAFT_SLUG,
      requestUrl: `https://ryan-realty.com/admin/cmas/${DRAFT_SLUG}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.status).toBe(200)
    expect(result.html).toContain('DRAFT CMA FROM RENDER_ARGS')
    expect(renderImmersiveCmaHtml).toHaveBeenCalled()
  })

  it('prefers live immersive from render_args on admin Open report (C1/C4/C9 Tip Ready)', async () => {
    getCmaServeHead.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-648-se-douglas',
      status: 'draft',
      broker_slug: 'matthew-ryan',
    })
    getCmaStoredHtmlBySlug.mockResolvedValue('<html><body>648 SE Douglas stored</body></html>')
    getCmaRenderSourceBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-648-se-douglas',
      status: 'draft',
      render_args: {
        comps: [{ address: '1 Pine', latitude: 43.7, longitude: -121.5 }],
        subject: { streetAddress: '648 SE Douglas', latitude: 43.71, longitude: -121.51 },
      },
      broker_slug: 'matthew-ryan',
      build_summary: null,
    })
    const result = await serveCmaDocument({
      slug: 'cma-648-se-douglas',
      requestUrl: 'https://ryan-realty.com/admin/cmas/cma-648-se-douglas/view',
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).toContain('DRAFT CMA FROM RENDER_ARGS')
    expect(renderImmersiveCmaHtml).toHaveBeenCalled()
    expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
  })

  it('falls back to stored HTML when render_args immersive cannot render', async () => {
    getCmaServeHead.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-648-se-douglas',
      status: 'draft',
      broker_slug: 'matthew-ryan',
    })
    getCmaRenderSourceBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-648-se-douglas',
      status: 'draft',
      render_args: null,
      broker_slug: 'matthew-ryan',
      build_summary: null,
    })
    getCmaStoredHtmlBySlug.mockResolvedValue('<html><body>648 SE Douglas stored</body></html>')
    const result = await serveCmaDocument({
      slug: 'cma-648-se-douglas',
      requestUrl: 'https://ryan-realty.com/admin/cmas/cma-648-se-douglas/view',
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).toContain('648 SE Douglas stored')
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
  })

  it('404s a missing slug without loading blobs', async () => {
    getCmaServeHead.mockResolvedValue(null)
    const result = await serveCmaDocument({
      slug: 'cma-648-douglas',
      requestUrl: 'https://ryan-realty.com/admin/cmas/cma-648-douglas/view',
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result).toEqual({ kind: 'json', status: 404, body: { error: 'CMA not found' } })
    expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
    expect(getCmaRenderSourceBySlug).not.toHaveBeenCalled()
  })

  it('serves the unavailable page when the head read times out, not CMA not found', async () => {
    vi.useFakeTimers()
    try {
      getCmaServeHead.mockImplementation(() => new Promise(() => {}))
      const pending = serveCmaDocument({
        slug: 'cma-3859-oakside',
        requestUrl: 'https://ryan-realty.com/admin/cmas/cma-3859-oakside/view',
        isAdmin: true,
        viewerEmail: 'matt@ryan-realty.com',
        skipRegisterGate: true,
        adminReview: true,
      })
      await vi.advanceTimersByTimeAsync(4_000)
      const result = await pending
      expect(result.kind).toBe('html')
      if (result.kind !== 'html') return
      expect(result.status).toBe(200)
      expect(result.html).toContain('This report exists, but it did not finish rendering')
      expect(result.html).not.toContain('CMA not found')
      expect(getCmaRenderSourceBySlug).not.toHaveBeenCalled()
      expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('serves the unavailable page when the head read throws, not CMA not found', async () => {
    getCmaServeHead.mockRejectedValue(new Error('getCmaServeHead failed: statement timeout'))
    const result = await serveCmaDocument({
      slug: 'cma-3859-oakside',
      requestUrl: 'https://ryan-realty.com/admin/cmas/cma-3859-oakside/view',
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
      adminReview: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.status).toBe(200)
    expect(result.html).toContain('This report exists, but it did not finish rendering')
    expect(result.html).not.toContain('CMA not found')
    expect(getCmaRenderSourceBySlug).not.toHaveBeenCalled()
  })

  it('runs the broker read in parallel with the map rebuild', async () => {
    vi.useFakeTimers()
    try {
      getCmaBrokerBySlugOrEmail.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(BROKER_ROW), 2_000)
          }),
      )
      buildCmaMapDataUri.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ dataUri: 'data:image/png;base64,MAP' }), 2_000)
          }),
      )
      getCmaServeHead.mockResolvedValue(draftHead)
      getCmaRenderSourceBySlug.mockResolvedValue(draftFromRenderArgs)
      let settled: Awaited<ReturnType<typeof serveCmaDocument>> | undefined
      void serveCmaDocument({
        slug: DRAFT_SLUG,
        requestUrl: `https://ryan-realty.com/admin/cmas/${DRAFT_SLUG}/view`,
        isAdmin: true,
        viewerEmail: 'matt@ryan-realty.com',
        skipRegisterGate: true,
        adminReview: true,
      }).then((result) => {
        settled = result
        return result
      })
      await vi.advanceTimersByTimeAsync(1_000)
      expect(settled).toBeUndefined()
      await vi.advanceTimersByTimeAsync(1_000)
      expect(settled).toBeDefined()
      expect(settled?.kind).toBe('html')
      if (settled?.kind !== 'html') return
      expect(settled.html).toContain('DRAFT CMA FROM RENDER_ARGS')
      expect(getCmaBrokerBySlugOrEmail).toHaveBeenCalled()
      expect(buildCmaMapDataUri).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps anonymous /cma/{draft} as 404', async () => {
    getCmaServeHead.mockResolvedValue(draftHead)
    const result = await serveCmaDocument({
      slug: DRAFT_SLUG,
      requestUrl: `https://ryan-realty.com/cma/${DRAFT_SLUG}`,
      isAdmin: false,
      viewerEmail: null,
    })
    expect(result).toEqual({ kind: 'json', status: 404, body: { error: 'CMA not found' } })
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
    expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
  })

  it('still renders a draft when the live market and credit reads hang', async () => {
    vi.useFakeTimers()
    try {
      getCmaCityClosedDuring.mockImplementation(() => new Promise(() => {}))
      getLikeHomeSales.mockImplementation(() => new Promise(() => {}))
      getCmaServeHead.mockResolvedValue({
        html_path: 'db:cmas.html_content:cma-3711-purcell',
        status: 'draft',
        broker_slug: 'matthew-ryan',
      })
      getCmaRenderSourceBySlug.mockResolvedValue({
        html_path: 'db:cmas.html_content:cma-3711-purcell',
        status: 'draft',
        broker_slug: 'matthew-ryan',
        build_summary: null,
        render_args: {
          comps: [{ address: '3700 Purcell' }],
          subject: {
            streetAddress: '3711 Purcell',
            city: 'Bend',
            subdivision: 'Northwest Crossing',
            sqft: 1800,
            yearBuilt: 2004,
            latitude: 44.06,
            longitude: -121.3,
          },
          expiredAudit: { finalCycle: { listDate: '2025-01-15', offMarketDate: '2025-06-01' } },
          generatedAtIso: '2025-06-02T00:00:00.000Z',
        },
      })
      const pending = serveCmaDocument({
        slug: 'cma-3711-purcell',
        requestUrl: 'https://ryan-realty.com/admin/cmas/cma-3711-purcell/view',
        isAdmin: true,
        viewerEmail: 'matt@ryan-realty.com',
        skipRegisterGate: true,
      })
      await vi.advanceTimersByTimeAsync(4_000)
      const result = await pending
      expect(result.kind).toBe('html')
      if (result.kind !== 'html') return
      expect(result.html).toContain('DRAFT CMA FROM RENDER_ARGS')
      expect(result.html).not.toContain('CMA not found')
    } finally {
      vi.useRealTimers()
      getCmaCityClosedDuring.mockImplementation(async () => [])
      getLikeHomeSales.mockImplementation(async () => [])
    }
  })

  it('serves stored HTML when immersive render hangs, not a blank response', async () => {
    vi.useFakeTimers()
    try {
      renderImmersiveCmaHtml.mockImplementation(() => new Promise(() => {}) as unknown as string)
      getCmaServeHead.mockResolvedValue(draftHead)
      getCmaRenderSourceBySlug.mockResolvedValue(draftFromRenderArgs)
      getCmaStoredHtmlBySlug.mockResolvedValue('<html><body>stored purcell letter</body></html>')
      const pending = serveCmaDocument({
        slug: DRAFT_SLUG,
        requestUrl: `https://ryan-realty.com/admin/cmas/${DRAFT_SLUG}/view`,
        isAdmin: true,
        viewerEmail: 'matt@ryan-realty.com',
        skipRegisterGate: true,
      })
      await vi.advanceTimersByTimeAsync(12_000)
      const result = await pending
      expect(result.kind).toBe('html')
      if (result.kind !== 'html') return
      expect(result.html).toContain('stored purcell letter')
      expect(result.html).not.toContain('CMA not found')
    } finally {
      vi.useRealTimers()
      renderImmersiveCmaHtml.mockImplementation(() => '<html><body>DRAFT CMA FROM RENDER_ARGS</body></html>')
    }
  })
})

/**
 * tasteReview round three, §2: a row whose own audit says "indefensible"
 * rendered as a finished opinion on both surfaces. The broker's view now
 * carries the gate; the client's link never does, admin session or not.
 */
describe('needs review — the broker gate', () => {
  const readySlug = 'cma-2465-7th-redmond-97756'
  const readyHead = { html_path: 'pending:x', status: 'delivered', broker_slug: 'matthew-ryan' }
  const flagged = {
    ...readyHead,
    render_args: {
      comps: [],
      subject: { address: '2465 7th' },
      pricing: {
        review: {
          needsReview: true,
          reasons: ['The recommendation sits far above the machine-adjusted values of the three sales kept.'],
          auditVerdict: 'A broker should confirm the comp selection before this goes to a client.',
        },
      },
    },
    build_summary: null,
  }

  beforeEach(() => {
    getCmaServeHead.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    getCmaServeHead.mockResolvedValue(readyHead)
    getCmaStoredHtmlBySlug.mockResolvedValue(null)
    getCmaRenderSourceBySlug.mockResolvedValue(flagged)
    renderImmersiveCmaHtml.mockReset()
    renderImmersiveCmaHtml.mockImplementation(() => '<html><body>DRAFT CMA FROM RENDER_ARGS</body></html>')
    getCmaBrokerBySlugOrEmail.mockReset()
    getCmaBrokerBySlugOrEmail.mockImplementation(async () => BROKER_ROW)
    buildCmaMapDataUri.mockReset()
    buildCmaMapDataUri.mockImplementation(async () => ({ dataUri: 'data:image/png;base64,MAP' }))
  })

  it('banners the admin view, at the top of the document', async () => {
    const result = await serveCmaDocument({
      slug: readySlug,
      requestUrl: `https://ryan-realty.com/admin/cmas/${readySlug}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
      adminReview: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).toContain('Needs review before it goes out:')
    expect(result.html).toContain('A broker should confirm the comp selection')
    expect(result.html.indexOf('cma-review-gate')).toBeLessThan(
      result.html.indexOf('DRAFT CMA FROM RENDER_ARGS'),
    )
    expect(getCmaRenderSourceBySlug).toHaveBeenCalledTimes(1)
  })

  it('banners stored HTML from the render source already in hand', async () => {
    renderImmersiveCmaHtml.mockImplementation(() => null as unknown as string)
    getCmaStoredHtmlBySlug.mockResolvedValue('<html><body>stored review letter</body></html>')
    const result = await serveCmaDocument({
      slug: readySlug,
      requestUrl: `https://ryan-realty.com/admin/cmas/${readySlug}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
      adminReview: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).toContain('stored review letter')
    expect(result.html).toContain('Needs review before it goes out:')
    expect(getCmaRenderSourceBySlug).toHaveBeenCalledTimes(1)
  })

  it('never banners the public path, even with an admin session', async () => {
    for (const isAdmin of [true, false]) {
      const result = await serveCmaDocument({
        slug: readySlug,
        requestUrl: `https://ryan-realty.com/cma/${readySlug}`,
        isAdmin,
        viewerEmail: isAdmin ? 'matt@ryan-realty.com' : null,
        skipRegisterGate: true,
      })
      expect(result.kind).toBe('html')
      if (result.kind !== 'html') return
      expect(result.html).not.toContain('Needs review before it goes out')
      expect(result.html).not.toContain('indefensible')
    }
  })

  it('stays quiet on the admin view when the row is clean', async () => {
    getCmaRenderSourceBySlug.mockResolvedValue({
      ...flagged,
      render_args: { comps: [], subject: {}, pricing: { needsReview: false, reviewReason: null } },
    })
    const result = await serveCmaDocument({
      slug: readySlug,
      requestUrl: `https://ryan-realty.com/admin/cmas/${readySlug}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
      adminReview: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).not.toContain('Needs review before it goes out')
  })

  it('reads the older needsReview / reviewReason pair on stored rows', async () => {
    getCmaRenderSourceBySlug.mockResolvedValue({
      ...flagged,
      render_args: {
        comps: [],
        subject: {},
        pricing: { needsReview: true, reviewReason: 'The comp set is too heterogeneous.' },
      },
    })
    const result = await serveCmaDocument({
      slug: readySlug,
      requestUrl: `https://ryan-realty.com/admin/cmas/${readySlug}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
      adminReview: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).toContain(
      'Needs review before it goes out: The comp set is too heterogeneous.',
    )
  })
})

describe('D27 — a delivered CMA is frozen', () => {
  // The freeze is currently true only because both call sites happen to pass
  // false. That is one edit away from silently restating the market figures on a
  // document a client already holds, so pin it here rather than trusting the
  // argument to stay put.
  it('never re-hydrates the market area on the served document', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/cma/serve-document.ts'), 'utf8')
    // Single-line matches only, so the multi-line declaration is not mistaken
    // for a call site.
    const calls = src.match(/immersiveFromRow\([^)\n]+\)/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call).toContain('false')
    expect(src).not.toMatch(/immersiveFromRow\([^)]*,\s*true\s*\)/)
  })
})
