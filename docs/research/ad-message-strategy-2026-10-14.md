# Ad message strategy: plain English, context first, dollars over percentages

Research date: 2026-10-14. Written for step 0 of the content process (the whiteboard,
[`docs/plans/CONTENT_PROCESS.md`](../plans/CONTENT_PROCESS.md)), the ad-strategist
([`.claude/agents/ad-strategist.md`](../../.claude/agents/ad-strategist.md)) and the rules that hold
it ([`lib/content/process/plain-english.ts`](../../lib/content/process/plain-english.ts), rules R-186
to R-196 in [`lib/content/process/rules.ts`](../../lib/content/process/rules.ts)).

**Why this exists.** Matt, 2026-10-14, on the buyer ad draft: "'Sellers are paying to close.' I
already can tell that you're using some sort of language or brevity in the ad that people just aren't
going to understand. It's only you bots that understand it. You jump right into the middle of a
concept when you really don't explain it. It needs to be explained so that a 75-year-old person can
understand it. We're not going to pander, but we need to explain it in simple, plain English." Then:
"We need to start with a bigger context," and "Actual dollar amounts versus percentages will always
land better because people don't really want to do the math."

**How to read this.** Every claim below is a quote or a close paraphrase of the linked source, with
what it means for our ads after the arrow. Where a source is a summary of a primary source, it says
so. No statistic here is ours; none is estimated.

## 1. The order of the message: audience, context, insight, proof, why now, why us, one ask

