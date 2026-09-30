/**
 * A street is not a name.
 *
 * The owner-name check (letter-privacy.ts) refuses a document that prints a
 * word from the owner's name. A street can be spelled like one: the owner is
 * Ada Russell and the comp sits at 20726 Russell Rd. The document has to print
 * that comp, and the word in it is the street, not the owner.
 *
 * An occurrence of a name word is a street when ONE of three things shows it:
 *   1. It sits inside an address the document itself prints (the subject, a
 *      comp, an unsold peer, a competing listing). The caller hands those
 *      addresses in, so this is the structural signal: it guesses nothing about
 *      what a street looks like, and it is the only signal that reaches a street
 *      name of two words that the MLS stores without a suffix ("20705 Snow
 *      Peaks").
 *   2. A house number of three to five digits comes right before it, with an
 *      optional directional between: "20726 Russell", "20726 NE Russell". Not a
 *      year (1900 to 2099) with no directional, a zip code, the tail of a phone
 *      number, or a word the sentence carries on about ("Comp 3 Russell", "In
 *      2024 Russell wrote", "20726 Russell called"): an address ends.
 *   3. A street suffix comes right after it, printed capitalized: "Russell Rd",
 *      "Russell Road". Not when a capitalized word carries on ("Russell Market
 *      Report", "Russell Place LLC", "Russell St. Clair"), and the suffixes that
 *      are also ordinary words (way, place, point, run, market...) not when a
 *      sentence carries on either ("Russell Run is the plan", "Ada Way ahead").
 *      "Russell drive the offer" is a sentence.
 * Each signal stays inside ONE text node. The graded text carries a line
 * separator where a tag was, and the rules below match [ \t] between words, so a
 * number in one table cell and a name in the next are not an address.
 *
 * Signals 2 and 3 read the page, so they can be fooled; signal 1 cannot. When
 * the document's own addresses are handed in (the builder always does), signals
 * 2 and 3 apply only to a word that is the street name of one of them. The
 * owner's surname on a comp's street is cleared wherever that street prints; a
 * first name, or any other word, is not. On the stored letters signal 1 alone
 * cleared nearly everything the three did together, and the one document only
 * a heuristic cleared was a subdivision ("Otter Run"), not a street. So the
 * heuristics add little there and are held to known street names. A list of
 * addresses, even an empty one, means the record is known and this is strict.
 * No list at all means it is not known: then signals 2 and 3 are all there is,
 * and they apply to any word.
 *
 * This only ever CLEARS an occurrence. It cannot turn a pass into a block, so a
 * signal that is missing (a cell split by markup, an address the record does not
 * hold) fails closed to the old behaviour. What it does not decide: whether the
 * word is used as a name anywhere else. A greeting, an honorific, "Prepared
 * for", a sign-off, a pair beside another name word, a possessive ("Russell's"),
 * or the word off the street entirely ("the Russell family", "Russell called
 * us") is still a hit; letter-privacy.ts checks those first.
 *
 * What it cannot do: a bare number or a bare suffix is still only local
 * evidence. An owner's surname that is also a printed street, printed as a
 * person right after a three to five digit number at the end of a cell ("Listed
 * by 541 Russell"), reads as the street here. The scrub takes the owner's name
 * out of the MLS text before it is printed, and this check is the backstop for
 * what the scrub does not reach.
 */

import { AMBIGUOUS_STREET_SUFFIXES, PRINTED_STREET_SUFFIXES, STREET_DIRECTIONALS } from '@/lib/cma/street-words'

export type TextSpan = readonly [start: number, end: number]

/** Which of the three signals showed the occurrence is a street. */
export type StreetSignal = 'printed-address' | 'house-number' | 'suffix'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Longest first, so "northwest" is read whole before "n". */
function alternation(words: Iterable<string>): string {
  return [...words]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
}

const DIRECTIONAL_SRC = alternation(STREET_DIRECTIONALS)
const SUFFIX_SRC = alternation(PRINTED_STREET_SUFFIXES)

