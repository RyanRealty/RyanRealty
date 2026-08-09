/**
 * scripts/voice-constructions.cjs
 *
 * The machine-readable form of the "Banned constructions" section of
 * marketing_brain_skills/brand-voice/VOICE.md.
 *
 * SHAPE RULES WERE REMOVED 2026-08-06. This file used to ban coined maxims,
 * sermon clauses, meaning-narration and obvious restatement. Those came from the
 * GOV.UK "mechanical law" layer that is no longer part of the canon, and Buffett
 * uses all four constantly — interpreting a number for the reader IS the
 * Berkshire letter. Enforcing them rewrote the whole site into government-service
 * prose in a single day.
 *
 * What remains polices CONDUCT and TRUTH, not style: invented quotations,
 * self-praise, pandering, manufactured urgency, forecasts stated as fact,
 * numbers made to talk. None of those is a taste question.
 *
 * The test for adding anything here: if a good writer would ever do it on
 * purpose, it does not belong in a gate.
 *
 * Each rule carries the canon rule it enforces, a human label, a regex, and a
 * fix instruction that tells the rewriter what to do instead. Consumed by
 * scripts/check-voice-constructions.mjs (the gate + the worklist generator).
 *
 * Edits land HERE and only after the canon says so. A pattern that is not a
 * rule in VOICE.md does not belong in this file.
 */

'use strict'

