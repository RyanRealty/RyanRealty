/**
 * lib/studio/caption.ts — the words on the post.
 *
 * Two hard constraints, both mechanical:
 *
 *   Voice. Ryan Realty's canon is state the fact, then stop. The single most
 *   broken rule is a sentence whose job is to explain the sentence before it,
 *   so the system prompt bans that shape outright and checkBrandVoice() gets
 *   the last word. A caption that fails voice is regenerated once, then the
 *   draft dies. We do not ship a caption the gate rejected.
 *
 *   Figures. Every number in a caption is passed in from a verified source,
 *   never invented by the model. The model is told the numbers as literal
 *   strings and told it may not compute, round, or add any others. That is
 *   CLAUDE.md §0 expressed as a prompt constraint, backed by a check.
 */
import { generateGrokStructured } from '@/lib/grok/text'
import { checkBrandVoice } from '@/lib/voice/check'
import { stripDashes, hasDashes } from '@/lib/punctuation-guard'

export type CaptionRequest = {
  /** What this post is about, in plain language. */
  subject: string
  /**
   * Verified figures the caption MAY use, already formatted for display.
   * e.g. { 'median list price': '$749,000', 'active listings': '412' }
   */
  figures?: Record<string, string>
  /** Live context from research. Never a source for a figure. */
  context?: string
  /** Where this is going, so length lands right. */
  platforms: string[]
  /** Optional call to action, already brand-approved. */
  cta?: string
  /**
   * What the media actually shows, from the vision gate or the source.
   * Without it the model guesses, and it guessed "text graphic" for a
   * landscape clip.
   */
  mediaDescription?: string
}

export type CaptionResult = {
  caption: string
  /** Accessibility text for the media. */
  altText: string
  costUsd: number | null
  attempts: number
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    caption: { type: 'string' },
    altText: { type: 'string' },
  },
  required: ['caption', 'altText'],
  additionalProperties: false,
}

const SYSTEM = [
  'You write social copy for Ryan Realty, a licensed real estate brokerage in Bend, Oregon.',
  'Voice: state the fact, then stop.',
  '',
  'Open with the subject exactly as it is given to you. It is a place or an address, and it is the first thing on the line.',
  'Never open with "This", "It", "Here", "Welcome", "Introducing", or "Just listed".',
  'Never write filler verbs around a fact: no "is located in", "features", "boasts", "offers", "comes with", "you will find".',
  'A figure can stand as its own fragment. "$849,900. Two bedrooms, two baths." is correct and complete.',
  'Never write a sentence whose only job is to explain or soften the sentence before it.',
  'No hype words, no superlatives, no rhetorical questions, no emoji, no hashtags.',
  'No em dashes and no en dashes. Use a period.',
  'Under 40 words. Fewer is better. Say the true thing once.',
  'You may use only the figures you are given, exactly as written. You may not compute, round, estimate, or introduce any other number, date, or percentage.',
  'Do not describe the image. Do not say "swipe", "link in bio", or "DM us".',
  'altText plainly describes the media for a screen reader in one sentence, using only what you are told the media shows. Never guess at the media. If you are not told, describe the subject plainly instead.',
].join('\n')

