/**
 * Identity params never enter a stored URL.
 *
 * `?_pid=<crm_people.id>` and `?_fuid=<legacy id>` are how a link WE emailed
 * names its recipient. They belong in the request and in the identify backfill;
 * they do not belong in `visitor_events.page_url`, which is read by dashboards,
 * exported, and joined all over the CRM — nor in the GA4 mirror, which hands
 * the URL to a third party.
 *
 * Measured on production 2026-09-07, before this stripped them: rows in
 * `visitor_events` carried `https://ryan-realty.com/?agent=matt&_fuid=22288&_pid=13490`
 * verbatim, so a contact id sat in a stored URL on every identified arrival.
 *
 * `PersonIdentityBridge` does clean the address bar, but it cannot be the
 * mechanism: it runs in an effect and the page_view POST races it, which is
 * exactly why those rows exist. The server strips, so the timing cannot matter.
 *
 * Everything else stays. `utm_*`, `agent`, `fbclid` and `gclid` describe the
 * CLICK, not the person — the rule the route's campaign block already states.
 * `rr_doc` is first-party CMA document identity: it stays on stored URLs so
 * outcomes can attribute a comp tap, and `stripGa4UrlParams` takes it off
 * anything forwarded to GA4. Legacy `utm_campaign=<cmaSlug>` is still read.
 *
 * Lives beside the route rather than inside it because `route.ts` may only
 * export HTTP handlers, and a privacy rule this load-bearing gets its own test.
 */

/** Params that name a person. Extend here, nowhere else. */
export const IDENTITY_PARAMS = ['_pid', '_fuid'] as const

/**
 * Query params whose value is a PERSON's own words or contact details: what
 * they typed into a box that navigates (the homepage "value your home" box
 * goes to `/sell?address=<what they typed>`, the /about box to
 * `/contact?inquiry=<what they typed>`), or a prefill a link carries. The page
 * keeps them (the address still prefills the form); GA4 never receives them.
 * Matched without regard to case. Extend here, nowhere else.
 */
export const PERSON_TEXT_PARAMS = [
  'address',
  'addr',
  'street',
  'inquiry',
  'message',
  'msg',
  'comment',
  'comments',
  'note',
  'notes',
  'email',
  'phone',
  'tel',
  'mobile',
  'name',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'full_name',
  'fullname',
] as const

/**
 * Params that must not leave the building inside a URL handed to GA4
 * (Google's GA4 terms forbid personal information; a mailing address is one).
 * `rr_doc` is first-party CMA document identity (not a person, not a UTM);
 * stored visitor_events keep it so outcomes can attribute a comp tap, but no
 * page_location GA4 receives may. Identity params (`_pid`, `_fuid`) name a
 * contact; PERSON_TEXT_PARAMS carry what a person typed.
 */
export const GA4_STRIP_PARAMS = ['_pid', '_fuid', 'rr_doc', ...PERSON_TEXT_PARAMS] as const

/**
 * Client documents whose address names a person's home: `/cma/<slug>` and
 * `/bpo/<slug>`, where the slug is built from the subject's street address
 * (`/cma/cma-828-florida`, lib/cma/address-slug.ts, lib/bpo/slug.ts), plus the
 * static copies the /cma route can redirect to (`/cmas/<slug>/cma.html`,
 * `/drafts/<slug>/...`). GA4 gets `/cma/[document]` instead, and the server
 * mirror adds the document's opaque row id (`cma_id`, `bpo_id`) so a view is
 * still countable and attributable to its CMA without the address.
 */
export const GA4_PERSON_DOCUMENT_PREFIXES = ['cma', 'bpo', 'cmas', 'drafts'] as const

/** What GA4 sees in place of a person document's slug. */
export const GA4_DOCUMENT_PLACEHOLDER = '[document]'

