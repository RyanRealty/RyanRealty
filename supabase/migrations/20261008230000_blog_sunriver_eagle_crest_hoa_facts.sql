-- Sunriver and Eagle Crest guides: sourced HOA facts and GSC titles (SEO & AEO Desk brief
-- 2026-10-08, GSC low-CTR pages, section 6.2 and 6.3). Matt's OK is required before merge.
--
-- Sunriver: the SROA section said dues were 'approximately $1,200 to $2,500 per year' and SHARC
-- 'around $500 to $700 per household', with no source. SROA's 2026 maintenance fee is a flat
-- $172.94 a month on every property and the 2026 membership card (SHARC access) is $90 per card
-- (sunriverowners.org Accounting, Member Preference Program, Recreation Plus Program, accessed
-- 2026-10-08). The H2 keeps id="sroa-fees-and-costs" so existing links resolve, and a Questions
-- block is added so lib/blog/publish-blog-faq.ts emits FAQPage.
-- Eagle Crest: the meta's '$350,000' and the HOA section's '$200 to $450 per month, significantly
-- less than Brasada Ranch, Caldera Springs, or Tetherow' had no source. The HOA section now carries
-- the ECMA 2026 Dues and Budget Letter figures plus our own MLS median; other unsourced price,
-- rental, and green-fee ranges are cut. The single-family line uses the $835,000 12-month median
-- (99 sales) from /communities/eagle-crest as of Oct 8, 2026.
--
-- Each update is guarded by the md5 of the body it was written against, and the DO block fails
-- the migration if an existing row did not land on the new body (a drifted row is never
-- half-edited; a database without these rows is skipped). Re-running is a no-op.
-- scripts/blog-content/community-spotlights.ts carries the same title, meta, excerpt, and body,
-- so `npx tsx scripts/seed-blog-posts.ts --only community-spotlights` does not undo this.
-- To revert, run the REVERT block at the end of this file.

update public.blog_posts set
  seo_title = 'Sunriver HOA Fees and Year-Round Living Costs',
  seo_description = 'Sunriver''s SROA fee is $172.94 a month in 2026, or $2,075 a year, on every property. What full-time and vacation owners pay, from a Bend brokerage.',
  content = replace(replace(content,
    $q$<h2>SROA fees and costs</h2>

<p>Every property owner pays annual SROA assessments, which cover road maintenance, bike path upkeep, common area landscaping, and community programs. These currently run approximately $1,200 to $2,500 per year depending on the property type and size. Some sub-neighborhoods have additional HOA fees on top of SROA dues.</p>

<p>SHARC access requires a separate pass. Homeowners can purchase annual passes at a discounted rate (around $500 to $700 per household), or pay per visit. Vacation rental guests typically purchase passes through their management company.</p>$q$,
    $q$<h2 id="sroa-fees-and-costs">Sunriver HOA fees (SROA) in 2026</h2>

<p>Every Sunriver property pays the same SROA maintenance fee: $172.94 a month in 2026, or $2,075.28 a year, whether the home is lived in full time or rented. The fee pays for roads, pathways, snowplowing, parks, and the association's operations, and $30 of each month's fee goes to the reserve fund for long-lived repairs. SROA's board sets the fee each November and can raise it up to 6% a year without an owner vote.</p>

<p>Some condos and townhomes also belong to a sub-association with its own dues, and some SROA invoices still carry a SHARC assessment or the bulk fiber internet charge. Ask for the property's SROA statement and any sub-association budget before you write an offer.</p>

<p>Recreation is separate. An SROA membership card, which opens SHARC's pools and fitness center plus the tennis and pickleball courts, is $90 per card for 2026. Owners who rent their home short-term use the Recreation Plus Program instead, priced by bedroom count: $2,760 a year for a three-bedroom home in 2026.</p>

<p><small>Sources: Sunriver Owners Association, <a href="https://www.sunriverowners.org/departments/accounting">Accounting</a> (2026 maintenance fee), <a href="https://www.sunriverowners.org/owners/owner-benefits/member-preference-program">Member Preference Program</a> (2026 card), and <a href="https://www.sunriverowners.org/owners/owner-benefits/recreation-plus-program-for-rentals">Recreation Plus Program</a> (2026 fees), accessed Oct 8, 2026.</small></p>$q$),
    $q$match your goals.</p>
$q$,
    $q$match your goals.</p>

<h2>Questions</h2>

<h3>How much are Sunriver HOA fees?</h3>
<p>Every Sunriver property pays the Sunriver Owners Association a maintenance fee of $172.94 a month in 2026, or $2,075.28 a year. Some condos and townhomes owe sub-association dues on top of that.</p>

<h3>Do Sunriver owners pay extra for SHARC?</h3>
<p>SROA membership cards, which include SHARC access, are $90 per card for 2026. Some owners still pay a SHARC assessment on their SROA invoice, so check the property's statement.</p>
$q$),
  updated_at = now()
