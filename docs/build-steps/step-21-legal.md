# Build Step 21: Legal Pages, Fair Housing & Compliance

Scope: Security, compliance, privacy, terms, fair housing, DMCA, MLS attribution.

## TASK 1: Privacy Policy Page
Create src/app/(public)/privacy/page.tsx:
- Comprehensive privacy policy covering:
  - What data we collect (personal info, browsing activity, cookies, device info)
  - How we use it (personalization, lead routing, analytics, email notifications)
  - Third-party sharing (FUB for CRM, Resend for email, GA4 for analytics, Meta for advertising)
  - Cookie policy (types: essential, analytics, marketing; how to manage)
  - Data retention periods
  - CCPA rights (California): right to know, right to delete, right to opt-out of sale, right to non-discrimination
  - Oregon Consumer Privacy Act rights (effective July 2025): right to access, correct, delete, opt-out of targeted advertising
  - How to exercise rights: email address, response timeframe (45 days)
  - Children's privacy (we don't knowingly collect from under 13)
  - Updates to policy
  - Contact information
- Use the AI Assist to generate the initial draft, then review for accuracy
- Last updated date displayed prominently
- SEO: noindex (privacy pages shouldn't compete in search)

## TASK 2: Terms of Service Page
Create src/app/(public)/terms/page.tsx:
- Terms covering:
  - Acceptance of terms
  - Account registration and responsibilities
  - MLS data usage (IDX terms: data is for personal, non-commercial use)
  - Property information disclaimer (not guaranteed accurate, verify independently)
  - Automated valuation disclaimer (CMA is an estimate, not an appraisal)
  - User conduct (no scraping, no commercial use of data, no harassment)
  - Intellectual property (our content is copyrighted)
  - Third-party links
  - Limitation of liability
  - Indemnification
  - Governing law (Oregon)
  - Dispute resolution
  - Termination
  - Contact information
- SEO: noindex

## TASK 3: Fair Housing Page
Create src/app/(public)/fair-housing/page.tsx:
- Equal Housing Opportunity statement
- Fair Housing Act summary (protected classes: race, color, religion, sex, national origin, familial status, disability)
- Oregon-specific protections (additional protected classes under Oregon law)
- "If you believe you have been discriminated against, contact HUD" with link and phone number
- Ryan Realty's commitment to fair housing
- Large Equal Housing Opportunity logo

## TASK 4: DMCA Policy Page
Create src/app/(public)/dmca/page.tsx:
- DMCA notice and takedown procedure
- Designated agent contact information
- How to file a complaint (required elements of a DMCA notice)
- Counter-notification procedure

## TASK 5: MLS Attribution Component
Create src/components/legal/MLSAttribution.tsx:
- Oregon Data Share logo (image stored locally or in Supabase Storage)
- Attribution text per ODS Rules Sections 5-3/5-4 (placeholder text until Matt provides verbatim text)
- "Listing data provided by Oregon Data Share. All information deemed reliable but not guaranteed."
- Last data update timestamp
- This component MUST appear on EVERY page that displays MLS data (listing pages, search results, community pages, city pages, broker pages with listings)
- Render in footer or as a section at the bottom of listing content

## TASK 6: Equal Housing Component
Create src/components/legal/EqualHousing.tsx:
- Equal Housing Opportunity logo (small)
- Appears in the footer of every page and in every email template
- Also appears on the Fair Housing page (larger)

## TASK 7: Lead-Based Paint Auto-Note
Create src/components/listing/LeadPaintNotice.tsx:
- Automatically displays on any listing where year_built < 1978
- Text: "Homes built before 1978 may contain lead-based paint. Learn more." with link to EPA info
- Required by federal law for pre-1978 properties
- Small, non-intrusive notice below property details

## TASK 8: Oregon Real Estate Disclosure
Create src/components/legal/OregonDisclosure.tsx:
- Agency disclosure disclaimer required by OREA
- Text about brokerage licensing
- Matt's license number display
- Appears in footer or on about/contact pages

## TASK 9: Accessibility Statement Page
Create src/app/(public)/accessibility/page.tsx:
- Ryan Realty's commitment to web accessibility
- WCAG 2.1 Level AA conformance target
- Known limitations (if any)
- How to report accessibility issues
- Contact information
- Third-party accessibility audit date (when performed)

## TASK 10: Footer Legal Links
Update src/components/layout/Footer.tsx:
- Add links to all legal pages: Privacy Policy, Terms of Service, Fair Housing, DMCA, Accessibility
- Equal Housing logo always visible
- MLS Attribution always visible
- Copyright: "© 2026 Ryan Realty. All rights reserved."

TypeScript strict. No any types. Use design system components. Legal pages should have clean, readable typography with proper heading hierarchy.
