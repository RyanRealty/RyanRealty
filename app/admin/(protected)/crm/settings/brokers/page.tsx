// @no-parity — internal admin surface, no public mockup contract
// Brokers (11C, v2 language migration): the CRM broker roster — who is inside
// the CRM, who takes routed leads, and who has the SMS agent. Presentation:
// getCrmBrokers plus owner-guarded actions in app/actions/crm-brokers.ts.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { isBrokerSmsAgentEnvEnabled, isSmsAgentBrokerSlug } from '@/lib/data/agent/broker-agent-flags'
import { setCrmBrokerActiveAction, setCrmBrokerRoutingEligibleAction } from '@/app/actions/crm-brokers'
import { Button, QueueRow, SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
import { SmsAgentToggle } from './SmsAgentToggle'

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
  const smsBrokers = brokers.filter((b) => isSmsAgentBrokerSlug(b.slug))
  const smsOn = smsBrokers.filter((b) => b.smsAgentEnabled).length
  const envOn = isBrokerSmsAgentEnvEnabled()

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-text-2)' }}>
          CRM settings
        </Link>
      </p>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={brokers.length === 0 || !envOn ? 'attention' : 'ok'}>
          {brokers.length === 0 ? (
            <>
              <b>No CRM brokers.</b> Apply the broker config migration, then assign each broker a CRM slug.
            </>
          ) : (
            <>
              <b>
                {inCrm} of {brokers.length} broker{brokers.length === 1 ? '' : 's'} inside the CRM.
              </b>{' '}
              {routing} take{routing === 1 ? 's' : ''} routed leads.{' '}
              {smsOn} SMS agent{smsOn === 1 ? '' : 's'} on.
              {envOn
                ? ' Site-wide env is on.'
                : ' Site-wide env is off, so the marketing line will not reply.'}
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

      {smsBrokers.length > 0 ? (
        <section aria-label="SMS agent">
          <SectionHead>SMS agent</SectionHead>
          <ul className="av2-queue">
            {smsBrokers.map((b) => (
              <QueueRow
                key={`sms-${b.slug}`}
                kind={b.smsAgentEnabled ? 'On' : 'Off'}
                kindTone={b.smsAgentEnabled ? (envOn ? 'ok' : 'slow') : 'waiting'}
                title={
                  <Link href="/admin/brokers" style={{ color: 'var(--a-text)' }}>
                    {b.name || b.slug}
                  </Link>
                }
                context="Texts from this broker cell to the marketing line."
                action={
                  <SmsAgentToggle
                    crmSlug={b.slug}
                    brokerName={b.name || b.slug}
                    initialEnabled={b.smsAgentEnabled}
                    envEnabled={envOn}
                  />
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
