import Link from 'next/link'

/**
 * Site v2 team / social-proof section — split layout, text + team photo, on a
 * muted surface. Mirrors design_system/ryan-realty/ui_kits/website/index.html §social.
 */

export default function TeamSection({ teamImageSrc }: { teamImageSrc?: string | null }) {
  const src = teamImageSrc ?? '/images/team.webp'

  return (
    <section className="bg-muted border-y border-border">
      <div className="mx-auto max-w-7xl px-6 py-14 grid gap-12 items-center grid-cols-1 md:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="rr-eyebrow">Meet the team</div>
          <h2 className="mt-1.5 text-[30px] font-bold tracking-[-0.01em] text-foreground leading-tight">
            Brokers who live and work across Central Oregon.
          </h2>
          <p className="mt-3.5 text-[15px] leading-[1.6] text-muted-foreground max-w-[52ch]">
            Local knowledge, honest guidance, and a small team that has lived,
            worked, and closed deals across Bend, Redmond, Sisters, Sunriver, and
            surrounding communities. We tell you what the inspection found. We
            tell you when a listing has been sitting. We tell you what we don't
            know.
          </p>
          <div className="mt-6 flex gap-2.5 flex-wrap">
            <Link
              href="/team"
              className="inline-flex items-center rounded-[10px] bg-primary text-white px-[18px] py-[9px] text-sm font-semibold hover:bg-primary/85 transition active:translate-y-px"
            >
              Meet the team
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-[10px] bg-card text-foreground border border-border px-[18px] py-[9px] text-sm font-semibold hover:bg-card/80 transition active:translate-y-px"
            >
              Schedule a call
            </Link>
          </div>
        </div>

        <div className="relative w-full aspect-[4/3] rounded-[14px] overflow-hidden shadow-md bg-muted">
          {/* Plain <img> so the mtime cache-buster query string passes through
              without tripping next/image's localPatterns whitelist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Ryan Realty brokers"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