/** `/cma/<slug>...` or `/bpo/<slug>...`; group 1 is the prefix, group 2 the slug. */
const PERSON_DOCUMENT_PATH_RE = new RegExp(`^/(${GA4_PERSON_DOCUMENT_PREFIXES.join('|')})/([^/]+)`, 'i')

/**
 * A legacy CMA link carried the document slug as its campaign
 * (`utm_campaign=cma-828-florida`) and GA4 reads utm_* straight off
 * page_location, so the slug became a GA4 campaign name. Any value of this
 * shape is a document slug; GA4 gets the program campaign `cma-letter`
 * (`test-` kept). The one real program value, `cma-letter`, is untouched.
 */
const CMA_DOCUMENT_SLUG_VALUE_RE = /^(test-)?cma-(?!letter$)[a-z0-9-]+$/i
export const GA4_CMA_PROGRAM_CAMPAIGN = 'cma-letter'

/** A value that is an email address. */
const EMAIL_VALUE_RE = /[^\s@/?#&=]+@[^\s@/?#&=]+\.[a-z]{2,}/i
/** A value that is a North American phone number, punctuated or not. */
const PHONE_VALUE_RE = /^\+?1?[\s.()-]*\d{3}[\s.()-]*\d{3}[\s.-]*\d{4}$/

/**
 * A param value that is itself a link into a person document or carries a
 * person param: `/login?next=/cma/<slug>`, `/auth-error?next=/sell?address=...`.
 * The whole param goes (values arrive decoded).
 */
const NESTED_PERSON_VALUE_RE = new RegExp(
  `(?:^|/)(?:${GA4_PERSON_DOCUMENT_PREFIXES.join('|')})/(?!\\[document\\](?:[/?#]|$))[^/?#]+|[?&](?:${GA4_STRIP_PARAMS.join('|')})=`,
  'i',
)

/**
 * The URL as it may be stored. Returns undefined only for an absent input, so
 * a caller can keep using `?? undefined` to mean "column stays null".
 * A string we cannot parse is returned unchanged rather than half-edited — a
 * referrer can be anything, and guessing at one is worse than keeping it.
 */
/**
 * Destination of an in-document click, identity params stripped. Same rule as
 * `stripIdentityParams` — `_pid` / `_fuid` never enter stored metadata.
 */
export function stripClickDestination(url: string | null | undefined): string | undefined {
  return stripIdentityParams(url)
}

/**
 * Event metadata as it may be stored. A click destination is kept even at
 * essential consent — it names the page, not the person. Identity params
 * are stripped first. Other metadata still drops at essential.
 */
export function visitorEventMetadata(
  metadata: Record<string, unknown> | null | undefined,
  minimalOnly: boolean,
): Record<string, unknown> | undefined {
  const raw = metadata && typeof metadata === 'object' ? metadata : null
  const dest = stripClickDestination(typeof raw?.destination === 'string' ? raw.destination : null)
  if (minimalOnly) return dest ? { destination: dest } : undefined
  if (!raw && !dest) return undefined
  return dest ? { ...raw, destination: dest } : (raw ?? undefined)
}

function stripParams(url: string | null | undefined, names: readonly string[]): string | undefined {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return undefined
  try {
    const u = new URL(raw)
    let touched = false
    for (const p of names) {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p)
        touched = true
      }
    }
    return touched ? u.toString() : raw
  } catch {
    return raw
  }
}

export function stripIdentityParams(url: string | null | undefined): string | undefined {
  return stripParams(url, IDENTITY_PARAMS)
}

const GA4_STRIP_SET: ReadonlySet<string> = new Set(GA4_STRIP_PARAMS.map((p) => p.toLowerCase()))

/** True for a param VALUE that is an email address or a phone number. */
export function isContactValue(value: string): boolean {
  const v = value.trim()
  return EMAIL_VALUE_RE.test(v) || PHONE_VALUE_RE.test(v)
}

