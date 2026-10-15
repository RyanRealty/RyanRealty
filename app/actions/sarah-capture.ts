'use server'

import { sendEvent } from '@/lib/crm/send-event'
import { createCmaRequest } from '@/lib/cma-request'
import { kickCmaBuild } from '@/lib/cma/kick'
import { buildCma } from '@/lib/cma/build'
import { enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { applySarahPersonStage } from '@/lib/data/crm/sarah-stage'
import { lookupSarahAssignedBroker } from '@/lib/data/sarah/desk-broker'
import { deskBrokerFromAssigned } from '@/lib/sarah/desk-broker'
import { getSarahDeskBroker } from '@/app/actions/sarah-desk'
import {
  SARAH_SOURCE,
  SARAH_STAGE_BY_INTENT,
  sarahCaptureTags,
  sarahEventType,
  sarahOriginNote,
  type FlowAnswers,
  type SarahIntent,
} from '@/lib/sarah/intent-flow'

void buildCma

export type SarahCaptureInput = {
  intent: SarahIntent
  answers: FlowAnswers
  startCma?: boolean
}

export type SarahCaptureResult = {
  data: {
    personId: number | null
    cmaSlug: string | null
    stage: string | null
    brokerSlug: string | null
  } | null
  error: string | null
}

export async function captureSarahLead(input: SarahCaptureInput): Promise<SarahCaptureResult> {
  try {
    const name = input.answers.name?.trim() ?? ''
    const email = input.answers.email?.trim() || null
    const phone = input.answers.phone?.trim() || null
    if (!name || (!email && !phone)) {
      return { data: null, error: 'name and email or phone are required' }
    }

    const desk = await getSarahDeskBroker()
    const existingAssigned = await lookupSarahAssignedBroker({
      authEmail: email,
      phone,
    })
    const broker = existingAssigned ? deskBrokerFromAssigned(existingAssigned) : desk.data
    const tags = sarahCaptureTags(input.intent)
    const event = await sendEvent({
      type: sarahEventType(input.intent),
      source: SARAH_SOURCE,
      person: {
        firstName: name.split(/\s+/)[0],
        lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
        emails: email ? [{ value: email }] : undefined,
        phones: phone ? [{ value: phone }] : undefined,
        tags,
      },
      message: sarahOriginNote({
        intent: input.intent,
        answers: input.answers,
        brokerFirstName: broker.firstName,
      }).body,
      property: input.answers.address
        ? { street: input.answers.address, url: input.answers.address }
        : undefined,
      brokerAttribution: { brokerSlug: broker.slug, brokerEmail: broker.email },
    })
    if (!event.ok) {
      return { data: null, error: 'Could not save that just now.' }
    }
    const personId = event.personId
    const proposed = SARAH_STAGE_BY_INTENT[input.intent]
    let stage: string | null = null
    if (personId) {
      await enrichNativeLead({
        personId,
        tags,
        ...(existingAssigned ? {} : { assignedBroker: broker.slug }),
        custom: {
          sarahIntent: input.intent,
          sarahArea: input.answers.area ?? null,
          sarahBudget: input.answers.budget ?? null,
          sarahTimeline: input.answers.timeline ?? null,
          sarahAddress: input.answers.address ?? null,
        },
        originNote: sarahOriginNote({
          intent: input.intent,
          answers: input.answers,
          brokerFirstName: broker.firstName,
        }),
      })
      stage = await applySarahPersonStage(personId, proposed)
    }

    let cmaSlug: string | null = null
    if (input.startCma && input.answers.address?.trim()) {
      const cma = await createCmaRequest({
        rawAddress: input.answers.address.trim(),
        parsedStreet: input.answers.address.trim(),
        parsedCity: null,
        parsedState: 'OR',
        parsedPostalCode: null,
        leadEmail: email,
        leadName: name,
        leadPhone: phone,
        leadTimeline: input.answers.timeline ?? null,
        crmPersonId: personId,
        fubPersonId: personId,
        requestSource: 'sarah-chat',
        brokerSlug: broker.slug,
        notifyLead: false,
        notifyBroker: false,
      })
      if (cma.ok) {
        cmaSlug = cma.slug
        await kickCmaBuild(cma.slug)
      }
    }

    return { data: { personId, cmaSlug, stage, brokerSlug: broker.slug }, error: null }
  } catch (err) {
    console.error('[captureSarahLead]', err)
    return { data: null, error: 'Could not save that just now.' }
  }
}
