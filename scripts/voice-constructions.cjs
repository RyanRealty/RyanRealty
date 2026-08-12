/**
 * scripts/voice-constructions.cjs
 *
 * Machine-readable form of the D11 invented-quote rule in
 * marketing_brain_skills/brand-voice/VOICE.md.
 *
 * The mechanical gate is tiny on purpose: punctuation + invented quotes +
 * Value my home. Taste lives in the named exemplars, not here. Do not grow
 * a novel of regex.
 *
 * Consumed by scripts/check-voice-constructions.mjs and (via generated
 * mirror) lib/voice/check.ts.
 */

'use strict'

/** @type {Array<{id:string,rule:number,label:string,source:string,fix:string,example:string}>} */
const CONSTRUCTIONS = [
  {
    id: 'invented-attribution',
    rule: 1,
    label: 'puts words in a named person\'s mouth',
    // Matt, 2026-08-06: do not put direct quotes for him in anything unless
    // he asks to quote something specifically. Anchored on the CLOSING QUOTE,
    // not on the verb, so skill docs that say "when Matt says" do not fire.
    // Real quotes render from variables (reviews, testimonials), never from
    // a literal, so anything this catches in source or stored copy is
    // manufactured.
    source:
      "[\"\\u201d\\u2019']\\s*,?\\s*(said|says)\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+|[A-Z][a-z]+\\s+[A-Z][a-z]+,\\s*(principal\\s+)?broker\\s*:\\s*[a-z]",
    fix: 'State it plainly in the brokerage voice, or cut it. Never attach a name to a sentence nobody said.',
    example: '"This is the most room buyers have had in years," said Matt Ryan, principal broker.',
  },
]

/** Compiled once for the scanners. */
const COMPILED = CONSTRUCTIONS.map((c) => ({ ...c, re: new RegExp(c.source, 'i') }))

module.exports = { CONSTRUCTIONS, COMPILED }