/** A query param value GA4 must not receive: contact details, or a link into a person document. */
function isUnsafeUrlParamValue(value: string): boolean {
  return isContactValue(value) || NESTED_PERSON_VALUE_RE.test(value)
}

/**
 * The URL as GA4 may receive it: page_location and page_referrer on every
 * browser hit (lib/analytics/gtm-bootstrap.ts, components/PageViewTracker.tsx,
 * via `gtag('set')` and the page_view push) and on every Measurement Protocol
 * event (lib/ga4-measurement-protocol.ts runs it on whatever a sender passes).
 *
 *   1. `/cma/<slug>` and `/bpo/<slug>` become `/cma/[document]`, `/bpo/[document]`.
 *   2. GA4_STRIP_PARAMS go (identity, `rr_doc`, a person's typed text), matched
 *      without regard to case, and so does any param whose value is an email
 *      address, a phone number, or a link into a person document or carrying
 *      a person param (`next=/cma/<slug>`), whatever its name.
 *   3. A `utm_*` value shaped like a CMA document slug becomes `cma-letter`.
 *   4. The fragment goes (GA4 never needs it; it is free text the page controls).
 *
 * Untouched input is returned byte-identical, so the URL's own encoding
 * survives. Unlike the stored-URL strip, an input that is not an absolute URL
 * returns undefined: GA4 gets no value rather than a string nobody checked.
 *
 * ga4SafeUrlJs is the same function as a browser expression for the inline
 * GTM bootstrap; strip-identity.test.ts runs both over one case list.
 */
export function stripGa4UrlParams(url: string | null | undefined): string | undefined {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return undefined
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return undefined
  }
  let touched = false
  const m = PERSON_DOCUMENT_PATH_RE.exec(u.pathname)
  if (m && m[2] !== GA4_DOCUMENT_PLACEHOLDER) {
    u.pathname = `/${m[1]!.toLowerCase()}/${GA4_DOCUMENT_PLACEHOLDER}${u.pathname.slice(m[0].length)}`
    touched = true
  }
  const keys: string[] = []
  u.searchParams.forEach((_v, k) => {
    if (!keys.includes(k)) keys.push(k)
  })
  for (const k of keys) {
    const values = u.searchParams.getAll(k)
    if (GA4_STRIP_SET.has(k.toLowerCase()) || values.some(isUnsafeUrlParamValue)) {
      u.searchParams.delete(k)
      touched = true
      continue
    }
    if (/^utm_/i.test(k)) {
      const next = values.map((v) => {
        const x = CMA_DOCUMENT_SLUG_VALUE_RE.exec(v.trim())
        return x ? `${x[1] ?? ''}${GA4_CMA_PROGRAM_CAMPAIGN}` : v
      })
      if (next.some((v, i) => v !== values[i])) {
        u.searchParams.delete(k)
        for (const v of next) u.searchParams.append(k, v)
        touched = true
      }
    }
  }
  if (u.hash) {
    u.hash = ''
    touched = true
  }
  return touched ? u.toString() : raw
}

/**
 * stripGa4UrlParams as one browser JavaScript expression over `urlExpr`
 * (`location.href`, `document.referrer`), for the inline GTM bootstrap that
 * runs before React. Evaluates to the safe URL, or undefined.
 */
