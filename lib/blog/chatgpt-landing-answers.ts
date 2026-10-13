/**
 * Answer-first summary + Questions for the blog URLs ChatGPT already sends
 * visitors to. Applied at render so the live post does not need a DB write.
 *
 * Facts are the ones already in each post (or, for the July market report, the
 * first paragraphs the post already prints). A body that already opens with
 * v3-blog-answer, or already has a Questions heading, keeps that section.
 */
import { extractAnswerFirst } from '@/app/blog/[slug]/_v3/answer-first'
import { extractBlogFaq } from './publish-blog-faq'

export const CHATGPT_LANDING_BLOG_SLUGS = [
  'broken-top-bend-golf-community',
  'hoa-guide-central-oregon',
  'bend-oregon-market-report-july-2026',
] as const

const ANSWER: Record<(typeof CHATGPT_LANDING_BLOG_SLUGS)[number], string> = {
  'broken-top-bend-golf-community': `<div class="v3-blog-answer">
<p>Broken Top is a gated golf community on Bend's west side, about ten minutes from downtown and eight minutes from the Old Mill District. Membership in the private 18-hole club is separate from owning a home. HOA fees typically run $300 to $500 a month, and a full golf membership adds its own initiation fee and monthly dues. Homes range from townhomes around $800,000 to custom houses above $2,000,000.</p>
</div>`,
  'hoa-guide-central-oregon': `<div class="v3-blog-answer">
<p>In Central Oregon, HOAs range from basic subdivision associations that maintain common areas for about $50 a month to full-service resort organizations with pools and golf for $500 or more a month. Oregon law requires sellers to disclose an HOA and provide CC&amp;Rs, bylaws, and financial documents. Read the dues, rental rules, and reserve funding before you write an offer, because those rules bind you after closing.</p>
</div>`,
  'bend-oregon-market-report-july-2026': '',
}

const FAQ: Record<(typeof CHATGPT_LANDING_BLOG_SLUGS)[number], string> = {
  'broken-top-bend-golf-community': `<h2>Questions</h2>
<h3>Is Broken Top gated?</h3>
<p>Yes. The community has a staffed entry gate during business hours on Bend's west side, off Mt. Washington Drive. The gate keeps through-traffic out. It is not a full-security operation.</p>
<h3>Does buying a home in Broken Top include golf membership?</h3>
<p>No. Membership is separate from home ownership. Buying a home does not automatically make you a club member. Initiation fees and monthly dues are set by the club, and social memberships with pool and dining access but no golf are also available.</p>
<h3>What are Broken Top HOA fees?</h3>
<p>HOA fees typically run $300 to $500 per month, depending on property type. They cover common area maintenance, roads inside the community, gate staffing, shared landscaping, and access to community trails. Club dues are separate.</p>
<h3>How far is Broken Top from downtown Bend?</h3>
<p>Downtown Bend is about a ten-minute drive. The Old Mill District is roughly eight minutes. Mt. Bachelor is about 25 minutes via Century Drive and the Cascade Lakes Highway.</p>`,
  'hoa-guide-central-oregon': `<h2>Questions</h2>
<h3>How much are HOA dues in Central Oregon?</h3>
<p>Basic subdivision associations often run $30 to $100 a month. Mid-range subdivisions may be $100 to $200 a month. Higher-end subdivisions can be $200 to $400 a month. Resort communities such as Sunriver, Broken Top, Brasada Ranch, and Eagle Crest sit above that, sometimes $500 or more a month when amenities are extensive.</p>
<h3>What are CC&amp;Rs?</h3>
<p>Covenants, Conditions, and Restrictions are the governing documents that define what you can and cannot do with a property inside an HOA. In Central Oregon they commonly cover exterior modifications, landscaping, vehicles and parking, rental rules, pets, business use, and signage.</p>
<h3>What should I review before buying in an HOA?</h3>
<p>Oregon law requires the seller to disclose the HOA and provide CC&amp;Rs, bylaws, and financial documents. Read the governing documents, the current budget, the reserve study, recent financial statements, assessment history, and 12 to 24 months of board minutes. Confirm rental rules in writing if you plan to rent.</p>
<h3>How do HOAs affect resale value?</h3>
<p>Well-maintained common areas and community standards can support values. High monthly fees, restrictive rules, or a poorly funded reserve can shrink the buyer pool. Factor the HOA fee into total cost of ownership over the years you expect to hold the home.</p>`,
  'bend-oregon-market-report-july-2026': '',
}

function strip(html: string): string {
  return html.replace(/^\s+|\s+$/g, '')
}

/** Wrap the paragraphs before the first H2 so they become the answer, not a copy. */
function wrapLeadingProseAsAnswer(html: string): string | null {
  const start = html.search(/<p\b/i)
  const heading = html.search(/<h2\b/i)
  if (start < 0) return null
  const end = heading >= 0 && heading > start ? heading : html.length
  const lead = html.slice(start, end).trim()
  if (!lead || !/<p\b/i.test(lead)) return null
  const wrapped = `${html.slice(0, start)}<div class="v3-blog-answer">\n${lead}\n</div>\n${html.slice(end)}`
  return wrapped
}

export function ensureChatgptLandingBody(slug: string, html: string): string {
  if (!(CHATGPT_LANDING_BLOG_SLUGS as readonly string[]).includes(slug)) return html
  const key = slug as (typeof CHATGPT_LANDING_BLOG_SLUGS)[number]
  let body = html
  if (!extractAnswerFirst(body).answerHtml) {
    if (key === 'bend-oregon-market-report-july-2026') {
      body = wrapLeadingProseAsAnswer(body) ?? body
    } else if (ANSWER[key]) {
      body = `${strip(ANSWER[key])}\n${body}`
    }
  }
  if (extractBlogFaq(body).length === 0) {
    const faq = FAQ[key]
    if (faq) body = `${body.trimEnd()}\n${faq}\n`
  }
  return body
}
