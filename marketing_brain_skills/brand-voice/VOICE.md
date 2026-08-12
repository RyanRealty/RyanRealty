# Ryan Realty: The Voice

**Locked D11, 2026-08-12. This is the only voice document in this repository.**
If you find another, it is stale. Delete it and point here.

## The law

Write to one person. Say the fact. Then stop. Never pander, never sermon, never
self-praise, never overexplain. Never invent a quote. Live numbers. Value my home.
A short judgment in our voice is allowed. Complimentary and exciting is allowed
when it is true and specific. Not salesy.

## Never name the virtues

Do not call ourselves authentic, genuine, honest, simple, transparent, trusted,
dedicated, or any other virtue. The language does the work. Only those virtue
words are dead. Other true facts may stay (boutique, premier, full-service if
true). Boutique describes the firm.

**About mission (the one exception).** This sentence may appear on About, exact
words:

`We are a boutique real estate brokerage in Bend, Oregon, committed to building community through authentic relationships and exceptional customer service.`

Nowhere else uses authentic / exceptional as a claim about us.

## Never invent a quote

Matt, 2026-08-06. Do not put direct quotes for him in anything unless he asks
to quote something specifically. No manufactured `"...," said Matt Ryan`. No
`Matt Ryan, principal broker:` line. No attributed line for any broker, client,
or third party that the person did not actually say. A fabricated quotation is
words put in a real person's mouth under a real license.

When a sentence states a judgment and no one has actually said it, state it
plainly in the brokerage's voice, or cut it. Never attach a name.

## Live numbers

Every number traces to a named source (CLAUDE.md §0). Pull it fresh. If a stat
cannot be verified, it does not ship.

## Value my home

Never on a CTA we would tap: "What's my home worth?" or "What is your home
worth?"

Always: **Value my home** or **Get my home's value** (Get your home's value
when addressing them).

Title and meta may keep search demand language. The button a person taps does
not.

## Punctuation

No em dash. No en dash. No semicolon. No `!`. Colon only as a label or list
(`Beds: 3`), never as a dramatic beat. Compound hyphens stay where English
needs them (single-family, 30-year fixed).

## SEO vs voice

Title, H1, and meta are search-first. Body, SMS, captions, and packets still
obey the law.

Homepage H1: `Homes for Sale in Central Oregon`

Homepage lead: `Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.`

## Three registers

1. **Public** (site, social, newsletter, packets, SMS to leads): the law.
   Listing posts do not thank. The house is the post.
2. **Personal notes to clients:** always respectful. Always thank them. Their
   trust matters. This register may thank.
3. **Admin:** as simple as possible. Completely different from public.
   Instrument language.

## MLS remarks

Never rewrite. Display may translate a property-type code (type A to
Residential). That is a label, not a voice pass. Customer reviews, another
broker's remarks, and quoted third parties are also never rewritten.

## Who is talking

We. Not I.

## Scope

This governs every word a member of the public reads: site, SMS, email,
newsletter, blog, social captions, GBP posts, packets, video on-screen text we
author, public error and empty states.

Not governed: code, comments, commit messages, logs, internal docs, admin UI
(unless sent).

## Named exemplars

| Surface | Line |
|---|---|
| Market / packet | 131 homes are for sale in Bend between $504,000 and $616,000. The median one has been listed 53 days. |
| Homepage H1 | Homes for Sale in Central Oregon |
| Homepage lead | Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market. |
| Buyer SMS | 123 Main is listed at $895,000. Want a short comparison and what to think about offering? |
| IG caption | New on Awbrey Butte. 4 bed, 3 bath, $1.12M. Views, a usable lot, and a house that shows well. |
| House compliment | A bright kitchen and a deck with a real view of the butte. |
| Listing process | We sign. We schedule photos and the sign. We start the marketing. It goes in the MLS as coming soon. When the photos and materials are ready, we go live and the sign goes in. |
| Newsletter open | 14 new listings in Bend this week. Median list $625,000. |
| Judgment | The second listing succeeds by correcting the first ask, not defending it. |
| About mission | We are a boutique real estate brokerage in Bend, Oregon, committed to building community through authentic relationships and exceptional customer service. |

Taste is these lines plus "would Matt send this?" Regex cannot catch corny.

## Mechanical gate

Tiny, on purpose. `scripts/brand-voice-vocabulary.cjs` and
`scripts/voice-constructions.cjs` check punctuation, invented quotes, and
Value my home. They do not encode taste. Do not grow a novel of regex.

## Data accuracy and fair housing

CLAUDE.md §0 and fair housing outrank everything in this file.
