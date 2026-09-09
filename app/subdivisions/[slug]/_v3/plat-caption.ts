/**
 * The subdivision opening's caption — one AUTHORED sentence per setting.
 *
 * WHAT WAS HERE BEFORE (taste table 2026-09-08, subdivision scored 59)
 *
 *   `${resortLabel}, the resort ${displayName} sits inside.`
 *
 * One interpolated fragment, rendered directly under the H1, and only on the
 * plats that borrowed a resort photograph — every other plat in the class
 * opened on a headline and nothing at all. The evaluator called it out as
 * template-interpolated, and it is: a noun, a comma, an appositive, a name.
 * It is also not a sentence about the PLACE. It exists because §0 applies to a
 * photograph that makes a claim, so a frame shot at Eagle Crest above the words
 * "Ridge at Eagle Crest" has to say whose frame it is.
 *
 * WHAT THIS IS
 *
 * A pure composer that picks a WHOLE SENTENCE for the plat's setting from the
 * facts the page already holds and already renders. Not one grammar with slots:
 * the resort sentence leads with the resort, the neighborhood sentence leads
 * with the plat, the city sentence leads with the inventory, and the sentence
 * for a plat whose opening borrowed a photograph names the photograph first.
 * Four settings, four grammars, and within each one the clause about homes for
 * sale is present only when there is a count to stand behind.
 *
 * AND WHAT THE FRAME IS, ALWAYS (SITE-56). The opening now reaches past the
 * resort borrow for its picture: one of the plat's own homes, or the plat's own
 * ground drawn from TIGER data. Those are frames OF this place, so unlike the
 * resort borrow they do not lead — the setting sentence comes first and the
 * credit follows it as a short clause. Every one of them NAMES the frame: the
 * address of the house in the photograph, or the fact that the drawing is a
 * drawing and where its lines came from. A picture that makes a claim is held
 * to §0 exactly as a number is.
 *
 * §0, FIGURE BY FIGURE. Every number that can appear here is a number the same
 * page renders under its own trace:
 *
 *   homes for sale   the counted set — `getPlatPublicInventory().activeCount`
 *                    on a registry plat, the in-boundary SFR active tiles on a
 *                    recorded plat. The SAME value the opening's source chip
 *                    covers (homesLedgerTrace) and the same set PlaceSplitView
 *                    lists. Passed as null unless it is a real positive count:
 *                    a timed-out read leaves an empty array exactly as an empty
 *                    plat does, and "no homes are for sale" is a claim about the
 *                    world that a short read cannot make (ABSENT IS NOT ZERO).
 *   typical asking   `publishPlatFigures().medianListPrice`, already formatted
 *                    by the caller through lib/format/money, and already on the
 *                    market Instrument as "median list price". Registry plats
 *                    only, because that is the only path with a counted median.
 *
 * No other figure appears. The lifetime closed count is deliberately NOT here:
 * it is rendered a screen away as "homes sold here, all time", and a second
 * noun for one number on one page is the reconciliation defect §0 rule 5 names.
 *
 * NEVER SAY "PLAT" (parity.json). The county's word for this object does not
 * reach a visitor; the page says "subdivision".
 *
 * NOTHING IS INVENTED. No direction ("west of Bend"), no era ("platted in the
 * fifties"), no adjective the data did not hand over. A plat with no setting and
 * no count gets NO caption — null — rather than a sentence that says nothing.
 */

export type PlatCaptionFacts = {
  /** The published plat name, exactly as the H1 spells it. */
  displayName: string
  /**
   * The registry resort this plat is a recorded subdivision of, when it is one
   * (data/resort-communities.json). Null for a plain recorded plat.
   */
  resortLabel?: string | null
  /**
   * The neighborhood the plat's own boundary sits inside, walked from the
   * county boundary tree (getPlatBoundaryCity). Null when the tree has no
   * neighborhood between this plat and its city.
   */
  neighborhoodLabel?: string | null
  /** The plat's city. Null when the page could not resolve a real one. */
  cityName?: string | null
  /**
   * WHAT THE OPENING FRAME IS, when it is not a photograph of this place
   * (SITE-56). Absent means the opening carries the plat's own still, or none
   * at all, and the caption goes straight to the setting sentence.
   *
   *   resort   the frame is the resort the plat sits inside (SITE-08 pass 2).
   *   listing  the frame is one of the plat's own homes, and the caption names
   *            the house in it — the only condition on which a listing
   *            photograph may open a page about a place.
   *   ground   the frame is drawn, not photographed: the plat's own streets,
   *            water and recorded outline.
   */
  photograph?:
    | { kind: 'resort'; label: string }
    | { kind: 'listing'; address: string }
    | { kind: 'ground' }
    | null
  /** Homes for sale in the counted set. Null unless it is a real positive count. */
  activeForSale?: number | null
  /** The counted set's median list price, already formatted ("$1.2M", "$910,000"). */
  medianAsking?: string | null
}

