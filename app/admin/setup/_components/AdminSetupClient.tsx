'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setSetupComplete } from '@/app/actions/admin-setup'
import { Button, SectionHead } from '@/components/admin/v2'

/**
 * 11F: presentation migrated to the LOCKED admin v2 language (ADMIN_UI.md).
 * PRESENTATION ONLY — this is the first-run door into the admin. The step
 * state, the setSetupComplete() call, the redirect-to-/admin on completion,
 * and the error handling are byte-for-byte unchanged; only the raw <h2>s
 * became SectionHead (ci:admin-ui rule A bans raw headings under app/admin)
 * and the Button + text classes moved to v2 tokens.
 */
export default function AdminSetupClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleComplete() {
    setError(null)
    setLoading(true)
    const result = await setSetupComplete()
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
    router.push('/admin')
  }

  return (
    <div className="mt-6 space-y-6">
      {step === 1 && (
        <section>
          <SectionHead>Step 1: Admin account</SectionHead>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Ensure your admin account exists. Sign in at the main site or use the admin login page. Your email must be granted admin access (e.g. in admin_roles or as the designated superuser).
          </p>
          <Button type="button" variant="quiet" onClick={() => setStep(2)} className="mt-3">
            Next
          </Button>
        </section>
      )}
      {step === 2 && (
        <section>
          <SectionHead>Step 2: Brokerage basics</SectionHead>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Configure brokerage name and branding in Settings after setup.
          </p>
          <Button type="button" variant="quiet" onClick={() => setStep(3)} className="mt-3">
            Next
          </Button>
        </section>
      )}
      {step === 3 && (
        <section>
          <SectionHead>Step 3: Complete</SectionHead>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            You&apos;re all set. Welcome to your admin dashboard.
          </p>
          {error && (
            <p className="mt-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
              {error}
            </p>
          )}
          <Button type="button" onClick={handleComplete} disabled={loading} className="mt-3">
            {loading ? 'Completing…' : 'Finish setup'}
          </Button>
        </section>
      )}
    </div>
  )
}
