'use client'

import Link from 'next/link'
import { Button } from '@/components/admin/v2'
import '@/components/admin/v2/admin-v2.css'

export default function PeopleError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <h2 className="av2-lane-head">People</h2>
      <p style={{ color: 'var(--a-text)', marginBottom: 12 }}>
        People did not load. You can still add a contact, or try again.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={reset}>Try again</Button>
        <Link href="/admin/people#add-person" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          New contact
        </Link>
      </div>
    </div>
  )
}
