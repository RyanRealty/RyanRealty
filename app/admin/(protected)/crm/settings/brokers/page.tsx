// @no-parity — internal admin surface, no public mockup contract
// Brokers (11C, v2 language migration): the CRM broker roster — who is inside
// the CRM, and who takes routed leads. Presentation only: the same cached DAL
// read (getCrmBrokers) and the same owner-guarded server actions in
// app/actions/crm-brokers.ts, posting the same `crmSlug` + `value` fields.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { setCrmBrokerActiveAction, setCrmBrokerRoutingEligibleAction } from '@/app/actions/crm-brokers'
import { Button, QueueRow, SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'

export const metadata = { title: 'Brokers | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmBrokersSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const brokers = await getCrmBrokers()

  // Each toggle posts the OPPOSITE of the flag's current value, exactly as the
  // hidden `value` field did before — the bound args carry the same payload the
  // server actions already parse out of FormData.
  async function toggleActive(crmSlug: string, value: 'on' | 'off'): Promise<void> {
    'use server'
    const formData = new FormData()
    formData.set('crmSlug', crmSlug)
    formData.set('value', value)
    await setCrmBrokerActiveAction(formData)
  }
  async function toggleRouting(crmSlug: string, value: 'on' | 'off'): Promise<void> {
    'use server'
    const formData = new FormData()
    formData.set('crmSlug', crmSlug)
    formData.set('value', value)
    await setCrmBrokerRoutingEligibleAction(formData)
  }

  const inCrm = brokers.filter((b) => b.crmActive).length
  const routing = brokers.filter((b) => b.routingEligible).length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-text-2)' }}>
          CRM settings
        </Link>
      </p>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={brokers.length === 0 ? 'attention' : 'ok'}>
          {brokers.length === 0 ? (
            <>
              <b>No CRM brokers.</b> Apply the broker config migration, then assign each broker a CRM slug.
            </>
          ) : (
            <>
              <b>
                {inCrm} of {brokers.length} broker{brokers.length === 1 ? '' : 's'} inside the CRM.
              </b>{' '}
              {routing} take{routing === 1 ? 's' : ''} routed leads.
            </>
          )}
        </VerdictLine>
      </div>

      {brokers.length > 0 ? (
        <section aria-label="Broker roster">
          <SectionHead>Roster</SectionHead>
          <ul className="av2-queue">
            {brokers.map((b) => (
              <QueueRow
                key={b.slug}
                kind={b.crmActive ? 'In CRM' : 'Off'}
                kindTone={b.crmActive ? 'ok' : 'waiting'}
                title={
                  <Link href="/admin/brokers" style={{ color: 'var(--a-text)' }}>
                    {b.name || b.slug}
                  </Link>
                }
                context={
                  <>
                    <span style={{ fontFamily: 'var(--a-font-mono)' }}>{b.slug}</span>
                    {' · '}
                    {b.email ?? 'no email'}
                    {' · '}
                    <StateWord state={b.routingEligible ? 'ok' : 'waiting'}>
                      {b.routingEligible ? 'Routing eligible' : 'No routing'}
                    </StateWord>
                  </>
                }
                action={
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <form action={toggleActive.bind(null, b.slug, b.crmActive ? 'off' : 'on')}>
                      <Button type="submit" variant="quiet">
                        {b.crmActive ? 'Turn off' : 'Turn on'}
                      </Button>
                    </form>
                    <form action={toggleRouting.bind(null, b.slug, b.routingEligible ? 'off' : 'on')}>
                      <Button type="submit" variant="quiet">
                        {b.routingEligible ? 'Stop routing' : 'Allow routing'}
                      </Button>
                    </form>
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Identity fields (name, phone, Twilio number) are edited on each{' '}
        <Link href="/admin/brokers" style={{ color: 'var(--a-accent)' }}>
          broker profile
        </Link>
        .
      </p>
    </div>
  )
}
