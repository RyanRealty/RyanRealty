# Transaction-summary data sources

When to read: building or extending a transaction-summary `.txt` or
Broker Notes PDF; the `/api/files/sales/{guid}` response is missing a
field you need; cross-referencing SkySlope data against MLS data;
encountering a sale-price discrepancy.

## Source per field

| Field | Source |
|---|---|
| Listing price (original + final) | **Spark API** `StandardFields.OriginalListPrice` + `ListPrice` (filter `ListingId Eq '<MLS#>'`) — primary. Supabase `listings.*` as fallback when in coverage. |
| Close price (MLS) | **Spark API** `ClosePrice` — primary. Supabase fallback. |
| Sale-to-list ratio | Compute `ClosePrice / ListPrice` from Spark, or read `listings.sale_to_list_ratio` if Supabase has the row. |
| Listing agent name + firm | **Spark API** `ListAgentFullName` + `ListOfficeName`. |
| Buyer agent name + firm | **Spark API** `BuyerAgentFullName` + `BuyerOfficeName`. *Critical — do NOT assume Ryan Realty was dual agent; the Spark BuyerAgent field is the authoritative truth.* |
| Subdivision + year built | **Spark API** `SubdivisionName` + `YearBuilt`. |
| Beds / baths / sqft | **Spark API** `BedroomsTotal` + `BathroomsTotalDecimal` + `LivingArea`. |
| Escrow company + officer + phone + email | `/api/files/sales/{guid}` `sale.escrowContact` (firstName + lastName + email + company). If empty (closed-folder API often returns null), parse the EM Receipt's `claudeReasoning` field in `report.jsonl` for `Western Title & Escrow Company / signed by <Name> (escrow officer)`. |
| Lender + loan officer | `/api/files/sales/{guid}` `sale.lenderContact` |
| Other-side agent contact | `/api/files/sales/{guid}` `sale.otherSideAgentContact` |
| Earnest money amount | Read the EM Receipt PDF (FUNDS IN THE AMOUNT OF: $). Also captured in `report.jsonl` `claudeReasoning` post-OCR. |
| Escrow file # | Read the EM Receipt PDF (FILE NO.: ...) — also appears in Prelim Title (Order No:) + ALTA Settlement (File No.:). Mirrored in `sale.escrowNumber`. |
| Settlement officer | Read the ALTA Settlement Statement (Officer/Escrow Officer:) |
| Commission % + gross | `/api/files/sales/{guid}` `sale.commission` (saleCommissionPercent + officeGrossCommissionOnSale). Often null on closed folders — fall back to ALTA Settlement PDF. |

## Spark API is the primary MLS source

Use Spark before Supabase. The Supabase `listings` table only covers
the MLS feeds the Ryan Realty platform syncs (currently Deschutes /
Crook counties); Jefferson County (Madras), Wasco, Hood River, and
out-of-region listings are NOT in Supabase but ARE in Spark.

**Spark query template:**

```js
// Direct REST (works from .mjs scripts — no TS import dance)
const base = process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
const filter = encodeURIComponent(`ListingId Eq '${mlsNumber}'`)
const r = await fetch(`${base}/listings?_pagination=1&_page=1&_limit=1&_filter=${filter}`, {
  headers: { Authorization: `Bearer ${process.env.SPARK_API_KEY}`, Accept: 'application/json' },
})
const result = (await r.json()).D?.Results?.[0]
const f = result?.StandardFields
```

The Spark filter field is `ListingId` (NOT `ListNumber` or `MlsNumber`)
— SparkQL's REST field naming is from the BBO standard. Supabase
mirrors this into `ListNumber`.

Existing repo helper: [lib/spark.ts](../../../../lib/spark.ts)
`fetchSparkListingsPage()` — usable from `.ts` scripts via tsx. For
`.mjs` scripts, use the direct REST snippet above (avoiding the
.ts import barrier).

## Supabase column quirk

If using Supabase fallback: `listings` uses mixed-case names that need
double-quoting. Use `ListNumber` (NOT `ListingId`) as the MLS# key. See
[docs/DATABASE_FOR_AI_AGENTS.md](../../../../docs/DATABASE_FOR_AI_AGENTS.md).

## Sale-price reconciliation

- SkySlope `sale.salePrice` may be the **net price** after seller
  credit.
- MLS `ClosePrice` is the **gross sale price**.
- A $30k delta usually means seller credit toward buyer closing costs
  (or similar).
- **Always state both values + the reason** in the summary; never
  claim the SkySlope value if it disagrees with MLS without
  explanation.

This rule is also embedded in the Broker Notes generation contract —
see [broker-notes-generation.md](broker-notes-generation.md) under
"Sale-price reconciliation".
