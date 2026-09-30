// @no-parity — private tokenized utility page (a market report's preferences link), not a marketing route; no mockup contract
// @no-breadcrumb — reached only from a report email's signed link; a crumb trail would lead its reader into the public graph from a private address
// @no-static-params — every render is one signed link's person, per request (force-dynamic)
/**
 * /email-preferences — the no-login market-report preferences page (Matt's
 * decisions 2026-09-29).
 *
 * Every market report carries "Manage your report" and "Unsubscribe" links
 * here, signed for the person, her subscription and the report
 * (lib/email/report-link-token.ts). No login. From here she can:
 *   - see her areas, how often the report comes, and whether it is on;
 *   - pause and resume; switch weekly / monthly / quarterly; add and remove
 *     areas;
 *   - "Stop these reports" (the report only; other email keeps working);
 *   - "Stop all Ryan Realty email", behind a confirmation;
 *   - turn all email back on herself when only her own unsubscribe stands in
 *     the way ("Start receiving Ryan Realty email again");
 *   - reread every report she was sent (each a signed web view of the stored
 *     copy).
 * The footer's Unsubscribe link lands with `stop=1`: the page opens on one
 * clear "Stop these reports" button, with a way back to every other choice.
 *
 * PRIVATE ADDRESS. The link names a person, so the page is on the private-path
 * list (lib/analytics/private-paths.ts): no tag, no page tracker, and no
 * V3SectionTracker here; no-referrer (next.config.ts); noindex; per request.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Quiet (her report) then
 * Controls (the choices) then Quiet (her past reports): no two adjacent blocks
 * share a pattern. One primary button, only on a confirmation.
 *
 * Copy follows marketing_brain_skills/brand-voice/VOICE.md: plain, first
 * person plural, no em dashes (ci:no-public-em-dash scans this file).
 */
import type { Metadata } from 'next'
import { readReportPreferences, type ReportPreferencesView } from '@/lib/data/crm/reportPreferences'
import {
  V3_ROOT_CLASS,
  V3Controls,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  type V3ControlsRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { updateReportPreference } from './actions'
import { doneAlert, errorAlert, FREQUENCY_LABEL, FREQUENCY_OPTIONS } from './copy'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your market report',
  description: 'Change or stop your Ryan Realty market report.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? '').trim()
}

function LinkProblem({ reason }: { reason: 'invalid' | 'not-found' | 'unavailable' }) {
  const unavailable = reason === 'unavailable'
  return (
    <V3Quiet
      id="report"
      heading={unavailable ? 'We could not open this link right now' : 'We could not open this link'}
      headingLevel={1}
      items={[
        {
          kind: 'prose',
          body: unavailable
            ? 'Try again in a minute. If it keeps happening, reply to any of our emails and we will take care of it.'
            : 'The link may have been cut short when it was copied. Open it again from the email, or reply to any of our emails and we will take care of it.',
        },
        { label: 'Go to ryan-realty.com', href: '/' },
      ]}
    />
  )
}

function statusItems(view: ReportPreferencesView): V3QuietItem[] {
  const items: V3QuietItem[] = []
  const state = view.state
  let value: string
  let detail: string
  if (state === 'none') {
    value = 'Not signed up'
    detail = 'You got a market report once. There is no regular report to change.'
  } else if (state === 'stopped') {
    value = 'Stopped'
    detail = 'You stopped these reports. Resume them here any time.'
  } else if (state === 'paused') {
    value = 'Paused'
    detail = 'Nothing goes out until you resume it.'
  } else if (view.emailOff) {
    value = 'On, but not sending'
    detail = 'All email from Ryan Realty is off for this address, so no report goes out.'
  } else if (view.awaitingFirstReport) {
    value = 'On'
    detail = 'Your first report has not gone out yet.'
  } else {
    value = 'On'
    detail = view.nextSendLabel ? `Next report on or after ${view.nextSendLabel}.` : 'It comes on the schedule below.'
  }
  items.push({ kind: 'fact', term: 'Your report', value, detail })
  if (state !== 'none' && view.frequency) {
    items.push({ kind: 'fact', term: 'How often', value: FREQUENCY_LABEL[view.frequency] ?? view.frequency })
  }
  if (view.areas.length > 0) {
    items.push({ kind: 'chips', term: view.areas.length === 1 ? 'Area' : 'Areas', labels: view.areas.map((a) => a.label) })
  }
  if (view.emailOff) {
    items.push({
      kind: 'fact',
      term: 'All email from Ryan Realty',
      value: 'Off',
      detail: view.emailRestartable
        ? 'Off at your request. You can turn it back on below.'
        : 'Off for a reason this page cannot clear. Reply to any of our emails and we will sort it out.',
    })
  }
  return items
}

