'use client'

import { useState } from 'react'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import { GoogleIcon } from '@/components/icons/AuthProviderIcons'
import { Button } from '@/components/ui/button'

const ADMIN_NEXT = '/admin'

/**
 * Google-only admin sign-in (Matt directive 2026-06-09: the brokerage runs on
 * Google Workspace, so Google is the single auth path). Email/password and
 * reset flows were removed from this surface; the server actions still exist
 * but have no UI entry point.
 */
export default function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const result = await signInWithOAuthBrowser('google', ADMIN_NEXT)
    if (result.error) {
      setLoading(false)
      setError(result.error)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <Button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
      >
        <GoogleIcon className="size-5 text-primary-foreground" />
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Use your @ryan-realty.com Google account.
      </p>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  )
}