/**
 * A house number is a whole number. It is not a piece of a price, a decimal, a
 * range or a hyphenated phone number, and it is not the last group of a phone
 * number written with spaces ("541 555 1212 Russell").
 */
const NOT_INSIDE_A_NUMBER = '(?<![\\w$,.\\-/#])(?<!\\d{3}\\)?[ \\t.\\-]{1,3}\\d{3}[ \\t.\\-]{1,3})'

/**
 * Ends at the name word: "20726 Russell" -> 20726, "20726 NE Russell" -> 20726
 * and NE. Three to five digits: a one or two digit number before a name is as
 * likely a label or a count ("Comp 3 Russell", "closed 12 Russell"), no house
 * number in this market has six, and a short house number is still cleared by a
 * suffix or by the printed address.
 */
const HOUSE_NUMBER_BEFORE = new RegExp(
  `${NOT_INSIDE_A_NUMBER}(\\d{3,5}[A-Za-z]?)[ \\t]+(?:(${DIRECTIONAL_SRC})\\.?[ \\t]+)?$`,
  'i',
)

/** Central Oregon and the rest of the state file zip codes under 97: "Bend 97702 Russell" is not an address. */
const ZIP_LIKE = /^97\d{3}$/

const YEAR_LIKE = /^(?:19|20)\d\d$/

/** Starts right after the name word: the next word, only when it is printed capitalized. */
const SUFFIX_AFTER = /^[ \t]+([A-Z][A-Za-z]*)(?![A-Za-z])/

/**
 * A lower-case word right after the name word means the sentence goes on about
 * the word ("3 Russell said", "In 2019 Russell replaced the roof"). An address
 * ends: a suffix, a city, a unit, punctuation, the end of the cell.
 */
const PROSE_AFTER = /^[ \t]+[a-z]/

/**
 * A capitalized word right after the suffix means a heading, an entity or a name
 * carries on ("Russell Market Report", "Russell Place LLC"). A directional or a
 * unit still ends an address ("Russell Rd NE", "Russell Rd Unit 5"). A period
 * ends the sentence or abbreviates the suffix, so it is not a continuation here.
 */
const CAPITALIZED_AFTER_SUFFIX = /^[ \t]+(?!(?:NE|NW|SE|SW|N|S|E|W|Unit|Apt|Ste|Suite|Bldg|Lot)\b)[A-Z]/

/** "St." and "Dr." start a name as often as they end a street: "Russell St. Clair", "Russell Dr. Smith". */
const TITLED_NAME_AFTER = /^\.[ \t]+[A-Z]/