function choiceRows(view: ReportPreferencesView, token: string): V3ControlsRow[] {
  const act = updateReportPreference
  const rows: V3ControlsRow[] = []
  const hidden = (op: string, extra: Record<string, string> = {}) => ({ t: token, op, ...extra })
  const { state } = view

  if (state === 'on') {
    rows.push({
      id: 'pause',
      term: 'Pause',
      detail: 'Take a break and keep your areas and schedule.',
      action: act,
      submit: 'Pause',
      hidden: hidden('pause'),
    })
  } else if (state === 'paused' || state === 'stopped') {
    rows.push({
      id: 'resume',
      term: 'Resume',
      detail: state === 'stopped' ? 'Start your market report again.' : 'Pick up where you left off.',
      action: act,
      submit: 'Resume',
      hidden: hidden('resume'),
    })
  }
  if (state !== 'stopped') {
    rows.push({
      id: 'stop-report',
      term: 'Stop these reports',
      detail: 'No more market reports. Other email from Ryan Realty is not affected.',
      action: act,
      submit: 'Stop these reports',
      hidden: hidden('stop'),
    })
  }
  if (state !== 'none' && view.frequency) {
    rows.push({
      id: 'frequency',
      term: 'How often',
      detail: `Now ${FREQUENCY_LABEL[view.frequency]?.toLowerCase() ?? view.frequency}.`,
      action: act,
      submit: 'Save',
      select: { name: 'frequency', label: 'How often', options: FREQUENCY_OPTIONS, defaultValue: view.frequency },
      hidden: hidden('frequency'),
    })
  }
  if (state !== 'none' && view.addable.length > 0) {
    rows.push({
      id: 'add-area',
      term: 'Add an area',
      detail: 'Cities and neighborhoods we report on.',
      action: act,
      submit: 'Add',
      select: { name: 'area', label: 'Area', options: view.addable.map((a) => ({ value: a.slug, label: a.label })) },
      hidden: hidden('add-area'),
    })
  }
  if (state !== 'none' && view.areas.length > 1) {
    for (const area of view.areas) {
      rows.push({
        id: `remove-${area.slug}`,
        term: area.label,
        detail: 'On your report.',
        action: act,
        submit: `Remove ${area.label}`,
        hidden: hidden('remove-area', { area: area.slug }),
      })
    }
  }
  if (!view.emailOff) {
    rows.push({
      id: 'all-email',
      term: 'All email from Ryan Realty',
      detail: 'Market reports and anything else we send. We ask you to confirm first.',
      action: act,
      submit: 'Stop all email',
      hidden: hidden('confirm-all-email'),
    })
  } else if (view.emailRestartable) {
    rows.push({
      id: 'all-email',
      term: 'All email from Ryan Realty',
      detail: 'Off at your request.',
      action: act,
      submit: 'Start receiving Ryan Realty email again',
      hidden: hidden('restart-all-email'),
    })
  }
  return rows
}

function reportItems(view: ReportPreferencesView): V3QuietItem[] {
  return view.reports.map((r) => ({
    label: r.subject ?? `Market report, ${r.dateLabel}`,
    href: r.viewUrl,
    detail: `Sent ${r.dateLabel}`,
    stack: true,
  }))
}

export default async function EmailPreferencesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const token = one(sp.t)
  const linkError = one(sp.error)

  let body: React.ReactNode
  if (!token) {
    body = <LinkProblem reason={linkError === 'unavailable' ? 'unavailable' : 'invalid'} />
  } else {
    const res = await readReportPreferences(token)
    if (!res.ok) {
      body = <LinkProblem reason={res.reason} />
    } else {
      const { view } = res
      const here = new URLSearchParams({ t: token }).toString()
      const selfHref = `/email-preferences?${here}`
      const done = one(sp.done)
      const alert =
        errorAlert(linkError) ??
        doneAlert(done, view) ??
        (view.preview ? doneAlert('preview', view) : null) ??
        undefined
      const stopAsk = one(sp.stop) === '1' && view.state !== 'stopped'
      const confirmAll = one(sp.confirm) === 'all-email' && !view.emailOff

      body = (
        <>
          <V3Quiet
            id="report"
            eyebrow="Ryan Realty market report"
            heading="Your market report"
            headingLevel={1}
            alert={alert}
            items={statusItems(view)}
          />
          {stopAsk ? (
            <V3Controls
              id="stop"
              heading="Stop your market report?"
              note="Other email from Ryan Realty is not affected. You can resume the report from this page any time."
              rows={[
                {
                  id: 'stop-confirm',
                  term: 'Stop these reports',
                  detail: 'No more market reports to this address.',
                  action: updateReportPreference,
                  submit: 'Stop these reports',
                  variant: 'primary',
                  hidden: { t: token, op: 'stop' },
                },
              ]}
              exit={{ label: 'Keep my report and see my other choices', href: selfHref }}
            />
          ) : confirmAll ? (
            <V3Controls
              id="all-email"
              heading="Stop all email from Ryan Realty?"
              note="Market reports, notes from your broker, and anything else we send by email all stop. To stop only the market report, use Stop these reports instead."
              rows={[
                {
                  id: 'all-email-confirm',
                  term: 'Stop all email',
                  detail: 'You can turn email back on from this page.',
                  action: updateReportPreference,
                  submit: 'Yes, stop all email',
                  variant: 'primary',
                  hidden: { t: token, op: 'stop-all-email', confirm: 'yes' },
                },
              ]}
              exit={{ label: 'Keep my email on', href: selfHref }}
            />
          ) : (
            <V3Controls
              id="choices"
              heading="Change your report"
              note="Each choice saves on its own."
              rows={choiceRows(view, token)}
            />
          )}
          {view.reports.length > 0 ? (
            <V3Quiet
              id="reports"
              heading="Your reports"
              items={reportItems(view)}
              note="Each one is the copy we sent you."
            />
          ) : null}
        </>
      )
    }
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>{body}</main>
      {/* Outside <main>: a <footer> inside sectioning content is not a
          contentinfo landmark (see app/forgot-password/page.tsx). */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
