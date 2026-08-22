# Data coverage index

**Auto-generated — do not hand-edit.** `node scripts/gen-data-coverage-index.mjs`

Answers the question that a schema dump cannot: **what else holds this same entity,
and how much of it does it cover?** Read this BEFORE concluding that anything is
missing, unrecoverable, or not tracked. CLAUDE.md §0 forbids reporting absence from a
single query shape; this index is where the second, differently-shaped check starts.

`DEAD` = zero rows. `THIN` = under 1% coverage of the parent. Never build on either
without saying so out loud.

## Entity: listing

Parent table `listings` — **595,377 rows**, keyed `ListingKey`.

| Table | Key column | Rows | Rows per parent row | Freshness | Flag |
|---|---|---:|---:|---|---|
| `listing_history` | `listing_key` | 3,901,379 | 6.55 | 2026-08-22 |  |
| `beacon_comparable_listings_v` | `listingkey` | 595,377 | 1.00 | — |  |
| `listing_tile_mv_src` | `listing_key` | 595,265 | 1.00 | — |  |
| `listing_tile_mv` | `listing_key` | 595,216 | 1.00 | — |  |
| `listing_private` | `listing_key` | 594,877 | 1.00 | 2026-08-22 |  |
| `price_history` | `listing_key` | 355,077 | 0.60 | 2026-08-22 |  |
| `analytics_v_closed_sale_co` | `listing_key` | 192,812 | 0.32 | — |  |
| `sale_pricing_price_steps` | `listing_key` | 160,448 | 0.27 | — |  |
| `sale_pricing_facts` | `listing_key` | 149,402 | 0.25 | — |  |
| `sale_pricing_seller_net` | `listing_key` | 149,402 | 0.25 | — |  |
| `sale_pricing_facts_sfr` | `listing_key` | 124,059 | 0.21 | — |  |
| `activity_events` | `listing_key` | 36,460 | 0.06 | 2026-08-22 |  |
| `listing_boundary_xref_mv_src` | `listing_key` | 21,219 | 0.04 | — |  |
| `listing_boundary_xref_mv` | `listing_key` | 21,093 | 0.04 | — |  |
| `status_history` | `listing_key` | 17,009 | 0.03 | 2026-08-22 |  |
| `engagement_metrics` | `listing_key` | 15,234 | 0.03 | 2026-08-22 |  |
| `listing_search_mv_src` | `listing_key` | 9,604 | 0.02 | — |  |
| `listing_search_mv` | `listing_key` | 9,555 | 0.02 | — |  |
| `user_events` | `listing_key` | 9,041 | 0.02 | 2026-08-22 |  |
| `listing_photos` | `listing_key` | 4,124 | 0.01 | 2026-04-04 | **THIN** |
| `dscr_rent_estimates` | `listing_key` | 3,229 | 0.01 | 2026-08-03 | **THIN** |
| `expired_listings` | `listing_key` | 314 | 0.00 | 2026-08-22 | **THIN** |
| `listing_agents` | `listing_key` | 216 | 0.00 | 2026-04-04 | **THIN** |
| `listing_pricing_reads` | `listing_key` | 200 | 0.00 | 2026-08-22 | **THIN** |
| `crm_deals` | `listing_key` | 21 | 0.00 | 2026-07-18 | **THIN** |
| `open_houses` | `listing_key` | 20 | 0.00 | 2026-04-03 | **THIN** |
| `likes` | `listing_key` | 6 | 0.00 | 2026-04-05 | **THIN** |
| `saved_listings` | `listing_key` | 5 | 0.00 | 2026-08-13 | **THIN** |
| `hidden_listings` | `listing_key` | 1 | 0.00 | 2026-07-28 | **THIN** |
| `listing_videos` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_detail_mv` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `cma_document_registrations` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_alert_queue` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_inquiries` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_photo_classifications` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_shares` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_sync_status` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listing_views` | `listing_key` | 0 | 0.00 | — | **DEAD** |
| `listings_historical` | `listingkey` | 0 | 0.00 | — | **DEAD** |
| `sale_pricing_water_reclass_queue` | `listing_key` | 0 | 0.00 | — | **DEAD** |

**Dead tables for this entity (zero rows):** `listing_videos`, `listing_detail_mv`, `cma_document_registrations`, `listing_alert_queue`, `listing_inquiries`, `listing_photo_classifications`, `listing_shares`, `listing_sync_status`, `listing_views`, `listings_historical`, `sale_pricing_water_reclass_queue`.
A dead table is not evidence that the data does not exist — check the covered tables above first.

## Entity: parcel / property

Parent table `properties` — **7,251 rows**, keyed `parcel_number`.

| Table | Key column | Rows | Rows per parent row | Freshness | Flag |
|---|---|---:|---:|---|---|
| `listings` | `parcel_number` | 595,377 | 82.11 | — |  |
| `beacon_comparable_listings_v` | `parcel_number` | 595,377 | 82.11 | — |  |

## Entity: person / contact

Parent table `crm_people` — **23,054 rows**, keyed `id`.

| Table | Key column | Rows | Rows per parent row | Freshness | Flag |
|---|---|---:|---:|---|---|
| `crm_timeline` | `person_id` | 100,333 | 4.35 | — |  |
| `visitor_sessions` | `crm_person_id` | 78,261 | 3.39 | — |  |
| `crm_contact_points` | `person_id` | 39,032 | 1.69 | — |  |
| `westside_parcels` | `person_id` | 17,665 | 0.77 | — |  |
| `crm_conversation_participant` | `person_id` | 8,447 | 0.37 | 2026-08-11 |  |
| `newsletter_subscribers` | `crm_person_id` | 5,346 | 0.23 | 2026-07-30 |  |
| `crm_suppressions` | `person_id` | 5,183 | 0.22 | 2026-08-19 |  |
| `crm_broker_alerts` | `person_id` | 1,026 | 0.04 | 2026-08-22 |  |
| `email_events` | `person_id` | 895 | 0.04 | 2026-08-22 |  |
| `crm_tasks` | `person_id` | 702 | 0.03 | 2026-08-22 |  |
| `cmas` | `person_id` | 341 | 0.01 | 2026-08-22 |  |
| `visitor_identity_map` | `crm_person_id` | 170 | 0.01 | 2026-08-21 | **THIN** |
| `crm_relationships` | `person_id` | 61 | 0.00 | — | **THIN** |
| `crm_sequence_enrollments` | `person_id` | 37 | 0.00 | 2026-08-22 | **THIN** |
| `crm_conversation_state` | `person_id` | 24 | 0.00 | 2026-08-12 | **THIN** |
| `crm_deal_people` | `person_id` | 24 | 0.00 | 2026-07-18 | **THIN** |
| `crm_deals` | `person_id` | 21 | 0.00 | 2026-07-18 | **THIN** |
| `meta_audience_removal_queue` | `person_id` | 21 | 0.00 | — | **THIN** |
| `listing_alerts` | `crm_person_id` | 19 | 0.00 | 2026-08-22 | **THIN** |
| `crm_message_drafts` | `person_id` | 14 | 0.00 | 2026-08-16 | **THIN** |
| `crm_report_subscriptions` | `person_id` | 4 | 0.00 | 2026-08-20 | **THIN** |
| `broker_price_opinions` | `person_id` | 3 | 0.00 | 2026-07-12 | **THIN** |
| `saved_searches` | `crm_person_id` | 2 | 0.00 | 2026-07-07 | **THIN** |
| `guest_search_alerts` | `crm_person_id` | 1 | 0.00 | 2026-07-07 | **THIN** |
| `cma_document_registrations` | `person_id` | 0 | 0.00 | — | **DEAD** |
| `crm_appointments` | `person_id` | 0 | 0.00 | — | **DEAD** |
| `crm_people_collaborators` | `person_id` | 0 | 0.00 | — | **DEAD** |
| `crm_person_files` | `person_id` | 0 | 0.00 | — | **DEAD** |
| `crm_short_links` | `person_id` | 0 | 0.00 | — | **DEAD** |
| `profiles` | `crm_person_id` | 0 | 0.00 | — | **DEAD** |
| `referral_receivables` | `person_id` | 0 | 0.00 | — | **DEAD** |
| `tc_deal_people` | `person_id` | 0 | 0.00 | — | **DEAD** |

**Dead tables for this entity (zero rows):** `cma_document_registrations`, `crm_appointments`, `crm_people_collaborators`, `crm_person_files`, `crm_short_links`, `profiles`, `referral_receivables`, `tc_deal_people`.
A dead table is not evidence that the data does not exist — check the covered tables above first.

---

Generated 2026-08-22.
