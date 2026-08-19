/**
 * /alerts/unsubscribe - listing-alert opt-out, on the v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet utility page. Confirm on POST, never GET. No sales Sheet.
 *
 * VISITOR OBJECTIVE: Stop these alert emails in one tap, one question.
 * MACHINE OBJECTIVE: Execute a compliance-clean exit that preserves trust,
 * and offer the road back into browsing rather than a dead end.
 * EXITS: /homes-for-sale
 *
 * THE PAGE CONTRACT: deactivation on POST, token from searchParams,
 * robots noindex nofollow, deactivateListingAlertByToken.
 *
 * D11: no virtue names. No invented quote. No !.
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { deactivateListingAlertByToken } from '@/lib/data'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'

export const metadata: Metadata = {
  title: 'Manage listing alerts',
  robots: { index: false, follow: false },
}

async function confirmUnsubscribe(token: string, _formData: FormData) {
  'use server'
  if (token) {
    await deactivateListingAlertByToken(token)
  }
  redirect('/alerts/unsubscribe?done=1')
}

export default async function UnsubscribeAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>
}) {
  const { token, done } = await searchParams
  const isDone = done === '1'
  const cleanToken = (token ?? '').trim()

  let heading = 'Manage listing alerts'
  let items: V3QuietItem[]
  let form: ReactNode = null

  if (isDone) {
    heading = 'You are unsubscribed'
    items = [
      {
        kind: 'prose',
        body: 'You will not get any more listing-alert emails for that search. You can start new alerts any time from search.',
      },
      { label: 'Back to search', href: '/search' },
    ]
  } else if (cleanToken) {
    heading = 'Stop these listing alerts?'
    items = [
      {
        kind: 'prose',
        body: 'We will stop emailing you new matches for this search. You can set up alerts again any time.',
      },
    ]
    form = (
      <form action={confirmUnsubscribe.bind(null, cleanToken)}>
        <V3Button type="submit" variant="ghost">
          Yes, stop these alerts
        </V3Button>
      </form>
    )
  } else {
    items = [
      {
        kind: 'prose',
        body: 'This link is missing its unsubscribe code. To stop a listing alert, use the link at the bottom of the alert email.',
      },
      { label: 'Back to search', href: '/search' },
    ]
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Quiet id="unsubscribe" heading={heading} headingLevel={1} items={items} />
        {form}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
