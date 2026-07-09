/**
 * Lead landing page — the SHARED renderer for /sell/[intent] and /buy/[intent].
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration, restyled IN
 * PLACE. Every byte of behavior is preserved from the prior ContentPageHero
 * layout: the interactive LeadLandingForm (the FUB lead path) keeps all its
 * props, the config-driven sections (challenge bullets, process steps, trust
 * bullets, testimonials, FAQ) all still render the same data, the FAQPage
 * JSON-LD still emits from the same visible Q&A, and the two hero CTAs +
 * "contact our team" link are unchanged. Only the presentation moved to the KB
 * shell (KbNav, a KB-token hero, KB section surfaces, KbFooter) so this page
 * wears the same Amboqia display / hard-edge look as the rest of the migrated
 * site.
 *
 * ContentPageHero is NOT edited here — it is shared by many non-LP content
 * pages (contact, faq, tools, etc.), so the hero is re-expressed inline against
 * KB tokens using the exact same config data (title / subtitle / heroImageUrl /
 * the two CTAs) it used to pass to ContentPageHero.
 *
 * PAGE CONTRACT: KB design + SEO (the route's generateMetadata, unchanged) +
 * tracking (KbSectionTracker pageType="lead-landing"). The default site chrome
 * is hidden for ^/sell/[intent] and ^/buy/[intent] via HideChrome; KbNav +
 * KbFooter carry the chrome here.
 */

import Image from 'next/image'
import LeadLandingForm from '@/components/landing/LeadLandingForm'
import type { LeadLandingConfig } from '@/lib/lead-landing-content'
import { TESTIMONIALS } from '@/lib/testimonials'
import { generateFAQSchema } from '@/lib/structured-data'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

type Props = {
  config: LeadLandingConfig
}

