# Entity optimization for SEO and SGE/AI Overviews

This doc is the single reference for how key entities appear in schema.org JSON-LD and meta tags so the site is optimized for search and AI Overviews (SGE).

## Entities

- **Ryan Realty** — Root `RealEstateAgent` and `WebSite` with `SearchAction` in [components/JsonLd.tsx](components/JsonLd.tsx). Name, areaServed (GeoCircle Central Oregon), sameAs (social URLs when set).
- **Listings** — Each listing page outputs `Product` + `Offer` + `Place` and `RealEstateListing` with `offeredBy` (RealEstateAgent when ListAgentName/ListOfficeName exist), `amenityFeature` from listings.amenities when present. See [components/listing/ListingJsonLd.tsx](components/listing/ListingJsonLd.tsx).
- **Brokers** — Team profile pages output `Person`/`RealEstateAgent` with name, image, url, worksFor (brokerage). Brokers table: display_name, title, bio, photo_url, email, phone.
- **Cities and subdivisions** — Search pages output `WebPage`, `BreadcrumbList`, `Place`, `ItemList`. Resort communities additionally get Resort/GolfCourse/AmenityFeature via [ResortCommunityJsonLd](app/search/[...slug]/ResortCommunityJsonLd.tsx).
- **Market reports** — Report pages use appropriate schema for Article/Report and BreadcrumbList.

## Consistency rules

- Use the same organization name ("Ryan Realty") in all JsonLd and meta tags.
- Broker and listing agent names should match exactly between listing detail, team page, and schema.
- Key phrases (e.g. "homes for sale in Bend", "Central Oregon real estate") appear in titles, descriptions, and schema where relevant.

## SGE / AI Overviews

- Ensure every entity has a clear `name` and `description` or `url` so AI can cite the site.
- Keep required and recommended schema.org properties populated; avoid empty optional arrays.
