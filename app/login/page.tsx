import type { Metadata } from 'next'
import Link from 'next/link'
import LoginForm from '@/components/auth/LoginForm'
import { H1 } from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Ryan Realty account.',
  openGraph: {
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams
  const nextPath = next && next.startsWith('/') ? next : '/account'

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      {/* No re-typeset wordmark here — the global SiteHeader above already
          carries the real Amboqia wordmark; re-rendering "Ryan Realty" in
          bold Geist put the brand name on screen twice in two different
          typefaces, and the design system says the wordmark is never
          re-typeset (design-audit P3). */}
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <H1 className="text-center text-xl text-foreground">Sign in</H1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Access your saved homes and searches
        </p>
        <LoginForm next={nextPath} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href={`/signup${nextPath !== '/account' ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="font-medium text-accent-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm font-medium text-accent-foreground hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  )
}
