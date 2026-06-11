# Ryan Realty Voice System v2 — APPROVED (Matt, 2026-06-11)

> STATUS: CANONICAL. Approved by Matt 2026-06-11 ("yes this is much better voice")
> after four in-session calibrations. This document governs every word written for
> any Ryan Realty surface. Where it conflicts with older sections of
> voice_guidelines.md or CLAUDE.md voice rules, THIS WINS (the mechanical floor —
> punctuation, banned words, fair housing, §0 accuracy — still applies unchanged).

# Ryan Realty Voice System v2 — DRAFT for Matt's sign-off

**Status:** DRAFT. Nothing replaced yet. On approval this supersedes `marketing_brain_skills/brand-voice/voice_guidelines.md` §4 to §8 and the "canonical phrases" sections, and the CLAUDE.md voice section gets rebuilt to match. The mechanical gates (`scripts/brand-voice-vocabulary.cjs`, `lib/punctuation-guard.ts`, `ci:brand-voice`) carry over unchanged as the floor.

**Date:** 2026-06-10

**Why the rebuild.** The current system is structurally a ban-list plus a phrase bank mined from Matt's review replies. Ban-lists tell a writer what to avoid, not how to think, so every new sentence is a fresh chance to fail in a new way. And the phrase bank ("honored to...", "a small business like ours") imports Matt's 1:1 thank-you-note register into site and marketing copy, which is exactly the pandering, self-describing voice he wants dead. The research on guidelines that writers and AI actually obey is consistent: principles first, then a target register, then before/after transformations, then decision tests, with the ban-list demoted to a mechanical floor ([Mailchimp content style guide structure](https://styleguide.mailchimp.com/voice-and-tone/), [Emphasis, "tone of voice guidelines people will actually use"](https://www.writing-skills.com/knowledge-hub/a-practical-guide-to-creating-brand-tone-of-voice-guidelines-that-people-will-actually-use/), [Monzo tone of voice](https://monzo.com/tone-of-voice)).

**The north star, Matt verbatim (2026-06-10):**

> "my big thing is that we don't pander, we don't overtly state simple things like a fucking moron, and we don't ever editorialize, we come across as open honest transparent brokers that know the market, but we don't need to SAY we are brokers and we really know the market."

Plus his four-line site standard from the same day: looks amazing not template, consistent, accurate, no lame copy. Plus the same-day growth directive: never position on smallness or headcount.

The whole system below is that paragraph, formalized.

---

## A. The Four Laws

Every sentence Ryan Realty publishes obeys all four. They are ordered, but they are not tradeable against each other.

### Law 1 — Never pander

No manufactured warmth, no flattery, no sentence that exists only to be nice. The reader is an intelligent adult deciding the largest transaction of their life. Treat them that way. "We're here to help," "we'd love to learn more," "don't hesitate to reach out" all assume the reader needs comfort instead of information. Ogilvy's line is the operating assumption: the consumer isn't a moron. A sentence whose only job is warmth gets cut. Warmth that survives is a byproduct of usefulness, not an ingredient added to it.

### Law 2 — Never state what showing can prove

No "we're honest," "trusted experts," "local brokers who know the market," "licensed and active," "independent brokerage." Self-description is the slowest and least credible way to claim a quality, because the reader expects a business to praise itself and discounts the claim to zero ([Hopkins, *Scientific Advertising*, on platitudes and generalities](https://growthsummary.com/book-summary/scientific-advertising/)). The fact or the number carries the claim. "Brokers who know the market" is dead. "Months of supply in Bend is 3.8 as of June 1" is alive, and it proves the dead sentence without saying it. If a quality can't be demonstrated with a fact, a number, a named process, or a visible behavior, the quality doesn't go in the copy.

This law also covers categories and credentials. A real estate site run by licensed brokers is the baseline, not a selling point. Naming the category out loud ("an independent brokerage serving buyers and sellers") reads as filler. Headcount is included here: "three brokers" is not a position and contradicts the growth intent.

### Law 3 — Never editorialize

No adjective the reader can't verify, no verdict where an observation would do. "Stunning kitchen" is the writer's opinion. "Kitchen renovated 2022, Wolf range, quartz counters" is the house. The observation IS the judgment: when the detail is good enough, the reader supplies the adjective themselves, and a conclusion the reader reaches on their own is the only kind they keep. This is the discipline behind Apple product copy ("40mm stainless steel case," not "beautifully crafted") and behind every luxury listing writer worth the fee: buyers have learned to skip "stunning" and "luxury" because those words do not predict their experience, while dates, dimensions, brand names, and architect names do ([analysis of Apple's copy specificity](https://www.copystyleguide.com/apple-tone-of-voice), [luxury listing copy craft](https://www.housingwire.com/articles/real-estate-copywriting/)). Same rule for market copy: "the market is doing interesting things" is editorial, "active inventory rose 12 percent in May" is the market.

### Law 4 — Specificity is the voice

The more concrete the sentence, the more Ryan Realty it sounds. This is the positive law the other three protect. Strunk and White, rule 16: use definite, specific, concrete language, prefer the specific to the general, the definite to the vague. Hopkins again: a specific claim multiplies the effect of the sentence because specifics read as fact and generalities read as advertising. The street name beats the neighborhood, the neighborhood beats the city, the number beats the trend word, the named process beats the promise. When a sentence feels weak, the fix is almost never a stronger adjective. It is a more specific noun.

**Law 4 is bounded by CLAUDE.md §0.** Every number that ships is verified against the source of truth with a trace. A specific number that is wrong is worse than no number. If the specific can't be verified, write the sentence without it or don't write the sentence.

---

## B. How authority shows

Authority without self-declaration is a craft with known techniques. These are the positive moves, with the register target first.

### The register (the dials)

Using the [NN/g four tone dimensions](https://www.nngroup.com/articles/tone-of-voice-dimensions/), Ryan Realty sits at:

| Dimension | Position | Meaning in practice |
|---|---|---|
| Formal ↔ Casual | Center, leaning plain | Full sentences, no slang, no stiffness. Reads like a competent person talking, not a brochure. |
| Funny ↔ Serious | Serious, dry wit allowed rarely | Never jokes about money, the market, or a client's situation. |
| Respectful ↔ Irreverent | Respectful, never deferential | We don't flatter and we don't grovel. We also don't punch at competitors. |
| Enthusiastic ↔ Matter-of-fact | Matter-of-fact, hard | This is the signature dial. Excitement is the reader's job. Ours is the fact that produces it. |

The matter-of-fact dial is what makes the brand read like The Economist rather than a realtor's flyer: authority comes from clarity, precision, and command of the topic, with every word earning its place ([Economist Style Guide ethos](https://gilnorton.com/the-economist-style-guide/)). It is also why the docs-grade neutrality matters: marketing speak slipping into a factual surface destroys clarity and erodes trust, which is the exact reason Stripe keeps brand voice out of its documentation ([Stripe's writing culture](https://www.mintlify.com/blog/stripe-docs)).

### Technique 1 — Verified numbers inside sentences

Not numbers in a stats box next to prose. Numbers AS the prose. "A well-priced single-family home in Bend is going under contract in a median of {38} days right now" does the work of three paragraphs about market knowledge. Every figure traces per CLAUDE.md §0, and figures in evergreen site copy must be wired to live data (the DAL), never hardcoded, so the copy can't go stale into a lie.

### Technique 2 — Name the actual thing

The street, the neighborhood, the subdivision, the appliance brand, the form number, the mechanism. "Old Bend, two blocks from Drake Park" beats "a great location." "We review the ALTA settlement statement with you line by line" beats "we're transparent about fees." Named entities are verifiable, and verifiable reads as true ([Hopkins](https://growthsummary.com/book-summary/scientific-advertising/), [entity-specific listing copy](https://www.housingwire.com/articles/real-estate-copywriting/)).

### Technique 3 — Process stated as fact

Timelines and behaviors written as flat declaratives, because a commitment with a clock on it is a claim the reader can hold us to. "Professional photos within 48 hours of signing. Weekly written updates on showings and traffic." No "we strive to," no "our goal is." If we can't state it as fact, we can't do it reliably, and then it doesn't ship (this keeps the old Dependable rule: never write a CTA we cannot honor).

### Technique 4 — Restraint

Short declaratives. One idea per sentence. The confidence is in what we don't say: no exclamation, no superlative, no stacking of three warmth beats where zero belong. Aesop built a global brand on exactly this, claims present but never foregrounded, confidence practiced quietly ([Aesop's restraint strategy](https://thebrandsider.com/p/how-aesop-turned-intellectual-rigour)). Omit needless words is a voice rule here, not just an editing rule: the deleted adjective is the brand.

### Technique 5 — Data as copy

Where a surface can show live data instead of prose, the data is the copy. An active-listings count updating daily says "we are plugged into this market" in a way no sentence can. Headlines built from the data ("787 homes for sale across Central Oregon" with a live count) are the strongest sentences on the site because they are unwritable by a competitor without our pipeline.

### Technique 6 — Proof first, then the offer

Order matters. Lead with the verifiable thing (the number, the comp, the process), then make the ask. "A broker prepares a written CMA with three closed comps and three active comps. You see every number we used. Request one here." The reversed order (ask first, justify after) is what sales copy does, and readers smell it.

### What "open, honest, transparent" looks like under these techniques

Never the words. Always one of: naming a known issue in a listing, publishing the comps behind a price, stating what something costs and what is included, saying "we don't know yet, we'll have it Tuesday," correcting our own number publicly when it changes. Transparency is an action with a timestamp, not a vocabulary choice.

---

## C. Before / after — 17 transformation pairs from the live site

Each pair is real copy currently in the repo, the law it breaks, and the rewrite. Figures in rewrites marked `{...}` are live-data slots resolved through the DAL at render, never hardcoded (CLAUDE.md §0). These rewrites are the teaching tool AND the work queue: on approval each becomes a site edit.

**1. `app/sell/valuation/page.tsx:44`** — breaks Law 2 (self-declared virtue) and Law 4 (vague)
- Before: "Get a custom valuation from Bend's trusted experts. We use local comps and market trends to give you a clear picture of your home's value, and how to maximize it."
- After: "A broker pulls the closed sales nearest your home from the last {90} days and writes you a price range, with every comp attached. You see the same numbers we used."

**2. `app/contact/page.tsx:85`** — breaks Law 1 (pandering) and Law 3 (unverifiable "quickly")
- Before: "Questions about buying, selling, or just exploring? We're here to help. Reach out and we'll get back to you quickly."
- After: "Send the question. A broker replies the same business day."

**3. `app/buy/page.tsx:131`** — breaks Law 2 (headcount + credential as position; smallness ban)
- Before: "Three licensed brokers. Live MLS data. One broker from your first search to the closing table. We cover Bend, Redmond, Sisters, Sunriver, and the surrounding communities."
- After: "The broker on your first showing is the broker who writes your offer and sits at your closing. {1,214} active listings across Bend, Redmond, Sisters, Sunriver, and the surrounding communities, updated from the MLS daily."

**4. `app/buy/page.tsx:159`** — breaks Law 2 ("we know," "honest guidance")
- Before: "Brokers who live and work in Central Oregon. We know Bend, Redmond, Sisters, Sunriver, and every neighborhood in between. You get honest guidance on schools, commute, and resale."
- After: "Ask about a specific street and you get a specific answer: what sold near it in the last six months, which schools feed it, what the winter commute to the Old Mill actually is, and what resale has done there since {2020}."

**5. `app/sell/page.tsx:174`** — breaks Law 2 (says "honest" instead of being it)
- Before: "A broker prepares a comparative market analysis with recent comparable sales and an honest price range. No cost, no obligation."
- After: "A broker prepares a comparative market analysis with recent comparable sales and a price range you can check against every comp in it. No cost, no obligation."

**6. `components/site/CtaDuo.tsx:96`** — breaks Law 2 (claims knowledge) plus the banned us-vs-them trope
- Before: "Get a free home valuation from a broker who knows your neighborhood. Local insight, not a national algorithm."
- After: "Tell us the address. A broker sends back a price range built from the closed sales nearest your home, with the comps attached."

**7. `app/buy/page.tsx:255`** — breaks Law 2 (stating the virtue "no spam, no pressure")
- Before: "Share your criteria and a Ryan Realty broker sends matching homes directly from the MLS. No spam, no pressure."
- After: "Share your criteria and a broker sends matching homes directly from the MLS. You get listings, nothing else, and you can stop them with one click."

**8. `components/site/LeadCaptureBlock.tsx:118`** — breaks Law 2 (negation-as-virtue)
- Before: "No automated estimate. A local broker writes back personally."
- After: "Matt, Paul, or Rebecca writes back with the comps from your area, usually within one business day."

**9. `app/faq/page.tsx:22` (and :27, :191)** — breaks Law 2 ("honest answers" is a self-grade)
- Before: "Honest answers to the questions Bend buyers and sellers ask Ryan Realty every week."
- After: "The questions Bend buyers and sellers ask us every week, answered."

**10. `app/faq/page.tsx:95`** — breaks Law 2 ("take that work seriously," "honest audit")
- Before: "Yes, and we take that work seriously. If your listing expired or you withdrew, we start with an honest audit of what happened. We look at pricing, presentation, photography, marketing reach, and feedback..."
- After: "Yes. We start by pulling the record: your price history, days on market against the neighborhood median, the photography, where the listing was syndicated, and the showing feedback. Then we tell you what we found, including anything the last agent got right."

**11. `components/site/Hero.tsx:29` / `HeroBlock.tsx:36` / `app/page.tsx:51`** — breaks Law 2 (self-description "the brokers who close deals here")
- Before: "Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Real numbers, direct from the brokers who close deals here."
- After: "Search {1,214} homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Median list price {$825,000}, updated from the MLS daily."

**12. `components/site/CtaDuo.tsx:89`** — breaks Law 4 ("we handle the rest" is vague)
- Before: "Save a search and get instant alerts when matching homes hit the market. Set your criteria once and we handle the rest."
- After: "Save a search. When a matching home hits the MLS, the alert is in your inbox the same hour."

**13. `app/sell/page.tsx:110`** — breaks Law 2 in a sneaky way (announces specificity instead of being specific)
- Before: "Specific numbers from the data. No layered hand-offs. The broker who prices your home is the broker who walks you to the finish line."
- After: "Bend's median sale price is {$795,000} and the median time to contract is {38} days. Your number depends on your street, and the broker who builds it for you is the one who closes your sale."

**14. `components/site/MarketingStandardBlock.tsx:12`** — breaks Law 3 (editorializes about "serious buyers")
- Before: "Every listing gets a professional video, the showcase treatment serious buyers expect."
- After: "Every listing gets a professional video before it goes live on the MLS. At every price point, not just the top of the market."

**15. `app/about/page.tsx:107` (JSON-LD description)** — breaks Law 2 (names the category)
- Before: "Independent real estate brokerage in Bend, Oregon serving Central Oregon buyers and sellers."
- After: "Ryan Realty markets Central Oregon homes with professional video, 3D tours, and pricing built from live MLS data. Founded in Bend, June 2023. The broker you call is the one who closes your sale."

**16. `app/faq/page.tsx:123`** — breaks Law 3 (editorializes about the reader's habits)
- Before: "Yes. Bend buyers and sellers do most of their thinking outside of standard business hours, and we work the schedule you need. We routinely run showings on weekday evenings and Saturdays and Sundays..."
- After: "Yes. Showings run weekday evenings and weekends. Tell us the window that works and we book it."

**17. `app/faq/page.tsx:67`** — breaks Law 1 (gently talks down: "can be intimidating") and Law 4
- Before: "Yes. A meaningful share of our business is first-time buyers, and we like that work. The Bend market can be intimidating for someone who has never bought before, so we walk you through the entire process..."
- After: "Yes. The first meeting covers lender pre-approval, what {$500K} to {$650K} actually buys in Bend right now, and the closing costs nobody itemizes for you. You leave with a written timeline from search to keys."

**Already passing, keep as exemplars:** `components/site/sell/SellValueProps.tsx:33` ("a written CMA with three closed comps, three active comps... You see every number we used"), `components/site/sell/SellProcess.tsx:33` ("Professional photos within 48 hours... Weekly written updates on showings and traffic"), `app/about/page.tsx:129-130` ("Homes here deserve more than a sign in the yard. Every Ryan Realty listing gets cinematic video, a 3D walkthrough, and a price built from live Central Oregon market data."). These show the system already exists in pockets. v2 makes it the whole site.

---

## D. Decision tests

Run before any sentence ships, in order. Writers and AI alike. A sentence that fails any test gets rewritten or cut, not excused.

1. **The competitor test.** Could any brokerage in Bend paste this sentence onto their site verbatim and have it be just as true? Then it says nothing. Cut it or make it specific enough that only we can claim it. ("Trusted local experts" fails. "Every listing gets a professional video, at every price point" passes only if it stays operationally true.)
2. **The receipt test.** Does the sentence assert a virtue, a skill, or a character trait (honest, trusted, expert, local, transparent, dedicated)? Show the receipt in the same breath (the number, the comp, the timeline, the named process) or cut the assertion. No receipt, no claim.
3. **The verify test.** Is there an adjective or adverb the reader cannot check from where they're standing? ("Stunning," "incredible," "perfectly," "exceptional.") Replace it with the noun, date, brand, dimension, or number that made us want the adjective.
4. **The moron test (Matt's test).** Does the sentence state something obvious about us or the situation as if it were news? ("We are licensed brokers." "Buying a home is a big decision." "The market is always changing.") Cut the sentence entirely. Nothing replaces it.
5. **The warmth-audit test.** Does the sentence exist only to be warm or polite? ("We'd love to help." "We're here for you.") Cut it. If the surface then feels cold, the fix is a more useful fact, not a warmer sentence.
6. **The clock test.** Does the sentence promise behavior? It needs a number or a timestamp ("same business day," "within 48 hours") and we must actually hit it. Can't put a clock on it, can't ship it.
7. **The headcount test.** Does the sentence position on size, smallness, or team count in either direction? Cut. Position on the service model and the standard, never the org chart.
8. **The trace test.** Does the sentence contain a figure? It needs a verification trace per CLAUDE.md §0, and on evergreen surfaces it must be wired to live data, not typed in.
9. **The read-aloud test.** Read it as Matt talking to a smart friend across a table. If it sounds like a brochure, a press release, or an agent's Instagram, rewrite. If it sounds like a person who knows the answer just saying the answer, ship.

---

## E. The mechanical floor (carried over unchanged)

The floor is enforced by gates, not by this document. It does not move in this rebuild.

- **Punctuation:** em-dash and en-dash banned as punctuation (`lib/punctuation-guard.ts`, `assertNoDashes()`), semicolons banned, dramatic colons banned, exclamation discipline (one max per piece, zero in market-data content). Em-dash allowed only as a data placeholder for "unavailable."
- **Banned vocabulary:** the full category lists in `scripts/brand-voice-vocabulary.cjs` stand as-is: real-estate clichés, AI filler, marketing slop, fake urgency, hype openings, pandering phrases, and the **smallness-positioning category** added 2026-06-10 ("three brokers," "small brokerage," "small team," "a small business like ours," "team of three," "boutique").
- **Banned tropes:** dramatic before-and-after ("most agents do X, we do Y"), fake humility brag, market-doom and market-hype, agent-as-hero arc, overt category/virtue/credential statements.
- **Data accuracy:** CLAUDE.md §0 outranks everything here. Unverifiable stat = cut, with a per-figure verification trace before publish.
- **Fair housing:** the separate compliance check remains a hard ship-blocker. Nothing in the four laws licenses copy that describes people rather than property and process.
- **Formatting floor:** phone `541.213.6706` (FUB-tracked `541.703.3095` on lead-capture surfaces), `ryan-realty.com`, `BEND · OREGON`, currency to the nearest thousand, integer days, signed one-decimal YoY percents, tabular numerals, sentence case body headlines.
- **Channel calibration:** voice_guidelines.md §11 (lengths, hashtag rules, NAR Clear Cooperation, no bylines, broker tagging) is format law, not voice, and carries over intact.

The relationship inverts, though: in v1 the ban-list WAS the system. In v2 the four laws are the system and the ban-list is just the tripwire that catches a sentence the laws should have already killed. When a gate fires, the fix is to re-run section D, not to thesaurus around the banned word.

---

## F. What dies

1. **The "canonical phrases" template bank (voice_guidelines.md §7, SKILL.md "Canonical phrases").** Dead for site, marketing, social, ad, listing, email-blast, and video copy. These phrases were mined from Matt's GBP review replies, which is a 1:1 thank-you register. Templating them into marketing produced the pseudo-Matt slop the May 2025 caption pass already had to ban one phrase at a time ("a happy yes," "stepping into this next chapter," "honored to have been in the room"). Review-reply voice is not site voice. The phrases survive only in Appendix A, scoped to Matt's personal 1:1 correspondence.
2. **The "words to favor" list** ("genuinely, honored, privilege, small business like ours, trust, chapter, the finish line..."). Dead everywhere outside Appendix A. A favored-words list is a slop generator: it tells an AI to sprinkle sentiment tokens instead of finding facts. "A small business like ours" is additionally banned outright on marketing surfaces by the smallness directive.
3. **"Positioning Ryan Realty" phrasing patterns** ("Honored to..." / "Privilege to..." as brand positioning). Dead. The brand does not have feelings about itself in public. It has listings, numbers, processes, and results.
4. **The six named voice attributes as the spec** (Trustworthy, Honest, Knowledgeable, Professional, Dependable, Grateful). The attributes were true but structurally backwards: they are adjectives about us, which is Law 2 violated at the meta level, and they gave writers nothing operational. Their real content survives where it was load-bearing: sourcing rules live under Law 4 and the trace test, the CTA-honoring rule lives under the clock test, the gratitude rules collapse into Law 1 plus the §11 social-format law. We stop describing the voice with virtues for the same reason we stop describing the brokerage with them.
5. **Corpus-fingerprint matching against the GBP review corpus as a site-copy validator.** The corpus stays as the reference for Appendix A surfaces only. Measuring a hero headline against thank-you notes optimized for the wrong target the entire time.
6. **Any rule that produces self-description.** Standing instruction: if a future directive or skill edit would have Ryan Realty copy name its own category, virtue, credential, or headcount, the directive is wrong by definition under this system and gets pushed back on, not implemented.

---

## Appendix A — Matt 1:1 correspondence (the ONLY home for the old phrase bank)

**Scope, strictly:** Matt's personal review replies (GBP, Zillow), personal thank-you notes and letters to clients, and genuinely first-person messages Matt sends himself. Nothing that is broadcast, automated, templated at scale, or published on a marketing surface. If more than one person receives the same words, this appendix does not apply.

In that scope, Matt's natural register is the spec, drawn from the 22-response GBP corpus (`marketing_brain_skills/brand-voice/corpus/gbp_responses.md`): "Thank you so much for taking the time to...", "It was genuinely a pleasure working with you," "That kind of trust makes all the difference," "I'm always here if you need anything down the road," "Wishing you all the best in your new chapter," and "a small business like ours" (explicitly preserved here per the 2026-06-10 directive, banned everywhere else). "I" is correct here. Warmth is correct here. It is correct precisely because it is one named human writing to one named human about a real shared experience, which is the one context where stating the feeling IS the receipt.

The mechanical floor (Section E punctuation and accuracy rules) still applies even here.

---

## Research sources

- Hopkins, *Scientific Advertising*: platitudes leave no impression and damage credibility, specific claims read as fact — [growthsummary.com summary](https://growthsummary.com/book-summary/scientific-advertising/)
- Strunk & White, *The Elements of Style*, rules 16 and 17 (definite, specific, concrete language; omit needless words) — as applied in [Apple copy analysis](https://www.copystyleguide.com/apple-tone-of-voice) and [enchantingmarketing.com on Apple's techniques](https://www.enchantingmarketing.com/write-like-apple/)
- The Economist Style Guide ethos: authority through clarity, precision, and unpretentious command of the topic — [gilnorton.com overview](https://gilnorton.com/the-economist-style-guide/)
- Stripe: neutral, precise prose because marketing speak in factual surfaces erodes trust — [Mintlify on Stripe docs](https://www.mintlify.com/blog/stripe-docs), [Slab on Stripe's writing culture](https://slab.com/blog/stripe-writing-culture/)
- Aesop: restraint as positioning, claims present but never foregrounded — [The Brandsider](https://thebrandsider.com/p/how-aesop-turned-intellectual-rigour), [FTRS case study](https://newsletter.ftrs-studio.com/p/case-study-aesop-marketing-as-a-form-of-art)
- Luxury listing copy craft: buyers skip "stunning," verifiable specifics and named entities convert — [HousingWire copywriting guide](https://www.housingwire.com/articles/real-estate-copywriting/), [Inman on design-feature copy](https://www.inman.com/2022/05/23/6-copywriting-tips-to-help-your-listings-design-features-shine/)
- NN/g four dimensions of tone of voice (the dials in Section B) — [nngroup.com](https://www.nngroup.com/articles/tone-of-voice-dimensions/)
- Guideline structures writers actually obey: principles + register + examples + do/don't, ban-lists as floor — [Mailchimp content style guide](https://styleguide.mailchimp.com/voice-and-tone/), [Monzo tone of voice](https://monzo.com/tone-of-voice), [Emphasis practical guide](https://www.writing-skills.com/knowledge-hub/a-practical-guide-to-creating-brand-tone-of-voice-guidelines-that-people-will-actually-use/)

---

## On approval (not before)

1. Rewrite `marketing_brain_skills/brand-voice/voice_guidelines.md` around Sections A to F (keeping §6 ban detail, §11 channel calibration, §12 enforcement, the em-dash banner, and the changelog), and `SKILL.md` to match.
2. Rebuild the CLAUDE.md "Brand Voice" section: four laws + decision tests + pointer to the floor, canonical-phrases block deleted, Appendix A scoping added.
3. Apply the 17 site rewrites in Section C as a copy pass (each figure wired to the DAL with a verification trace, `npm run ci:gates` before commit).
4. Add a "self-description" detector idea to the gate backlog: flag sentences matching `we are|we're + <virtue/category>` and "honest|trusted|expert" used self-referentially on site surfaces (per the gates-not-prose memory).

## Addendum (Matt calibration, 2026-06-10 ~16:50) — pseudo-poetry is Law 3's worst offender

Matt, on the film concept's hero line "The land does the talking.": "fucking retarded."

Add to Law 3 (never editorialize): **no personification, no metaphor-as-headline, no pseudo-poetic taglines.** "The land does the talking" / "where the mountains meet the market" / any line that sounds like a perfume ad is the same disease as "stunning" — an unverifiable vibe asserted at the reader. The headline register is a CLAIM THE PAGE PROVES: a number, a place, a capability, a dare. If a line could caption a tourism brochure, it cannot headline this site.

## Addendum 2 (Matt calibration, 2026-06-10 ~17:15) — parity claims are banned

Matt, on "Every listing gets a film.": "another stupid fucking version of ad copy. every fucking broker shoots film."

New law: **a capability any competitor can also truthfully claim is banned as copy.** "Professional photos", "cinematic video", "3D tour", "drone" — parity, therefore noise. Only MOAT claims may be claimed: live boundary-level data, the deal-flow feed, see-every-number-we-used pricing, the verifiable per-listing marketing report. And capabilities are SHOWN, never said: the film plays in the page; the 3D tour embeds; nobody captions them with what they are. (This extends the competitor test in section D: "could a competitor claim this sentence verbatim?" — for capabilities the bar is "could they claim it AT ALL?")

## Addendum 3 (Matt calibration, 2026-06-11) — proof devices for a NEWER brokerage

Matt: "we havent done enough closing, we are a newer brokerage, we need to be
authentic, honest without saying so."

**Track-record claims are OUT as proof devices** — closing counts, tenure, volume,
"since 2023" flexes. Small numbers read weak; weak reads inauthentic. The proof
hierarchy for Ryan Realty's stage:

1. **The market itself** — demonstrate knowledge ON the market, never about ourselves:
   "Median in Bend moved to $740,000 this month. Fourteen days to pending. Here's
   what that does to a list price." (All live slots.) The 6.9-months buyer's-market
   reading is the archetype: expertise shown by what we SAY ABOUT THE MARKET,
   including when it costs us.
2. **The work product** — show the actual CMA page, the actual listing film playing,
   the actual per-listing analytics report. Never described, embedded.
3. **The process as fact** — what happens, by when: "Photography within 48 hours.
   A written price with every comp shown. A weekly written update." Verifiable
   commitments, not virtues.
NEVER: closings counts, years in business, "newer/established" framing of any kind,
team size (smallness ban), comparisons to other brokerages.

The earlier sample rewrite ("38 closings in Bend since 2023") is RETRACTED — wrong
proof device for our stage. Corrected register below.
