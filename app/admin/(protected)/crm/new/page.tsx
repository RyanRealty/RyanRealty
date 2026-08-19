// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/new — quick add. Name + email + phone. Address is a first-class
// field, never a note. Create lands on person detail for stage, tags,
// relationships, long notes, assignment extras, and property.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createCrmContactAction } from '@/app/actions/crm'
import { Button, TextField, VerdictLine } from '@/components/admin/v2'

export const metadata = { title: 'New contact | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function createContactForm(formData: FormData): Promise<void> {
  'use server'
  const r = await createCrmContactAction(formData)
  if (r.ok && r.personId) redirect(`/admin/people/${r.personId}`)
  if (r.ok) redirect('/admin/people')
  redirect(`/admin/crm/new?error=${encodeURIComponent(r.error ?? 'create failed')}`)
}

export default async function CrmNewContactPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  return (
    <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 12px' }}>
        <VerdictLine tone={error ? 'attention' : 'ok'}>
          {error ? (
            <>
              <b>{error}</b> Nothing was saved.
            </>
          ) : (
            <>
              <b>First name, email, and phone.</b> Address is a field, not a note. You land on the person next.
            </>
          )}
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ margin: '0 0 20px' }}>
        <Link href="/admin/people" style={{ color: 'var(--a-accent)' }}>
          Back to people
        </Link>
      </div>

      <form action={createContactForm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField label="First name" name="firstName" required autoComplete="off" />
        <TextField label="Last name" name="lastName" autoComplete="off" />
        <TextField label="Phone" name="phone" type="tel" required autoComplete="off" />
        <TextField label="Email" name="email" type="email" required autoComplete="off" />
        <TextField label="Street" name="street" autoComplete="street-address" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 88px', gap: 12 }}>
          <TextField label="City" name="city" autoComplete="address-level2" />
          <TextField label="State" name="state" defaultValue="OR" autoComplete="address-level1" />
          <TextField label="Zip" name="zip" autoComplete="postal-code" />
        </div>
        <div>
          <Button type="submit" touch>
            New contact
          </Button>
        </div>
      </form>
    </div>
  )
}
