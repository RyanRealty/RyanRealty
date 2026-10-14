/**
 * The /team/matthew-ryan prose bio (400-600 words). Facts only, from the repo:
 * VOICE.md, lib/brand/contact.ts, app/about/_v3/about-playbook.ts,
 * app/about/_v3/about-constants.ts, app/sell/_v3/sell-constants.ts,
 * docs/COPY_FROM_CURRENT_SITE.md. No client names. Never "top team".
 */
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { LISTING_FEE_PERCENT, LISTING_TERMS } from '@/app/sell/_v3/sell-constants'
import { ABOUT_LICENSES_CHECKED, FIRM_LICENSE, roleWords } from '@/app/about/_v3/about-constants'
import { formatCalendarDay } from '@/lib/format/date'

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Third-person bio rendered on /team/matthew-ryan. Built from locked brand facts. */
export function matthewRyanBio(): string {
  const office = `${BRAND.address.street} in downtown ${BRAND.address.city}`
  const licenseChecked = formatCalendarDay(ABOUT_LICENSES_CHECKED, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const firmLicense = FIRM_LICENSE.replace(/^OREA\s+/, '')

  return [
    `${BROKERS.matt.name} is the ${roleWords(BROKERS.matt.title)} of ${BRAND.name} in ${BRAND.address.city}, ${BRAND.address.regionFull}. He has been licensed in Oregon since 2012, started ${BRAND.legalName} in ${BRAND.llcSince}, and opened the Bend office in ${BRAND.foundedLabel}. His Oregon principal broker license is ${BROKERS.matt.license}. The firm's Oregon Real Estate Agency record is license ${firmLicense}, a registered business name. Both records showed as active on the Agency's public License Lookup on ${licenseChecked}.`,

    `Before real estate he served in the fire service, quietly supporting people through tough moments. That time taught him the value of earning trust through steady, reliable service, a principle he carries into every client relationship. He learned the business from his mentor, Hjalmar "Red" Erickson, whose Erickson Realty in Santa Monica was built on honesty and genuine care. Matt runs ${BRAND.name} the way Red taught him: every client gets the same care and the same effort, whether it is a first home or a ranch.`,

    `${BRAND.name} is a boutique brokerage in Central Oregon that helps clients buy and sell their properties. The office is at ${office}. The public number is ${CONTACT.phoneDirect}. The email is ${CONTACT.email.primary}. Call, text, or write, and a licensed broker replies the same business day. You talk with a broker, not a call center.`,

    `The brokerage has three licensed Oregon brokers: ${BROKERS.matt.name}, ${roleWords(BROKERS.matt.title)}; ${BROKERS.paul.nameShort}; and ${BROKERS.rebecca.nameShort}. Each broker's license, recorded closings, and direct line are on the team page. The broker you meet first is the broker who works with you through closing. There is no hand-off.`,

    `Matt helps buyers and sellers across Bend, Redmond, Sisters, Sunriver, La Pine, Terrebonne, Tumalo, and Prineville. He is a local expert who knows the neighborhoods, the resort communities, and the small details that decide whether a deal goes smoothly. His work focuses on selling homes in Central Oregon, relocation to Central Oregon, second homes in Sunriver and Vandevert Ranch, first-time home buyers, and investment property.`,

    `Sellers get a written comparative market analysis from recent sales near them, sent within 24 hours, with the comps that support the range. The CMA is free, and there is no listing agreement to get it. If you list, the listing fee is ${LISTING_FEE_PERCENT} of the sale price, with no add-on fees. ${LISTING_TERMS.covers} Photos are ready in 48 hours. The home goes on the MLS in 5 to 7 business days. You get a written report every week: showings, traffic, and feedback.`,

    `Buyers get an MLS search set to their criteria. The broker writes and negotiates the offer, reads every document with you, and stays from inspection and appraisal to the closing table.`,

    `Matt prides the office on exceptional customer service: real answers, quick responses, and careful negotiation backed by current market data. The site publishes live list prices, days on market, and closed comps from the regional MLS. Judge the brokerage on the public record: the licenses, the reviews on the reviews page, and the recorded closings.`,

    `If you want a conversation about a property or about the market, call or text ${CONTACT.phoneDirect}, email ${CONTACT.email.primary}, or book a time online.`,
  ].join('\n\n')
}

export function matthewRyanBioWordCount(text = matthewRyanBio()): number {
  return wordCount(text)
}

/** True when the bio is inside the 400-600 word public-page range. */
export function matthewRyanBioInRange(text = matthewRyanBio()): boolean {
  const n = wordCount(text)
  return n >= 400 && n <= 600
}

export const MATTHEW_RYAN_PERSON_SLUG = BROKERS.matt.slug
export const LISTING_FEE_IN_BIO = LISTING_FEE_PERCENT
