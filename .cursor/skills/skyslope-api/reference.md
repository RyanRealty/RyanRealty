# SkySlope reference links

## Fully executed (what that means for Ryan Realty work)

**Fully executed** is a **human transaction file standard**, not something API metadata or raw PDF text extraction can certify.

For a given instrument (OREF or otherwise), treat it as **fully executed** only when **all** of the following are true after review by someone who is expert in **Oregon OREF**, **SkySlope checklist expectations**, and **Oregon brokerage practice** (typically a principal broker, transaction coordinator, or compliance reviewer):

1. **Parties are identified and match the deal** — You can name the **buyer(s)** and **seller(s)** (or entities) the document purports to bind, and they match the accepted offer / counter chain and escrow instructions for **this** property.
2. **Required signatures and initials are complete** — Every line the form marks as requiring signature, initial, or date (including addenda and counter pages) is satisfied **for the correct parties** (not blank, not the wrong signatory, not an obvious placeholder).
3. **Signature validity is credible** — Wet signatures look authentic for the context; e-sign (DigiSign, DocuSign, etc.) audit trails or completion certificates align with the parties and timeline SkySlope shows.
4. **OREF and brokerage completeness** — All **statutorily and contractually required** attachments and disclosures for **this** transaction stage are present (e.g. pamphlets, advisories, addenda referenced by the RSA, HOA/title packages where required). Missing or wrong-version forms mean the packet is **not** fully executed for file purposes even if one page has a signature.
5. **No unresolved SkySlope checklist gaps** — SkySlope activity status (“Required”, “In Review”, etc.) is a **workflow** signal; it does not replace (4), but persistent “Required” with no doc often means the file is incomplete.

**What LLMs and scripts can do:** inventory documents, sort timelines, flag keywords, count e-sign markers, and compare filenames to expected OREF numbers. **What they cannot do:** substitute for the review above, interpret Oregon law for a specific fact pattern, or guarantee that every required initial exists on every page of a flattened PDF.

When this repo’s audit script emits labels like `e_sign_vendor_markers_present`, read that strictly as **“text layer contains vendor stamps”**, not as **“fully executed.”**

---

| Topic | URL |
|-------|-----|
| Listings/Sales API Redoc (swagger UI) | https://api-latest.skyslope.com/api/docs/redoc/index.html?url=/swagger/v1/swagger.json |
| Swagger JSON | https://api-latest.skyslope.com/swagger/v1/swagger.json |
| Example: HMAC login (Node) | https://github.com/cybercoinc/skyslope-example-authentication |
| Example: bulk export | https://github.com/cybercoinc/skyslope-bulk-export-api |
| Forms Partnership API | https://forms.skyslope.com/partner/api/docs |
| Offers API | https://offers.skyslope.com/offers-api/reference |
| SkySlope support | https://support.skyslope.com/hc/en-us |
| Open API ecosystem (overview article) | https://skyslope.com/general/unlocking-the-power-of-your-data/ |

## Login hosts (confirm per your agreement)

- `https://api-latest.skyslope.com/auth/login`
- `https://api.skyslope.com/auth/login` (legacy/alternate; verify with SkySlope if latest fails)
