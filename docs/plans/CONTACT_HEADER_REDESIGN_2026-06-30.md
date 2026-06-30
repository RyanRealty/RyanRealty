# Contact-page header redesign (2026-06-30)

Matt's ask: kill the "dumb" Memberships section. Put **everything at the top by the
name** — big PFP, Name/Email/Phone, and quick actions (newsletter, automations,
saved searches, market reports). Comms immediately below. An owned-home card with a
single thumbnail + address + Generate-comp. PFP ~1/3 of mobile width, no wrapping.

Built in `components/console/LeadTabs.tsx`, `components/admin/crm/ContactQuickActions.tsx`,
`components/admin/crm/OwnedHomeCard.tsx`, and `app/admin/console/leads/[id]/page.tsx`.

## Shipped (each committed + verified at 375px and 1440px)

1. **Header — big PFP + name/email/phone** (commit 30b2e473). PFP is a `w-1/3
   max-w-[150px]` square (114px on mobile, capped 150px on desktop), never wraps
   (shrink-0 PFP + truncating text column). Name, email, phone sit beside it. Default
   tab is now **Comms**, so the landing is header → comms.
2. **Quick-action chips** (commit 4afbc881). A clean pill row by the name replaces the
   Memberships card:
   - **Newsletter** — one tap subscribes/unsubscribes (`setNewsletterSubscription`).
     Verified end-to-end: clicking it wrote an `active` `newsletter_subscribers` row.
   - **Automations** — bottom sheet to pick a workflow to enroll
     (`setSequenceEnrollment`); chip shows the enrolled count. Verified: sheet lists
     the 4 active workflows with toggles.
   - **Saved searches** — sheet listing them with View links; chip shows count.
   - **Market reports** — sheet with the areas/frequency/on-off panel; chip checks
     when active.
3. **Owned-home card** (commit c24c0dcf). When the contact owns a home: a single
   thumbnail (MLS photo → street view → placeholder) + address + beds/baths/sqft +
   an "On the market" note, and **Generate comp** → flips to **Review comp**
   (`/cma-drafts/<id>`) + **Send to lead** once the CMA draft is built (reuses the
   existing startCma/sendCma flow). Verified on lead 12679 (real house photo +
   "1694 NW Fields St" + "3 bed · 3 bath · 2,080 sqft").
4. **Removed the dumb Memberships card + the duplicate "Home they own" detail card**
   (commit 03d2dec4) and their dead imports. The Info tab is now the clean detail
   view (contacts, relationships, custom fields), not a pile of toggles.

## Notes / follow-ups
- The owned-home card renders whenever `nextStep.ownsHome` is true and there's an
  address; the thumbnail falls back to a "No photo" placeholder when neither an MLS
  photo nor a street view is available.
- One pre-existing unused-var warning remains in the page
  (`saveContactCustomFieldsAction`) — not introduced by this work.
- The Homes/watching tab still holds the detailed saved-search assign/edit/delete
  forms + report panel; the chips are the quick-access path to the same data.