function buildPrompt(request: CaptionRequest): string {
  const figures = request.figures && Object.keys(request.figures).length > 0
    ? Object.entries(request.figures)
        .map(([label, value]) => `- ${label}: ${value}`)
        .join('\n')
    : '- none, do not use any numbers at all'

  return [
    `Subject: ${request.subject}`,
    '',
    'Verified figures you may use, exactly as written:',
    figures,
    '',
    request.mediaDescription ? `The media shows: ${request.mediaDescription}` : '',
    request.context ? `Context for tone only, never a source for a number:\n${request.context}\n` : '',
    `Destination: ${request.platforms.join(', ')}`,
    request.cta ? `End with this call to action, verbatim: ${request.cta}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Numbers the model produced that we did not authorise.
 * Exported for tests: this is the §0 backstop, and it is the check that
 * catches a model helpfully "improving" $749,000 into $750K.
 */
export function unauthorisedFigures(
  caption: string,
  figures: Record<string, string> = {},
  context: { subject?: string; cta?: string } = {},
): string[] {
  // Compare on digits alone. "$749,000" in the source and "$749,000." at the
  // end of a sentence are the same number, and an earlier version of this
  // matcher swallowed the full stop and then rejected its own correct caption.
  const digitsOnly = (token: string) => token.replace(/[^\d.]/g, '').replace(/\.$/, '')

  const allowed = new Set<string>()
  // Everything we AUTHORED is authorised: the figure values, the figure
  // LABELS ("homes closed in the last 30 days" contains 30), the subject
  // (a street number), and the CTA (a listing key). None of those is a claim
  // about the market. Each was learned the hard way, by killing a correct
  // draft: the labels omission cost a finished $0.48 video.
  const sources = [
    ...Object.values(figures),
    ...Object.keys(figures),
    context.subject ?? '',
    context.cta ?? '',
  ]
  for (const value of sources) {
    for (const number of value.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
      allowed.add(digitsOnly(number))
    }
  }

  const found = caption.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) ?? []
  return found.filter((token) => !allowed.has(digitsOnly(token)))
}

/**
 * Filler openers, caught rather than hoped away.
 *
 * The first live draft came back "This listing is in Bend, Oregon. The list
 * price is $849,900." Every fact was true and every word before the fact was
 * wasted. An instruction alone did not hold, so the check does.
 */
const WEAK_OPENERS = [
  'this ', 'it ', 'here ', 'welcome', 'introducing', 'just listed',
  'check out', 'take a look', 'we are', "we're", 'our ',
]

export function weakOpener(caption: string): string | null {
  const start = caption.trim().toLowerCase()
  return WEAK_OPENERS.find((opener) => start.startsWith(opener)) ?? null
}

export type CaptionAdapters = {
  writeStructured: typeof generateGrokStructured
}

/**
 * Write a caption, check it, and retry once with the failure fed back.
 * Returns null when the second attempt also fails, which is a kill signal:
 * the caller must not fall back to a template.
 */
export async function writeCaption(
  request: CaptionRequest,
  adapters: CaptionAdapters = { writeStructured: generateGrokStructured },
): Promise<{ ok: true; result: CaptionResult } | { ok: false; error: string }> {
  const basePrompt = buildPrompt(request)
  let feedback = ''
  let cost = 0

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { value, costUsd } = await adapters.writeStructured<{ caption: string; altText: string }>({
      system: SYSTEM,
      prompt: feedback ? `${basePrompt}\n\nYour previous attempt was rejected: ${feedback}\nWrite it again.` : basePrompt,
      schema: SCHEMA,
      schemaName: 'social_caption',
      maxTokens: 700,
      reasoningEffort: 'low',
    })
    cost += costUsd ?? 0

    // Dashes are a publish-boundary hard fail for the whole fan-out, so fix
    // them here rather than letting one caption abort every platform.
    const caption = hasDashes(value.caption) ? stripDashes(value.caption) : value.caption
    const altText = hasDashes(value.altText) ? stripDashes(value.altText) : value.altText

    const voice = checkBrandVoice(caption)
    if (!voice.ok) {
      feedback = `it used banned language: ${voice.violations.map((v) => v.term).join(', ')}`
      continue
    }

    const opener = weakOpener(caption)
    if (opener) {
      feedback = `it opened with "${opener}". Open with the subject itself: ${request.subject}.`
      continue
    }

    const stray = unauthorisedFigures(caption, request.figures, {
      subject: request.subject,
      cta: request.cta,
    })
    if (stray.length > 0) {
      feedback = `it invented figures we did not verify: ${stray.join(', ')}. Use only the figures listed, exactly as written.`
      continue
    }

    return {
      ok: true,
      result: { caption: caption.trim(), altText: altText.trim(), costUsd: cost, attempts: attempt },
    }
  }

  return { ok: false, error: `Caption failed twice: ${feedback}` }
}