export function ga4SafeUrlJs(urlExpr: string): string {
  return (
    `(function(h){try{h=String(h==null?'':h).trim();if(!h)return undefined;` +
    `var u=new URL(h),t=0,S=${JSON.stringify([...GA4_STRIP_SET])},R=${PERSON_DOCUMENT_PATH_RE.toString()},` +
    `C=${CMA_DOCUMENT_SLUG_VALUE_RE.toString()},E=${EMAIL_VALUE_RE.toString()},P=${PHONE_VALUE_RE.toString()},N=${NESTED_PERSON_VALUE_RE.toString()};` +
    `function c(v){var w=v.trim();return E.test(w)||P.test(w)||N.test(v)}` +
    `var m=R.exec(u.pathname);if(m&&m[2]!==${JSON.stringify(GA4_DOCUMENT_PLACEHOLDER)}){u.pathname='/'+m[1].toLowerCase()+'/'+${JSON.stringify(GA4_DOCUMENT_PLACEHOLDER)}+u.pathname.slice(m[0].length);t=1}` +
    `var ks=[];u.searchParams.forEach(function(v,k){if(ks.indexOf(k)<0)ks.push(k)});` +
    `ks.forEach(function(k){var vs=u.searchParams.getAll(k);` +
    `if(S.indexOf(k.toLowerCase())>=0||vs.some(c)){u.searchParams.delete(k);t=1;return}` +
    `if(/^utm_/i.test(k)){var nv=vs.map(function(v){var x=C.exec(v.trim());return x?(x[1]||'')+${JSON.stringify(GA4_CMA_PROGRAM_CAMPAIGN)}:v});` +
    `if(nv.some(function(v,i){return v!==vs[i]})){u.searchParams.delete(k);nv.forEach(function(v){u.searchParams.append(k,v)});t=1}}});` +
    `if(u.hash){u.hash='';t=1}return t?u.toString():h}catch(e){return undefined}})(${urlExpr})`
  )
}

/** True for a path (or full URL) on a person document: `/cma/<slug>`, `/bpo/<slug>`. */
export function isPersonDocumentPath(pathOrUrl: string | null | undefined): boolean {
  const raw = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!raw) return false
  let path = raw
  try {
    path = new URL(raw, 'https://ryan-realty.com').pathname
  } catch {
    return false
  }
  const m = PERSON_DOCUMENT_PATH_RE.exec(path)
  return !!m && m[2] !== GA4_DOCUMENT_PLACEHOLDER
}

/** A page_path as GA4 may receive it: the person-document slug replaced, no query. */
export function ga4SafePagePath(path: string | null | undefined): string | undefined {
  const raw = typeof path === 'string' ? path.trim() : ''
  if (!raw) return undefined
  const safe = stripGa4UrlParams(new URL(raw.startsWith('/') ? raw : `/${raw}`, 'https://ryan-realty.com').toString())
  return safe ? new URL(safe).pathname : undefined
}

/**
 * A page_title as GA4 may receive it. A CMA or BPO document's title is built
 * from the subject's address, so on those pages GA4 gets a fixed label.
 */
export function ga4SafePageTitle(pageUrlOrPath: string | null | undefined, title: string | null | undefined): string | undefined {
  if (isPersonDocumentPath(pageUrlOrPath)) {
    const path = new URL(String(pageUrlOrPath).trim(), 'https://ryan-realty.com').pathname
    return /^\/bpo\//i.test(path) ? 'Broker price opinion' : 'CMA'
  }
  const t = typeof title === 'string' ? title.trim() : ''
  return t || undefined
}

/** Params that copy a link's utm_* values (`lp_*` on browser events, `campaign_details` on the server). */
const CAMPAIGN_COPY_PARAM_RE = /^(?:utm_|lp_)?(?:campaign|campaign_id|content|term)$/i

/**
 * The value a GA4 event parameter may carry, or undefined when it must not be
 * sent: an email address or phone number is dropped whatever the name, and a
 * CMA document slug in a campaign copy (a legacy `utm_campaign=<cmaSlug>`
 * carried into `lp_campaign` or `campaign_details`) becomes `cma-letter`.
 * Non-strings pass through.
 */
export function ga4SafeParamValue<T>(name: string, value: T): T | string | undefined {
  if (typeof value !== 'string') return value
  if (isContactValue(value)) return undefined
  if (!CAMPAIGN_COPY_PARAM_RE.test(name)) return value
  const x = CMA_DOCUMENT_SLUG_VALUE_RE.exec(value.trim())
  return x ? `${x[1] ?? ''}${GA4_CMA_PROGRAM_CAMPAIGN}` : value
}