export default function LeadLandingPage({ config }: Props) {
  const quotes = TESTIMONIALS.slice(0, 3)

  const audienceCrumb = config.audience === 'seller'
    ? { label: 'Sell', href: '/sell' }
    : { label: 'Buy', href: '/buy' }

  const audienceLabel = config.audience === 'seller' ? 'Seller' : 'Buyer'

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="lead-landing" />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          audienceCrumb,
          { label: config.title },
        ]}
      />
      <SmoothScrollProvider>
        {/* HERO — re-expressed inline against KB tokens with the SAME config data
            (title / subtitle / heroImageUrl) and the SAME two CTAs that used to
            feed ContentPageHero. ContentPageHero is shared by non-LP pages, so it
            is not edited; this is the in-place restyle. */}
        <section className="lp-hero" id="lead-hero" aria-label="Page hero">
          <div className="lp-hero-media" aria-hidden>
            <Image
              src={config.heroImageUrl}
              alt={config.imageAlt}
              fill
              className="lp-hero-img"
              sizes="100vw"
              priority
            />
            <div className="lp-hero-scrim" />
          </div>
          <div className="wrap lp-hero-inner">
            <span className="hero-tag">
              <span className="dot" />
              {audienceLabel} · Central Oregon
            </span>
            <h1 className="hero-h display">{config.title}</h1>
            <p className="lp-hero-sub">{config.subtitle}</p>
            <div className="hero-cta-row lp-hero-cta-row">
              <a href={`${config.path}#lead-form`} className="btn">
                {config.primaryCtaLabel} <span className="arr">→</span>
              </a>
              <a href={config.secondaryCtaHref} className="btn ghost">
                {config.secondaryCtaLabel} <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* CHALLENGE + PROCESS + TRUST (left) and the LEAD FORM (right). Every
            config-driven list is preserved one-for-one; the LeadLandingForm keeps
            every prop so the FUB lead path is byte-identical. */}
        <section className="section lp-body" id="lead-detail" aria-label={`${audienceLabel} lead detail`}>
          <div className="wrap lp-grid">
            <div className="lp-col-main">
              <span className="chip lp-chip">{audienceLabel} lead page</span>
              <div className="sec-head lp-sec-head">
                <h2 className="sec-title display">{config.challengeTitle}</h2>
              </div>
              <ul className="lp-list">
                {config.challengeBullets.map((bullet) => (
                  <li key={bullet} className="lp-list-item">{bullet}</li>
                ))}
              </ul>

              <article className="lp-card" aria-label={config.processTitle}>
                <h3 className="lp-card-title display">{config.processTitle}</h3>
                <ol className="lp-steps">
                  {config.processSteps.map((step, idx) => (
                    <li key={step} className="lp-step">
                      <span className="lp-step-num mono-num">{idx + 1}</span>
                      <span className="lp-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </article>

              <article className="lp-card" aria-label="Why this works">
                <h3 className="lp-card-title display">Why this works</h3>
                <ul className="lp-list">
                  {config.trustBullets.map((bullet) => (
                    <li key={bullet} className="lp-list-item">{bullet}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div id="lead-form" className="lp-col-form">
              <LeadLandingForm
                audience={config.audience}
                pageTitle={config.seoTitle}
                pagePath={config.path}
                leadIntent={config.intent}
                heading={config.formTitle}
                subheading={config.formSubtitle}
                buttonLabel={config.primaryCtaLabel}
              />
            </div>
          </div>
        </section>

        {/* TESTIMONIALS — same three quotes, KB navy surface. */}
        <section className="section lp-reviews" id="lead-reviews" aria-label="Recent client feedback">
          <div className="wrap">
            <div className="sec-head lp-sec-head-reviews">
              <span className="sec-index">Proof</span>
              <h2 className="sec-title display">Recent client feedback</h2>
            </div>
            <div className="lp-review-grid">
              {quotes.map((quote) => (
                <figure key={`${quote.author}-${quote.source}`} className="lp-review">
                  <blockquote className="lp-review-quote">{quote.quote}</blockquote>
                  <figcaption className="lp-review-by">
                    {quote.author} from {quote.source}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — FAQPage schema emitted from the SAME visible Q&A data
            (legitimate because the questions render to the page). */}
        <section className="section lp-faq" id="lead-faq" aria-label="Questions we hear often">
          {config.faq.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(config.faq)) }}
            />
          )}
          <div className="wrap">
            <div className="sec-head lp-sec-head">
              <span className="sec-index">FAQ</span>
              <h2 className="sec-title display">Questions we hear often</h2>
            </div>
            <div className="lp-faq-grid">
              {config.faq.map((item) => (
                <article key={item.question} className="lp-faq-item">
                  <h3 className="lp-faq-q">{item.question}</h3>
                  <p className="lp-faq-a">{item.answer}</p>
                </article>
              ))}
            </div>
            <div className="lp-faq-cta">
              <a href="/contact" className="lp-faq-link">
                Prefer to talk now? Contact our team. <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>

      {/* Scoped KB-token styles for the lead-landing surfaces. Navy/cream tokens
          and the Amboqia display come from kb.css; this only lays out the
          LP-specific blocks (hero overlay, two-column body, review + FAQ grids). */}
      <style>{`
        .kb-root .lp-hero{position:relative;min-height:62vh;display:flex;align-items:flex-end;background:var(--navy);overflow:hidden;}
        .kb-root .lp-hero-media{position:absolute;inset:0;}
        .kb-root .lp-hero-img{object-fit:cover;object-position:center;}
        .kb-root .lp-hero-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(16,39,66,.92) 0%,rgba(16,39,66,.62) 46%,rgba(16,39,66,.34) 100%);}
        .kb-root .lp-hero-inner{position:relative;z-index:2;padding:120px 18px 48px;color:var(--cream);}
        .kb-root .lp-hero .hero-tag{color:var(--cream-70);}
        .kb-root .lp-hero .hero-h{font-size:clamp(2.3rem,6vw,5rem);line-height:.98;max-width:18ch;color:var(--cream);}
        .kb-root .lp-hero-sub{margin-top:18px;max-width:60ch;font-size:clamp(1.02rem,1.7vw,1.32rem);line-height:1.5;font-weight:500;color:var(--cream-70);}
        .kb-root .lp-hero-cta-row{margin-top:28px;flex-wrap:wrap;}

        .kb-root .lp-body{padding:clamp(48px,7vw,96px) 0;}
        .kb-root .lp-grid{display:grid;grid-template-columns:1fr;gap:clamp(32px,5vw,56px);align-items:start;}
        @media(min-width:1000px){.kb-root .lp-grid{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);}}
        .kb-root .lp-chip{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--navy-70);border:1px solid var(--navy-12);border-radius:20px;padding:6px 14px;margin-bottom:22px;}
        .kb-root .lp-sec-head{border-bottom:var(--edge,3px) solid var(--navy);padding-bottom:14px;}
        .kb-root .lp-sec-head .sec-title{font-size:clamp(1.7rem,4.4vw,3rem);}
        .kb-root .lp-list{list-style:none;margin:clamp(22px,3vw,32px) 0 0;border-top:1px solid var(--navy-12);}
        .kb-root .lp-list-item{font-size:clamp(1rem,1.5vw,1.18rem);line-height:1.5;font-weight:500;color:var(--navy-70);padding:16px 0 16px 26px;border-bottom:1px solid var(--navy-12);position:relative;}
        .kb-root .lp-list-item::before{content:"";position:absolute;left:0;top:25px;width:11px;height:2px;background:var(--navy);}
        .kb-root .lp-card{margin-top:clamp(26px,3.5vw,40px);border:var(--edge,3px) solid var(--navy);padding:clamp(22px,3vw,34px);background:var(--cream);}
        .kb-root .lp-card-title{font-size:clamp(1.4rem,3vw,2rem);line-height:1;color:var(--navy);}
        .kb-root .lp-card .lp-list{margin-top:18px;}
        .kb-root .lp-steps{list-style:none;margin-top:18px;border-top:1px solid var(--navy-12);}
        .kb-root .lp-step{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:baseline;padding:16px 0;border-bottom:1px solid var(--navy-12);}
        .kb-root .lp-step:last-child{border-bottom:0;}
        .kb-root .lp-step-num{font-family:var(--font-amboqia-safe),serif;font-size:clamp(1.6rem,3.4vw,2.2rem);line-height:.9;color:var(--navy);}
        .kb-root .lp-step-text{font-size:clamp(1rem,1.5vw,1.14rem);line-height:1.45;font-weight:500;color:var(--navy-70);}
        .kb-root .lp-col-form{position:sticky;top:96px;}
        @media(max-width:999px){.kb-root .lp-col-form{position:static;}}

        .kb-root .lp-reviews{background:var(--navy);color:var(--cream);padding:clamp(48px,7vw,96px) 0;}
        .kb-root .lp-sec-head-reviews{border-bottom:var(--edge,3px) solid var(--cream-40);padding-bottom:14px;}
        .kb-root .lp-reviews .sec-index{color:var(--cream-70);}
        .kb-root .lp-reviews .sec-title{font-size:clamp(1.7rem,4.4vw,3rem);color:var(--cream);}
        .kb-root .lp-review-grid{display:grid;grid-template-columns:1fr;gap:clamp(18px,2.5vw,28px);margin-top:clamp(28px,4vw,44px);}
        @media(min-width:760px){.kb-root .lp-review-grid{grid-template-columns:repeat(3,1fr);}}
        .kb-root .lp-review{border:1px solid var(--cream-40);padding:clamp(20px,2.5vw,28px);display:flex;flex-direction:column;gap:16px;}
        .kb-root .lp-review-quote{font-size:clamp(.98rem,1.4vw,1.1rem);line-height:1.5;color:var(--cream-70);}
        .kb-root .lp-review-by{font-size:.82rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--cream);}

        .kb-root .lp-faq{padding:clamp(48px,7vw,96px) 0;}
        .kb-root .lp-faq-grid{display:grid;grid-template-columns:1fr;gap:0;margin-top:clamp(28px,4vw,44px);border-top:1px solid var(--navy-12);}
        @media(min-width:820px){.kb-root .lp-faq-grid{grid-template-columns:1fr 1fr;column-gap:clamp(40px,5vw,72px);}}
        .kb-root .lp-faq-item{padding:22px 0;border-bottom:1px solid var(--navy-12);}
        .kb-root .lp-faq-q{font-size:clamp(1.04rem,1.6vw,1.24rem);font-weight:700;color:var(--navy);line-height:1.3;}
        .kb-root .lp-faq-a{margin-top:10px;font-size:clamp(.96rem,1.4vw,1.08rem);line-height:1.5;font-weight:500;color:var(--navy-70);}
        .kb-root .lp-faq-cta{margin-top:clamp(28px,3.5vw,40px);}
        .kb-root .lp-faq-link{display:inline-flex;align-items:center;gap:8px;font-size:.92rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--navy);}
        .kb-root .lp-faq-link:hover .arr{transform:translateX(4px);}
        .kb-root .lp-faq-link .arr{transition:transform .18s ease;}
      `}</style>
    </main>
  )
}
