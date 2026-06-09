/**
 * Lead origin note — the internal FUB timeline note that tells the broker WHY a
 * lead came in. Matt reads this in Follow Up Boss, so it is plain and scannable:
 * a header line then labelled lines. No em-dashes, no semicolons (brand voice
 * §, internal text still follows the punctuation floor for legibility).
 *
 * buildLeadOriginNote is a PURE function. It only renders fields that are
 * actually present and never invents data, so a sparse context collapses to
 * just the header plus whatever is known.
 */

export type LeadOriginContext = {
  source?: string
  sourceLabel?: string
  landingPage?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  audience?: 'seller' | 'buyer' | null
  tier?: string
  tierReason?: string
  want?: string
  assignedAgent?: string
  assignmentReason?: string
  extra?: string
}

const HEADER = 'LEAD ORIGIN'

/** Trim a value and treat blank/whitespace-only as absent. */
function clean(value?: string | null): string {
  if (!value) return ''
  return String(value).trim()
}

/**
 * Build the Campaign line from whatever UTM fields are present. Returns '' when
 * no UTM field is set so the caller can omit the line entirely.
 *
 * Shapes (only present pieces appear):
 *   Campaign: <utmCampaign> (<utmSource>/<utmMedium>, ad=<utmContent>)
 *   Campaign: (<utmSource>/<utmMedium>)        // no campaign name
 *   Campaign: <utmCampaign>                     // campaign name only
 */
function buildCampaignLine(ctx: LeadOriginContext): string {
  const campaign = clean(ctx.utmCampaign)
  const src = clean(ctx.utmSource)
  const medium = clean(ctx.utmMedium)
  const content = clean(ctx.utmContent)

  if (!campaign && !src && !medium && !content) return ''

  // Build the parenthetical (source/medium, ad=content).
  const parenParts: string[] = []
  if (src || medium) {
    parenParts.push([src, medium].filter(Boolean).join('/'))
  }
  if (content) {
    parenParts.push(`ad=${content}`)
  }
  const paren = parenParts.length ? `(${parenParts.join(', ')})` : ''

  // Join only the present pieces so an absent campaign name does not leave a
  // doubled space (e.g. "Campaign: (facebook/paid)" not "Campaign:  (...)").
  const value = [campaign, paren].filter(Boolean).join(' ')
  return `Campaign: ${value}`
}

/**
 * Render the lead origin note. Pure. Omits every line whose value is empty and
 * never emits an em-dash or semicolon. Always opens with the HEADER line.
 */
export function buildLeadOriginNote(ctx: LeadOriginContext): string {
  const lines: string[] = [HEADER]

  const source = clean(ctx.sourceLabel) || clean(ctx.source)
  if (source) lines.push(`Source: ${source}`)

  const page = clean(ctx.landingPage)
  if (page) lines.push(`Page: ${page}`)

  const campaignLine = buildCampaignLine(ctx)
  if (campaignLine) lines.push(campaignLine)

  const want = clean(ctx.want)
  if (want) lines.push(`Wants: ${want}`)

  const tier = clean(ctx.tier)
  if (tier) {
    const reason = clean(ctx.tierReason)
    lines.push(reason ? `Tier: ${tier} (${reason})` : `Tier: ${tier}`)
  }

  const agent = clean(ctx.assignedAgent)
  if (agent) {
    const reason = clean(ctx.assignmentReason)
    lines.push(reason ? `Assigned: ${agent} (${reason})` : `Assigned: ${agent}`)
  }

  const extra = clean(ctx.extra)
  if (extra) lines.push(extra)

  return lines.join('\n')
}

/**
 * True when the note carries at least one detail line beyond the header. Lets a
 * caller skip posting an empty (header-only) note.
 */
export function leadOriginNoteHasDetail(note: string): boolean {
  return note.split('\n').filter((l) => l.trim() && l.trim() !== HEADER).length > 0
}
