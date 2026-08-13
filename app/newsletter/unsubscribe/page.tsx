/**
 * /newsletter/unsubscribe - newsletter opt-out, on the v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet utility page. Confirm on POST, never GET. No sales Sheet.
 *
 * VISITOR OBJECTIVE: Stop the monthly briefing in one step.
 * MACHINE OBJECTIVE: Honor the global opt-out compliance-cleanly while
 * leaving the door open to the site.
 * EXITS: /
 *
 * THE PAGE CONTRACT: deactivation on POST, token from searchParams,
 * robots noindex nofollow, unsubscribeNewsletterByToken, force-dynamic.
 *
 * D11: no virtue names. No invented quote. No !.
 */

// @no-parity branded token-confirm utility page, no marketing mockup (mirrors app/alerts/unsubscribe)
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { unsubscribeNewsletterByToken } from '@/lib/data'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Manage newsletter',
  robots: { index: false, follow: false },
}

async function confirmUnsubscribe(token: string, _formData: FormData) {
  'use server'
  if (token) {
    await unsubscribeNewsletterByToken(token)
  }
  redirect('/newsletter/unsubscribe?done=1')
}

export default async function UnsubscribeNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>
}) {
  const { token, done } = await searchParams
  const isDone = done === '1'
  const hasToken = Boolean(token)

  let heading = 'Manage newsletter'
  let items: V3QuietItem[]
  let form: ReactNode = null

  if (isDone) {
    heading = 'You are unsubscribed'
    items = [
      {
        kind: 'prose',
        body: 'You will not receive the newsletter. You can subscribe again any time from the bottom of any page.',
      },
      { label: 'Back to home', href: '/' },
    ]
  } else if (hasToken) {
    heading = 'Unsubscribe from the Ryan Realty newsletter?'
    items = [
      {
        kind: 'prose',
        body: 'We will stop sending you the monthly newsletter. You can subscribe again any time.',
      },
    ]
    form = (
      <form action={confirmUnsubscribe.bind(null, token as string)}>
        <V3Button type="submit" variant="ghost">
          Yes, unsubscribe me
        </V3Button>
      </form>
    )
  } else {
    items = [
      {
        kind: 'prose',
        body: 'This link is missing its unsubscribe code. To stop the newsletter, use the link at the bottom of any newsletter email.',
      },
      { label: 'Back to home', href: '/' },
    ]
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="utility" />
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
