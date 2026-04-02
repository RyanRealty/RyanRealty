import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SentryExampleTrigger } from './SentryExampleTrigger'

export const metadata = {
  title: 'Sentry test',
  robots: { index: false, follow: false },
}

/**
 * Local and preview verification only. Production is 404 unless SENTRY_TEST_PAGE=1
 * (set on the host, e.g. Vercel preview) so you can confirm Sentry without shipping a public test route.
 */
export default function SentryExamplePage() {
  const allowInProd = process.env.SENTRY_TEST_PAGE === '1'
  if (process.env.NODE_ENV === 'production' && !allowInProd) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sentry verification</CardTitle>
          <CardDescription>
            Use the actions below, then open Sentry Issues for this app. Set SENTRY_DSN and
            NEXT_PUBLIC_SENTRY_DSN to your real DSN in the environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SentryExampleTrigger />
        </CardContent>
      </Card>
    </div>
  )
}
