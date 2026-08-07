// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/new — add a contact by hand (ADMIN_UI pattern 6, config form).
// P11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// PRESENTATION ONLY.
//
// Carried over verbatim: the createContactForm 'use server' adapter and all three
// of its redirects (/admin/crm/<id> · /admin/crm · /admin/crm/new?error=…), the
// createCrmContactAction call, `dynamic = 'force-dynamic'`, the metadata title,
// the /admin/crm back href, the `?error=` read, and EVERY form field name —
// firstName · lastName · email · phone · broker · note — with the same required
// flag on firstName and the same CRM_BROKERS / CRM_BROKER_DISPLAY option list.
// No field was added: `source` is still unsent, so the action still stamps its
// own 'Manual entry' default.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), ConsoleSection's "New contact" title with it (the nav names the
// page — acceptance bar rule 1), and the two-across name row became the locked
// single column at 640px.
//
// BROKER CONTROL SWAPPED, VALUE SEMANTICS PROVEN IDENTICAL. The shadcn-backed
// BrokerSelect island became the v2 SelectField. Radix Select submits NOTHING
// when untouched; a native select submits the empty string from its first
// option. createCrmContactAction reads
// `String(formData.get('broker') ?? '').trim() || (access.access.brokerSlug ?? 'matt')`
// (app/actions/crm.ts) — an absent value and an empty string take the identical
// branch, so "Assign to me" still means the signed-in broker. Same option values,
// same name, same default.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createCrmContactAction } from '@/app/actions/crm'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { Button, SelectField, TextAreaField, TextField, VerdictLine } from '@/components/admin/v2'

export const metadata = { title: 'New contact | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function createContactForm(formData: FormData): Promise<void> {
  'use server'
  const r = await createCrmContactAction(formData)
  if (r.ok && r.personId) redirect(`/admin/crm/${r.personId}`)
  if (r.ok) redirect('/admin/crm')
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
              <b>A first name, plus an email or a phone number.</b> An existing contact is updated
              rather than duplicated.
            </>
          )}
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ margin: '0 0 20px' }}>
        <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
          Back to contacts
        </Link>
      </div>

      <form action={createContactForm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField label="First name" name="firstName" required autoComplete="off" />
        <TextField label="Last name" name="lastName" autoComplete="off" />
        <TextField label="Email" name="email" type="email" autoComplete="off" />
        <TextField label="Phone" name="phone" type="tel" autoComplete="off" />
        <SelectField label="Broker" name="broker" defaultValue="">
          <option value="">Assign to me</option>
          {CRM_BROKERS.map((b) => (
            <option key={b} value={b}>
              {CRM_BROKER_DISPLAY[b] ?? b}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Note"
          name="note"
          rows={3}
          placeholder="Where you met them, what they need"
        />
        <div>
          <Button type="submit" touch>
            Create contact
          </Button>
        </div>
      </form>
    </div>
  )
}
