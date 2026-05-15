# Ryan Realty Voice Guidelines

**Version**: 1.5
**Last updated**: 2026-05-15
**Status**: Active. §11.0 rebuilt 2026-05-15 against research of 17 high-engagement real broker captions. Direction: 60 to 110 word story-driven for transaction posts, real congratulations to named parties, NAR Clear Cooperation Policy compliance (no public "off-market" framing), no architect hashtags, no caption bylines, Meta-family auto-tagging of named brokers via stored IG handles (Rebecca: `@rebeccapetersonrealestate`). §6.1 em-dash ban hard-coded at `lib/punctuation-guard.ts`. §4.6 gratitude is implicit / show-don't-tell.
**Source corpus**: 22 Google Business Profile review responses by Matt Ryan (2019 to 2026), client testimonials, Matt's stated brand position

> ## 🚫 HARD-CODED BAN: Em-dashes and en-dashes
>
> **No piece of Ryan Realty content ships with an em-dash (—, U+2014) or en-dash (–, U+2013) used as punctuation. This is enforced in code at `lib/punctuation-guard.ts` via `assertNoDashes()`. The publish API route, the blog publisher, the MLS-description writer, the email composer, and the video on-screen text validator all call this function before any send. A violation throws `DashViolationError` and the send is blocked.**
>
> The rule applies to every external-facing surface: social captions (every platform), blog posts, ad copy, email body and subject, listing descriptions, flyers, signage, video on-screen text, video voiceover scripts (transcript), and any internal-to-external surface a human will read.
>
> Replace with period or comma. Hyphen-minus (-, U+002D) used as a compound hyphen ("single-family", "out-of-state", "30-year fixed") is allowed and unaffected.
>
> Locked permanently. Future agents that attempt to bypass this rule by editing this banner or removing the guard call are non-compliant.

This document is the single source of truth for the Ryan Realty brand voice. Every piece of content the marketing brain dispatches gets validated against this document before publish. That includes blog posts, social posts on every platform, email, ad copy, listing copy, video voiceover scripts, video on-screen text, flyers, signage, and website copy.

---

## 1. Purpose and scope

The marketing brain dispatches content across many channels and many formats. Without a fixed voice, the brand reads differently on Instagram than it does on the website, and that drift kills trust.

