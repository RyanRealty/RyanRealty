-- New post /blog/real-estate-commission-bend-oregon, the buyer's-agent guide's Oregon law date,
-- and a back-link from the cost-to-sell guide (SEO & AEO Desk brief 2026-10-09, AIV c2).
-- Matt's OK is required before merge.
--
-- 1. Inserts the commission guide. Every dollar figure is derived from the cost-to-sell guide's
--    traced inputs (lib/blog/cost-to-sell-inputs.ts): Bend's $765,000 12-month median sale
--    (market_metric city:bend detached, period_end 2026-10-08, re-read 2026-10-09 06:50 PT),
--    3% = $22,950, a half-point = $3,825 (arithmetic only), and $3,215 of title, escrow, lien
--    search and recording (0.42%). The body is lib/blog/real-estate-commission.ts rendered
--    verbatim (md5 ce46c714b41085791cc7874727ccfd8e). `on conflict (slug) do nothing`: a row that already exists (seeded
--    first) is left alone.
-- 2. /blog/buyers-agent-bend-buyer-broker-agreement: HB 4058 passed in 2024 but took effect
--    Jan 1, 2025 (Oregon Real Estate Agency overview, Dec 2024; ORS 696.810). One sentence.
-- 3. /blog/cost-to-sell-house-bend-oregon: one "More on commission in Bend" paragraph after
--    "Listing fee versus buyer-agent compensation". Its 8 questions are unchanged.
--
-- Updates 2 and 3 are guarded by the md5 of the body they were written against (dry-run
-- read-only against production on 2026-10-09); the DO block fails the migration if an existing
-- row did not land on the expected body (a database without these rows is skipped). Re-running
-- is a no-op. scripts/blog-content/aeo-guides-2026-09.ts carries the same edits, so
--   npx tsx scripts/seed-blog-posts.ts --only aeo-guides-2026-09 --slug real-estate-commission-bend-oregon
-- does not undo this. To revert, run the REVERT block at the end of this file.

insert into public.blog_posts
  (title, slug, content, excerpt, category, tags, hero_image_url, seo_title, seo_description,
   status, published_at, author_broker_id, updated_at)
