/**
 * Broker faces on cream. Roster cards carry light chrome + icon reach
 * (call / text / email) for Home density; name remains the door. Title
 * stays a role chip under the name.
 *
 * roster: /team (H1), /about and homepage (H2).
 * portrait: /team/[slug] at card-photo scale, not AboutFaces poster size.
 */

import Link from "next/link"
import { cn } from "@/lib/utils"
import { V3_ROOT_CLASS, V3Heading } from "@/components/site/v3"
import type { AboutFace } from "./about-faces"
import "./about-faces.css"

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M7.2 3.8h2.4l1.2 4.2-1.6 1.1a12.6 12.6 0 0 0 5.7 5.7l1.1-1.6 4.2 1.2v2.4c0 .9-.7 1.7-1.6 1.7A14.8 14.8 0 0 1 3.8 5.4c0-.9.8-1.6 1.7-1.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
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
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
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

export function AboutFaces({
  people,
  heading,
  headingLevel = 1,
  size = "roster",
  reach = true,
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
  size?: "roster" | "portrait"
  /** Call / Text / Email icon buttons on the face row, including portrait. */
  reach?: boolean
}) {
  const [first, ...rest] = people
  if (!first) return null
  const shown = [first, ...rest]
  const lead = headingLevel === 1 && size === "roster"
  const reachLinks = (person: AboutFace) =>
    reach ? (
      <div className="about-faces__reach-row" id={size === "portrait" ? "contact-broker" : undefined}>
        {person.tel ? (
          <a href={`tel:${person.tel}`} className="about-faces__reach" aria-label={`Call ${person.name}`}>
            <IconPhone />
            <span className="about-faces__reach-label">Call</span>
          </a>
        ) : null}
        {person.tel ? (
          <a href={`sms:${person.tel}`} className="about-faces__reach" aria-label={`Text ${person.name}`}>
            <IconMessage />
            <span className="about-faces__reach-label">Text</span>
          </a>
        ) : null}
        {person.email ? (
          <a href={`mailto:${person.email}`} className="about-faces__reach" aria-label={`Email ${person.name}`}>
            <IconEnvelope />
            <span className="about-faces__reach-label">Email</span>
          </a>
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
          {first.title ? <p className="about-faces__title">{first.title}</p> : null}
          {reachLinks(first)}
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
        <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
          {heading}
        </V3Heading>
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
              {person.title ? <p className="about-faces__title">{person.title}</p> : null}
              {reachLinks(person)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