/** A possessive names a person, however the copy wrote the apostrophe. */
const POSSESSIVE_AFTER = /^(?:['‘’]|&#0*(?:39|145|146|8216|8217);|&#x0*(?:27|2018|2019);|&apos;|&[lr]squo;)s(?![A-Za-z])/i

/** Same word rule as NAME_TOKEN_RE in letter-privacy.ts, so both read the same words. */
const NAME_RUN_RE = /[A-Za-z][A-Za-z'-]+/g

const UNIT_MARKERS: ReadonlySet<string> = new Set(['unit', 'apt', 'apartment', 'ste', 'suite', 'bldg', 'building', '#'])

function bareWord(word: string): string {
  return word.replace(/\.$/, '').toLowerCase()
}

type ParsedAddress = { number: string; name: string[] }

/**
 * The house number and the street-name words of one printed address, or null
 * when it has no house number to anchor on. The street part only ("20705 Snow
 * Peaks, Bend, OR" reads as "20705" and Snow, Peaks). A unit, a directional and
 * a suffix are not the name.
 */
function parsePrintedAddress(raw: string | null | undefined): ParsedAddress | null {
  const street = (raw ?? '').split(',')[0]?.trim() ?? ''
  const parts = /^(\d{1,6}[A-Za-z]?)\s+(.+)$/.exec(street)
  if (!parts) return null
  const words = parts[2]!.split(/\s+/).filter(Boolean)
  // A unit rides at the end ("Unit 5", "Apt B", "#12") and is not the street.
  if (words.length > 1 && /^#\S+$/.test(words[words.length - 1]!)) words.pop()
  if (words.length > 2 && UNIT_MARKERS.has(bareWord(words[words.length - 2]!))) words.splice(-2)
  // A leading directional goes, unless that would leave only a suffix: "123 South St" is the street South.
  const withoutLead = words.slice(1)
  const leavesOnlyASuffix = withoutLead.length === 1 && PRINTED_STREET_SUFFIXES.has(bareWord(withoutLead[0]!))
  if (words.length > 1 && STREET_DIRECTIONALS.has(bareWord(words[0]!)) && !leavesOnlyASuffix) words.shift()
  if (words.length > 1 && STREET_DIRECTIONALS.has(bareWord(words[words.length - 1]!))) words.pop()
  if (words.length > 1 && PRINTED_STREET_SUFFIXES.has(bareWord(words[words.length - 1]!))) words.pop()
  if (words.length === 0) return null
  return { number: parts[1]!, name: words }
}

/**
 * A matcher for one printed address. The document may print the directional or
 * the suffix in another form than the record holds ("20726 Russell Rd" against
 * "20726 NE Russell Road"), so both are optional and either form matches. The
 * house number is not optional: it is what makes this a printed address.
 */
function printedAddressMatcher(parsed: ParsedAddress): RegExp {
  const name = parsed.name.map(escapeRegExp).join('[ \\t]+')
  return new RegExp(
    `${NOT_INSIDE_A_NUMBER}${escapeRegExp(parsed.number)}[ \\t]+(?:(?:${DIRECTIONAL_SRC})\\.?[ \\t]+)?${name}(?![A-Za-z0-9])` +
      `(?:[ \\t]+(?:${SUFFIX_SRC})(?![A-Za-z]))?`,
    'gi',
  )
}

/**
 * The property-address keys the render args use: `address`, `streetAddress`,
 * `addresses`. An allowlist, not a search for "address": "mailAddress" and
 * "emailAddress" are not properties the letter prints, and a key added later is
 * not trusted until it is named here.
 */
const ADDRESS_KEY = /^(?:address|streetAddress|addresses)$/i
/** A subtree that belongs to a party (the client, an owner, a mailing address), never to a property the letter prints. */
const PARTY_KEY = /^(?:owner|client|mailing|taxpayer|e-?mail)/i
const MAX_DEPTH = 12
/** The largest letter in the stored set carries about a hundred; this is a bound, not a target. */
const MAX_ADDRESSES = 500

/**
 * Every address the document prints, read off its render args: the subject, the
 * comps, the unsold peers, the competing listings, the notable and record
 * sales. Each sits under one of the address keys, so this walks the whole object
 * and takes what those keys hold. It does not name the sections, because a list
 * of sections lags the template: the competing listings, the notable sales and
 * the record sale each print addresses under their own paths. A section added
 * later is covered the day it lands.
 *
 * Over-collecting is harmless. A matcher exists only for "<house number>
 * <street>", and it clears a name word only where the document prints exactly
 * that, so a string that is no address, or an address the document never
 * prints, clears nothing.
 */
export function printedAddressesOf(renderArgs: unknown): string[] {
  const found = new Set<string>()
  const seen = new WeakSet<object>()
  const take = (value: unknown) => {
    if (typeof value === 'string') {
      const address = value.trim()
      if (address && found.size < MAX_ADDRESSES) found.add(address)
    } else if (Array.isArray(value)) {
      for (const item of value) take(item)
    }
  }
  const walk = (node: unknown, depth: number) => {
    if (depth > MAX_DEPTH || node === null || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    for (const [key, value] of Object.entries(node)) {
      // The client is the owner: nothing under a party's key is a property the letter prints.
      if (PARTY_KEY.test(key)) continue
      if (ADDRESS_KEY.test(key)) take(value)
      walk(value, depth + 1)
    }
  }
  walk(renderArgs, 0)
  return [...found]
}

/** Matchers for every address the document prints. Duplicates and unreadable entries drop out. */
export function printedAddressMatchers(addresses: readonly (string | null | undefined)[] | null | undefined): RegExp[] {
  const seen = new Set<string>()
  const matchers: RegExp[] = []
  for (const address of addresses ?? []) {
    const parsed = parsePrintedAddress(address)
    if (!parsed) continue
    const matcher = printedAddressMatcher(parsed)
    if (seen.has(matcher.source)) continue
    seen.add(matcher.source)
    matchers.push(matcher)
  }
  return matchers
}

/** The street-name words of every address the document prints, lower case. */
export function printedStreetWords(addresses: readonly (string | null | undefined)[] | null | undefined): Set<string> {
  const words = new Set<string>()
  for (const address of addresses ?? []) {
    for (const word of parsePrintedAddress(address)?.name ?? []) words.add(bareWord(word))
  }
  return words
}

/** Where the printed addresses sit in the graded text. */
export function printedAddressSpans(text: string, matchers: readonly RegExp[]): TextSpan[] {
  const spans: TextSpan[] = []
  for (const matcher of matchers) {
    for (const match of text.matchAll(matcher)) {
      const start = match.index ?? 0
      spans.push([start, start + match[0].length])
    }
  }
  return spans
}

/**
 * The signal that shows the word at [start, end) is a street, or null when
 * nothing does. The printed address is asked first because it is the one that
 * needs no guess. `streetWords`, when the document's addresses are known, are
 * the only words the number and suffix signals may clear.
 */
export function streetSignalAt(
  text: string,
  start: number,
  end: number,
  spans: readonly TextSpan[],
  streetWords?: ReadonlySet<string> | null,
): StreetSignal | null {
  const after = text.slice(end, end + 48)
  if (POSSESSIVE_AFTER.test(after)) return null
  if (spans.some(([from, to]) => from <= start && end <= to)) return 'printed-address'
  if (streetWords && !streetWords.has(text.slice(start, end).toLowerCase())) return null

  const before = text.slice(Math.max(0, start - 48), start)
  const number = HOUSE_NUMBER_BEFORE.exec(before)
  if (
    number &&
    (number[2] !== undefined || !YEAR_LIKE.test(number[1]!)) &&
    !ZIP_LIKE.test(number[1]!) &&
    !PROSE_AFTER.test(after)
  ) {
    return 'house-number'
  }

  const suffix = SUFFIX_AFTER.exec(after)
  if (!suffix) return null
  const word = suffix[1]!.toLowerCase()
  if (!PRINTED_STREET_SUFFIXES.has(word)) return null
  const rest = after.slice(suffix[0].length)
  // A heading, an entity or a name carries on; or an ordinary word that a sentence carries on with.
  if (CAPITALIZED_AFTER_SUFFIX.test(rest)) return null
  if ((word === 'st' || word === 'dr') && TITLED_NAME_AFTER.test(rest)) return null
  if (AMBIGUOUS_STREET_SUFFIXES.has(word) && PROSE_AFTER.test(rest)) return null
  return 'suffix'
}

/**
 * True when the word prints at least once and every place it prints is a
 * street. One occurrence that is not (a name, a stray mention, a possessive)
 * makes this false.
 */
export function everyOccurrenceIsStreet(
  text: string,
  word: string,
  spans: readonly TextSpan[],
  streetWords?: ReadonlySet<string> | null,
): boolean {
  const target = word.toLowerCase()
  let seen = false
  for (const run of text.matchAll(NAME_RUN_RE)) {
    const printed = run[0].toLowerCase()
    // One part of a hyphenated name ("Russell-Smith") is the name, not a street.
    if (printed.includes('-') && printed.split('-').some((part) => part === target || part === `${target}'s`)) return false
    if (printed !== target && printed !== `${target}'s`) continue
    seen = true
    if (printed !== target) return false
    const start = run.index ?? 0
    if (streetSignalAt(text, start, start + run[0].length, spans, streetWords) === null) return false
  }
  return seen
}
