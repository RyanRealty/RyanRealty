/**
 * WHAT THE DOCUMENT IS ALLOWED TO READ OFF A STORED ROW.
 *
 * Four fields land on `render_args` from the pricing side (stream R2f) and
 * every one of them changes what a chapter may CLAIM:
 *
 *   pricing.sellerNet   — the itemised net at list, with a source per line
 *   expiredAudit.askExposure — which ask actually ran the clock
 *   pricing.review      — severity plus the one notice a seller may read
 *   subjectStatus       — whether this home is somebody else's listing today
 *
 * Every reader here is TOLERANT and TOTAL: a row built before the field
 * existed returns null, a malformed one returns null, and the chapter that
 * asked degrades to the honest smaller statement rather than throwing or
 * inventing. That is the whole contract — §0 says a figure with no basis does
 * not ship, and a renderer cannot ask the build to re-run.
 *
 * These readers do NOT compute anything. They validate shape and hand back
 * what was stored; the arithmetic belongs to lib/pricing.
 */

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(str).filter((s): s is string => s != null)
}

// ── The net at list ─────────────────────────────────────────────────────────

/** One deduction, and where the figure came from. Both are required (§0). */
export type SellerNetLine = { label: string; amount: number; source: string }

export type SellerNetSheet = {
  /** How the sheet was put together, in the pricing side's own words. */
  basis: string | null
  list: number
  lines: SellerNetLine[]
  net: number
  /** The pricing side's summary sentence, when it wrote one. */
  sentence: string | null
  /** What is NOT in the net. Empty means every deduction is on the sheet. */
  unknowns: string[]
}

/**
 * A dollar of slack, and not a cent more.
 *
 * A net sheet whose column does not add up is worse than no net sheet: the
 * reader can add it themselves, and when it fails they stop believing the
 * price too. Rounding to whole dollars on both sides is the only difference
 * this tolerates.
 */
const NET_RECONCILE_TOLERANCE = 1

/**
 * The itemised net, or null.
 *
 * NULL IS A RESULT, not a failure. The chapter that reads this prints no
 * figure at all when it gets null and says instead what a net would need —
 * which is the round-four class A finding: a figure headed as what the seller
 * keeps, computed as the list minus seller concessions alone, with the
 * commission, title, escrow and the loan payoff nowhere in it.
 *
 * Rejected, every one of them because the printed column would lie:
 *   - no `lines`, or an empty one
 *   - a line with no source, or a non-numeric amount
 *   - no list, or a list that is not positive
 *   - a net that is not a number
 *   - a net ABOVE the list (you cannot net more than you asked)
 *   - a net that is not `list` minus the lines, to the dollar
 */
export function readSellerNetSheet(pricing: unknown): SellerNetSheet | null {
  const p = obj(pricing)
  const sn = obj(p?.sellerNet)
  if (!sn) return null
  const list = num(sn.list)
  const net = num(sn.net)
  if (list == null || !(list > 0) || net == null) return null
  if (!Array.isArray(sn.lines) || sn.lines.length === 0) return null
  const lines: SellerNetLine[] = []
  for (const raw of sn.lines) {
    const l = obj(raw)
    const label = str(l?.label)
    const amount = num(l?.amount)
    const source = str(l?.source)
    if (!label || amount == null || !source) return null
    lines.push({ label, amount, source })
  }
  if (net > list) return null
  const sum = lines.reduce((t, l) => t + l.amount, 0)
  if (Math.abs(list - sum - net) > NET_RECONCILE_TOLERANCE) return null
  return {
    basis: str(sn.basis),
    list: Math.round(list),
    lines,
    net: Math.round(net),
    sentence: str(sn.sentence),
    unknowns: strList(sn.unknowns),
  }
}

/**
 * What the pricing side says is NOT in the net, readable even when the sheet
 * itself is unprintable.
 *
 * The chapter with no figure still has to name what a net would need, and the
 * row's own list of unknowns is a better answer than the renderer's default.
 */
export function readSellerNetUnknowns(pricing: unknown): string[] {
  return strList(obj(obj(pricing)?.sellerNet)?.unknowns)
}

// ── Which ask ran the clock ─────────────────────────────────────────────────

/** One period the home was asking one price. */
export type AskExposureSegment = {
  ask: number
  from: string | null
  to: string | null
  days: number | null
  sharePct: number | null
  pctAboveRangeTop: number | null
}

export type AskExposure = {
  segments: AskExposureSegment[]
  /** The ask the home spent the most days at. The one the story is about. */
  dominant: number | null
  /** The ask it came off at. */
  final: number | null
  sentence: string | null
}

