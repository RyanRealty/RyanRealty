'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export interface KbOpenHouseItem {
  href: string
  photoUrl: string | null
  price: number | null
  address: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Pre-formatted human date/time, e.g. "Sat 11am-1pm". */
  whenLabel: string
}

/**
 * Price to the nearest thousand. Sub-million rounds to a "$895K" short form,
 * a million and up renders in full with commas ("$1,250,000"). Returns null
 * when there is no usable number so the stamp simply renders the date instead.
 */
function ohMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  const k = Math.round(n / 1000)
  if (k >= 1000) return `$${(k * 1000).toLocaleString('en-US')}`
  return `$${k}K`
}

/**
 * Split a "Sat 11am-1pm" style label into its weekday token and the time
 * window so the stamp can set the day big and the window small underneath.
 * Falls back to the whole string in the day slot when there is no space.
 */
function splitWhen(label: string): { day: string; time: string } {
  const i = label.indexOf(' ')
  if (i === -1) return { day: label, time: '' }
  return { day: label.slice(0, i), time: label.slice(i + 1) }
}

function ohSpecs(it: KbOpenHouseItem): string[] {
  const out: string[] = []
  if (it.beds != null) out.push(`${it.beds} bd`)
  if (it.baths != null) out.push(`${it.baths} ba`)
  if (it.sqft) out.push(`${Number(it.sqft).toLocaleString('en-US')} sf`)
  return out
}

/**
 * KB Open Houses — an editorial board, not a card grid. The next open house on
 * the calendar takes a full-bleed cinematic LEAD panel; the rest run as a
 * horizontal scroll-snap rail of tall photo cards. The date/time is the hero of
 * every tile: a hard navy/cream ledger stamp with a live pulse dot, because the
 * window is what makes an open house urgent. Price sets in Amboqia, the address
 * carries a mono city sub, and bd/ba/sf run as a mono spec line. The whole tile
 * links to the listing. Navy surface, cream edges, server-safe data in,
 * scroll-reveal only on the client. Renders null when the calendar is empty.
 */
export function KbOpenHouses({
  items,
  eyebrow,
  heading,
  viewAllHref,
}: {
  items: KbOpenHouseItem[]
  eyebrow: string
  heading: string
  viewAllHref?: string
}) {
  const root = useRef<HTMLElement>(null)
  // The rail is a navigable index: clicking/hovering a card promotes it into the
  // big lead panel. The rail stays STABLE (every open house always visible, the
  // active one marked) so there is no reflow on selection.
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const lead = root.current?.querySelector<HTMLElement>('.oh-lead')
      const rail = gsap.utils.toArray<HTMLElement>('.oh-rail-card')

      if (reduce) {
        if (lead) gsap.set(lead, { clipPath: 'inset(0 0 0% 0)', opacity: 1 })
        gsap.set(rail, { y: 0 })
        return
      }

      if (lead) {
        gsap.fromTo(
          lead,
          { clipPath: 'inset(0 0 100% 0)', opacity: 1 },
          {
            clipPath: 'inset(0 0 0% 0)',
            duration: 1.05,
            ease: 'power4.out',
            scrollTrigger: { trigger: lead, start: 'top 82%', once: true },
          },
        )
      }
      if (rail.length) {
        // Transform-only entrance — opacity is owned by CSS (active/dimmed states)
        // so the cards are NEVER hidden if the ScrollTrigger doesn't fire. They are
        // interactive buttons; content must not depend on an animation playing.
        gsap.from(rail, {
          y: 26,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
        })
      }
    }, root)
    return () => ctx.revert()
  }, [])

  if (items.length === 0) return null

  const safeIndex = Math.min(activeIndex, items.length - 1)
  const lead = items[safeIndex]
  const hasRail = items.length > 1
  const leadWhen = splitWhen(lead.whenLabel)
  const leadPrice = ohMoney(lead.price)
  const leadSpecs = ohSpecs(lead)

  return (
    <section className="section openhouses" id="open-houses" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{heading}</h2>
        </div>

        <div className={hasRail ? 'oh-board has-rail' : 'oh-board'}>
          {/* LEAD — the next open house, full-bleed cinematic panel */}
          <a className="oh-lead" href={lead.href}>
            <div className="oh-lead-media">
              {lead.photoUrl ? (
                <img className="oh-lead-img" src={lead.photoUrl} alt={lead.address} loading="lazy" />
              ) : (
                <div className="oh-noimg" aria-hidden="true" />
              )}
            </div>

            <div className="oh-stamp oh-stamp-lead">
              <span className="oh-stamp-live" aria-hidden="true" />
              <span className="oh-stamp-kicker">Open house</span>
              <span className="oh-stamp-day mono-num">{leadWhen.day}</span>
              {leadWhen.time ? <span className="oh-stamp-time mono-num">{leadWhen.time}</span> : null}
            </div>

            <div className="oh-lead-info">
              {leadPrice ? <div className="oh-lead-price display mono-num">{leadPrice}</div> : null}
              <div className="oh-lead-addr">
                {lead.address}
                <span className="oh-sub">{lead.cityLine}</span>
              </div>
              {leadSpecs.length ? (
                <div className="oh-specs">
                  {leadSpecs.map((s) => (
                    <span key={s} className="mono-num">
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </a>

          {/* RAIL — every open house as a selectable card; scroll-snaps horizontally
              on mobile, scrolls vertically beside the lead on desktop. Click or hover
              promotes the card into the lead panel. The big lead anchor is the
              navigation target. */}
          {hasRail ? (
            <div className="oh-rail" role="list">
              {items.map((it, i) => {
                const when = splitWhen(it.whenLabel)
                const price = ohMoney(it.price)
                const specs = ohSpecs(it)
                const isActive = i === safeIndex
                return (
                  <button
                    key={it.href}
                    type="button"
                    className="oh-rail-card"
                    role="listitem"
                    aria-current={isActive}
                    aria-label={`Preview ${it.address}`}
                    onClick={() => setActiveIndex(i)}
                    onMouseEnter={() => setActiveIndex(i)}
                    onFocus={() => setActiveIndex(i)}
                  >
                    <div className="oh-rail-media">
                      {it.photoUrl ? (
                        <img className="oh-rail-img" src={it.photoUrl} alt={it.address} loading="lazy" />
                      ) : (
                        <div className="oh-noimg" aria-hidden="true" />
                      )}
                    </div>

                    <div className="oh-stamp">
                      <span className="oh-stamp-live" aria-hidden="true" />
                      <span className="oh-stamp-day mono-num">{when.day}</span>
                      {when.time ? <span className="oh-stamp-time mono-num">{when.time}</span> : null}
                    </div>

                    <div className="oh-rail-info">
                      {price ? <div className="oh-rail-price display mono-num">{price}</div> : null}
                      <div className="oh-rail-addr">
                        {it.address}
                        <span className="oh-sub">{it.cityLine}</span>
                      </div>
                      {specs.length ? (
                        <div className="oh-specs">
                          {specs.map((s) => (
                            <span key={s} className="mono-num">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {viewAllHref ? (
          <div className="lst-foot">
            <a href={viewAllHref} className="btn ghost">
              All open houses <span className="arr">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