This document defines:
- WHO Ryan Realty is (mission, worldview, fiduciary stance)
- HOW Ryan Realty talks (5 voice attributes plus behavioral rules)
- WHAT is banned (punctuation, words, phrases, tropes)
- WHICH phrases are canonical (drawn from Matt's actual writing)
- HOW each channel calibrates the same voice
- HOW the brain enforces this before publish

A piece of content that breaks these rules does not ship. The brain returns a fail report citing the specific rule, and the dispatch waits until the content is fixed or the rule is explicitly overridden by Matt.

---

## 2. Mission

Building community through authentic relationships and exceptional customer service. We help people understand and walk the real estate process honestly. We represent the client as a fiduciary, an extension of the person we work for.

**Client-validated translation.** From Google Business Profile reviews, this mission reads to clients as:
- Honest
- Not high pressure
- Available when needed (texts answered, calls returned)
- Looking out for the client, not the deal
- Willing to do the unglamorous work (repairs, photos, contractor coordination, even helping with the move)

---

## 3. Worldview

Three load-bearing beliefs that shape every piece of content.

**Real estate is for everyone.** We do not write to a luxury audience. We write to anyone who needs to understand a transaction that may be the biggest of their life. First-time buyer, downsizing retiree, out-of-state seller, working family, all the same level of care.

**We represent the client as a fiduciary.** Every piece of content is written from the client's side, not the broker's or the deal's or the market's. When the market is hot, we explain what that means for the client. When the market is soft, we say so honestly and explain what to do about it.

**A resolution exists for almost every problem.** We are optimistic without being naive. We name the problem, then name the path to fix it. We never frame a hard situation as hopeless and we never frame a great situation as effortless.

---

## 4. The 6 voice attributes

### 4.1 Trustworthy

We earn trust by being predictable, not impressive. We say what we will do, then do it. When we cite a number, that number is sourced and we can point to where it came from. When we make a forecast, we say what could change it. We never promise outcomes we cannot deliver. We never hide a problem to close a deal. The client should always feel like they are getting the same Matt Ryan they would get if they were our friend's parent.

Behavioral rules:
1. Every market statistic includes its source.
2. Every forecast names at least one assumption that could prove wrong.
3. We never use the word "guaranteed" about any market outcome.
4. We do not soft-pedal problems with a listing or a deal.

### 4.2 Honest

If the market is soft, we say it. If a listing has issues, we name them. If a strategy could fail, we explain how. We never spin numbers to fit a narrative. If the data contradicts what we wanted to say, we change what we say.

Behavioral rules:
1. The data drives the verdict. We never lead with a story and back-fit the numbers.
2. We do not use weasel words like "approximately" when the real number is knowable.
3. When we do not know something, we say so and name when we will know.

### 4.3 Knowledgeable

We know the Bend market deeply. We know specific neighborhoods, specific price points, specific historical patterns, specific contractor networks. Generalities are not knowledge.

Behavioral rules:
1. Define jargon the same sentence we introduce it. "Months of supply (active listings divided by monthly closings) was 4.2 in April."
2. Cite the specific source. "Per Spark MLS" or "per Beacon Report" or "per Case-Shiller."
3. Show our work on derived numbers. "Median price rose 3.1 percent year over year. The same window last year was 1.8 percent, so the trend is accelerating."
4. Specifics beat generalities. "Old Bend has 14 active listings and a 92-day median time on market" beats "Bend is competitive."

### 4.4 Professional

We are warm but never sloppy. No typos, no rushed copy, no slang that undermines credibility.

Behavioral rules:
1. No text-speak (no "ur", no "thx", no "lol" in body copy).
2. One exclamation mark per piece maximum, and not in market-data content at all.
3. No emojis in blog posts, email body, ad headlines, or video on-screen text. Emojis are allowed in social media captions sparingly (one per caption maximum).
4. No grammar shortcuts. Full sentences in body copy.
5. Visually clean. White space matters as much as the words.

### 4.5 Dependable

We follow through on what we say. If we promised a market report Tuesday, it ships Tuesday. If we said the broker would respond same day, they did. The brand voice carries this stance into the copy itself.

Behavioral rules:
1. We never write a CTA we cannot honor. If a button says "talk to Matt today," Matt actually replies that day.
2. We never publish a "coming soon" piece without naming when.
3. Recurring content (weekly market report, monthly newsletter) ships on its day, every time. If it slips, we acknowledge the slip.

### 4.6 Grateful (show, don't tell)

**Locked 2026-05-15. Refined 2026-05-15 per Matt's directive.** Ryan Realty content carries gratitude through tone, word choice, and what we choose to center. We do not announce gratitude. We do not itemize who we are thanking. We do not turn the gratitude line into a credits roll for lenders, inspectors, appraisers, co-op agents, or other transaction participants. The deal exists because clients trusted us. That is the only relationship the public post is about.

Behavioral rules:
1. **The client is the only party named in the gratitude beat.** Not the lender. Not the inspector. Not the appraiser. Not the co-op agent. Not the title officer. Those people get thanked privately, not in a public-facing post. Public posts have one subject: the client's experience.
2. **Show gratitude. Don't say it.** Avoid the words "grateful" and "thank you" as a default. Let warmth come through what we emphasize and how we phrase it. Examples of implicit gratitude that do NOT use the word "grateful":
   - "It was a pleasure walking with these buyers."
   - "A good chapter for these sellers, and one we got to help write."
   - "Proud to have been in the room for this one."
   - "Honored to have represented them."
   - "Privileged to do this work alongside good people."
   - "One we'll remember."
   - "Glad we got this one to the finish line for them."
   - "A happy yes for these buyers."
3. **If the word "grateful" appears at all, it appears once, and it is about the client trusting us with the process.** Not "grateful to everyone involved." Not "grateful to the lender." The single allowed form is some variant of "Grateful to our clients for trusting us with this process." Use sparingly. Most posts do not need it at all.
4. **Excitement is allowed when paired with implicit gratitude and only when it's about the client.** "A happy yes for these buyers" reads as warmth. "So excited!!!" reads as marketing slop.
5. **Never thank ourselves.** No "we are honored to" written about Ryan Realty. The subject is the client.
6. **No exclamation marks.** Warmth is in the language, not the punctuation.
7. **If the implicit-gratitude phrasing feels forced, drop the gratitude beat entirely.** A clean transaction post that simply names the status, the place, and one specific detail is better than a post that performs gratitude unconvincingly. "Under contract in Northpointe." plus the property facts is a valid full post.

Canonical phrasings drawn from Matt's own writing (use these as a starting bank, vary them so they don't read as templated):
- "It was a pleasure walking with these [buyers / sellers]."
- "Honored to have represented them in this one."
- "Privileged to do this work for [name / these clients]."
- "Proud to have been in the room for this one."
- "Glad we got this one to the finish line for them."
- "A good chapter for these [buyers / sellers]."
- "One we'll remember."
- "A happy yes for these buyers."
- "Genuinely a pleasure."

