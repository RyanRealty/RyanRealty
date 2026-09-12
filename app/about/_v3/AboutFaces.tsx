/**
 * Broker faces on cream. Roster cards carry license under title plus labeled
 * reach (Call / Text / Email / Schedule). Portrait puts Oregon license,
 * readable phone/email, and the same CTA strip above the fold.
 *
 * roster: /about (H2).
 * editorial: /team (H1). Principal at conversation scale, the other two as
 *   rows, Call as the one primary reach. SITE-74.
 * portrait: /team/[slug] at card-photo scale, not AboutFaces poster size.
 * compact: the homepage (H2). One table, not three cards: the three cutouts
 *   stand on a shared hairline shelf as the column heads, and every row
 *   beneath (name, Oregon license, Call, Text, Book) aligns across the three
 *   columns by subgrid. At 390 the whole thing sits in one screen (SITE-M1,
 *   Matt 2026-09-07). Email and Schedule stay on the roster and the portrait.
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { V3_ROOT_CLASS, V3Button, V3Eyebrow, V3Heading } from "@/components/site/v3"
import { teamPath } from "@/lib/slug"
import type { AboutFace, AboutFaceRecord } from "./about-faces"
import { aboutCompactReach } from "./about-faces"
import { FacePortrait } from "./FacePortrait.client"
import "./about-faces.css"

export type AboutFaceProof = {
  /** Formatted average, e.g. "5.0". Never invented. */
  value: string
  /** Review count the average is of. */
  count: number
  href: string
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M2.5 5.5c0-.8.7-1.5 1.5-1.5h2.2c.7 0 1.3.5 1.4 1.2l.5 2.6c.1.5-.1 1-.5 1.3L6.2 10.4a12.2 12.2 0 0 0 7.4 7.4l1.3-1.4c.3-.4.8-.6 1.3-.5l2.6.5c.7.1 1.2.7 1.2 1.4V21c0 .8-.7 1.5-1.5 1.5C9.7 22.5 1.5 14.3 1.5 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.2 3.2V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconEnvelope() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M4.5 7A1.5 1.5 0 0 1 6 5.5h12A1.5 1.5 0 0 1 19.5 7v10a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m5.2 7.2 6.8 5.2 6.8-5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M7 3.5v3M17 3.5v3M4.5 9h15M6 5.5h12A1.5 1.5 0 0 1 19.5 7v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V7A1.5 1.5 0 0 1 6 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


/**
 * The broker's own figure, and the reveal behind it (SITE-48).
 *
 * A figure with a plain sentence beside it, then ONE native disclosure holding
 * both the places those transactions were and the section 0 trace. Native, so
 * every word is in the served HTML with no script, and the reveal is real data
 * rather than a hover that decorates. A broker with no record renders nothing
 * here — see AboutFaceRecord for why a zero is not an option.
 *
 * WHY NOT V3SourceLine HERE. That primitive is itself a <details>, and nesting
 * it inside this one would put the trace two clicks deep. It carries the same
 * contract instead — the complete trace verbatim, in the served HTML, folded
 * behind one control, labelled "Source" — and the reader reaches the places
 * and the method with a single tap rather than reading three identical
 * "SOURCE …" rows across three cards standing side by side.
 */
