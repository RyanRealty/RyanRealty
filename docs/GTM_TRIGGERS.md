# GTM triggers and dataLayer events

Use this doc to configure Google Tag Manager triggers and tags. All events are pushed to `window.dataLayer` from [lib/tracking.ts](lib/tracking.ts).

## Events

| dataLayer event       | When to fire              | Suggested GTM trigger   | Use for                          |
|-----------------------|---------------------------|--------------------------|-----------------------------------|
| `listing_view`        | User views a listing page | Custom Event = listing_view | GA4 view_item, Meta ViewContent  |
| `search_view`         | User views search/geo     | Custom Event = search_view  | GA4 view_search_results, Meta Search |
| `listing_click`       | User clicks a listing tile| Custom Event = listing_click | GA4, Meta ViewContent            |
| `saved_property`      | User saves a listing      | Custom Event = saved_property | GA4 generate_lead, Meta Lead     |
| `sign_up`             | User completes sign-up   | Custom Event = sign_up      | GA4, Meta CompleteRegistration   |
| `view_item`           | Ecommerce (with listing_view) | Same as listing_view   | GA4 ecommerce                    |
| `view_search_results` | With search_view          | Same as search_view         | GA4                              |
| `generate_lead`       | With saved_property (method: save_listing) | Same as saved_property | GA4                               |

## Custom dimensions (event parameters)

- `listing_key`, `listing_url`, `city`, `state`, `mls_number`, `value`, `currency`, `bedrooms`, `bathrooms` (listing_view, listing_click, saved_property)
- `search_term`, `subdivision`, `results_count` (search_view)
- `source_page` (listing_click)

## Trigger setup

1. Create a Custom Event trigger for each event name above (e.g. Event name equals `listing_view`).
2. Map dataLayer variables to GA4 dimensions or Meta parameters as needed.
3. For FUB identity bridge, use the same events to fire a tag that passes identity (e.g. from cookie or dataLayer) when present.
