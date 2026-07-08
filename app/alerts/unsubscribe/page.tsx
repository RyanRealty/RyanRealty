import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { deactivateListingAlertByToken } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { H1 } from '@/components/site/primitives'

/**
 * Unsubscribe confirmation for listing alerts (the token link at the bottom of
 * every alert email points here). The deactivation happens on a POST (the
 * confirm button), never on GET, so an email client prefetching the link
 * cannot accidentally unsubscribe the recipient. Reading searchParams makes
 * the page request-time rendered.
 */

export const metadata: Metadata = {
  title: 'Manage listing alerts',
  robots: { index: false, follow: false },
}

async function confirmUnsubscribe(token: string, _formData: FormData) {
  'use server'
  // One token namespace: every alert (guest or signed-in) lives in the unified
  // listing_alerts table, so a single deactivate covers both legacy flows.
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

  return (
    <main className="bg-background">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        {isDone ? (
          <>
            <H1 className="text-2xl">You’re unsubscribed</H1>
            <p className="text-muted-foreground">
              You won’t get any more listing-alert emails for that search. You can start new alerts
              any time from the search page.
            </p>
            <Button asChild>
              <Link href="/search">Back to search</Link>
            </Button>
          </>
        ) : cleanToken ? (
          <>
            <H1 className="text-2xl">Stop these listing alerts?</H1>
            <p className="text-muted-foreground">
              We’ll stop emailing you new matches for this search. You can set up alerts again any time.
            </p>
            <form action={confirmUnsubscribe.bind(null, cleanToken)}>
              <Button type="submit">Yes, stop these alerts</Button>
            </form>
          </>
        ) : (
          <>
            <H1 className="text-2xl">Manage listing alerts</H1>
            <p className="text-muted-foreground">
              This link is missing its unsubscribe code. To stop a listing alert, use the link at the
              bottom of the alert email.
            </p>
            <Button asChild>
              <Link href="/search">Back to search</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