values (
  'Real Estate Commission in Bend, Oregon',
  'real-estate-commission-bend-oregon',
  $cm$
<div class="v3-blog-answer" data-figures-as-of="2026-10-08">
<p>Ryan Realty's listing fee is 3% of the sale price with no add-on fees, which comes to $22,950 on a $765,000 home, Bend's median sale price over the last 12 months. What the buyer's agent is paid is a separate number. Since the August 17, 2024 practice changes from the National Association of REALTORS® settlement, it has been negotiated offer by offer instead of being posted in the MLS, and since January 1, 2025, Oregon law (ORS 696.810) has required the buyer's agent to have a written agreement with the buyer that explains how that agent is paid. No law sets either fee, and both are negotiable.</p>
<p class="v3-blog-answer-source">Median: Ryan Realty, Oregon Data Share MLS, single-family, as of Oct 8, 2026 (<a href="/housing-market/bend">Bend housing market</a>). Rule sources are listed at the bottom of this page.</p>
</div>

<h2>Our listing fee, in dollars</h2>
<p>Our fee is 3% of the sale price, with no add-on fees. It covers the MLS listing, professional photography, video, a 3D tour, the full marketing plan, every showing, weekly written reports, and transaction management through closing. On a $765,000 sale, which is Bend's median over the last 12 months as of Oct 8, 2026, that's $22,950. It's taken from your proceeds at closing, not paid up front. It's written into the listing agreement, and Oregon requires that agreement in writing before a broker markets your home.</p>

<h2>Who pays the buyer's agent now</h2>
<p>Until August 2024, the listing side usually posted an offer to pay the buyer's agent in the MLS. Under the practice changes from the National Association of REALTORS® settlement, which took effect on August 17, 2024, that offer can't appear in the MLS. Buyers working with an agent sign a written agreement before touring, and the agreement states what their agent will be paid.</p>
<p>As a seller, you can still agree to cover some or all of that fee, but it's now a term of each offer rather than an assumption. Some buyers ask for it, some don't, and you can say yes, no, or part. The math is simple: on a $765,000 sale, every half-point you agree to is $3,825. That's arithmetic, not a recommendation. We show you each offer's net after any buyer's-agent fee on a <a href="/tools/seller-net-sheet">seller net sheet</a> before you answer.</p>

<h2>What Oregon law requires in writing</h2>
<p><strong>For buyers:</strong> Oregon's House Bill 4058, passed in 2024 and in effect since January 1, 2025, requires a broker who represents a buyer of a home, residential land, or a one-to-four-unit property to work under a written representation agreement (ORS 696.810). It has to be signed before, or as soon as reasonably practicable after, the broker starts helping the buyer, and it can't run longer than 24 months with renewals. Oregon Real Estate Agency rules require it to explain how the buyer's agent may be paid, along with the term, termination rights, and whether it's exclusive. MLS rules are stricter on timing: the agreement has to be signed before the first tour.</p>
<p><strong>For sellers:</strong> your listing agreement has to be in writing before your broker markets the home, and it can't run longer than 24 months either. It states the listing fee and whether you've authorized any offer to the buyer's agent.</p>
<p>More on the buyer side: <a href="/blog/buyers-agent-bend-buyer-broker-agreement">Working with a buyer's agent in Bend</a>.</p>

<h2>What you pay besides commission</h2>
<p>Commission is the biggest line, but it isn't the only one. On a $765,000 Bend sale, the owner's title policy, your half of escrow, the lien search, and recording the release of your mortgage come to about $3,215, or 0.42% of the price. Deschutes County charges no transfer tax. Your loan payoff and the property-tax proration come out of proceeds too. Every line, with its source: <a href="/blog/cost-to-sell-house-bend-oregon">What it costs to sell a house in Bend</a>.</p>

<h2>How to compare agents on fees</h2>
<p>You'll see Bend commission rates quoted online. We haven't found a published, dated measure of what Bend sellers actually paid, so we don't quote one. Ask every agent you interview the same three things in writing: the listing fee as a percent and in dollars at your likely price, what that fee includes, and how they'll handle a buyer's request for agent compensation. Ours are above and on our <a href="/about">about page</a>.</p>
<p>Want the numbers for your home? Ask for a <a href="/sell/valuation">written valuation</a>, or see <a href="/sell">how we sell</a>.</p>

<h2>Questions</h2>
<h3>What is the real estate commission in Bend, Oregon?</h3>
<p>It depends on the brokerage, because no law sets it. Ryan Realty's listing fee is 3% of the sale price with no add-on fees, or $22,950 on a $765,000 home, Bend's 12-month median sale price as of Oct 8, 2026. What the buyer's agent is paid is a separate amount, negotiated offer by offer.</p>
<h3>Who pays the buyer's agent in Oregon now?</h3>
<p>The buyer agrees to their agent's fee in a written agreement. A seller can agree to cover some or all of it as a term of the offer, but since August 17, 2024 that offer can't be posted in the MLS, so it's decided offer by offer.</p>
<h3>Does Oregon require a written buyer agreement?</h3>
<p>Yes. Since January 1, 2025, ORS 696.810 has required a broker representing a buyer of residential property to work under a written representation agreement, signed before or as soon as reasonably practicable after the broker starts helping. It must explain how the buyer's agent may be paid and can't run longer than 24 months. MLS rules require it before the first tour.</p>
<h3>Is real estate commission negotiable in Oregon?</h3>
<p>Yes. Commissions are not set by law. Under the 2024 settlement rules, written buyer agreements must say so conspicuously, and every listing agreement is its own negotiation.</p>
<h3>What does Ryan Realty's 3% listing fee include?</h3>
<p>The MLS listing, professional photography, video, a 3D tour, the full marketing plan, every showing, weekly written reports, and transaction management through closing. There are no add-on fees.</p>
<h3>Is commission part of seller closing costs?</h3>
<p>It's paid at closing from your proceeds, but it's usually listed separately. On a $765,000 Bend sale, title, escrow, the lien search, and recording the release of your mortgage add about $3,215, and Deschutes County charges no transfer tax.</p>
<h3>Do I have to pay the buyer's agent if I sell my Bend home?</h3>
<p>No. Covering the buyer's agent is your choice in each offer. Some buyers will ask for it as part of their offer, and you can accept, decline, or counter, the same as with price.</p>

<h2>Sources</h2>
<ul>
<li>Ryan Realty, <a href="/housing-market/bend">Bend housing market</a> (Oregon Data Share MLS), as of Oct 8, 2026</li>
<li>National Association of REALTORS®, <a href="https://www.nar.realtor/the-facts/what-the-nar-settlement-means-for-home-buyers-and-sellers" target="_blank" rel="noopener">What the NAR Settlement Means for Home Buyers and Sellers</a> (updated May 24, 2024; practice changes effective Aug 17, 2024)</li>
<li>National Association of REALTORS®, <a href="https://www.nar.realtor/the-facts/written-buyer-agreements-101" target="_blank" rel="noopener">Written Buyer Agreements 101</a> and <a href="https://www.nar.realtor/handbook-on-multiple-listing-policy/no-compensation-offers-in-mls-section-4-written-buyer-agreements-required-policy-statement-8-13" target="_blank" rel="noopener">MLS Policy Statement 8.13</a></li>
<li><a href="https://www.oregonlegislature.gov/bills_laws/ors/ors696.html" target="_blank" rel="noopener">ORS 696.810</a>, Real estate licensee as buyer's agent; obligations (2025 edition)</li>
<li><a href="https://www.oregonlegislature.gov/bills_laws/lawsstatutes/2024orLaw0003.pdf" target="_blank" rel="noopener">Oregon Laws 2024, chapter 3 (House Bill 4058)</a></li>
<li>Oregon Real Estate Agency, <a href="https://www.oregon.gov/rea/newsroom/Pages/2024-OREN-J/Buyer-Agreements-Listing-Agreements-Law-Rule-Overview.aspx" target="_blank" rel="noopener">Buyer Agreements and Listing Agreements: A Law and Rule Overview</a> (Dec 2024), and <a href="https://oregon.legal/oregon-laws/oar-863-015-0133/" target="_blank" rel="noopener">OAR 863-015-0133</a></li>
<li>Ryan Realty, <a href="/blog/cost-to-sell-house-bend-oregon">What it costs to sell a house in Bend</a> (figures as of Oct 8, 2026)</li>
</ul>
$cm$,
  'What our listing fee is, how the buyer''s agent gets paid since the 2024 rule changes, what Oregon law requires in writing, and what you pay besides commission.',
  'Selling Guides',
  array['commission','buyer''s agent','nar settlement','oregon','bend']::text[],
  '/images/blog/how-to-sell-your-home-bend.jpg',
  'Bend Real Estate Commission: What Sellers Pay',
  'Ryan Realty''s listing fee is 3% ($22,950 on a $765,000 Bend home). Buyer''s-agent pay is negotiated per offer since Aug 2024. Oregon rules explained.',
  'published',
  '2026-10-09T14:00:00Z',
  '2fda6811-2edf-49e3-b3ca-33e1052f82e6',
  now()
)
on conflict (slug) do nothing;