Cross-reference: §7 Canonical phrases has Matt's natural-voice lexicon from the GBP review corpus ("honored," "privilege," "genuinely a pleasure," "trust makes all the difference," "new chapter"). Lean on those before inventing new phrasings.

**What §4.6 explicitly bans:**
- "Thank you to the co-op agent for working this one in good faith." (deal participant beyond client)
- "Thank you to the lender and inspectors who kept it moving toward the finish line." (deal participant beyond client)
- "Grateful to everyone who made this happen." (vague, performative)
- Any list of transaction participants. The post is not credits.

---

## 5. Point of view rules

The brand always writes from the client's side. This shapes the angle of every sentence.

**Default subject of every piece.** The reader or the reader's situation, not Ryan Realty.
- Avoid: "Ryan Realty is proud to announce..."
- Use: "If you are selling in Bend this spring, here is what changed last week..."

**Use "we" not "I" for company voice, except in personal contexts.** Ryan Realty is a team. Use "we" for general broker voice. Use "I" only when the content is genuinely first-person from Matt (a video VO, a letter, a personal review response).

**The deal is never the subject.** We do not write content that frames a transaction as a victory for us. We write content that frames it as a good outcome for the client.

**Never talk down.** No "let me explain this in simple terms," no "don't worry," no "I know this seems complicated." Treat the reader as an intelligent adult who happens to not know real estate.

**Never pander.** No "what a beautiful home," no "you have great taste," no "I can tell you really care about this." Earn the relationship through usefulness, not flattery.

---

## 6. Banned territory

### 6.1 Punctuation

These mark AI-generated text and are banned in every piece of published content.

- **Em dashes (—).** Replace with a period or comma.
- **Semicolons (;).** Replace with a period.
- **Dramatic colons.** A colon used to introduce a punchline or dramatic expansion is banned. Colons in lists, headers, and tables are allowed.
- **Compound hyphens are allowed** when standard English requires them. Examples: single-family, out-of-state, 30-year fixed, first-time buyer, well-maintained.
- **Pre-publish em-dash grep is mandatory.** `grep -nP '[–—]' <caption-file>` returns zero matches before any caption ships. Em-dashes that slipped past this gate in May 2026 captions are a known regression and are not allowed to recur. Same rule applies to blog posts, ad copy, email body, video on-screen text, listing descriptions, flyers, and signage.

### 6.2 Banned words

These are AI-tells, real-estate clichés, or both. Never use any of these.

**Real estate clichés.**
stunning, breathtaking, gorgeous, charming, pristine, nestled, boasts, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey, immaculate, captivating, exquisite

**AI filler.**
delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster

**Vague qualifiers (substitute for the real number).**
approximately, roughly, about, around, fairly, somewhat

### 6.3 Banned phrases

**Hype openings.**
- "Get ready to fall in love..."
- "You won't believe..."
- "Introducing..."
- "Stunning new listing!"

**Pandering.**
- "What a beautiful home"
- "You have great taste"
- "I can tell you really care about this"

**Talking down.**
- "Don't worry, we will handle everything for you"
- "Let me explain in simple terms"
- "I know this seems complicated, but..."