/** "1 home" / "14 homes", with the thousands separator a four-figure count needs. */
function homes(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'home' : 'homes'}`
}

/** "1 of its homes is" / "14 of its homes are" — the possessive form. */
function ofItsHomes(n: number): string {
  return n === 1 ? '1 of its homes is' : `${n.toLocaleString('en-US')} of its homes are`
}

/**
 * The caption for this plat's opening, or null when there is nothing true to
 * say. One sentence, at most two clauses, in the voice of
 * marketing_brain_skills/brand-voice/VOICE.md.
 */
export function platCaption(facts: PlatCaptionFacts): string | null {
  const name = facts.displayName.trim()
  if (name.length === 0) return null

  const resort = facts.resortLabel?.trim() || null
  const hood = facts.neighborhoodLabel?.trim() || null
  const city = facts.cityName?.trim() || null
  const photo = facts.photograph?.kind === 'resort' ? facts.photograph.label.trim() || null : null
  const n =
    facts.activeForSale != null && Number.isFinite(facts.activeForSale) && facts.activeForSale > 0
      ? Math.round(facts.activeForSale)
      : null
  const asking = facts.medianAsking?.trim() || null

  /* SETTING 1 — THE OPENING BORROWED A PHOTOGRAPH.
     The frame is the resort's, not this subdivision's, so the sentence names
     the frame before it names anything else. That is the §0 obligation the old
     caption existed for, kept, in a sentence a person would actually say. */
  if (photo) {
    if (n != null) {
      return `That photograph is ${photo}. ${name} is one of the subdivisions inside it, and ${ofItsHomes(n)} for sale right now.`
    }
    return `That photograph is ${photo}. ${name} is one of the subdivisions inside it.`
  }

  /* THE FRAME IS THIS PLACE'S OWN, AND STILL HAS TO BE NAMED (SITE-56).
     A photograph of one of the plat's homes, or a drawing of its ground, is a
     frame OF this place — so unlike the resort borrow above it does not lead;
     it follows the setting sentence as its own short clause. The reader gets
     the place first and the credit second, and nothing on the page implies a
     listing's front elevation is a picture of a subdivision. */
  const frameCredit =
    facts.photograph?.kind === 'listing'
      ? (() => {
          const address = facts.photograph.address.trim()
          if (address.length === 0) return null
          if (n === 1) return `The photograph is ${address} — that home.`
          if (n != null && n > 1) return `The photograph is ${address}, one of them.`
          return `The photograph is ${address}, a home here.`
        })()
      : facts.photograph?.kind === 'ground'
        ? `The drawing above is the ground under ${name}: its streets and water, from US Census TIGER data.`
        : null
  const withCredit = (sentence: string | null): string | null =>
    frameCredit ? (sentence ? `${sentence} ${frameCredit}` : frameCredit) : sentence

  /* SETTING 2 — A SUBDIVISION OF A RESORT COMMUNITY.
     The resort is the thing a reader recognises, so it leads. When the counted
     set carries a median, the asking price is the second clause: it is the one
     figure that tells a buyer whether this pocket is their price band at all. */
  if (resort) {
    if (n != null && asking) {
      return withCredit(`${name} is one of ${resort}'s subdivisions. ${ofItsHomes(n)} for sale right now, and the typical one is asking ${asking}.`)
    }
    if (n != null) {
      return withCredit(`${name} is one of ${resort}'s subdivisions, and ${ofItsHomes(n)} for sale right now.`)
    }
    return withCredit(city
      ? `${name} is one of the subdivisions inside ${resort}, in ${city}.`
      : `${name} is one of the subdivisions inside ${resort}.`)
  }

  /* SETTING 3 — INSIDE A NAMED NEIGHBORHOOD OF A CITY.
     Two containers, and the reader wants the near one: the sentence walks
     outward from the subdivision to the neighborhood to the city. */
  if (hood && city) {
    if (n != null) {
      return withCredit(`${name} sits inside ${hood}, in ${city}, and ${ofItsHomes(n)} on the market today.`)
    }
    return withCredit(`${name} sits inside ${hood}, one of ${city}'s neighborhoods.`)
  }
  if (hood) {
    return withCredit(n != null
      ? `${name} sits inside ${hood}, and ${ofItsHomes(n)} on the market today.`
      : `${name} sits inside ${hood}.`)
  }

  /* SETTING 4 — A CITY SUBDIVISION WITH NO NEARER PARENT.
     There is no container worth leading with, and the INVENTORY is the only
     fact this setting has: no resort, no neighborhood, sometimes no median.
     The appositive sits mid-sentence, not trailing after "right now" — a
     taste pass on golf-homes-at-tetherow (SITE-47, second round) flagged the
     earlier trailing form as a dangling clause that read as a slot-filled
     template regardless of grammar, and named the asking price as the one
     figure this setting was withholding that Setting 2 already spends. */
  if (city) {
    if (n != null && asking) {
      return withCredit(`${name}, one of ${city}'s subdivisions, has ${homes(n)} for sale right now, and the typical one is asking ${asking}.`)
    }
    if (n != null) {
      return withCredit(`${name}, one of ${city}'s subdivisions, has ${homes(n)} for sale right now.`)
    }
    return withCredit(`${name} is one of ${city}'s subdivisions.`)
  }

  /* SETTING 5 — THE NAME AND A COUNT, AND NOTHING ELSE THE PAGE KNOWS.
     No city resolved, no parent recorded. The count is still a fact. */
  if (n != null) {
    return withCredit(`${homes(n)} ${n === 1 ? 'is' : 'are'} for sale in ${name} right now.`)
  }

  /* Nothing true to say. §0: no caption beats an empty one. */
  return withCredit(null)
}
