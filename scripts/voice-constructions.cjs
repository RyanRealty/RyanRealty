/**
 * scripts/voice-constructions.cjs
 *
 * The machine-readable form of the "Banned constructions" section of
 * marketing_brain_skills/brand-voice/VOICE.md.
 *
 * A word list cannot catch the thing Matt actually objected to. "Pricing sets
 * the number. Competition decides how it lands." contains no banned word. It
 * is banned because of its SHAPE: a coined maxim. These are the shapes.
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
    id: 'meaning-narration',
    rule: 2,
    label: 'explains the sentence before it',
    source:
      "\\b(this|that|which|it)\\s+(tells|shows|means)\\s+you\\b|\\bwhat\\s+(this|that)\\s+means\\b|\\bin\\s+other\\s+words\\b|\\bput\\s+simply\\b|\\bthink\\s+of\\s+(it|this|that)\\s+as\\b|\\bis\\s+history,\\s*not\\s+a\\s+forecast\\b",
    fix: 'Delete the sentence. The fact before it already carries the meaning.',
    example: 'This is history, not a forecast: it tells you when buyers have been most active.',
  },
  {
    id: 'obvious-restatement',
    rule: 2,
    label: 'explains a label, chart, or word the reader can read',
    source:
      "\\b(lower|higher|faster|slower|shorter|longer)\\s+is\\s+(better|worse|faster|slower|higher|lower)\\b|\\bas\\s+you\\s+can\\s+see\\b|\\bnotice\\s+(that|how)\\b|\\bkeep\\s+in\\s+mind\\b|\\bit\\s+is\\s+(important|worth)\\s+(to\\s+note|noting|remembering)\\b|\\bit'?s\\s+(important|worth)\\s+(to\\s+note|noting|remembering)\\b",
    fix: 'Delete. The chart, label, or number states this already.',
    example: 'Lower is faster.',
  },
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
  {
    id: 'sermon-clause',
    rule: 8,
    label: 'trailing clause that moralizes the fact',
    source:
      "\\bwhich\\s+is\\s+(one\\s+more\\s+reason|exactly\\s+why|why\\s+it\\s+(is|'?s)\\s+so\\s+important)\\b|\\band\\s+that\\s+matters\\s+because\\b|\\ball\\s+the\\s+more\\s+reason\\b|\\bwhich\\s+is\\s+precisely\\s+why\\b",
    fix: 'End the sentence at the fact. Cut everything from the clause onward.',
    example: 'which is one more reason the list price has to be right on day one.',
  },
  {
    id: 'coined-maxim',
    rule: 8,
    label: 'coins a maxim (the "X, not Y" shape)',
    source:
      "\\bis\\s+(a|an|the)\\s+[a-z][a-z\\s]{2,28},\\s*not\\s+(a|an|the)\\s+[a-z][a-z\\s]{2,28}\\b|\\bnot\\s+(a|an)\\s+[a-z]+,\\s*(but\\s+)?(a|an)\\s+[a-z]+\\b",
    fix: 'State the thing plainly. A maxim is us being pleased with ourselves.',
    example: 'This number is a starting point, not a verdict.',
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