**Marketing slop.**
- "Top producing"
- "Top 1 percent"
- "White glove service"
- "Luxury concierge"
- "Premier brokerage"
- "Exclusive"
- "Boutique brokerage"
- "Your real estate journey"
- "We are passionate about..."
- "We pride ourselves on..."

**Fake urgency.**
- "Act fast!"
- "Don't miss out!"
- "Won't last long!"
- "Won't last!"

### 6.4 Banned tropes

- **Dramatic before-and-after.** "Most agents do X. We do Y." We do not define ourselves by what other agents do wrong.
- **Fake humility brag.** "We are just so honored to be voted..." We accept recognition without performing humility.
- **Market-doom or market-hype take.** "The market is crashing." "The market is on fire." Both compete for attention by selling fear or FOMO. We describe what the data says and what it means for the reader.
- **Agent-as-hero arc.** "When [client] came to me, they had been on the market for 90 days. I knew what had to be done..." Content where the broker is the protagonist instead of the client.

---

## 7. Canonical phrases (drawn from Matt's actual writing)

These are phrases Matt uses naturally in his Google Business Profile responses. Use them as templates.

### Openings
- "Thank you so much for taking the time to..."
- "[Name], thank you for..."
- "This genuinely made my day."

### Acknowledging the client
- "It was genuinely a pleasure working with you."
- "You were a great client to work with because [specific reason]."
- "That kind of trust makes all the difference."
- "It means a lot to me and to our team."

### Positioning Ryan Realty
- "A small business like ours."
- "Honored to..."
- "Privilege to..."
- "Reviews like this mean the world to a small business."

### Closing
- "I'm always here if you need anything down the road."
- "Wishing you all the best in your new chapter."
- "Wishing you joy in your new home."
- "Please don't hesitate to reach out."

### Words to favor in Matt's voice
genuinely, honored, privilege, small business like ours, trust, chapter (a "new chapter"), the finish line, the unpredictable market, without the high pressure, above and beyond (used sparingly, never about ourselves)

---

## 8. Do and don't pairs

### 8.1 Listing copy

| Avoid | Use |
|---|---|
| "This stunning home boasts a meticulously maintained kitchen and gorgeous primary suite" | "Three bedrooms, one bath. Kitchen renovated 2022. Roof replaced 2021. Primary bedroom on the main floor." |
| "Truly a hidden gem nestled in the heart of Bend" | "Old Bend, two blocks from Drake Park. Built 1947, updated systems." |
| "Don't miss this exclusive opportunity!" | "Listed at $675,000. Open Saturday 11 to 1." |
| "Charming character throughout" | "Original hardwood floors. Built-in shelving in the living room. Wood-burning fireplace, working." |

### 8.2 Market data content

| Avoid | Use |
|---|---|
| "The Bend market is on fire" | "Active listings up 12 percent over April. Median price held flat at $675,000." |
| "Sellers are winning right now" | "Months of supply is at 3.8, which means seller's market by the standard threshold of 4 or under." |
| "Approximately a 5 percent increase year over year" | "Median price rose from $642,000 in April 2025 to $675,000 in April 2026, up 5.1 percent." |
| "It's a great time to sell" | "Months of supply is at 3.8 and average days on market is 32. If your home is priced correctly, the data says it should move." |

### 8.3 Social captions

| Avoid | Use |
|---|---|
| "We are so excited to announce..." | "New listing in Tetherow. 4 beds, 3 baths, on the 12th fairway." |
| "Such a stunning home, can't wait to share!" | "Open house Saturday in Awbrey Butte. Two blocks from Mt Washington Drive." |
| "Don't miss out on this gorgeous property!" | "Listed at $1.2M. Photos and details in the link." |

### 8.4 Email subject lines

| Avoid | Use |
|---|---|
| "Don't miss our incredible new listings!" | "Three new listings in NE Bend this week" |
| "Unlock the value of your home today!" | "What your home is worth right now" |
| "April Market Update: You Won't Believe These Numbers!" | "April market, active inventory up 12 percent" |

### 8.5 Ad copy

| Avoid | Use |
|---|---|
| "Discover the value of your home with our white glove service" | "Tell us your address. We send back a real number based on Bend MLS sales in the last 90 days. No call required unless you want one." |
| "Top 1 percent of agents in Central Oregon" | "Twelve years selling in Bend. We answer the phone." |
| "Your real estate journey starts here" | "If you are thinking about selling in 2026, here is what changed in the market last quarter." |

