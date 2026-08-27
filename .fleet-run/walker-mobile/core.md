RUN-TOKEN: 266404d1e1ead874

# Fleet case pack: core

Generated live 2026-08-19T14:08:33.623Z from the durable work graph (deploy a6558109fb45).
RUN-TOKEN identifies this pack version. If it matches your previous run of this pack, the pack text is unchanged — do not re-POST identical pack findings. Then continue the rest of the job your live brief names. Only Flow Prover ends the run on a flows-pack token match (do not re-submit). Regression Certifier ignores this line and always runs every case.
Run each case at BOTH viewports unless your bot brief narrows it: mobile 390 wide first, then desktop 1280.
Rails (non-negotiable, also in your bot brief): browse signed-out on production only; LOOK never touch (Flow Prover's four flow submits with the designated fleet identity are the only exception anywhere); no admin; facts only.

### core-home

- URL: https://ryan-realty.com/
- Expected: Search door present and usable. Six town doors (Bend, La Pine, Redmond, Sunriver, Sisters, Terrebonne) each with a photograph, each opening its city page. Live market pulse numbers render (no zeros, no placeholders). One primary CTA per viewport.
- If observed differs from expected: report ONE finding per distinct defect (case id core-home).

### core-search

- URL: https://ryan-realty.com/homes-for-sale
- Expected: Omnibox, filter chips (Beds/Baths/Price/More), Save search and Alerts controls, a result count with sort, and map+list in lockstep. Filtering changes both the list and the pins. No console errors visible in page behavior (blank sections, dead buttons).
- If observed differs from expected: report ONE finding per distinct defect (case id core-search).

### core-listing

- URL: https://ryan-realty.com/homes-for-sale
- Expected: Open the first listing card. Detail page opens on a real photo hero (video shows UNMUTE top-right when present), price + beds/baths/sqft + address, listing agent attribution block (ODS), price/status history, similar listings, and a working contact CTA. LOOK do not touch: never submit the contact form.
- If observed differs from expected: report ONE finding per distinct defect (case id core-listing).

### core-sell

- URL: https://ryan-realty.com/sell
- Expected: Step 1 asks for the address only. Advancing shows step 2 asking email (required) and phone (optional). CTA language is "Value my home" style, never a "what is my home worth?" question on a button. STOP at the final submit — never submit (Flow Prover owns submits).
- If observed differs from expected: report ONE finding per distinct defect (case id core-sell).

### core-places

- URL: https://ryan-realty.com/neighborhoods
- Expected: Neighborhood index renders with real active counts per area (numbers differ by area, no zeros-everywhere). Each tile opens its neighborhood page. Repeat for /subdivisions. On the place page, count shown matches the listings visible within a reasonable margin and every place name is a working door.
- If observed differs from expected: report ONE finding per distinct defect (case id core-places).

### core-market

- URL: https://ryan-realty.com/housing-market
- Expected: Market hub renders live figures with methodology/freshness stamps. Any months-of-supply verdict label matches its number (4 or less seller, 4 to 6 balanced, 6 or more buyer). Charts draw as charts (no number-dump tables, no dead polylines).
- If observed differs from expected: report ONE finding per distinct defect (case id core-market).

### core-sitemap

- URL: https://ryan-realty.com/sitemap.xml
- Expected: Sitemap index lists child sitemaps; open two children — listing and geo URLs present and a spot-checked URL from each returns a real page (not 404/empty shell).
- If observed differs from expected: report ONE finding per distinct defect (case id core-sitemap).
