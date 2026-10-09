# FSBO sources: findings and next steps (2026-10-09, WIP)

## 1. Zillow FSBO scraper: nothing seen since 2026-09-01

**Root cause:** the Apify actor `maxcopell~zillow-scraper` changed its output on **2026-09-01**. Its changelog says: "The output now has only the mapped fields. Zillow raw fields that the mapping does not use are removed."

`parseZillowItem` in `lib/fsbo-detector.ts` reads the old raw fields: `detailUrl`/`url`/`hdpUrl`, `address`/`streetAddress`, `unformattedPrice`/`price`, `latLong`, `imgSrc`, `listingProvidedBy`. With those gone, `canonicalUrl()` returns null, so every item is dropped without a warning. `scrapeZillowCity` returns `[]` with no error, so `scrape_errors` stays empty.

There was no code change around Sep 1. The last commits to this code were on Aug 19 and Oct 5.

**New output fields** (from the actor's README):
- `propertyUrl`, `zpid`
- `listingAddress{street,city,state,zipCode,full}`, `listingPrice{amount}`
- `coordinates{latitude,longitude}`, `mainImage`
- `bedrooms`, `bathrooms`, `livingArea`, `lotArea{value,unit}`
- `daysOnZillow`, `homeType`
- `listingType{isFSBO,isFSBA,...}`, `broker{name,phoneNumber}`

**Fix (not yet coded):**
1. In `parseZillowItem`, accept the mapped shape: URL from `propertyUrl`, address from `listingAddress`, price from `listingPrice.amount`, lat/long from `coordinates`, photo from `mainImage`, lot from `lotArea`, converting acres to sqft when `unit` is acres.
   - Reject `listingType.isFSBO === false`.
   - Keep the old raw keys as a fallback.
2. In the actor input, add `resultsLimit: 100`. The documented cap is `resultsLimit`; `maxItems` is not in the current schema, so runs may be uncapped, which costs more per result.
3. Make shape drift visible: when the actor returns items but none parse, push `zillow <city>: N items, 0 parsed (actor output shape changed?)` into `errors` and log a warning. Do the same for non-200 responses, which today are only logged.
4. Add a unit test with the README sample item. It should parse as an FSBO listing, be rejected as FSBA, and trigger the drift error.

This needs no new key, no paid tier change and no new ToS decision: it's the same actor and the same account. After merge and deploy, the 09:35 UTC cron should refresh `last_seen_at` on any 653-class rows that are still live and flip them back to `active`. That happens in `lib/fsbo-processor.ts`, where seen URLs get `status: 'active'`.

**Not verified:** I could not read the Vercel runtime logs because the Vercel MCP connection isn't authorized for team `team_zwYQPapH0CpleD7RzJ7WctGO`. I also did not check the Apify account's credit status, since that would mean using the token.

## 2. Craigslist owner lookup: placeholders stay `pending`

**Root cause: by design, not a bug.** `lib/fsbo-craigslist.ts` only parses the static list view and never fetches detail pages. Titles rarely carry a street, so `streetAddress` is `''`. The processor skips the county and skip-trace owner lookup when the street is empty, to keep garbage out. All 13 active rows are placeholders like this.

**This needs Matt's decision before any code:**
- Getting an address means fetching each Craigslist posting's detail page for the map's lat/long or the address. That is more automated access than today's single search fetch, so it needs a call on Craigslist's terms.
- Contact details sit behind Craigslist's reply relay or CAPTCHA and can't be fetched.
- Any lookup from lat/long would go through the county records plus the BatchData chain, which is paid per lookup and carries the BatchData terms questions.

**Options for Matt:**
- (a) Allow detail-page fetches, at most N per day, for lat/long only, then look up the parcel from the county by coordinates.
- (b) Keep the list view only, and show placeholders in their own "needs address" bucket instead of Blocked.
- (c) Drop Craigslist rows that have no street address.