/**
 * GA4 parameter NAMES that would carry a person's details or a person
 * document's slug. No registry may list one (ga4-browser-events.test.ts) and
 * the Measurement Protocol client drops one (lib/ga4-measurement-protocol.ts).
 * `cma_slug` was sent on valuation_requested until 2026-10-14; it is `cma_id` now.
 */
export const GA4_PERSON_PARAM_NAME_RE =
  /^(?:[a-z0-9]+_)*(?:address|addr|street|email|e_mail|phone|tel|mobile|first_?name|last_?name|full_?name|client_name|owner_name|person_name|contact_name|message|inquiry|comment|comments|note|notes)$|^(?:[a-z0-9]+_)?(?:cma|bpo|doc|document|subject|property|report|home)_slug$|^name$/i

export function isPersonParamName(name: string): boolean {
  return GA4_PERSON_PARAM_NAME_RE.test(name.trim())
}

/**
 * Where a tracked redirect sends a request it classified as AUTOMATION (a mail
 * security gateway, a link previewer, a crawler): our own site's link with no
 * person on it, and any other site's link untouched (it never carries ours). The
 * redirect re-signs `_pid` for a person clicking (P7 identity loop); for automation
 * it must not. A gateway resolves the link with a library user agent, then renders
 * where it was sent in a sandbox with an ordinary one, and a signed token there made
 * the sandbox the contact: identified, cookied, and a broker text queued (review of
 * 2026-09-30). Used by /api/track/e/click and the SMS short link /r/<code>.
 */
export function withoutIdentityOnOwnSite(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'ryan-realty.com') return url
  } catch {
    return url
  }
  return stripIdentityParams(url) ?? url
}

type Ga4ParamValue = string | number | boolean | undefined | null

/**
 * One Measurement Protocol event's params as GA4 may receive them. Every
 * server sender goes through lib/ga4-measurement-protocol.ts, which runs this
 * on the event and on any event sent before it (`campaign_details`), so no
 * caller can hand GA4 a person's details by mistake:
 *
 *   - a person-named param (GA4_PERSON_PARAM_NAME_RE: `cma_slug`, `address`,
 *     `email`, ...) is dropped;
 *   - `page_location` / `page_referrer` go through stripGa4UrlParams,
 *     `page_path` through ga4SafePagePath, and `page_title` becomes a fixed
 *     label on a CMA or BPO document;
 *   - every other string goes through ga4SafeParamValue (contact details
 *     dropped, a CMA slug in a campaign copy becomes `cma-letter`).
 *
 * Order is kept, so GA4's 25-parameter cap still keeps what the sender put first.
 */
export function ga4SafeEventParams(params: Record<string, Ga4ParamValue>): Record<string, Ga4ParamValue> {
  const out: Record<string, Ga4ParamValue> = {}
  const where = typeof params.page_location === 'string' ? params.page_location : typeof params.page_path === 'string' ? params.page_path : null
  for (const [k, v] of Object.entries(params)) {
    if (isPersonParamName(k)) continue
    let safe: Ga4ParamValue
    if (k === 'page_location' || k === 'page_referrer') safe = typeof v === 'string' ? stripGa4UrlParams(v) : undefined
    else if (k === 'page_path') safe = typeof v === 'string' ? ga4SafePagePath(v) : undefined
    else if (k === 'page_title') safe = typeof v === 'string' ? ga4SafePageTitle(where, v) : undefined
    else safe = ga4SafeParamValue(k, v)
    if (safe !== undefined && safe !== null) out[k] = safe
  }
  return out
}

/** User properties as GA4 may receive them: no person-named property, no contact details. */
export function ga4SafeUserProperties(props: Record<string, string | number>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(props)) {
    if (isPersonParamName(k)) continue
    const safe = ga4SafeParamValue(k, v)
    if (safe !== undefined) out[k] = safe
  }
  return out
}