- **Call out the audience first.** The Federal Plain Language Guidelines (PLAIN, March 2011, rev. May
  2011), "Identify and write for your audience": "Tell your audience why the material is important to
  them. Say, 'If you want a research grant, here's what you have to do.'" The same section: "people
  want to know just what applies to them." -> The opening line names who it is for: "Thinking of
  buying in Central Oregon?" ([guidelines PDF](https://www.fai.gov/sites/fai/files/2016-12-22-Federal-Rulemaking-VAAR-FederalPLGuidelines.pdf),
  [archived table of contents](https://webarchive.library.unt.edu/web/20121006190813mp_/http:/www.plainlanguage.gov/howto/guidelines/FederalPLGuidelines/TOC.cfm))
- **Start from what the audience knows now.** Same section: "Start out by thinking about what your
  audience knows about the situation now. Then, think about how to guide them from their current
  knowledge to what you need them to know." -> Context before shorthand; the opposite of "jump right
  into the middle of a concept".
- **Unaware prospects do not respond to the offer.** Eugene Schwartz's levels of awareness
  (*Breakthrough Advertising*, 1966), as summarized by Josh Kaufman's *The Personal MBA*: at the
  "Unaware" level "the prospect is not aware of any need or Desire for what you have to offer", and
  such prospects do not respond to information about benefits or price. -> Most viewers of a feed ad
  are not shopping today, so a bare figure ("$10,000") lands as noise until the context says what it
  means to them. (Secondary source; the book itself was not read for this note.)
  ([Personal MBA](https://personalmba.com/levels-of-awareness/))
- **One main message, at the top, with the call to action.** CDC Clear Communication Index (User
  Guide, August 2019), item 1: one main message statement, "the one thing the audience must
  remember", 1 to 3 short sentences, which may be combined with the call to action; item 2: "People
  look for the most important information at the top, beginning, or front of a material."
  ([CDC CCI user guide](https://www.cdc.gov/ccindex/pdf/clear-communication-user-guide.pdf))
- **A number needs its comparison.** CCI item 16: "To help people make sense of numbers, present them
  in context. Is the number high or low ... or higher or lower than expected?" -> The whiteboard's
  `contrast` field: what came before, and only with figures behind it.
- **Feed placement and the Housing category.** Our own rules already hold the hook to 2 s (R-053,
  `spec_rules.hook_by_s`) and say a buyer ad's first line picks the buyer by need, because Meta's
  Housing category allows no age, gender or ZIP targeting
  ([`VIDEO_TYPES.md`](../../.claude/skills/ryan-studio/rules/VIDEO_TYPES.md) card 6). Meta's own
  creative guidance page could not be read for this note (it sits behind a login), so no Meta
  statistic is quoted here.

Our order, from the above: **audience call-out, context in plain words, the insight, the proof (one
or two verified dollar figures), the contrast when the data supports it, why now, why us, one ask.**
It has to fit the type's length window and land its hook by 2 s, so most of these are one short line
each.

## 2. Plain language: what the standards say

- **The definition.** Digital.gov: plain language is "communication that is clear and easy to
  understand for your target audience"; "Your audience can understand what you have created the
  first time they read or hear it." ([digital.gov](https://digital.gov/resources/an-introduction-to-plain-language))
  The Plain Writing Act of 2010 (P.L. 111-274) defines plain writing as "writing that is clear,
  concise, well-organized, and follows other best practices appropriate to the subject or field and
  intended audience." ([OPM](https://www.opm.gov/information-management/plain-language/))
- **Not pandering.** Federal guidelines, "Think about your audience": "One of the most popular plain
  language myths is that you have to 'dumb down' your content so that everyone everywhere can read it.
  That's not true." OPM: plain language is not talking down to readers. -> Matt: "We're not going to
  pander."
- **Short sentences, one idea each.** Federal guidelines, "Write short sentences": "Express only one
  idea in each sentence." CDC's plain language page aims for about 20 words a sentence, one idea
  each, and "Put the most important message first."
  ([CDC plain language](https://www.cdc.gov/health-literacy/php/develop-materials/plain-language.html))
  Our spoken-voice check already holds the voiceover tighter than that (R-043).
- **Everyday words, and jargon explained where it is used.** Federal guidelines, "Avoid legal,
  foreign, and technical jargon": "Readers complain about jargon more than any other writing fault,
  because writers often fail to realize that terms they know well may be difficult or meaningless to
  their audience. Try to substitute everyday language for jargon as often as possible." And: "When you
  have no way to express an idea except to use technical language, make sure you define your terms."
  CDC CCI item 7: use the words the primary audience uses every day, and when an unfamiliar term is
  needed, explain it where you use it, in the same sentence or immediately after. -> R-188: an insider
  term passes only when the same line carries its plain explanation. CDC keeps a list of jargon with
  everyday replacements ("Everyday Words for Public Health Communication"); the lexicon in
  `plain-english.ts` is ours, each entry with its reason and the everyday wording to use.

## 3. Readability: the grade the copy is held to

- **The formula.** Flesch-Kincaid grade level, from Kincaid, Fishburne, Rogers and Chissom (1975),
  *Derivation of New Readability Formulas ... for Navy Enlisted Personnel*, Research Branch Report
  8-75, built on reading tests of 531 Navy enlisted personnel: grade = 0.39 x (words / sentences) +
  11.8 x (syllables / words) - 15.59. The result reads as a US school grade.
  ([UCF STARS record](https://stars.library.ucf.edu/istlibrary/56),
  [formula as published on Wikipedia](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests))
- **What "easy to read" means.** MedlinePlus (National Library of Medicine): "In general, easy to read
  materials are usually written at a 5th to 8th grade reading level"; its tutorials are written at
  5th to 6th grade. ([MedlinePlus FAQ, archived](https://webarchive.library.unt.edu/web/20130215105904mp_/http://www.nlm.nih.gov/medlineplus/faq/easytoread.html))
- **How many adults read below that.** A Gallup analysis commissioned by the Barbara Bush Foundation
  (2020) estimated that 54% of US adults aged 16 to 74 read below the equivalent of a sixth-grade
  level, modeled from PIAAC data (2012 to 2017); Snopes rated the claim true with the caveat that it
  is a modeled estimate. ([Snopes](https://www.snopes.com/news/2022/08/02/us-literacy-rate/))
  NCES (December 10, 2024): the share of US adults at PIAAC literacy Level 1 or below rose "from 19
  percent in 2017 to 28 percent in 2023"; numeracy "from 29 percent in 2017 to 34 percent in 2023."
  ([IES press release](https://ies.ed.gov/learn/press-release/u-s-adults-score-par-international-average-literacy-skills-below-international-average-numeracy-and))
- **Older readers.** NCES, 2003 National Assessment of Adult Literacy: 26% of adults aged 65 and older
  were at the Below Basic prose level, against 15% of the whole NAAL population; adults 65 and older
  are one of the groups "overrepresented in the Below Basic level."
  ([NAAL key findings](https://nces.ed.gov/NAAL/kf_demographics.asp))
- **Who buys and sells homes.** NAR 2025 Profile of Home Buyers and Sellers (transactions July 2024 to
  June 2025): first-time buyers' median age a record 40, repeat buyers 62, sellers 64.
  ([NAR](https://www.nar.realtor/magazine/real-estate-news/nar-2025-profile-of-home-buyers-sellers-reveals-market-extremes))
  -> Matt's 75-year-old is not an edge case; it is close to the typical seller.
- **The limits of a formula.** The Federal guidelines put testing with real readers above formulas
  (section "Test": paraphrase testing, usability testing). Wikipedia's summary notes the formulas were
  built for school books and ignore the reader's knowledge and the content's layout. A formula
  measures sentence and word length, not meaning: "Sellers are paying to close" scores easy and is
  still the line Matt rejected. -> So the grade is a floor under the strategist and Matt, never a
  substitute, and the lexicon (R-188) and context first (R-191) catch what the grade cannot.

**The threshold: grade 6 or under (R-190, `PLAIN_ENGLISH.maxGrade`).** It sits at the low end of
MedlinePlus's 5 to 8 easy-to-read range, under the sixth-grade line that more than half of adults
read below (Gallup), and it is for listening once with no rereading, which no reading-level study
above measures directly, so we take the stricter end. Measured on real copy with the code:

| Copy | Grade |
|---|---:|
| Matt's own words, 2026-10-14 ("Are you thinking of buying in Central Oregon? You need to know what's happening in the market. ...", six lines, no figures) | 3.5 |
| The base test film (`lib/content/process/fixtures/`), voiceover plus every on-screen string | under 1 |
| The retired buyer ad lines, "Sellers are paying to close" / "Median seller credit, Bend single-family sales that reported one" | 8.2 |

Tightening the number needs nobody; raising it needs Matt's approval in the commit
(`scripts/check-rule-loosening.mjs`).

**How the code counts** (`plain-english.ts`): the voiceover and every on-screen string are pooled;
each on-screen string is one sentence; ElevenLabs audio tags are not words and an ellipsis is a pause
inside a sentence; syllables are counted by vowel groups with the usual silent-e, -es and -ed rules
(an estimate: "median" counts 2, a dictionary says 3); a figure written in digits counts as one word
of one syllable, and the voiceover spells figures out (the ElevenLabs v3 rule), so a spoken figure
counts in full.

## 4. Dollars over percentages

- **Most people struggle with percentages.** CDC CCI item 15: "Most people find it challenging to
  make meaning from percentages, decimals, fractions and other numbers commonly used in research." If
  there is no audience research, "use numbers most often used by non-experts, such as whole numbers."
  Item 17: "Be sure to do the math rather than expect the audience to calculate"; "Few people are
  likely to take the time or able to conduct even basic mathematical calculations such as addition
  and subtraction." Its worked example states a yearly cost in dollars ("you spent $4,380 last year").
  -> Matt: "people don't really want to do the math, and they don't know what that means."
- **Percentages mislead even experts.** Gigerenzer, Gaissmaier, Kurz-Milcke, Schwartz and Woloshin
  (2007), *Psychological Science in the Public Interest* 8(2), 53-96: "Collective statistical
  illiteracy refers to the widespread inability to understand the meaning of numbers"; a 25% risk
  reduction from mammography "means that 1 less woman out of 1,000 will die of the disease"; they
  recommend absolute numbers over relative ones.
  ([KOPS, Konstanz](https://kops.uni-konstanz.de/entities/publication/1c820f2d-aeed-4bfd-b65b-0e3f86803750/full))
- **Numeracy is low even among the educated.** Lipkus, Samsa and Rimer (2001), *Medical Decision
  Making* 21(1), 37-44: across 463 participants aged 40 and older, "even well-educated participants
  perform poorly on tests of numeracy." ([RePEc](https://ideas.repec.org/a/sae/medema/v21y2001i1p37-44.html))
  PIAAC 2023: 34% of US adults at numeracy Level 1 or below (section 3).
- **Framing sways the less numerate.** Peters, Vastfjall, Slovic, Mertz, Mazzocco and Dickert (2006),
  *Psychological Science* 17(5), 407-413: less numerate people were more swayed by how a number was
  framed. A 2022 to 2023 registered replication (Zhu and Feldman, N = 860) supported the framing
  effect but not the frequency-versus-percentage effect, so that part is not claimed here.
  ([Chalmers record](https://research.chalmers.se/publication/82667),
  [replication](https://rr.peercommunityin.org/index/view/v_article/376?page=17))
- **For a big-ticket purchase, dollars read bigger.** Chen, Monroe and Lou (1998), *Journal of
  Retailing* 74(3), 353-372: "For the high-price product, our subjects indicated that a price reduction
  framed in dollar terms seemed more significant" than the same reduction framed in percentage terms,
  "and the opposite was true for the low-price product." A home is the high-price case.
  ([Illinois Experts](https://experts.illinois.edu/en/publications/the-effects-of-framing-price-promotion-messages-on-consumers-perc/))

**Where Matt goes further than CDC.** CDC rewrites "Eighty-one percent of children" as "8 out of 10
children". Matt's ruling for our ads is dollar amounts ("Actual dollar amounts versus percentages
will always land better"), so R-189 refuses a percentage, the word percent, and an "N in 10" or "N out
of N" fraction in an ad. For organic posts it is planned (R-192) so Matt can widen it.

## 5. What this means for the build

| Finding | Rule |
|---|---|
| A strategist decides audience, context, insight, contrast, why now, why us and one ask before anyone builds; five takes, four killed (creative-brain law) | R-186 (whiteboard required, every field filled, author ad-strategist) |
| Every figure is a verified row, never typed (CLAUDE.md §0) | R-187 |
| Jargon only when explained in the same line | R-188 (lexicon with reasons and glosses; glosses ratcheted, so a new way past a term needs Matt) |
| Dollars, not percentages or fractions, in ads | R-189; R-192 planned for organic |
| Grade 6 or under, voiceover and screen together | R-190 |
| Open on the audience or the situation | R-191 |
| Matt reads the buyer ad's whiteboard script before any board | R-193 (planned, doors) |

## Sources

- PLAIN, *Federal Plain Language Guidelines*, March 2011, rev. 1 May 2011:
  [PDF (fai.gov copy)](https://www.fai.gov/sites/fai/files/2016-12-22-Federal-Rulemaking-VAAR-FederalPLGuidelines.pdf),
  [archived TOC](https://webarchive.library.unt.edu/web/20121006190813mp_/http:/www.plainlanguage.gov/howto/guidelines/FederalPLGuidelines/TOC.cfm),
  [archived "Write short sentences"](https://cybercemetery.unt.edu/oilspill/20121007091104mp_/http:/www.plainlanguage.gov/howto/guidelines/bigdoc/writeShortSent.cfm)
- Digital.gov, [An introduction to plain language](https://digital.gov/resources/an-introduction-to-plain-language); [Clear and short](https://digital.gov/guides/plain-language/writing/clear-short)
- OPM, [Plain Language](https://www.opm.gov/information-management/plain-language/)
- CDC, [Clear Communication Index User Guide (2019)](https://www.cdc.gov/ccindex/pdf/clear-communication-user-guide.pdf); [Plain Language Materials & Resources](https://www.cdc.gov/health-literacy/php/develop-materials/plain-language.html)
- Kincaid et al. (1975), [UCF STARS](https://stars.library.ucf.edu/istlibrary/56); [Flesch-Kincaid readability tests](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests)
- MedlinePlus, [easy-to-read FAQ (archived)](https://webarchive.library.unt.edu/web/20130215105904mp_/http://www.nlm.nih.gov/medlineplus/faq/easytoread.html)
- Gallup / Barbara Bush Foundation (2020), via [Snopes](https://www.snopes.com/news/2022/08/02/us-literacy-rate/)
- NCES, [PIAAC 2023 press release](https://ies.ed.gov/learn/press-release/u-s-adults-score-par-international-average-literacy-skills-below-international-average-numeracy-and); [NAAL 2003 key findings](https://nces.ed.gov/NAAL/kf_demographics.asp)
- NAR, [2025 Profile of Home Buyers and Sellers](https://www.nar.realtor/magazine/real-estate-news/nar-2025-profile-of-home-buyers-sellers-reveals-market-extremes)
- Schwartz (1966) via Kaufman, [The Personal MBA: levels of awareness](https://personalmba.com/levels-of-awareness/)
- Gigerenzer et al. (2007), [KOPS](https://kops.uni-konstanz.de/entities/publication/1c820f2d-aeed-4bfd-b65b-0e3f86803750/full)
- Lipkus, Samsa and Rimer (2001), [RePEc](https://ideas.repec.org/a/sae/medema/v21y2001i1p37-44.html)
- Peters et al. (2006), [Chalmers](https://research.chalmers.se/publication/82667); replication, [PCI RR](https://rr.peercommunityin.org/index/view/v_article/376?page=17)
- Chen, Monroe and Lou (1998), [Illinois Experts](https://experts.illinois.edu/en/publications/the-effects-of-framing-price-promotion-messages-on-consumers-perc/)
