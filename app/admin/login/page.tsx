import type { Metadata } from 'next'
import Link from 'next/link'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = {
  title: 'Admin sign in',
  description: 'Sign in to the Ryan Realty admin portal.',
  robots: 'noindex, nofollow',
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="text-xl font-bold text-primary">
            Ryan Realty
          </Link>
        </div>
        <h1 className="text-center text-lg font-semibold text-foreground">Admin Portal</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Sign in with Google (recommended) or your admin email
        </p>
        <AdminLoginForm />
      </div>
    </main>
  )
}