function faceRecord(record: AboutFaceRecord | null | undefined) {
  if (!record) return null
  return (
    <div className="about-faces__record">
      <p className="about-faces__record-figure">
        <span className="about-faces__record-value">{record.value}</span>
        <span className="about-faces__record-label">{record.label}</span>
      </p>
      {/* One control, not two. The places and the section 0 trace live behind
          the same disclosure: three cards side by side each printing their own
          "SOURCE …" row put the least editorial text on the page three times
          in a row, and the trace is still in the served HTML either way. */}
      <details className="about-faces__where">
        <summary className="about-faces__where-summary">
          <span className="about-faces__where-text">{record.placesSummary}</span>
          <span className="about-faces__where-caret" aria-hidden="true" />
        </summary>
        {record.places.length > 0 ? (
          <ul className="about-faces__where-list">
            {record.places.map((place) => (
              <li key={place.name} className="about-faces__where-row">
                <span className="about-faces__where-place">{place.name}</span>
                <span className="about-faces__where-n">{place.n}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="about-faces__where-trace">
          <span className="about-faces__where-trace-label">Source</span> {record.trace}
        </p>
      </details>
    </div>
  )
}

function faceCredential(person: AboutFace) {
  return (
    <>
      {person.title ? <p className="about-faces__title">{person.title}</p> : null}
      {person.license ? (
        <p className="about-faces__license about-faces__license--credential">
          <span className="about-faces__license-term">Oregon license</span>
          <span className="about-faces__license-num">{person.license}</span>
        </p>
      ) : null}
    </>
  )
}

function editorialReach(person: AboutFace) {
  return (
    <div className="about-faces__reach-row">
      {person.tel ? (
        <a
          href={`tel:${person.tel}`}
          className={cn("about-faces__reach", "about-faces__reach--call")}
          aria-label={`Call ${person.name}`}
        >
          <span className="about-faces__reach-label">
            Call
            {person.phoneDisplay ? (
              <span className="about-faces__reach-num">{person.phoneDisplay}</span>
            ) : null}
          </span>
        </a>
      ) : null}
      {person.tel ? (
        <a href={`sms:${person.tel}`} className="about-faces__reach-text" aria-label={`Text ${person.name}`}>
          Text
        </a>
      ) : null}
      {person.email ? (
        <a
          href={`mailto:${person.email}`}
          className="about-faces__reach-text"
          aria-label={`Email ${person.name}`}
        >
          Email
        </a>
      ) : null}
      {person.bookHref ? (
        <Link
          href={person.bookHref}
          className="about-faces__reach-text"
          aria-label={`Schedule with ${person.name}`}
        >
          Schedule
        </Link>
      ) : null}
    </div>
  )
}

function faceIdentity(person: AboutFace, opts?: { contact?: boolean }) {
  return (
    <>
      {person.title ? <p className="about-faces__title">{person.title}</p> : null}
      {person.license ? (
        <p className="about-faces__license">OR #{person.license}</p>
      ) : null}
      {opts?.contact ? (
        <div className="about-faces__contact">
          {person.phoneDisplay ? (
            <p className="about-faces__contact-line">
              <span className="about-faces__contact-term">Phone</span>
              <span className="about-faces__contact-value">{person.phoneDisplay}</span>
            </p>
          ) : null}
          {person.email ? (
            <p className="about-faces__contact-line">
              <span className="about-faces__contact-term">Email</span>
              <span className="about-faces__contact-value">{person.email}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export function AboutFaces({
  people,
  heading,
  headingLevel = 1,
  size = "roster",
  reach = true,
  eyebrow,
  claim,
  figures,
  source,
  proof,
}: {
  people: readonly AboutFace[]
  heading: string
  /**
   * 1 on /team, where the faces ARE the page. 2 on /about and the homepage,
   * whose H1 already exists. Default keeps existing callers byte-identical
   * except /about, which now passes 2 so the faces are doors, not the fold.
   *
   * --lead (display-1, chrome top pad) is roster + headingLevel 1 only.
   * portrait never takes --lead or --solo: that pair is the poster.
   */
  headingLevel?: 1 | 2
  /**
   * roster: the /about cards. editorial: the /team fold (principal + rows).
   * portrait: one broker, /team/[slug]. compact: the homepage table, three
   * faces + names + licenses + Call / Text / Book in one 390 screen. Compact
   * ignores `reach`: its rows ARE the reach, and there is no Email or
   * Schedule chip to switch off.
   */
  size?: "roster" | "portrait" | "compact" | "editorial"
  /** Call / Text / Email / Schedule buttons on the face row, including portrait. */
  reach?: boolean
  /**
   * The three head slots, added for /about (SITE-48). Roster only. They exist
   * so a page can OPEN on this section — the faces and the firm's own record —
   * instead of on a stack of contact links. /about's fold was seven identical
   * hairline link rows with the Proof, the closings, the faces and the Atlas
   * all below it; the taste table's verdict was "a phone book, not a proof
   * point". Leave them off and the section renders exactly as it always did.
   */
  eyebrow?: string
  /** One sentence the firm says about itself, under the heading. */
  claim?: string
  /** The firm's own figures beside the claim. Each carries its trace via `source`. */
  figures?: readonly { value: string; label: string }[]
  /** The section 0 trace for `figures`. Required whenever figures are passed. */
  source?: ReactNode
  /**
   * SITE-90 layout lock: the 5.0-from-25 lives on the principal's face card,
   * not a three-tile KPI row and not only a clause in the claim sentence.
   */
  proof?: AboutFaceProof
}) {
  const [first, ...rest] = people
  if (!first) return null
  const shown = [first, ...rest]
  const lead = headingLevel === 1 && size === "roster"

  if (size === "compact") {
    return (
      <section
        id="faces"
        className={cn(V3_ROOT_CLASS, "about-faces", "about-faces--compact")}
        aria-labelledby="faces-heading"
      >
        <div className="about-faces__head">
          <V3Eyebrow>Our brokers</V3Eyebrow>
          <div className="about-faces__head-row">
            <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
              {heading}
            </V3Heading>
            <V3Button variant="text" href={teamPath()} className="about-faces__door">
              Meet the team
            </V3Button>
          </div>
        </div>
        <ul className="about-faces__grid">
          {shown.map((person, index) => (
            <li key={person.href} className="about-faces__item">
              <Link href={person.href} className="about-faces__photo-link">
                {/* Plain img: owned public/ file, same reason V3Stage states. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="about-faces__photo"
                  src={person.src}
                  alt={person.name}
                  width={800}
                  height={1200}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  decoding="async"
                />
              </Link>
              <Link href={person.href} className="about-faces__name">
                {person.name}
              </Link>
              {person.title ? <p className="about-faces__role">{person.title}</p> : null}
              {person.license ? (
                <p className="about-faces__license">OR #{person.license}</p>
              ) : null}
              {aboutCompactReach(person).map((row) =>
                row.kind === "book" ? (
                  <Link
                    key={row.kind}
                    href={row.href}
                    className={cn("about-faces__reach", `about-faces__reach--${row.kind}`)}
                    aria-label={row.ariaLabel}
                  >
                    <IconCalendar />
                    <span className="about-faces__reach-label">{row.label}</span>
                    {row.detail ? <span className="about-faces__reach-detail">{row.detail}</span> : null}
                  </Link>
                ) : (
                  <a
                    key={row.kind}
                    href={row.href}
                    className={cn("about-faces__reach", `about-faces__reach--${row.kind}`)}
                    aria-label={row.ariaLabel}
                  >
                    {row.kind === "call" ? <IconPhone /> : <IconMessage />}
                    <span className="about-faces__reach-label">{row.label}</span>
                    {row.detail ? <span className="about-faces__reach-detail">{row.detail}</span> : null}
                  </a>
                ),
              )}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  /* Four chips of identical weight said Call and Schedule matter equally, and
     the row read as the "card grids with icons" tell (evaluator, 2026-09-09).
     Call carries the modifier and the weight; the rest are the alternatives.
     Same vocabulary as the homepage compact rows, which already name the kind
     on the class. */
  const reachLinks = (person: AboutFace) =>
    reach ? (
      <div className="about-faces__reach-row" id={size === "portrait" ? "contact-broker" : undefined}>
        {person.tel ? (
          <a
            href={`tel:${person.tel}`}
            className={cn("about-faces__reach", "about-faces__reach--call")}
            aria-label={`Call ${person.name}`}
          >
            <IconPhone />
            <span className="about-faces__reach-label">
              Call{person.phoneDisplay ? <span className="about-faces__reach-num">{person.phoneDisplay}</span> : null}
            </span>
          </a>
        ) : null}
        {person.tel ? (
          <a
            href={`sms:${person.tel}`}
            className={cn("about-faces__reach", "about-faces__reach--text")}
            aria-label={`Text ${person.name}`}
          >
            <IconMessage />
            <span className="about-faces__reach-label">Text</span>
          </a>
        ) : null}
        {person.email ? (
          <a
            href={`mailto:${person.email}`}
            className={cn("about-faces__reach", "about-faces__reach--email")}
            aria-label={`Email ${person.name}`}
          >
            <IconEnvelope />
            <span className="about-faces__reach-label">Email</span>
          </a>
        ) : null}
        {person.bookHref ? (
          <Link
            href={person.bookHref}
            className={cn("about-faces__reach", "about-faces__reach--book")}
            aria-label={`Schedule with ${person.name}`}
          >
            <IconCalendar />
            <span className="about-faces__reach-label">Schedule</span>
          </Link>
        ) : null}
      </div>
    ) : null

  if (size === "portrait") {
    return (
      <section
        id="faces"
        className={cn(V3_ROOT_CLASS, "about-faces", "about-faces--portrait")}
        aria-labelledby="faces-heading"
      >
        <Link href={first.href} className="about-faces__photo-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="about-faces__photo"
            src={first.src}
            alt={first.name}
            width={800}
            height={1200}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
        <div className="about-faces__row">
          <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
            {heading}
          </V3Heading>
          {faceIdentity(first, { contact: true })}
          {reachLinks(first)}
        </div>
      </section>
    )
  }

  if (size === "editorial") {
    const [leadPerson, ...companions] = shown
    if (!leadPerson) return null
    return (
      <section
        id="faces"
        className={cn(
          V3_ROOT_CLASS,
          "about-faces",
          "about-faces--editorial",
          "about-faces--lead",
          proof && "about-faces--house",
        )}
        aria-labelledby="faces-heading"
      >
        <div className="about-faces__head">
          <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
            {heading}
          </V3Heading>
          {claim ? <p className="about-faces__claim">{claim}</p> : null}
        </div>
        <div className="about-faces__editorial">
          {proof ? (
            <ul className="about-faces__trio" aria-hidden="true">
              {shown.map((person) => (
                <li key={`trio-${person.href}`} className="about-faces__trio-item">
                  <Link href={person.href} className="about-faces__photo-link" tabIndex={-1}>
                    <FacePortrait
                      src={person.src}
                      name={person.name}
                      priority={person === leadPerson}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <article className="about-faces__lead">
            <Link href={leadPerson.href} className="about-faces__photo-link">
              <FacePortrait
                src={leadPerson.src}
                name={leadPerson.name}
                priority
                proof={proof?.value}
              />
            </Link>
            <div className="about-faces__row">
              <Link href={leadPerson.href} className="about-faces__name">
                {leadPerson.name}
              </Link>
              {faceCredential(leadPerson)}
              {proof ? (
                <p className="about-faces__face-proof">
                  <Avatar className="about-faces__face-proof-avatar" size="sm">
                    <AvatarFallback className="about-faces__face-proof-fallback" delayMs={0}>
                      {proof.value}
                    </AvatarFallback>
                  </Avatar>
                  <Link href={proof.href} className="about-faces__face-proof-link">
                    from {proof.count} Google reviews
                  </Link>
                </p>
              ) : null}
              {faceRecord(leadPerson.record)}
              {reach ? editorialReach(leadPerson) : null}
            </div>
          </article>
          {companions.length > 0 ? (
            <ul className="about-faces__companions">
              {companions.map((person) => (
                <li key={person.href} className="about-faces__companion">
                  <Link href={person.href} className="about-faces__photo-link">
                    <FacePortrait src={person.src} name={person.name} />
                  </Link>
                  <div className="about-faces__row">
                    <Link href={person.href} className="about-faces__name">
                      {person.name}
                    </Link>
                    {faceCredential(person)}
                    {person.record ? (
                      <p className="about-faces__specialty">
                        <span className="about-faces__record-value">{person.record.value}</span>
                        {person.record.places.length > 0
                          ? ` in ${person.record.places.map((p) => p.name).join(', ')}`
                          : ` ${person.record.label}`}
                      </p>
                    ) : null}
                    {person.record ? (
                      <details className="about-faces__where">
                        <summary className="about-faces__where-summary">
                          <span className="about-faces__where-text">{person.record.placesSummary}</span>
                          <span className="about-faces__where-caret" aria-hidden="true" />
                        </summary>
                        {person.record.places.length > 0 ? (
                          <ul className="about-faces__where-list">
                            {person.record.places.map((place) => (
                              <li key={place.name} className="about-faces__where-row">
                                <span className="about-faces__where-place">{place.name}</span>
                                <span className="about-faces__where-n">{place.n}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="about-faces__where-trace">
                          <span className="about-faces__where-trace-label">Source</span> {person.record.trace}
                        </p>
                      </details>
                    ) : null}
                    {reach ? editorialReach(person) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section
      id="faces"
      className={cn(
        V3_ROOT_CLASS,
        "about-faces",
        lead && "about-faces--lead",
        shown.length === 1 && "about-faces--solo",
      )}
      aria-labelledby="faces-heading"
    >
      <div className="about-faces__head">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
          {heading}
        </V3Heading>
        {claim ? <p className="about-faces__claim">{claim}</p> : null}
        {figures && figures.length > 0 ? (
          <dl className="about-faces__figures">
            {figures.map((f) => (
              <div key={`${f.value} ${f.label}`} className="about-faces__figure">
                <dt className="about-faces__figure-value">{f.value}</dt>
                <dd className="about-faces__figure-label">{f.label}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {source}
      </div>
      <ul className="about-faces__grid">
        {shown.map((person, index) => (
          <li key={person.href} className="about-faces__item">
            <Link href={person.href} className="about-faces__photo-link">
              {/* Plain img: owned public/ file, same reason V3Stage states. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="about-faces__photo"
                src={person.src}
                alt={person.name}
                width={800}
                height={1200}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : undefined}
                decoding="async"
              />
            </Link>
            <div className="about-faces__row">
              <Link href={person.href} className="about-faces__name">
                {person.name}
              </Link>
              {faceIdentity(person)}
              {faceRecord(person.record)}
              {reachLinks(person)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