/**
 * The ask that actually ran the clock, or null.
 *
 * Round-four class B: chapter 1 told the story of the FINAL ask — the cut a
 * seller made in the last five weeks — while 152 of the 187 days were spent
 * at a price $15,000 higher. The verdict sentence measured the gap of an ask
 * that barely had any exposure, so the document's whole first act rested on
 * the wrong number.
 *
 * Segments with no positive ask are dropped rather than failing the read: a
 * partial exposure is still a truer basis than the final cut alone. `dominant`
 * is taken from the stored field when present and otherwise from the segment
 * with the most days, because the renderer must never be the only place that
 * knows which ask the story is about.
 */
export function readAskExposure(expiredAudit: unknown): AskExposure | null {
  const ea = obj(expiredAudit)
  const ax = obj(ea?.askExposure)
  if (!ax) return null
  const segments: AskExposureSegment[] = []
  if (Array.isArray(ax.segments)) {
    for (const raw of ax.segments) {
      const s = obj(raw)
      const ask = num(s?.ask)
      if (ask == null || !(ask > 0)) continue
      segments.push({
        ask,
        from: str(s?.from),
        to: str(s?.to),
        days: num(s?.days),
        sharePct: num(s?.sharePct),
        pctAboveRangeTop: num(s?.pctAboveRangeTop),
      })
    }
  }
  if (segments.length === 0) return null
  const dominantField = num(obj(ax.dominant)?.ask) ?? num(ax.dominant)
  const longest = [...segments].sort((a, b) => (b.days ?? 0) - (a.days ?? 0))[0]!
  const finalField = num(obj(ax.final)?.ask) ?? num(ax.final)
  return {
    segments,
    dominant: dominantField ?? longest.ask,
    final: finalField ?? segments[segments.length - 1]!.ask,
    sentence: str(ax.sentence),
  }
}

// ── The review gate, on every path ──────────────────────────────────────────

export type ReviewSeverity = 'none' | 'review' | 'blocked'

export type RendererReviewNotice = {
  severity: ReviewSeverity
  /** Seller-safe. The only review wording either document is allowed to print. */
  notice: string | null
}

function severity(v: unknown): ReviewSeverity | null {
  const s = str(v)?.toLowerCase()
  return s === 'none' || s === 'review' || s === 'blocked' ? s : null
}

/**
 * The notice a reader sees when the row is under review, or null.
 *
 * Round-four class C: the gate existed on `/admin/cmas/[slug]/view` only, so a
 * flagged row printed as a finished opinion on the client link and in the PDF.
 * `rendererNotice` is the pricing side's seller-safe sentence — never the
 * audit's own words, which is why the admin banner and this are two different
 * strings off the same block.
 *
 * Returns null at severity `none`, with no severity recorded, or with no
 * notice to print: a band with nothing in it is chrome.
 */
export function readReviewNotice(pricing: unknown): RendererReviewNotice | null {
  const p = obj(pricing)
  const review = obj(p?.review)
  if (!review) return null
  const sev = severity(review.severity)
  if (!sev || sev === 'none') return null
  const notice = str(review.rendererNotice)
  if (!notice) return null
  return { severity: sev, notice }
}

// ── Whose listing is this ───────────────────────────────────────────────────

export type CmaSubjectStatus = {
  standardStatus: string | null
  /** On the market today, with a brokerage that is not ours. */
  isActiveWithOtherBrokerage: boolean
  /** Came off the market, but the listing agreement may still be running. */
  isWithdrawnNotExpired: boolean
  listingAgentIsUs: boolean
  note: string | null
}

/**
 * The subject's own listing status, or null.
 *
 * Read off `render_args.subjectStatus` first, then off the subject and the
 * pricing block, because the field is landing this cycle and a renderer that
 * only looks in one place fails silently the moment it lands in another. A
 * silent miss here is a compliance failure, not a cosmetic one (class D):
 * soliciting a home that is currently listed with another brokerage is the one
 * thing a licensed broker's document may not do.
 */
export function readSubjectStatus(args: unknown): CmaSubjectStatus | null {
  const a = obj(args)
  if (!a) return null
  const candidate =
    obj(a.subjectStatus) ?? obj(obj(a.subject)?.subjectStatus) ?? obj(obj(a.pricing)?.subjectStatus)
  if (!candidate) return null
  return {
    standardStatus: str(candidate.standardStatus),
    isActiveWithOtherBrokerage: candidate.isActiveWithOtherBrokerage === true,
    isWithdrawnNotExpired: candidate.isWithdrawnNotExpired === true,
    listingAgentIsUs: candidate.listingAgentIsUs === true,
    note: str(candidate.note),
  }
}

// ── One list ceiling per document ───────────────────────────────────────────

export type ListClamp = {
  /** The list the clamp allows. Null when the row carries no figure. */
  after: number | null
  /** False only when the row says outright that the clamp did not bind. */
  binds: boolean
}

/** `pricing.clamp`, or null. Shape only; the arithmetic is lib/pricing's. */
export function readListClamp(pricing: unknown): ListClamp | null {
  const c = obj(obj(pricing)?.clamp)
  if (!c) return null
  const binds = c.bound !== false && c.binds !== false && c.applied !== false
  return { after: num(c.after), binds }
}

