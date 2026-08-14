'use server'

/**
 * Incoming agent referral (/refer-a-client).
 *
 * Another licensed broker sends a Central Oregon buyer or seller. The client
 * becomes a crm_people row tagged referral:inbound. The sending agent becomes
 * a separate person tagged role:referring-agent. Neither auto-enrolls
 * (geoReferralEnrollBlock). Nothing is sent to the client or the agent.
 * Internal only: a broker task + queued broker alert.
 */

import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import {
  DEFAULT_INBOUND_FEE_PCT,
  INBOUND_REFERRAL_SOURCE,
  inboundAgentTags,
  inboundClientTags,
  phoneForSecondPerson,
  validateInboundReferral,
  type InboundReferralInput,
} from '@/lib/crm/inbound-referral'

export async function submitInboundAgentReferral(
  input: InboundReferralInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const checked = validateInboundReferral(input)
  if (!checked.ok) return { ok: false, error: checked.error }
  if (checked.honeypot) return { ok: true }

  const parsed = checked.parsed

  try {
    const client = await ensureNativeLead({
      name: parsed.clientName,
      email: parsed.clientEmail,
      phone: parsed.clientPhone || undefined,
      source: INBOUND_REFERRAL_SOURCE,
      tags: inboundClientTags(parsed.intent),
      assignedBroker: 'matt',
    })
    if (!client.personId) return { ok: false, error: 'Something went wrong. Please try again.' }

    const agentPhone = phoneForSecondPerson(parsed.clientPhone, parsed.agentPhone)
    const agent = await ensureNativeLead({
      name: parsed.agentName,
      email: parsed.agentEmail,
      phone: agentPhone || undefined,
      source: INBOUND_REFERRAL_SOURCE,
      tags: inboundAgentTags(),
      assignedBroker: 'matt',
    })

    await enrichNativeLead({
      personId: client.personId,
      custom: {
        inboundIntent: parsed.intent,
        inboundArea: parsed.area,
        inboundFeePct: DEFAULT_INBOUND_FEE_PCT,
        inboundSmsConsent: parsed.smsConsent,
        referringAgentName: parsed.agentName,
        referringAgentEmail: parsed.agentEmail,
        referringAgentPhone: parsed.agentPhone || null,
        referringBrokerage: parsed.brokerage,
        referringAgentPersonId: agent.personId || null,
      },
      assignedBroker: 'matt',
      originNote: {
        title: 'Inbound agent referral',
        body: [
          `Client: ${parsed.clientName} <${parsed.clientEmail}>`,
          `Intent: ${parsed.intent}. Area: ${parsed.area}.`,
          `Sending broker: ${parsed.agentName} <${parsed.agentEmail}>, ${parsed.brokerage}.`,
          parsed.notes ? `Notes: ${parsed.notes}` : null,
          `Fee recorded as ${DEFAULT_INBOUND_FEE_PCT}% of our side unless a different number is agreed in writing.`,
          'Do not contact the client until the referral is in writing. No drip enrolled.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    })

    if (agent.personId) {
      await enrichNativeLead({
        personId: agent.personId,
        custom: {
          inboundClientPersonId: client.personId,
          inboundClientName: parsed.clientName,
          inboundClientEmail: parsed.clientEmail,
          inboundIntent: parsed.intent,
          inboundArea: parsed.area,
        },
        assignedBroker: 'matt',
        originNote: {
          title: 'Sent us a client',
          body: [
            `Referred ${parsed.clientName} (${parsed.intent}, ${parsed.area}).`,
            `Client person #${client.personId}.`,
          ].join('\n'),
        },
      })
    }

    await createNativeTask({
      personId: client.personId,
      name: `Inbound referral: call ${parsed.agentName} at ${parsed.brokerage} about ${parsed.clientName}`,
      type: 'Referral',
      dueInMinutes: 240,
      assignedBroker: 'matt',
    })

    await queueBrokerAlert({
      broker: 'matt',
      personId: client.personId,
      kind: 'new-lead',
      body: [
        `Inbound referral: ${parsed.agentName} (${parsed.brokerage}) sent ${parsed.clientName} (${parsed.intent}, ${parsed.area}).`,
        'Call the sending broker first. Do not contact the client until the referral is in writing.',
        `Open the lead: ryan-realty.com/admin/people/${client.personId}`,
      ].join('\n'),
    }).catch(() => {})

    await fireLeadGenerated({
      lp_variant: 'inbound-agent-referral',
      lead_type: parsed.intent === 'sell' ? 'seller' : 'buyer',
      value: 500,
      extra: {
        referral: 'inbound',
        area: parsed.area,
        intent: parsed.intent,
        person_id: client.personId,
      },
    }).catch(() => {})

    return { ok: true }
  } catch (err) {
    console.error('[submitInboundAgentReferral]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
