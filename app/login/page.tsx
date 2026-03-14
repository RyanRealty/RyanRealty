import type { Metadata } from 'next'
import Link from 'next/link'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Ryan Realty account.',
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
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
        <h1 className="text-center text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Access your saved homes and searches
        </p>
        <LoginForm next={nextPath} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href={`/signup${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="font-medium text-accent-foreground hover:underline">
            Sign up
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