update public.blog_posts set
  content = replace(content,
    $q$Oregon wrote the same requirement into state law in 2024 with House Bill 4058, which requires$q$,
    $q$Oregon wrote the same requirement into state law with House Bill 4058, passed in 2024 and in effect since January 1, 2025 (ORS 696.810), which requires$q$),
  updated_at = now()
where slug = 'buyers-agent-bend-buyer-broker-agreement' and md5(content) = 'c26dddd414f17c628853ac2374f24aab';

update public.blog_posts set
  content = replace(content,
    $q$Commission is negotiable and every listing agreement is its own conversation.</p>
$q$,
    $q$Commission is negotiable and every listing agreement is its own conversation.</p>
<p>More on commission in Bend: <a href="/blog/real-estate-commission-bend-oregon">real estate commission in Bend, Oregon</a>, our fee in dollars and the Oregon rules.</p>
$q$),
  updated_at = now()
where slug = 'cost-to-sell-house-bend-oregon' and md5(content) = '9f60ee154efb04dd2b0543dcf12127c2';

do $$
begin
  if exists (select 1 from public.blog_posts
             where slug = 'buyers-agent-bend-buyer-broker-agreement' and md5(content) <> 'c38504a058d28ab5396e10d6b0e6b91d') then
    raise exception 'buyers-agent-bend-buyer-broker-agreement: body drifted, not updated';
  end if;
  if exists (select 1 from public.blog_posts
             where slug = 'cost-to-sell-house-bend-oregon' and md5(content) <> 'f819e062054a92c2996a1f758b8e14f2') then
    raise exception 'cost-to-sell-house-bend-oregon: body drifted, not updated';
  end if;
end
$$;

-- REVERT (run by hand):
-- delete from public.blog_posts where slug = 'real-estate-commission-bend-oregon';
-- update public.blog_posts set content = replace(content,
--     $q$Oregon wrote the same requirement into state law with House Bill 4058, passed in 2024 and in effect since January 1, 2025 (ORS 696.810), which requires$q$,
--     $q$Oregon wrote the same requirement into state law in 2024 with House Bill 4058, which requires$q$), updated_at = now()
--   where slug = 'buyers-agent-bend-buyer-broker-agreement' and md5(content) = 'c38504a058d28ab5396e10d6b0e6b91d';
-- update public.blog_posts set content = replace(content,
--     $q$<p>More on commission in Bend: <a href="/blog/real-estate-commission-bend-oregon">real estate commission in Bend, Oregon</a>, our fee in dollars and the Oregon rules.</p>
-- $q$, ''), updated_at = now()
--   where slug = 'cost-to-sell-house-bend-oregon' and md5(content) = 'f819e062054a92c2996a1f758b8e14f2';
