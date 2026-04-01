import type { Metadata } from 'next'
import Link from 'next/link'
import SignupForm from '@/components/auth/SignupForm'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Ryan Realty account.',
  openGraph: {
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function SignupPage({ searchParams }: Props) {
  const { next } = await searchParams
  const nextPath = next && next.startsWith('/') ? next : '/dashboard'

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="text-xl font-bold text-primary">
            Ryan Realty
          </Link>
        </div>
        <h1 className="text-center text-xl font-semibold text-foreground">Create account</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Save homes, get alerts, and stay in the loop
        </p>
        <SignupForm next={nextPath} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href={`/login${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="font-medium text-accent-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm text-muted-foreground hover:text-muted-foreground">
          Back to home
        </Link>
      </p>
    </main>
  )
}
