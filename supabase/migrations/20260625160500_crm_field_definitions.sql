-- CRM custom-field registry (in-house CRM, FUB replacement).
--
-- crm_people.custom is a free-form jsonb bag of per-contact key/value pairs
-- carried over from Follow Up Boss (FUB ships 64 typed custom fields). The jsonb
-- alone has no schema: the UI cannot know a key is a number vs a date, what its
-- human label is, what order to render it in, or whether it is select-typed with a
-- fixed option set. This table is that schema layer over the jsonb bag.
--
-- One row per logical custom field. The contact-card Details section and the
-- saved-view AST custom-condition builder read this registry to type, label, and
-- order the values they pull off crm_people.custom. Deleting a definition removes
-- ONLY the schema row, never the underlying values in custom jsonb (a definition
-- can be re-added later and the data is still there).
create table if not exists public.crm_field_definitions (
  id            bigserial   primary key,
  -- The jsonb key inside crm_people.custom this definition describes. Stable,
  -- unique, machine-readable (e.g. 'leadScore'). Never renamed in place.
  key           text        not null unique,
  -- Human label shown in the UI (e.g. 'Lead Score').
  label         text        not null,
  -- Value type the UI uses to render + coerce the stored jsonb value.
  type          text        not null
                  check (type in ('text', 'number', 'date', 'select')),
  -- For type = 'select': the allowed options [{ value, label }, ...]. Empty for
  -- the other types.
  options       jsonb       not null default '[]'::jsonb,
  -- Render order within the contact card (ascending). Ties break on label.
  position      int         not null default 0,
  -- When true, the card omits this field for a contact whose custom value is empty.
  hide_if_empty boolean     not null default false,
  -- When true, the UI renders the value but never offers an editor for it (it is
  -- written by a system path, e.g. a computed lead score).
  read_only     boolean     not null default false,
  -- Optional grouping label so the card can section fields (e.g. 'Buyer', 'Seller').
  field_group   text,
  -- Protected definitions cannot be deleted via the action (load-bearing system
  -- fields the platform writes to, e.g. lead score / CMA delivery).
  is_protected  boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The card render reads every definition once, ordered. The unique(key) already
-- creates a btree on key; this index serves the ordered list render.
create index if not exists crm_field_definitions_position_idx
  on public.crm_field_definitions (position, label);

comment on table public.crm_field_definitions is
  'Schema/registry layer over the free-form crm_people.custom jsonb bag. One row per logical custom field: its type, label, order, options, and flags. Deleting a row drops only the definition, never the underlying custom-jsonb values.';
comment on column public.crm_field_definitions.key is
  'The jsonb key inside crm_people.custom this definition describes (e.g. leadScore). Stable + unique.';
comment on column public.crm_field_definitions.type is
  'Value type for render/coercion: text | number | date | select.';
comment on column public.crm_field_definitions.options is
  'For select-typed fields: [{ value, label }, ...]. Empty for other types.';
comment on column public.crm_field_definitions.is_protected is
  'Protected system fields cannot be deleted via the CRM action.';

-- Seed the registry from the known FUB custom-field set (docs/FUB_CUSTOM_FIELDS.md
-- + docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md). FUB exposes 64 custom fields; this
-- seeds ~35 representative ones with type inferred from those audits. The rest
-- backfill from the live custom jsonb in a later data pass. Keys mirror the FUB
-- API keys with the redundant 'custom' prefix stripped (the jsonb already lives
-- under the 'custom' column), so e.g. customLeadScore -> leadScore.
--
-- on conflict (key) do nothing keeps this migration idempotent and never clobbers
-- a label/type an admin has since edited.
insert into public.crm_field_definitions
  (key, label, type, position, field_group, is_protected, read_only) values
  -- ── Lead scoring (system-written) ──────────────────────────────────────────
  ('leadScore',             'Lead Score',              'number',  10, 'Engagement', true,  true ),
  ('sellerScore',           'Seller Score',            'number',  11, 'Engagement', true,  true ),
  ('leadTier',              'Lead Tier',               'text',    12, 'Engagement', true,  true ),
  ('engagementStreakDays',  'Engagement Streak Days',  'number',  13, 'Engagement', false, true ),
  ('lastActiveDate',        'Last Active Date',        'date',    14, 'Engagement', false, true ),
  ('totalListingsViewed',   'Listings Viewed',         'number',  15, 'Engagement', false, true ),
  ('totalListingsSaved',    'Listings Saved',          'number',  16, 'Engagement', false, true ),
  ('cmaDownloads',          'CMA Downloads',           'number',  17, 'Engagement', false, true ),
  -- ── Buyer profile ───────────────────────────────────────────────────────────
  ('buyerBudgetMin',        'Buyer Budget Min',        'number',  20, 'Buyer',      false, false),
  ('buyerBudgetMax',        'Buyer Budget Max',        'number',  21, 'Buyer',      false, false),
  ('buyerSearchAreas',      'Buyer Search Areas',      'text',    22, 'Buyer',      false, false),
  ('preferredCommunities',  'Preferred Communities',   'text',    23, 'Buyer',      false, false),
  ('preferredBeds',         'Preferred Beds',          'number',  24, 'Buyer',      false, false),
  ('preferredBaths',        'Preferred Baths',         'number',  25, 'Buyer',      false, false),
  ('preferredPropertyType', 'Preferred Property Type', 'text',    26, 'Buyer',      false, false),
  ('moveTimeline',          'Move Timeline',           'text',    27, 'Buyer',      false, false),
  -- ── Seller profile ──────────────────────────────────────────────────────────
  ('isSellerCurious',       'Seller Curious',          'select',  30, 'Seller',     false, false),
  ('sellerPropertyAddress', 'Seller Property Address', 'text',    31, 'Seller',     false, false),
  ('marketValue',           'Market Value',            'number',  32, 'Seller',     false, false),
  ('equityPercent',         'Equity Percent',          'number',  33, 'Seller',     false, false),
  ('yearsOwned',            'Years Owned',             'number',  34, 'Seller',     false, false),
  -- ── Property / ownership facts ───────────────────────────────────────────────
  ('purchasePrice',         'Purchase Price',          'number',  40, 'Property',   false, false),
  ('purchaseDate',          'Purchase Date',           'date',    41, 'Property',   false, false),
  ('yearBuilt',             'Year Built',              'number',  42, 'Property',   false, false),
  ('bedrooms',              'Bedrooms',                'number',  43, 'Property',   false, false),
  ('baths',                 'Baths',                   'number',  44, 'Property',   false, false),
  ('neighborhood',          'Neighborhood',            'text',    45, 'Property',   false, false),
  ('subdivision',           'Subdivision',             'text',    46, 'Property',   false, false),
  ('propertyType',          'Property Type',           'text',    47, 'Property',   false, false),
  -- ── Listing facts ────────────────────────────────────────────────────────────
  ('mlsNumber',             'MLS Number',              'text',    50, 'Listing',    false, false),
  ('listingStatus',         'Listing Status',          'text',    51, 'Listing',    false, false),
  ('listingDaysOnMarket',   'Listing Days On Market',  'number',  52, 'Listing',    false, false),
  ('originalListPrice',     'Original List Price',     'number',  53, 'Listing',    false, false),
  ('listingExpiredDate',    'Listing Expired Date',    'date',    54, 'Listing',    false, false),
  -- ── CMA delivery (system-written) ────────────────────────────────────────────
  ('cmaPdfUrl',             'CMA PDF URL',             'text',    60, 'CMA',        true,  true ),
  ('cmaDeliveredAt',        'CMA Delivered At',        'date',    61, 'CMA',        true,  true ),
  -- ── Relationship / lifecycle dates ───────────────────────────────────────────
  ('birthday',              'Birthday',                'date',    70, 'Personal',   false, false),
  ('homeAnniversary',       'Home Anniversary',        'date',    71, 'Personal',   false, false),
  ('closingAnniversary',    'Closing Anniversary',     'date',    72, 'Personal',   false, false),
  ('organization',          'Organization',            'text',    73, 'Personal',   false, false),
  ('website',               'Website',                 'text',    74, 'Personal',   false, false)
on conflict (key) do nothing;

-- The one select-typed seed (isSellerCurious) gets its yes/no options. Done as a
-- follow-up update so the bulk insert stays uniform; idempotent on the key.
update public.crm_field_definitions
   set options = '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'::jsonb
 where key = 'isSellerCurious' and options = '[]'::jsonb;
