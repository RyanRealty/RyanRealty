/**
 * /marketing/request: brokers land here from the marketing@ reply signature.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this is) then the existing RequestBuilder (capture contract
 * unchanged: send into the queue or mailto). No public sales Sheet.
 *
 * VISITOR OBJECTIVE: A Ryan Realty broker picks a deliverable and gets a
 * pre-written, pre-addressed request.
 * MACHINE OBJECTIVE: Feed well-formed requests into the marketing inbox
 * pipeline. URL is pinned by email signatures.
 * EXITS: mailto:marketing@ryan-realty.com
 *
 * THE PAGE CONTRACT: robots noindex nofollow, getSession +
 * getPersonIdFromCookie (dynamic mode), RequestBuilder two intakes.
 *
 * D11: no virtue names. No invented quote. No !.
 */

import type { Metadata } from 'next'
import RequestBuilder from './RequestBuilder'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
} from '@/components/site/v3'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'

export const metadata: Metadata = {
  title: 'Marketing request | Ryan Realty',
  description:
    'Listing kits, market reports, social posts, ads, and blog posts the Ryan Realty marketing team can draft. Pick what you need.',
  robots: { index: false, follow: false },
}

export default async function MarketingRequestPage() {
  await Promise.all([getSession(), getPersonIdFromCookie()])

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="utility" />
        <V3Quiet
          id="marketing-request"
          eyebrow="Ryan Realty marketing"
          heading="What we can build"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'Pick what you need. The team gets the request, drafts it, and replies on the email thread. Most items land in your inbox within a day. Market reports and full listing kits take longer.',
            },
            {
              kind: 'prose',
              body: 'Need something that is not on this list? Email marketing@ryan-realty.com and describe it.',
            },
            { label: 'Email marketing@ryan-realty.com', href: 'mailto:marketing@ryan-realty.com' },
          ]}
        />

        <RequestBuilder />
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
