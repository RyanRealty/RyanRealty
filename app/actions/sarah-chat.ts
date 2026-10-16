'use server'

import { getSarahListingFacts } from '@/lib/data/sarah/listing-facts'
import { getSarahDeskBroker } from '@/app/actions/sarah-desk'
import {
  answerListingQuestion,
  answerPlaceQuestion,
  listingUnknownFactEn,
  parseSarahPage,
  placeUnknownFactEn,
} from '@/lib/sarah/listing-answer'
import { getSarahPlaceFacts } from '@/lib/sarah/place-facts'
import { answerPublicRecordsQuestion, classifyPublicRecordsQuestion } from '@/lib/sarah/public-records'
import {
  looksLikeHomeSearch,
  runHomeSearch,
  type HomeSearchCard,
  type HomeSearchState,
} from '@/lib/sarah/home-search'
import { WEB_HELP_EN } from '@/lib/sarah/scripts'
import type { FlowChip } from '@/lib/sarah/intent-flow'

export type SarahChatInput = {
  pagePath: string
  question: string
}

export type SarahChatResult = {
  data: {
    reply: string
    listNumber: string | null
    pageKind: string
    cards?: HomeSearchCard[]
    seeAll?: { href: string; label: string } | null
    voiceSummary?: string
    homeSearch?: HomeSearchState
    chips?: FlowChip[] | null
  } | null
  error: string | null
}

/**
 * Page-aware Q&A. Production web chat had no chat route and no page context:
 * evaluateSarahTurn returned reply:null and the panel printed WEB_HELP_EN.
 * Listing pages load MLS facts. Area pages use the community/city registry.
 */
export async function answerSarahChat(input: SarahChatInput): Promise<SarahChatResult> {
  try {
    const question = String(input.question ?? '').trim()
    if (!question) {
      return { data: null, error: 'empty question' }
    }
    const desk = await getSarahDeskBroker()
    const broker = desk.data.firstName
    const page = parseSarahPage(input.pagePath)

    if (looksLikeHomeSearch(question)) {
      const turn = await runHomeSearch(question)
      return {
        data: {
          reply: turn.reply,
          listNumber: null,
          pageKind: 'search',
          cards: turn.cards,
          seeAll: turn.seeAll,
          voiceSummary: turn.voiceSummary,
          homeSearch: turn.next,
          chips: turn.chips,
        },
        error: null,
      }
    }

    if (page.kind === 'listing' && page.listNumber) {
      const facts = await getSarahListingFacts(page.listNumber)
      const recordsIntent = classifyPublicRecordsQuestion(question)
      const reply = recordsIntent
        ? await answerPublicRecordsQuestion({ question, facts, brokerFirstName: broker })
        : answerListingQuestion(question, facts, broker)
      const safe = reply === WEB_HELP_EN ? listingUnknownFactEn(broker) : reply
      return { data: { reply: safe, listNumber: page.listNumber, pageKind: page.kind }, error: null }
    }

    if (page.kind === 'community' || page.kind === 'city' || page.kind === 'neighborhood') {
      const facts = getSarahPlaceFacts(input.pagePath)
      const reply = answerPlaceQuestion(question, facts, broker)
      const safe = reply === WEB_HELP_EN ? placeUnknownFactEn(page.kind, broker) : reply
      return { data: { reply: safe, listNumber: null, pageKind: page.kind }, error: null }
    }

    return { data: { reply: placeUnknownFactEn('page', broker), listNumber: null, pageKind: 'other' }, error: null }
  } catch (err) {
    console.error('[answerSarahChat]', err)
    return { data: { reply: listingUnknownFactEn(), listNumber: null, pageKind: 'other' }, error: null }
  }
}
