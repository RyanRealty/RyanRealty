# Ryan Realty: The Voice

**Locked 2026-08-05. This is the only voice document in this repository.** Every
other voice, tone, or style file was deleted when this one was written. If you find
another, it is stale: delete it and point its references here. One canon, or the
rules drift.

## Scope

This governs **every word a member of the public reads**, whatever produces it:

| Surface | Examples |
|---|---|
| Email | Lead follow-up, sequence touches, saved-search alerts, document delivery, e-sign notices, review requests |
| Text | Every SMS body: sequence touches, auto-replies, alerts, agent replies |
| Reports | CMA, BPO, market reports, every figure's surrounding sentence |
| Site | Every page, hero, heading, body paragraph, button, form label, empty state, public error message, meta description |
| Landing pages | Seller valuation, expired, FSBO, every `/lp/*` |
| Listings | Our own MLS remarks, flyers, signage, listing descriptions |
| Social + ads | Captions, headlines, ad copy, video on-screen text and voiceover |
| Documents | Anything a client opens: PDFs, letters, disclosures we author |

**Not governed:** code, comments, commit messages, admin screens, logs, internal
docs. And never rewritten, because they are someone else's words: customer reviews,
another broker's listing remarks, quoted third-party sources, MLS data fields.

## The anchor

**Warren Buffett's Berkshire Hathaway shareholder letters.**
Read them: https://www.berkshirehathaway.com/letters/letters.html

Buffett writes about money, once a year for fifty years, to people who do not work
in finance. They are the most-read financial documents in the world. He does it by
writing to one specific person, using plain words, naming the bad news before the
good, and letting a number sit by itself.

Further codified in Lawrence Cunningham's *The Essays of Warren Buffett*, and in
Buffett's own foreword to the SEC's Plain English Handbook.

Two supporting standards, adopted for mechanics only:

- **GOV.UK** (https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/)
  for sentence discipline. Their position on adjectives is ours: they are
  subjective and make text read like spin.
- **Redfin's market reports** (https://www.redfin.com/news/) for report structure,
  and for rule 3 below.

---

## The eight rules

### 1. Write to one person

Not "sellers," not "homeowners," not "our clients." One person, reading alone. Use
"you." Use their name when we have it.

> No: "Sellers in this market are finding that pricing matters."
> Yes: "You get one first two weeks on market."

### 2. State the fact. Then stop.

**This is the rule that matters most, and the one we break most.** A fact with a
number carries its own meaning. The sentence after it, the one explaining what it
means, is noise. Delete it.

> No: "April homes went pending in 9 days. Lower is faster."
> No: "131 homes are for sale in your band. Those are the homes yours is judged
> against on day one."
> Yes: "131 homes are for sale in Bend between $504,000 and $616,000. The median
> one has been listed 53 days."

If the reader could work it out from the number, they already have.

### 3. Interpretation goes in a quote, under a name

When something needs a judgment call, a person makes it and signs it. The document
reports; a named broker interprets. This is Redfin's convention, and it is a
compliance asset as much as a voice one.

> Yes: "Homes that fail to sell close at a median 94.2% of the ask that failed.
> 'The second listing succeeds by correcting the first ask, not defending it,' said
> Matt Ryan, principal broker."

No unattributed opinions anywhere.

### 4. A number beats an adjective, and stands alone

State the number once. No adjective in front of it, no restatement after it, no
telling the reader it is high, low, or surprising.

> No: "a remarkably strong median of $599,900"
> Yes: "a median of $599,900"

"About" and "roughly" are allowed only on genuine estimates, never on a number we
can pull exactly (CLAUDE.md §0).

### 5. Plain word over formal word

about (not approximately) · buy (not purchase, acquire) · use (not utilize) · help
(not assist) · near (not in close proximity to) · home (not residence) · now (not
at this time) · we can (not we are able to).

Sentences run 15 to 20 words. Longer is fine when a short one sits beside it.
Active voice: name who did the thing.

### 6. Bad news first, in plain words

