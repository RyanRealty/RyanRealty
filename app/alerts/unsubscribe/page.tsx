import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { deactivateGuestAlertByToken } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { H1 } from '@/components/site/primitives'

/**
 * Unsubscribe confirmation for guest listing alerts (the token link at the
 * bottom of every guest alert email points here). The deactivation happens on
 * a POST (the confirm button), never on GET, so an email client prefetching the
 * link cannot accidentally unsubscribe the recipient.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Manage listing alerts',
  robots: { index: false, follow: false },
}

async function confirmUnsubscribe(token: string, _formData: FormData) {
  'use server'
  if (token) await deactivateGuestAlertByToken(token)
  redirect('/alerts/unsubscribe?done=1')
}

export default async function UnsubscribeAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>
}) {
  const { token, done } = await searchParams
  const isDone = done === '1'

  return (
    <main className="bg-background">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        {isDone ? (
          <>
            <H1 className="text-2xl">You&apos;re unsubscribed</H1>
            <p className="text-muted-foreground">
              You won&apos;t get any more listing-alert emails for that search. You can start new alerts
              any time from the search page.
            </p>
            <Button asChild>
              <Link href="/search">Back to search</Link>
            </Button>
          </>
        ) : !token ? (
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
        ) : (
          <>
            <H1 className="text-2xl">Stop these listing alerts?</H1>
            <p className="text-muted-foreground">
              We&apos;ll stop emailing you new matches for this search. You can set up alerts again any time.
            </p>
            <form action={confirmUnsubscribe.bind(null, token)}>
              <Button type="submit">Yes, stop these alerts</Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