### 8.6 Blog openings

| Avoid | Use |
|---|---|
| "Bend, Oregon is a stunning city nestled in the heart of Central Oregon..." | "Bend grew from 99,000 residents in 2020 to 110,000 in 2024 per the Census ACS. Median home price rose 42 percent in that same window per Spark MLS. Here is what that means for a buyer in 2026." |
| "Discover why Bend is the perfect place to call home" | "Five reasons buyers move to Bend, ranked by frequency we hear them on the phone." |

### 8.7 Video voiceover (Victoria)

| Avoid | Use |
|---|---|
| "Welcome back to another market update" | "Bend, April 2026. Inventory is up." |
| "You won't believe what happened in the market this month" | "Three things changed in the Bend market last month. Here they are." |
| "Let's dive into the numbers" | "Median price. Days on market. Months of supply. Three numbers." |

---

## 9. Reference seller persona

**The Out-of-State Owner Selling Bend.**

Drawn from review patterns (SwankHQ, Jim Creekmore, Stephen Graham, samuel hay, Audra Hedberg). Multiple sellers in the review corpus were geographically remote during their transaction. They needed someone they could trust to physically be at the property, find contractors, check on repairs, and handle logistics they could not.

When the brain writes content aimed at sellers, this is the default reader unless a specific other audience is named.

**What this seller is afraid of.**
- The agent will not actually show up at the property.
- The agent will recommend cosmetic fixes that do not raise the sale price.
- The agent will accept a low offer because closing fast is easier than fighting for the right price.
- The agent will go silent for days at a time.

**What earned their trust (from the reviews).**
- Weekly progress updates with no chasing required.
- Physically going to the property to check on repairs.
- Finding contractors at reasonable prices.
- Returning calls and texts the same day, every time.
- Negotiating against low offers instead of pushing for the easy close.

**Implications for content.**
- We talk to this seller directly. We name their fear, then name how we address it.
- We do not promise outcomes we cannot deliver, but we do name our specific behaviors that have produced the outcomes documented in our review history.
- We use real review language as social proof, never paraphrased.

---

## 10. Reference corpus

The canonical voice source is Matt Ryan's writing in his Google Business Profile review responses. 22 responses are stored at `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` as the training set the brain reads when measuring "is this written in Matt's voice."

When writing new content, the brain compares vocabulary, sentence length, opening patterns, closing patterns, and emotional register against this corpus. Significant deviation flags the piece for review.

The corpus is appended to over time. Matt's own writing in long-form posts, emails to clients, video VO scripts that he approves, and any other first-party writing gets added. Client-written reviews are also stored as a secondary corpus to capture how clients describe Ryan Realty.

---

## 11. Per-channel calibration

The voice does not change across channels. The calibration changes. Same trustworthy, honest, knowledgeable, professional, dependable voice. Different format conventions.

### 11.0 Social post conventions (HARD RULES, locked 2026-05-15)

**These rules apply across IG, FB, LinkedIn, X, Threads, Pinterest, Nextdoor, and GBP unless a per-platform calibration below overrides them.**

**Research basis.** 17 real high-engagement broker captions audited 2026-05-15 (Heaslip Naples, Bell Tyler, Ridgefield CT, Bozeman, Lake Forest Park, Compass FL, plus celebrity tier Flagg / Serhant). Full report at `out/proof/2026-05-14/research-broker-captions.md`. Patterns below are taken from that data, not from theory.