/** @type {Array<{id:string,rule:number,label:string,source:string,fix:string,example:string}>} */
const CONSTRUCTIONS = [
  // ── Rule 2: state the fact, then stop ──────────────────────────────────


  {
    id: 'takeaway-framing',
    rule: 2,
    label: 'announces the conclusion instead of stating the fact',
    source:
      "\\bthe\\s+(takeaway|bottom\\s+line|upshot)\\s+(is|here)\\b|\\bwhat\\s+this\\s+all\\s+means\\b|\\bhere\\s+is\\s+what\\s+(that|this)\\s+means\\b",
    fix: 'Lead with the fact itself. Cut the announcement.',
    example: 'The bottom line here is that pricing matters.',
  },

  // ── Rule 8: never be pleased with yourself ─────────────────────────────

  // ── Rule 2: state the fact, then stop ──────────────────────────────────
  //
  // Added 2026-08-06 after the repo-wide pass. Both shapes below were live on
  // the site while ci:brand-voice and ci:voice-constructions reported zero —
  // they carry no banned word and no listed sermon connector, so nothing
  // caught them. They are rules now because they were found by eye, and the
  // next person will not have that eye.
  {
    id: 'affordance-instruction',
    rule: 2,
    label: 'explains that a control does what the control obviously does',
    source:
      "\\b(click|tap|open|drag)\\s+any\\s+(dot|card|city|pin|marker|tile|row|photo)\\b|\\buse\\s+the\\s+arrows\\s+to\\s+browse\\b|\\bscroll\\s+to\\s+see\\s+more\\b",
    fix: 'Cut it. A dot on a map is already clickable, and the reader already knows.',
    example: 'Click any dot for the price, the beds, and the street.',
  },
  {
    id: 'reassurance-no-receipt',
    rule: 2,
    label: 'reassurance about our character, with nothing behind it',
    // Matched as the TRAILING CLAUSE it actually was, not as any mention of
    // the phrase. Internal skill docs instruct producers to avoid "no
    // pressure"; a rule that fires on the instruction as well as the sin
    // produces a baseline of noise, and a noisy gate is one people learn to
    // ignore. So: a sentence boundary in front, a full stop behind.
    source:
      "[.!?]\\s+No\\s+pressure\\.|\\band\\s+we\\s+can\\s+help\\.|\\bworth\\s+your\\s+time\\.|\\bwe\\s+will\\s+keep\\s+an\\s+eye\\s+on\\s+the\\s+\\w+\\s+for\\s+you\\b|\\bwe\\s+know\\s+these\\s+\\w+\\s+and\\s+their\\s+\\w+\\s+well\\b",
    fix: 'Name the action or the number instead. A virtue we assert is one the reader discounts.',
    example: 'A local broker will follow up with specifics. No pressure.',
  },
  {
    id: 'invented-attribution',
    rule: 3,
    label: 'puts words in a named person\'s mouth',
    // Matt, 2026-08-06: "Don't ever put direct quotes for me in anything.
    // Unless I ask you to quote something specifically." Four blog posts and a
    // market-narrative generator had grown `"...," said Matt Ryan, principal
    // broker` overnight, because rule 3 says a judgment belongs under a name
    // and the obvious way to satisfy that is to invent the attribution. It is
    // the one fix rule 3 does not permit. Real quotes render from variables
    // (reviews, testimonials), never from a literal, so anything this catches
    // in source or stored copy is manufactured.
    // Anchored on the CLOSING QUOTE, not on the verb. A first cut matched any
    // "said Firstname Lastname" and returned 35 hits, most of them skill docs
    // saying things like "Trigger when Matt says any of:" — instructions, not
    // attributions. A manufactured quote always has the quotation mark right
    // before the attribution, so that is what this keys on.
    source:
      "[\"\\u201d\\u2019']\\s*,?\\s*(said|says)\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+|[A-Z][a-z]+\\s+[A-Z][a-z]+,\\s*(principal\\s+)?broker\\s*:\\s*[a-z]",
    fix: 'State it plainly in the brokerage voice, or cut it. Never attach a name to a sentence nobody said.',
    example: '"This is the most room buyers have had in years," said Matt Ryan, principal broker.',
  },

  {
    id: 'data-speaks',
    rule: 8,
    label: 'numbers made to speak, say, tell, reveal, or prove',
    source:
      "\\b\\d[\\d,]*\\s+(sales|homes|listings|numbers|figures|comps|records)\\s+(say|says|tell|tells|reveal|reveals|prove|proves|show|shows)\\b|\\bthe\\s+(data|numbers|figures)\\s+(say|says|tell|tells|reveal|reveals|prove|proves)\\b|\\bthe\\s+(data|numbers)\\s+(do|does)\\s+not\\s+lie\\b",
    fix: 'State what the number is. Numbers do not talk.',
    example: '450 sales say the calendar matters.',
  },

  // ── Rule 1 + 5: write to one person, no windup ─────────────────────────
  {
    id: 'throat-clear',
    rule: 5,
    label: 'windup before the fact',
    source:
      "^\\s*(before\\s+the\\s+numbers|let'?s\\s+(take\\s+a\\s+look|start\\s+(with|by)|dive\\s+in|talk\\s+about)|first\\s+things\\s+first|to\\s+begin\\s+with)\\b|\\bwithout\\s+further\\s+ado\\b",
    fix: 'Delete the windup. Open on the fact.',
    example: 'Before the numbers, the concrete things this property has going for it.',
  },

  // ── Rule 6 + 8: no self-praise, no pandering, no manufactured urgency ──
  {
    id: 'self-praise',
    rule: 8,
    label: 'names a virtue instead of showing it',
    source:
      "\\bwe\\s+(pride\\s+ourselves|are\\s+passionate|are\\s+dedicated|are\\s+committed\\s+to\\s+excellence|go\\s+above\\s+and\\s+beyond)\\b|\\byour\\s+(trusted|local)\\s+(expert|experts|advisor|advisors|agent|agents)\\b|\\bwe\\s+are\\s+(honest|trusted|the\\s+best)\\b",
    fix: 'Show the receipt in the same breath, or cut the claim.',
    example: 'We pride ourselves on honest guidance.',
  },
  {
    id: 'pandering',
    rule: 1,
    label: 'flatters, reassures, or talks down to the reader',
    source:
      "\\b(great|excellent)\\s+question\\b|\\byou\\s+have\\s+great\\s+taste\\b|\\bdon'?t\\s+worry,?\\s+we\\b|\\blet\\s+me\\s+explain\\s+in\\s+simple\\s+terms\\b|\\bbuying\\s+a\\s+home\\s+is\\s+(one\\s+of\\s+)?the\\s+(biggest|largest|most\\s+important)\\b|\\bwe\\s+know\\s+how\\s+(hard|stressful|overwhelming)\\b",
    fix: 'Cut it. The reader is a smart adult deciding a large transaction.',
    example: 'Don\'t worry, we will handle everything.',
  },
  {
    id: 'fake-urgency',
    rule: 7,
    label: 'manufactured urgency',
    source:
      "\\bact\\s+(fast|now)\\b|\\bdon'?t\\s+miss\\s+out\\b|\\bwon'?t\\s+last\\s+(long)?\\b|\\bbefore\\s+it'?s\\s+too\\s+late\\b|\\bhurry\\b",
    fix: 'Cut it. If the market is moving, the number says so.',
    example: "Act fast, this won't last long.",
  },

  // ── Rule 7: say what you do not know ───────────────────────────────────
  {
    id: 'false-certainty',
    rule: 7,
    label: 'forecast stated as fact',
    source:
      "\\byour\\s+home\\s+will\\s+sell\\s+(in|for|within)\\b|\\bwe\\s+guarantee\\b|\\bis\\s+guaranteed\\s+to\\s+(sell|appreciate|increase)\\b|\\bwill\\s+definitely\\s+(sell|appreciate)\\b",
    fix: 'Write the measured condition instead of the prediction.',
    example: 'Your home will sell in about 30 days.',
  },
]

/** Compiled once for the scanners. */
const COMPILED = CONSTRUCTIONS.map((c) => ({ ...c, re: new RegExp(c.source, 'i') }))

module.exports = { CONSTRUCTIONS, COMPILED }