Name the limitation, cost, risk, or mistake before the upside. Never bury it, never
soften it with a qualifier stack. If we got something wrong, say so.

> Yes: "Your last listing asked $619,999 and did not sell."
> Yes: "We cannot verify your home's condition from the record, so this estimate
> assumes average condition for its age."

### 7. Say what you do not know

No false certainty, no forecast dressed as fact. Where the answer is unknown, write
the condition instead of a guess.

> No: "Your home will sell in about 30 days."
> Yes: "Homes in Stone Creek have gone pending in a median of 24 days over the last
> two years."

### 8. Never be pleased with yourself

From The Economist's style guide, which names our failure exactly: *do not be too
pleased with yourself.* No coined maxims. No clever balanced pairs. No sentence
that exists to sound wise. No congratulating the reader on their decision, and no
congratulating ourselves on the analysis.

---

## Banned constructions

Every example below was real Ryan Realty copy on 2026-08-05. These shapes must not
ship again.

**The aphorism pair.** Two balanced clauses coining a maxim.
> Killed: "Pricing sets the number. Competition decides how it lands."
> Killed: "This number is a starting point, not a verdict."

**The meaning-narration.** Any sentence explaining the sentence before it.
Triggers: "this tells you," "what this means," "in other words," "put simply,"
"this is history, not a forecast."
> Killed: "This is history, not a forecast: it tells you when Bend buyers have been
> most active."

**The sermon clause.** A trailing clause that moralizes the fact.
Triggers: "which is one more reason," "and that matters because," "which is why it
is so important."
> Killed: "...which is one more reason the list price has to be right on day one."
> Killed: "...it is fully in your control before the next listing goes live."

**The drama header.** A heading that narrates instead of stating.
> Killed: "The market gave its answer. Here is what it was worth hearing."
> Replaced with: "Your last listing."

**The obvious restatement.** Explaining a chart, a label, or a word.
> Killed: "Lower is faster." "Real homes, really sold."

**The data-speaks headline.** Numbers do not speak, say, tell, reveal, or prove.
> Killed: "450 sales say the calendar matters."
> Replaced with: "April homes went pending in 9 days. December homes took 39."

**The throat-clear.** A windup before the fact.
> Killed: "Before the numbers, the concrete things this property has going for it."

**Pandering.** "Great question," "you have great taste," "don't worry, we will
handle everything," "let me explain in simple terms," "buying a home is a big
decision."

**Fake urgency.** "Act fast," "don't miss out," "won't last long."

**Self-praise.** "Honest," "trusted," "dedicated," "your local experts," "premier,"
"boutique," "top producing." A virtue we name is a virtue the reader doubts.

**Category and headcount as position.** "Independent brokerage by design," "full-
service," "licensed and active brokers," "three brokers," "small team."

**This file is authoritative for everything.**
[`scripts/brand-voice-vocabulary.cjs`](../../scripts/brand-voice-vocabulary.cjs) is a
machine-readable projection of the rules above, nothing more: it exists so
[`scripts/check-brand-voice.mjs`](../../scripts/check-brand-voice.mjs) can fail a
commit. Every list it holds is derived from this document. It inherits nothing from
any earlier version, and a word or pattern is only bannable here first.

---

## Per-surface rules

### Email

Subject is the fact, under 50 characters, no colon drama, no emoji. The first
sentence is the reason for the email, with no greeting paragraph in front of it.
One ask, stated once. Sign with a real broker's name and title.

> Subject: "3 homes matched your search in Awbrey Butte"
> Not: "Your personalized property update is here!"

### Text messages

One idea. Under 300 characters where possible. No emoji. Identify who is texting on
first contact. One ask, never two questions. Consent and opt-out language is fixed
by law and lives in [`lib/crm/sms-consent-text.ts`](../../lib/crm/sms-consent-text.ts):
do not rewrite it for tone.

### Saved-search and listing alerts

The listings are the content. Say what matched and why, then get out of the way. No
adjectives about the homes, no urgency, no "we thought you'd love this."