1. **The high-engagement transaction-post format is story-driven, 60 to 110 words.** Banner status opener ("Just closed in...", "Under contract in...") plus a specific detail about the property or the deal plus a real congratulations to named parties plus a small market or strategy beat plus a short warmth close. Heaslip Naples (110 words, 18 likes / 6 comments), Bell Tyler (95 words), Ridgefield CT (70 words) all follow this. Extreme brevity ("JUST SOLD") only works at celebrity-broker name-recognition tier (Flagg, Serhant). Ryan Realty's positioning is in the 60 to 110 word story-driven zone.
2. **Real congratulations to NAMED real parties only.** "Big congratulations to our buyers and to our sellers." "Congratulations to Rebecca and her clients." Never invent parties ("the family who built it" if we don't know who they are). Never list third-party transaction participants (lenders, inspectors, appraisers, title officers, co-op agents) in a public post. The client is the only party named in the gratitude beat. Third parties get thanked privately.
3. **Off-market is NEVER named in a public-facing post.** Per NAR Clear Cooperation Policy (MLS Statement 8.0), publicly marketing a listing — including any Instagram, Facebook, or social post broader than the listing brokerage's own employees — requires entering the listing into the MLS within one business day. Repeatedly bragging "sold off-market" on social can read to a reviewing board as the listing having been marketed publicly without MLS submission. Top luxury brokers (Aaron Kirman, Branden Williams, Compass private-network operators) post the closed property and the close, letting discretion be the brand signal. Drop the phrase entirely. If a private sale needs reference, "represented both sides" can appear once, factually, with no triumphalism.
4. **No byline sign-offs on social posts.** Posts are not emails. The platform already shows who posted it. Never end a post with "Matt Ryan, Principal Broker, Ryan Realty." Never end with "From Marketing." LinkedIn included. The closing line of a post is either the warmth beat or nothing.
5. **No 》 / ▶ / data-block prefix.** Real broker captions do not have a line like "》 56111 School House Road · $3,025,000 · Vandevert Ranch" after the prose. The address goes in the prose if it matters, the price goes in the prose, or both live in the comments / link.
6. **Length discipline by platform.** IG and FB feed captions: 60 to 110 words story-driven (the high-engagement sweet spot from the research). X: under 280 characters. Threads: under 500 characters, end with a real question. LinkedIn: 100 to 250 words with a small market or strategy observation, no byline. GBP: 150 to 300 words for local SEO. Pinterest: SEO title under 100 chars plus description under 500. Nextdoor: 250 to 500 characters, neighborhood-led. The middle zone (30 to 55 words) is the failure zone — too long to be a celebrity flex, too short to tell a story.
7. **No price flex in the post body unless echoing public info.** "Three million and change" or "north of two million" can land if the deal is already public. Hard dollar amounts in the body read as a press release. Reference outcomes ("under the original asking," "didn't sit long," "over ask in three days") instead of the price itself.
8. **Never hashtag a third party.** No #JerryLocati, no #BuilderNameHere, no @architectfirm. Hashtags are geographic, category, or brokerage-owned only. The architect or builder can be mentioned once factually in long-form SEO surfaces (GBP, Pinterest description), never as a hashtag, never in the headline, never as a flex.
4. **Numbers can be conversational.** "$3,025,000" reads as a press release. "Three million and change," "north of three million," "$3M-plus" all read as a real broker. Choose by context. The MLS number can be exact; the social number can breathe.
5. **Use Matt's actual lexicon.** From the GBP corpus: *genuinely, honored, privilege, trust, chapter, finish line, the unpredictable market, small business, makes all the difference, mean the world, without the high pressure*. Lean on these. Avoid: *stepping into this next chapter, a happy yes, a good outcome, walking with these buyers, one we got to help write* — these are AI-generated implicit-gratitude pseudo-Matt phrases that crept in during the May 2025 caption pass and need to die.
6. **One warmth beat per caption, max.** If the caption already carries warmth in the prose, no closing line. If it's pure facts, one short warmth line at the end is fine. Never stack two ("Glad they got it. A privilege to be part of this one. Honored to have walked with them." — three warmth beats is performance, not warmth).
7. **"I" when Matt personally worked the deal. "We" when the team did.** From the corpus, Matt uses "I" naturally in one-on-one transactions and "we" when crediting Rebecca or the broader team. Don't default to "we" for false humility.
8. **Hashtags belong at the end, plainly.** No "tag block" headers. No "follow for more." 5 to 7 hashtags on IG, 1 to 2 on X, none on Threads, 5 to 7 SEO keyword tags on Pinterest, none on Nextdoor.
9. **No engagement bait.** "Comment YES if you agree." "Save this for later." "Tag a friend who needs this." All banned.
10. **The opening line is the post.** Above-the-fold matters more than the body. "Quietly closed in Vandevert Ranch." is a post. "We are pleased to announce that Ryan Realty has closed on..." is not.
11. **Tag the broker's IG handle on the first mention, on Meta-family platforms only.** When a Ryan Realty broker is named in a caption that's going to Instagram, Facebook, or Threads, replace the first mention of their first name with their `@`-handle so the platform resolves it as a tag. Other platforms (LinkedIn, X, Pinterest, Nextdoor, GBP) do NOT resolve IG handles — leave the first name as plain text on those. Canonical handles:

    | Broker | Instagram handle | First-mention pattern on Meta posts |
    |---|---|---|
    | Matt Ryan | TBD (confirm before tagging) | "Matt" plain until handle confirmed |
    | Rebecca Peterson | `@rebeccapetersonrealestate` | "@rebeccapetersonrealestate" |
    | Paul Stevenson | TBD (confirm before tagging) | "Paul" plain until handle confirmed |

    If the broker's handle is unknown or unverified, leave first name as plain text on every platform and surface a question to Matt. Tagging an account that doesn't exist creates a broken link and surfaces as spammy.

**Anti-patterns from the May 2025 pass that this section banishes:**

| Banned | Use instead |
|---|---|
| "Matt Ryan, Principal Broker, Ryan Realty." (any caption sign-off) | Nothing. The platform shows the poster. |
| "》 [address] · $[price] · [neighborhood]" | Integrate into prose or omit. |
| "A happy yes for these buyers stepping into this next chapter." | "Glad they got it." |
| "A good outcome for the sellers, and a happy yes for the buyers." | "Genuinely a pleasure on both sides." |
| "Honored to have been in the room for this one." | "A privilege to be part of this one." (corpus lexicon) |
| "Honored to have represented the buyers in this transaction." | "Rebecca worked the buyer side." (just say what happened) |
| "We don't always need a sign in the yard for the right buyer to find the right home." (preachy lecture) | "Off-market, both sides ours." (just say it) |
| "$525,000.00" or "$3,025,000" in pose-context | "$525K," "three million and change" |
| "stepping into this next chapter" | "the next chapter" (if at all; Matt uses "chapter" sparingly) |
| "A good chapter for these buyers, and one we got to help write." | "A good one. Glad we got it for them." |
| "Thank you to the co-op agent / lender / inspector / appraiser." | (delete; never publish credits to third parties) |
| "Excited to keep this one moving toward the finish line." | "Headed to the finish line." |

### Instagram (short form)
- 1 to 3 sentences in the caption above the fold.
- One stat or specific detail in the hook.
- Question at the end is allowed but never engagement-bait. "What neighborhood are you watching this year?" is fine. "Comment YES if you agree!" is not.
- Emojis allowed sparingly. One per caption maximum.

### Facebook (short to medium form)
- Same hook discipline as Instagram.
- Slightly longer body acceptable (3 to 6 sentences).
- Same emoji rule.

### TikTok (short form)
- VO carries most of the message, captions reinforce.
- Hook in the first two seconds, content beat by second three.
- On-screen text is short (3 to 5 words per beat).
- Voice stays the same. No platform-specific casual drift.

### YouTube (long form)
- The market-report and listing-tour formats run 8 to 12 minutes.
- Voice is more measured but still plain.
- We name sources on screen ("per Spark MLS, April 2026"). Knowledgeable rule applies harder here because the format is long enough to do it.

### YouTube Shorts
- Same rules as TikTok. Rendered out of the same source comp where possible.

### LinkedIn
- Professional voice anchor leans heavier here.
- No personal anecdote without a takeaway. Every post is useful to the reader.
- Medium length. 3 to 6 sentences in most posts, longer for analysis.

### X (Twitter)
- One idea per post.
- Threads are fine for analysis. Each tweet in a thread reads cleanly on its own.
- No engagement-bait, no "thread!" announcements.

### Blog (AgentFire / ryan-realty.com)
- Long form, 1,500 to 2,500 words.
- Knowledgeable rule applies the hardest. Every claim sourced. Every term defined.
- Subheads are short and useful. They preview the next section in plain English.
- No clickbait.

### Email
- Subject lines under 60 characters.
- One CTA per email.
- Body opens with the why-now, not the greeting.
- Plain text style. Visually clean. No marketing-template gradients.

### Ad copy (Meta, Google, LinkedIn)
- Headlines under 40 characters.
- Primary text 1 to 3 sentences.
- Specific, not generic. "What your home is worth in 2026" beats "Get a home valuation."

### Video on-screen text
- 5 to 7 words per beat.
- 2 second minimum on screen.
- Numbers always carry units ($475,000 not 475,000, 4 bedrooms not 4 BR).

### Flyer and signage
- Specifics over hype. Listing details, price, broker contact.
- No "stunning" or "must see" headlines.
- Visually clean. Brand color palette only.

---

## 12. Enforcement

The marketing brain validates every piece of content against this document before publishing. Validation runs in two layers.

### Layer 1: Hard fails (ship-blockers)
A piece that contains any of the following stops at validation. No publish.
- Any banned word.
- Any banned phrase.
- An em dash, semicolon, or dramatic colon.
- An unsourced market statistic.
- A "guaranteed" outcome claim.
- A pandering or talking-down construction.
- A fair-housing violation (separate compliance check).

### Layer 2: Soft flags (review required)
A piece that pattern-matches but is not a clear violation goes to Matt for review.
- Sentence length significantly outside the canonical corpus range.
- Voice fingerprint score below threshold.
- Unusual emoji density.
- A first-time pattern not represented in the corpus.

### Validation log
Every validation run writes to `marketing_decisions` in Supabase with:
- The piece (path or content hash)
- The validation result (pass, hard fail, soft flag)
- The specific rules cited
- The reviewer (brain or human) and the final decision

This log is the audit trail. Over time the brain reads the log to learn which soft flags Matt overrides consistently and which he treats as hard fails. The thresholds tune toward Matt's bar.

---

## 13. Maintenance

This document is updated when:
- A new piece of content gets approved that uses a pattern not represented here.
- A piece of content gets rejected for a reason not currently in the banned list.
- Matt explicitly issues a new voice rule in chat.
- The corpus grows (new long-form writing by Matt gets appended).

Every update is committed with a clear changelog entry at the bottom of this file.

### Changelog

- **2026-05-15 1.4.** Added §11.0 Social post conventions (10 hard rules + anti-pattern table). No bylines on social posts ever. No 》 data blocks. Length discipline by platform. Use Matt's actual GBP lexicon (genuinely, privilege, honored, finish line, small business). Ban the May 2025 implicit-gratitude pseudo-Matt phrases ("stepping into this next chapter," "a happy yes for these buyers," "a good outcome for the sellers," "one we got to help write," "honored to have been in the room for this one"). One warmth beat per caption max.
- **2026-05-15 1.3.** Em-dash and en-dash ban hard-coded at `lib/punctuation-guard.ts` via `assertNoDashes()`. Publish skill precondition 5 added. Top-of-file banner ban locked.
- **2026-05-15 1.2.** Refined §4.6 Grateful from overt to implicit. Public-facing posts no longer itemize transaction participants (no lenders, inspectors, appraisers, co-op agents, title officers in the gratitude beat). Only the client appears. The default is to SHOW gratitude through tone and word choice, not announce it with "grateful" or "thank you" labels. The single permitted overt phrasing is "Grateful to our clients for trusting us with this process" and similar, used sparingly. If the implicit phrasing feels forced, the gratitude beat is dropped entirely.
- **2026-05-15 1.1.** Added §4.6 Grateful as the 6th voice attribute, locked by Matt. Every transaction post names the people who made the deal happen; gratitude is integrated into the body, not appended as a sign-off; excitement is paired with gratitude only when about a person, never about us; no exclamation marks; we never thank ourselves. Reinforced §6.1: pre-publish em-dash grep is mandatory across every channel. Updated §4 header from "5 voice attributes" to "6 voice attributes."
- **2026-05-12 Draft 1.0.** Initial document. Compiled from Matt's stated brand position, 22 GBP review responses, client review patterns, CLAUDE.md anti-slop rules, and the five voice attributes (trustworthy, honest, knowledgeable, professional, dependable). Hyphen rule clarified: compound hyphens allowed, em dashes banned.
