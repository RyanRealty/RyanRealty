// @no-parity — branded token-confirm utility page, no marketing mockup (mirrors app/alerts/unsubscribe)
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unsubscribeNewsletterByToken } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { H1 } from '@/components/site/primitives'

/**
 * Unsubscribe confirmation for the Ryan Realty newsletter. The token link at
 * the bottom of every newsletter email (and the List-Unsubscribe header) points
 * here. The unsubscribe happens on a POST (the confirm button), never on GET, so
 * an email client prefetching the link cannot accidentally opt the recipient out.
 *
 * Mirrors app/alerts/unsubscribe/page.tsx.
 */

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

  if (isDone) {
    return (
      <main className="bg-background">
        <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
          <H1 className="text-2xl">You’re unsubscribed</H1>
          <p className="text-muted-foreground">
            You won’t receive the newsletter. You can subscribe again any time from the bottom of any
            page.
          </p>
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (hasToken) {
    return (
      <main className="bg-background">
        <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
          <H1 className="text-2xl">Unsubscribe from the Ryan Realty newsletter?</H1>
          <p className="text-muted-foreground">
            We’ll stop sending you the monthly newsletter. You can subscribe again any time.
          </p>
          <form action={confirmUnsubscribe.bind(null, token as string)}>
            <Button type="submit">Yes, unsubscribe me</Button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-background">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <H1 className="text-2xl">Manage newsletter</H1>
        <p className="text-muted-foreground">
          This link is missing its unsubscribe code. To stop the newsletter, use the link at the
          bottom of any newsletter email.
        </p>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  )
}