> Yes: "3 new listings match Awbrey Butte, 3+ bed, under $900,000."

### Reports and client documents

Structure follows Redfin: the claim with its number leads, the method is stated
before any interpretation, the source sits under the figure. Every section answers
one question. Rules 2 and 3 carry the weight: report the number, attribute the
judgment.

### Site pages

Headings are sentence case and say something specific. Buttons say what happens
("See the estimate," not "Get started"). Empty states say what is missing and what
to do next. Public error messages say what failed and the next step, with no
apology theater.

---

## Search traffic

Cutting editorializing does not cost search traffic. It is the thing that earns it.

The anchor for report structure, Redfin, runs the most-cited real-estate data
operation in the country on exactly these rules, and their pages rank nationally on
the strength of specific numbers, not adjectives. A sentence that explains another
sentence adds no query coverage. Nobody searches "what this means for you."

Four rules so a voice pass never costs a ranking:

1. **Never delete a fact to shorten a page.** Delete interpretation, keep evidence.
   Thin content loses; padded content also loses. What wins is a page that answers
   more real questions than the competing page. Cutting a sermon clause removes zero
   answers. If a rewrite ends shorter and less useful, it was done wrong: cut the
   editorializing and add another verified fact.
2. **Headings state what someone would search.** "When Bend homes go pending" earns
   the query. "450 sales say the calendar matters" earns nothing, because nobody
   types that. Rule 8 and search intent point the same direction.
3. **Keep the entities.** Place names, subdivision names, school names, street names,
   prices, dates, and property types are how a page gets found. They are specifics,
   which the canon wants anyway. Never trade a proper noun for a pronoun to make a
   sentence read smoother.
4. **Titles and meta descriptions are governed by this file.** State the page's
   actual content with its number. No hype, no "discover," no "your dream home
   awaits." A meta description is a promise the page has to keep.

The deleted material was never doing SEO work. Editorializing is what a page says
about itself; search rewards what a page can prove.

## Mechanics

**Punctuation.** No em or en dashes in prose a reader sees. No semicolons: use a
period. No dramatic colons in body prose. One exclamation mark per piece maximum,
none in anything carrying market data. Compound hyphens stay where English needs
them (single-family, 30-year fixed).

**Numbers.** Currency to the nearest thousand: `$895,000`. Days as an integer plus
the word: `38 days`. Percentages carry one decimal: `2.1%`. Year over year carries
a signed arrow: `↑ 2.1% YoY`. Unavailable renders as an em-dash placeholder.
Tabular numerals on every numeric surface.

**Fixed facts.** Phone `541.703.3095`, the only public number, imported from
[`lib/brand/contact.ts`](../../lib/brand/contact.ts) and never typed. Web
`ryan-realty.com`. Social `@ryanrealtybend`. Place separator is a middle dot:
`BEND · OREGON`. Sentence case for body headings; Title Case only on a hero H1.

**Data accuracy (CLAUDE.md §0) and fair housing outrank everything in this file**
and are hard ship-blockers.

---

## Matt's first-person voice

One narrow exception: correspondence Matt personally sends. Review replies,
personal letters, a note to a past client.

"Thank you so much for taking the time to..." · "It was genuinely a pleasure
working with you." · "That kind of trust makes all the difference." · "I'm always
here if you need anything down the road."

Never on a site page. Never in a report. Never in an automated send.

---

## The review test

Read the piece once and ask five questions. Cut, do not excuse.

1. **Does a sentence explain another sentence?** Delete it.
2. **Is there an opinion with no name attached?** Attribute it or cut it.
3. **Am I pleased with myself anywhere here?** Cut that part.
4. **The competitor test:** could any brokerage in Bend paste this sentence on
   their site verbatim and have it be just as true? Then it says nothing.
5. **The receipt test:** does a sentence claim a virtue, skill, or character trait?
   Show the receipt in the same breath, or cut the claim.

If the piece still says everything it needs to after those cuts, it is done.