/**
 * THE ONE NUMBER THIS DOCUMENT MAY NAME AS THE TOP OF THE LIST.
 *
 * Round-four class E: Concorde printed three different list ceilings on two
 * screens, and the highest of them was the ask that had just failed. The
 * chapter that states the list range, the net chapter's list, and the closing
 * are three chances to print a fourth; every one of them resolves the ceiling
 * here instead.
 *
 * `highEnd` is the method's own top. When the failed-ask clamp binds, the
 * price the document recommends cannot go above what the clamp allows — so
 * the ceiling is the lower of the two, and nothing downstream may print above
 * it. Null when the row carries neither.
 */
export function listCeiling(pricing: unknown): number | null {
  const hi = num(obj(pricing)?.highEnd)
  const clamp = readListClamp(pricing)
  const after = clamp?.binds ? clamp.after : null
  if (hi == null) return after != null && after > 0 ? after : null
  if (after == null || !(after > 0)) return hi > 0 ? hi : null
  return Math.min(hi, after)
}

// ── How the comps were found ────────────────────────────────────────────────

export type CompSearchRung = {
  key: string | null
  label: string | null
  window: string | null
  added: number | null
  kept: number | null
}

export type CompSearch = {
  subdivision: string | null
  rungs: CompSearchRung[]
  /** Kept sales per subdivision name, as the pricing side counted them. */
  keptBySubdivision: Record<string, number>
  /** The pricing side's own sentence. When present it is what prints. */
  sentence: string | null
  /** On acreage: the splits that set sales aside, one sentence. */
  ruralSentence?: string | null
}

/**
 * `render_args.compSearch`, or null.
 *
 * Round-four class E: chapter 3 told 2465's seller there were not enough
 * recent Diamond Bar Ranch sales while three of its five sales are Diamond Bar
 * Ranch. `lib/pricing/search-story.ts` composes that clause from the TIER
 * LADDER alone — any rung outside the subdivision makes it claim a shortage —
 * and the ladder does not know what the kept set turned out to be. This reader
 * takes the pricing side's own account when the row carries one; the renderer
 * derives the sentence from the kept comps when it does not.
 */
export function readCompSearch(args: unknown): CompSearch | null {
  const cs = obj(obj(args)?.compSearch)
  if (!cs) return null
  const rungs: CompSearchRung[] = Array.isArray(cs.rungs)
    ? cs.rungs
        .map((raw) => obj(raw))
        .filter((r): r is Record<string, unknown> => r != null)
        .map((r) => ({
          key: str(r.key),
          label: str(r.label),
          window: str(r.window),
          added: num(r.added),
          kept: num(r.kept),
        }))
    : []
  const bySub: Record<string, number> = {}
  const raw = obj(cs.keptBySubdivision)
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      const n = num(v)
      const name = k.trim()
      if (name && n != null && n >= 0) bySub[name] = n
    }
  }
  return {
    subdivision: str(cs.subdivision),
    rungs,
    keptBySubdivision: bySub,
    sentence: str(cs.sentence),
    ruralSentence: str(cs.ruralSentence),
  }
}

// ── What a figure measures ──────────────────────────────────────────────────

/**
 * `<block>.measure` — the short phrase naming what a figure is a figure OF.
 *
 * Round-four class E: chapter 3's index clause said the market "peaked in
 * April" and chapter 5's month line said April was the low month. Both are
 * true and they measure different things. A reader meeting them four screens
 * apart reads one document contradicting itself, so each names its measure in
 * the same breath as its month.
 */
export function readMeasure(block: unknown): string | null {
  return str(obj(block)?.measure)
}

/**
 * What the month line is a line OF.
 *
 * `market.trend` is an array today, so the pricing side may hang the phrase on
 * the array itself or beside it as `market.trendMeasure`. Both are read; a row
 * carrying neither prints the renderer's own plain naming of the same series.
 */
export function readTrendMeasure(market: unknown): string | null {
  const m = obj(market)
  if (!m) return null
  const onArray = (m.trend as { measure?: unknown } | null | undefined)?.measure
  return str(onArray) ?? readMeasure(m.trend) ?? str(m.trendMeasure)
}

/**
 * `pricing.rangeRule.kept` — how many sales the pricing side says the range is
 * the spread of, or null.
 *
 * ONE n PER CHAPTER (round-four class E). 19968 printed six, four and two for
 * one set inside two chapters. The cover's range-cause sentence already reads
 * this field; the chapter lead, the strip caption and the market chapter's
 * "sales behind your price" now resolve to the same number, so a reader who
 * counts cannot find a second answer.
 */
export function readRangeRuleKept(pricing: unknown): number | null {
  const n = num(obj(obj(pricing)?.rangeRule)?.kept)
  return n != null && n >= 0 ? Math.round(n) : null
}
