import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReportPreferencesView } from '@/lib/data/crm/reportPreferences'

const readReportPreferences = vi.hoisted(() => vi.fn())
vi.mock('@/lib/data/crm/reportPreferences', () => ({ readReportPreferences }))
vi.mock('./actions', () => ({ updateReportPreference: async () => undefined }))

import EmailPreferencesPage from './page'

function view(over: Partial<ReportPreferencesView> = {}): ReportPreferencesView {
  return {
    preview: false,
    state: 'on',
    frequency: 'monthly',
    areas: [
      { slug: 'bend-larkspur', label: 'Larkspur' },
      { slug: 'bend', label: 'Bend' },
    ],
    addable: [{ slug: 'sisters', label: 'Sisters' }],
    awaitingFirstReport: false,
    nextSendLabel: 'October 29, 2026',
    emailOff: false,
    emailRestartable: false,
    reports: [
      {
        emailKey: 'k1',
        sentAt: '2026-09-30T16:00:00Z',
        dateLabel: 'September 30, 2026',
        subject: 'Bend is a seller’s market with 3.6 months of supply',
        viewUrl: 'https://ryan-realty.com/email-preferences/report?t=v.tok',
      },
    ],
    ...over,
  }
}

async function render(params: Record<string, string>) {
  const el = await EmailPreferencesPage({ searchParams: Promise.resolve(params) })
  return renderToStaticMarkup(el)
}

beforeEach(() => readReportPreferences.mockReset())

describe('/email-preferences', () => {
  it('a bad or missing link shows a plain "could not open" page and reads nothing personal', async () => {
    const html = await render({})
    expect(html).toContain('We could not open this link')
    expect(readReportPreferences).not.toHaveBeenCalled()
    readReportPreferences.mockResolvedValue({ ok: false, reason: 'unavailable' })
    expect(await render({ t: 'x' })).toContain('We could not open this link right now')
  })

  it('shows her report: state, next send, interval and areas, with every choice', async () => {
    readReportPreferences.mockResolvedValue({ ok: true, view: view(), token: { preview: false } })
    const html = await render({ t: 'm.tok' })
    expect(html).toContain('Your market report')
    expect(html).toContain('Next report on or after October 29, 2026.')
    expect(html).toContain('Monthly')
    expect(html).toContain('Larkspur')
    for (const label of ['Pause', 'Stop these reports', 'Save', 'Add', 'Remove Larkspur', 'Remove Bend', 'Stop all email']) {
      expect(html).toContain(`>${label}<`)
    }
    // Her past reports, each a door to the stored copy.
    expect(html).toContain('Your reports')
    expect(html).toContain('https://ryan-realty.com/email-preferences/report?t=v.tok')
    // The page never mounts a section tracker (the address carries a secret).
    expect(html).not.toContain('v3-section-tracker')
  })

  it('opens on one clear "Stop these reports" button from the footer Unsubscribe', async () => {
    readReportPreferences.mockResolvedValue({ ok: true, view: view(), token: { preview: false } })
    const html = await render({ t: 'm.tok', stop: '1' })
    expect(html).toContain('Stop your market report?')
    expect(html).toContain('Other email from Ryan Realty is not affected')
    expect(html).toContain('Keep my report and see my other choices')
    // The other choices wait behind the way back.
    expect(html).not.toContain('>Pause<')
  })

  it('puts "Stop all Ryan Realty email" behind a confirmation', async () => {
    readReportPreferences.mockResolvedValue({ ok: true, view: view(), token: { preview: false } })
    const html = await render({ t: 'm.tok', confirm: 'all-email' })
    expect(html).toContain('Stop all email from Ryan Realty?')
    expect(html).toContain('>Yes, stop all email<')
    expect(html).toContain('name="confirm" value="yes"')
    expect(html).toContain('Keep my email on')
  })

  it('says plainly when all email is off, and offers the restart only when she can do it herself', async () => {
    readReportPreferences.mockResolvedValue({ ok: true, view: view({ emailOff: true, emailRestartable: true }), token: { preview: false } })
    let html = await render({ t: 'm.tok' })
    expect(html).toContain('On, but not sending')
    expect(html).toContain('>Start receiving Ryan Realty email again<')
    readReportPreferences.mockResolvedValue({ ok: true, view: view({ emailOff: true, emailRestartable: false }), token: { preview: false } })
    html = await render({ t: 'm.tok' })
    expect(html).not.toContain('Start receiving Ryan Realty email again')
    expect(html).toContain('for a reason this page cannot clear')
  })

  it('words results from fixed copy only, never from the URL', async () => {
    readReportPreferences.mockResolvedValue({ ok: true, view: view({ state: 'stopped' }), token: { preview: false } })
    const html = await render({ t: 'm.tok', done: 'stopped' })
    expect(html).toContain('Your market report is stopped')
    const spoof = await render({ t: 'm.tok', done: '<script>alert(1)</script>', error: 'Call 555-0100 now' })
    expect(spoof).not.toContain('555-0100')
    expect(spoof).not.toContain('<script>alert')
  })

  it('carries no em dash anywhere', async () => {
    readReportPreferences.mockResolvedValue({ ok: true, view: view(), token: { preview: false } })
    const cases: Array<Record<string, string>> = [{ t: 'm.tok' }, { t: 'm.tok', stop: '1' }, { t: 'm.tok', confirm: 'all-email' }, {}]
    for (const params of cases) {
      expect(await render(params)).not.toContain('—')
    }
  })
})