where slug = 'sunriver-year-round-living-vs-vacation' and md5(content) = '5c6a307e76c93d88643a367e9e0f6bde';

update public.blog_posts set
  seo_title = 'Eagle Crest Redmond: Condos, Homes, HOA Fees',
  seo_description = 'Eagle Crest''s 2026 master dues are $96 a month per lot or unit, plus $90 water and sewer on a built lot. Condos, townhomes, and homes in Redmond.',
  content = replace(replace(replace(replace(replace(replace(content,
    $q$<p>Central Oregon resort communities rarely price below a million dollars. Eagle Crest, just north of Redmond, is one of the exceptions. It offers three golf courses, a sports center, and resort infrastructure at price points that would buy a condo in most other resort communities.</p>$q$,
    $q$<p>Many Central Oregon resort communities sell well above a million dollars. Eagle Crest, just north of Redmond, is one of the exceptions. It offers three golf courses, a sports center, and resort infrastructure at lower price points than most of the region's resorts.</p>$q$),
    $q$All three courses are open to the public, so this is not a private club experience. Green fees run lower than Tetherow or Pronghorn, typically $40 to $80 per round depending on season and tee time. Homeowners receive discounted rates and can purchase annual passes.</p>$q$,
    $q$All three courses are open to the public, so this is not a private club experience. Homeowners receive discounted rates and can purchase annual passes.</p>$q$),
    $q$<p>Eagle Crest's price ranges:</p>

<ul>
<li><strong>Condos (1-2 bed):</strong> $200,000 to $350,000. These are the entry-level investment and vacation properties. Many are in buildings with shared amenities and work well as rentals.</li>
<li><strong>Townhomes (2-3 bed):</strong> $300,000 to $450,000. More space and privacy than condos, with attached garages and small patios or decks.</li>
<li><strong>Single-family homes (3-4 bed):</strong> $400,000 to $600,000. Detached homes with private yards, garages, and more separation from neighbors. Some have golf course or canyon views. These are the most versatile option, working equally well as primary residences, vacation homes, or rental properties.</li>
</ul>

<p>Compare these to Caldera Springs ($600K to $1.5M+), Brasada Ranch ($700K to $3M+), or Broken Top ($800K to $3M+). Eagle Crest is not competing on luxury. It is competing on access and affordability.</p>$q$,
    $q$<p>Eagle Crest has three kinds of homes:</p>

<ul>
<li><strong>Single-family homes:</strong> Detached homes with private yards, garages, and more separation from neighbors. Some have golf course or canyon views. Over the last 12 months they sold for a median $835,000, across 99 sales.</li>
<li><strong>Condos:</strong> The entry-level investment and vacation properties. Many are in buildings with shared amenities and work well as rentals.</li>
<li><strong>Townhomes:</strong> More space and privacy than condos, with attached garages and small patios or decks.</li>
</ul>

<p><small>Single-family homes, Oregon Data Share MLS, as of Oct 8, 2026, from our <a href="/communities/eagle-crest">Eagle Crest community page</a>. We don't publish a condo or townhome median.</small></p>

<p>Eagle Crest is not competing on luxury. It is competing on access and price.</p>$q$),
    $q$<p>Typical gross rental income by property type:</p>

<ul>
<li><strong>Condos:</strong> $12,000 to $22,000 per year</li>
<li><strong>Townhomes:</strong> $18,000 to $30,000 per year</li>
<li><strong>Single-family homes:</strong> $25,000 to $40,000 per year</li>
</ul>

<p>With lower purchase prices and lower HOA fees, the rental math at Eagle Crest often returns a higher percentage as a share of purchase price than at higher-end resort communities. A $300,000 condo generating $20,000 in gross rental income returns a higher percentage than a $1.2 million cabin generating $50,000.</p>

<p>Management fees typically run 20% to 30% of gross revenue, and you will need to account for cleaning, maintenance, and supplies. Run the real numbers before making assumptions about cash flow.$q$,
    $q$<p>Rental income depends on the specific home, its location, and how it is managed. Before you buy for rental income, get the property's booking history, the management fee, and every layer of dues, and account for cleaning, maintenance, and supplies. Run the real numbers before making assumptions about cash flow.$q$),
    $q$<p>Eagle Crest HOA fees are structured differently depending on the sub-community and property type. Expect to pay $200 to $450 per month, which is significantly less than Brasada Ranch, Caldera Springs, or Tetherow. These fees cover common area maintenance, road upkeep, and access to resort facilities.</p>

<p>Some sub-communities within Eagle Crest have additional HOA layers with their own fees. Before purchasing, confirm the total monthly assessment for the specific property you are considering, not just the resort-level fee. The layered HOA structure can be confusing, and the total cost is what matters for your monthly budget.</p>$q$,
    $q$<p>Eagle Crest dues come in layers. Every lot or unit pays the Eagle Crest Master Association. For 2026 that's $96 a month for the common areas ($108.85 if the owner didn't prepay the pro shop loan), $90 a month for water and sewer on a built lot, and a Resort Sports Center fee of $460.52 a year per unit plus $32 a year per owner, billed quarterly. Most homes and condos also belong to a sub-association that bills its own dues, so ask for both budgets. In our MLS data, detached Eagle Crest listings that reported dues since October 2023 show a median of $138 a month across 425 listings. Condo and townhome dues aren't in that figure.</p>

<p><small>Sources: Eagle Crest Master Association, <a href="https://eaglecrestowners.com/hoas/ecma/">2026 Dues and Budget Letter</a> (December 2025); Ryan Realty, <a href="/communities/eagle-crest">Eagle Crest community page</a>, Oregon Data Share MLS, as of Oct 8, 2026.</small></p>$q$),
    $q$vacation rental potential, and a Cascade mountain backdrop, all at 30% to 50% of the cost of competitors.</li>$q$,
    $q$vacation rental potential, and a Cascade mountain backdrop, at a lower price point.</li>$q$),
  updated_at = now()
where slug = 'eagle-crest-affordable-resort-redmond' and md5(content) = '47207cedcb2222ad59a354353e90dcf2';

do $chk$
begin
  if exists (select 1 from public.blog_posts where slug = 'sunriver-year-round-living-vs-vacation') and not exists (select 1 from public.blog_posts where slug = 'sunriver-year-round-living-vs-vacation' and md5(content) = '1c2ed95ed228184745948273785b0376') then
    raise exception 'sunriver-year-round-living-vs-vacation: body did not match the expected base; nothing applied';
  end if;
  if exists (select 1 from public.blog_posts where slug = 'eagle-crest-affordable-resort-redmond') and not exists (select 1 from public.blog_posts where slug = 'eagle-crest-affordable-resort-redmond' and md5(content) = '0f99d66beda46f79d0b6d8d318441371') then
    raise exception 'eagle-crest-affordable-resort-redmond: body did not match the expected base; nothing applied';
  end if;
end
$chk$;

-- REVERT
-- begin;
-- update public.blog_posts set seo_title = 'Sunriver Year-Round Living: What It Costs', seo_description = 'Should you live in Sunriver full time or keep it a vacation home? The community, the seasons, the rental question, and the costs that go with each choice, from a Bend brokerage.', content = replace(replace(content, $q$match your goals.</p>
-- 
-- <h2>Questions</h2>
-- 
-- <h3>How much are Sunriver HOA fees?</h3>
-- <p>Every Sunriver property pays the Sunriver Owners Association a maintenance fee of $172.94 a month in 2026, or $2,075.28 a year. Some condos and townhomes owe sub-association dues on top of that.</p>
-- 
-- <h3>Do Sunriver owners pay extra for SHARC?</h3>
-- <p>SROA membership cards, which include SHARC access, are $90 per card for 2026. Some owners still pay a SHARC assessment on their SROA invoice, so check the property's statement.</p>
-- $q$, $q$match your goals.</p>
-- $q$), $q$<h2 id="sroa-fees-and-costs">Sunriver HOA fees (SROA) in 2026</h2>
-- 
-- <p>Every Sunriver property pays the same SROA maintenance fee: $172.94 a month in 2026, or $2,075.28 a year, whether the home is lived in full time or rented. The fee pays for roads, pathways, snowplowing, parks, and the association's operations, and $30 of each month's fee goes to the reserve fund for long-lived repairs. SROA's board sets the fee each November and can raise it up to 6% a year without an owner vote.</p>
-- 
-- <p>Some condos and townhomes also belong to a sub-association with its own dues, and some SROA invoices still carry a SHARC assessment or the bulk fiber internet charge. Ask for the property's SROA statement and any sub-association budget before you write an offer.</p>
-- 
-- <p>Recreation is separate. An SROA membership card, which opens SHARC's pools and fitness center plus the tennis and pickleball courts, is $90 per card for 2026. Owners who rent their home short-term use the Recreation Plus Program instead, priced by bedroom count: $2,760 a year for a three-bedroom home in 2026.</p>
-- 
-- <p><small>Sources: Sunriver Owners Association, <a href="https://www.sunriverowners.org/departments/accounting">Accounting</a> (2026 maintenance fee), <a href="https://www.sunriverowners.org/owners/owner-benefits/member-preference-program">Member Preference Program</a> (2026 card), and <a href="https://www.sunriverowners.org/owners/owner-benefits/recreation-plus-program-for-rentals">Recreation Plus Program</a> (2026 fees), accessed Oct 8, 2026.</small></p>$q$, $q$<h2>SROA fees and costs</h2>
-- 
-- <p>Every property owner pays annual SROA assessments, which cover road maintenance, bike path upkeep, common area landscaping, and community programs. These currently run approximately $1,200 to $2,500 per year depending on the property type and size. Some sub-neighborhoods have additional HOA fees on top of SROA dues.</p>
-- 
-- <p>SHARC access requires a separate pass. Homeowners can purchase annual passes at a discounted rate (around $500 to $700 per household), or pay per visit. Vacation rental guests typically purchase passes through their management company.</p>$q$) where slug = 'sunriver-year-round-living-vs-vacation';
-- update public.blog_posts set seo_title = 'Eagle Crest Redmond: Affordable Resort Homes', seo_description = 'Eagle Crest resort living in Redmond, Oregon. Whole-ownership homes start at $350,000, with golf, trails, and three sports centers on site.', content = replace(replace(replace(replace(replace(replace(content, $q$vacation rental potential, and a Cascade mountain backdrop, at a lower price point.</li>$q$, $q$vacation rental potential, and a Cascade mountain backdrop, all at 30% to 50% of the cost of competitors.</li>$q$), $q$<p>Eagle Crest dues come in layers. Every lot or unit pays the Eagle Crest Master Association. For 2026 that's $96 a month for the common areas ($108.85 if the owner didn't prepay the pro shop loan), $90 a month for water and sewer on a built lot, and a Resort Sports Center fee of $460.52 a year per unit plus $32 a year per owner, billed quarterly. Most homes and condos also belong to a sub-association that bills its own dues, so ask for both budgets. In our MLS data, detached Eagle Crest listings that reported dues since October 2023 show a median of $138 a month across 425 listings. Condo and townhome dues aren't in that figure.</p>
-- 
-- <p><small>Sources: Eagle Crest Master Association, <a href="https://eaglecrestowners.com/hoas/ecma/">2026 Dues and Budget Letter</a> (December 2025); Ryan Realty, <a href="/communities/eagle-crest">Eagle Crest community page</a>, Oregon Data Share MLS, as of Oct 8, 2026.</small></p>$q$, $q$<p>Eagle Crest HOA fees are structured differently depending on the sub-community and property type. Expect to pay $200 to $450 per month, which is significantly less than Brasada Ranch, Caldera Springs, or Tetherow. These fees cover common area maintenance, road upkeep, and access to resort facilities.</p>
-- 
-- <p>Some sub-communities within Eagle Crest have additional HOA layers with their own fees. Before purchasing, confirm the total monthly assessment for the specific property you are considering, not just the resort-level fee. The layered HOA structure can be confusing, and the total cost is what matters for your monthly budget.</p>$q$), $q$<p>Rental income depends on the specific home, its location, and how it is managed. Before you buy for rental income, get the property's booking history, the management fee, and every layer of dues, and account for cleaning, maintenance, and supplies. Run the real numbers before making assumptions about cash flow.$q$, $q$<p>Typical gross rental income by property type:</p>
-- 
-- <ul>
-- <li><strong>Condos:</strong> $12,000 to $22,000 per year</li>
-- <li><strong>Townhomes:</strong> $18,000 to $30,000 per year</li>
-- <li><strong>Single-family homes:</strong> $25,000 to $40,000 per year</li>
-- </ul>
-- 
-- <p>With lower purchase prices and lower HOA fees, the rental math at Eagle Crest often returns a higher percentage as a share of purchase price than at higher-end resort communities. A $300,000 condo generating $20,000 in gross rental income returns a higher percentage than a $1.2 million cabin generating $50,000.</p>
-- 
-- <p>Management fees typically run 20% to 30% of gross revenue, and you will need to account for cleaning, maintenance, and supplies. Run the real numbers before making assumptions about cash flow.$q$), $q$<p>Eagle Crest has three kinds of homes:</p>
-- 
-- <ul>
-- <li><strong>Single-family homes:</strong> Detached homes with private yards, garages, and more separation from neighbors. Some have golf course or canyon views. Over the last 12 months they sold for a median $835,000, across 99 sales.</li>
-- <li><strong>Condos:</strong> The entry-level investment and vacation properties. Many are in buildings with shared amenities and work well as rentals.</li>
-- <li><strong>Townhomes:</strong> More space and privacy than condos, with attached garages and small patios or decks.</li>
-- </ul>
-- 
-- <p><small>Single-family homes, Oregon Data Share MLS, as of Oct 8, 2026, from our <a href="/communities/eagle-crest">Eagle Crest community page</a>. We don't publish a condo or townhome median.</small></p>
-- 
-- <p>Eagle Crest is not competing on luxury. It is competing on access and price.</p>$q$, $q$<p>Eagle Crest's price ranges:</p>
-- 
-- <ul>
-- <li><strong>Condos (1-2 bed):</strong> $200,000 to $350,000. These are the entry-level investment and vacation properties. Many are in buildings with shared amenities and work well as rentals.</li>
-- <li><strong>Townhomes (2-3 bed):</strong> $300,000 to $450,000. More space and privacy than condos, with attached garages and small patios or decks.</li>
-- <li><strong>Single-family homes (3-4 bed):</strong> $400,000 to $600,000. Detached homes with private yards, garages, and more separation from neighbors. Some have golf course or canyon views. These are the most versatile option, working equally well as primary residences, vacation homes, or rental properties.</li>
-- </ul>
-- 
-- <p>Compare these to Caldera Springs ($600K to $1.5M+), Brasada Ranch ($700K to $3M+), or Broken Top ($800K to $3M+). Eagle Crest is not competing on luxury. It is competing on access and affordability.</p>$q$), $q$All three courses are open to the public, so this is not a private club experience. Homeowners receive discounted rates and can purchase annual passes.</p>$q$, $q$All three courses are open to the public, so this is not a private club experience. Green fees run lower than Tetherow or Pronghorn, typically $40 to $80 per round depending on season and tee time. Homeowners receive discounted rates and can purchase annual passes.</p>$q$), $q$<p>Many Central Oregon resort communities sell well above a million dollars. Eagle Crest, just north of Redmond, is one of the exceptions. It offers three golf courses, a sports center, and resort infrastructure at lower price points than most of the region's resorts.</p>$q$, $q$<p>Central Oregon resort communities rarely price below a million dollars. Eagle Crest, just north of Redmond, is one of the exceptions. It offers three golf courses, a sports center, and resort infrastructure at price points that would buy a condo in most other resort communities.</p>$q$) where slug = 'eagle-crest-affordable-resort-redmond';
-- commit;
