// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createCrmContactAction } from '@/app/actions/crm'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import BrokerSelect from '@/app/components/admin/BrokerSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-foreground">← Back to contacts</Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New contact</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="mb-3 text-sm font-medium text-destructive">{error}</p>
          ) : null}
          <form action={createContactForm} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" required autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" autoComplete="off" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broker">Broker</Label>
              <BrokerSelect
                name="broker"
                placeholder="Assign to me"
                options={CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] ?? b }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note</Label>
              <Textarea id="note" name="note" rows={3} placeholder="Where you met them, what they need" />
            </div>
            <p className="text-xs text-muted-foreground">
              An email or a phone number is required. If the person already exists, this updates them instead of creating a duplicate.
            </p>
            <div className="flex justify-end">
              <Button type="submit">Create contact</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
