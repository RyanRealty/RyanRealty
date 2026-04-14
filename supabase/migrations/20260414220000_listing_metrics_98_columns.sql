-- =============================================================================
-- Phase 2: Add 98 new columns to listings table
-- Tier 2 (promoted from JSONB) → Tier 1 (generated) → Tier 3 (computed)
-- Order matters: generated columns reference Tier 2 base columns
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 2: Promoted from details JSONB (65 regular columns)
-- Written by the unified mapper on every sync
-- ─────────────────────────────────────────────────────────────────────────────

-- Property Basics (7)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_sub_type text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS year_built smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS levels text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS architectural_style text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS new_construction_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_attached_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS foundation_details text;

-- Structure & Dimensions (8)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS building_area_total numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS above_grade_finished_area numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS below_grade_finished_area numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS stories_total smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rooms_total smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS construction_materials text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS roof text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS basement_yn boolean;

-- Lot & Exterior (11)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lot_size_acres numeric(12,4);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lot_size_sqft numeric(12,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lot_features text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pool_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS spa_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fireplace_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fireplaces_total smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fencing text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS waterfront_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS horse_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS direction_faces text;

-- Parking (5)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS garage_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS garage_spaces smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS carport_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS carport_spaces smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS parking_total smallint;

-- Systems (4)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS heating_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS cooling_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sewer text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS water text;

-- Bathrooms (2)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS baths_full smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS baths_half smallint;

-- Financial (9)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS tax_annual_amount numeric(12,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS tax_assessed_value numeric(14,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS tax_year smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS association_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS association_fee numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS association_fee_frequency text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS hoa_monthly numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS buyer_financing text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS concessions_amount numeric(10,2);

-- Location & Schools (10)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS elementary_school text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS middle_school text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS high_school text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS school_district text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS view_description text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS parcel_number text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS walk_score smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS cross_street text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS irrigation_water_rights_yn boolean;

-- Dates (8)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pending_timestamp timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS purchase_contract_date date;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS off_market_date date;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS original_entry_timestamp timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status_change_timestamp timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_contract_date date;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS original_on_market_timestamp timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS back_on_market_timestamp timestamptz;

-- Agent & Office (5)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS list_agent_email text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS list_agent_mls_id text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS buyer_agent_name text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS buyer_agent_mls_id text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS buyer_office_name text;

-- Media & Marketing (5)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS photos_count smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS public_remarks text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS virtual_tour_url text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS home_warranty_yn boolean;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS senior_community_yn boolean;


-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 1: Computed columns (17 — regular columns, computed by unified mapper)
-- Originally planned as GENERATED ALWAYS AS STORED, but 627K-row computation
-- timed out on ADD COLUMN. The unified mapper computes these on every sync,
-- and the backfill migration populates them for existing data.
-- ─────────────────────────────────────────────────────────────────────────────

-- Pricing Ratios (9)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_sqft numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS close_price_per_sqft numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sale_to_list_ratio numeric(6,4);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sale_to_final_list_ratio numeric(6,4);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS total_price_change_pct numeric(8,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS total_price_change_amt numeric(12,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_acre numeric(14,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_bedroom numeric(12,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_room numeric(12,2);

-- Property Analysis (4)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_age smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sqft_efficiency numeric(6,4);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS bed_bath_ratio numeric(4,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS above_grade_pct numeric(5,4);

-- HOA & Tax (3)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS hoa_annual_cost numeric(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS hoa_pct_of_price numeric(6,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS tax_rate numeric(6,4);

-- Estimated Monthly PITI (1)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS estimated_monthly_piti numeric(10,2);


-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 3: Computed from related tables (16 regular columns)
-- Written by application code during sync, not auto-computed
-- ─────────────────────────────────────────────────────────────────────────────

-- Price History Metrics (5)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_drop_count smallint DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_increase_count smallint DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS total_price_changes smallint DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS largest_price_drop_pct numeric(6,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS days_since_last_price_change smallint;

-- Status History Metrics (5)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS days_to_pending smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS days_pending_to_close smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS was_relisted boolean DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS back_on_market_count smallint DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status_change_count smallint DEFAULT 0;

-- Market Positioning (3)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS dom_percentile numeric(5,4);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_percentile numeric(5,4);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_quality_score smallint;

-- Engagement (3)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS save_count integer DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS inquiry_count integer DEFAULT 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- COLUMN COMMENTS (every new column documented for AI agent discoverability)
-- ─────────────────────────────────────────────────────────────────────────────

-- Tier 2: Property Basics
COMMENT ON COLUMN listings.property_sub_type IS 'Promoted from details JSONB (PropertySubType). E.g., Single Family Residence, Townhouse, Condo.';
COMMENT ON COLUMN listings.year_built IS 'Promoted from details JSONB (YearBuilt). Year the property was originally constructed.';
COMMENT ON COLUMN listings.levels IS 'Promoted from details JSONB (Levels). E.g., One, Two, Three Or More, Split Level.';
COMMENT ON COLUMN listings.architectural_style IS 'Promoted from details JSONB (ArchitecturalStyle). E.g., Ranch, Colonial, Contemporary.';
COMMENT ON COLUMN listings.new_construction_yn IS 'Promoted from details JSONB (NewConstructionYN). True if newly built, never occupied.';
COMMENT ON COLUMN listings.property_attached_yn IS 'Promoted from details JSONB (PropertyAttachedYN). True if attached to another structure (townhome, duplex).';
COMMENT ON COLUMN listings.foundation_details IS 'Promoted from details JSONB (FoundationDetails). E.g., Concrete Perimeter, Slab, Crawl Space.';

-- Tier 2: Structure & Dimensions
COMMENT ON COLUMN listings.building_area_total IS 'Promoted from details JSONB (BuildingAreaTotal). Total building area in sqft including all floors.';
COMMENT ON COLUMN listings.above_grade_finished_area IS 'Promoted from details JSONB (AboveGradeFinishedArea). Finished living area above ground level in sqft.';
COMMENT ON COLUMN listings.below_grade_finished_area IS 'Promoted from details JSONB (BelowGradeFinishedArea). Finished basement area in sqft.';
COMMENT ON COLUMN listings.stories_total IS 'Promoted from details JSONB (StoriesTotal). Number of above-grade stories.';
COMMENT ON COLUMN listings.rooms_total IS 'Promoted from details JSONB (RoomsTotal). Total room count excluding bathrooms.';
COMMENT ON COLUMN listings.construction_materials IS 'Promoted from details JSONB (ConstructionMaterials). E.g., Frame, Brick, Stone, Stucco.';
COMMENT ON COLUMN listings.roof IS 'Promoted from details JSONB (Roof). E.g., Composition, Metal, Tile, Shake.';
COMMENT ON COLUMN listings.basement_yn IS 'Promoted from details JSONB (BasementYN). True if property has a basement.';

-- Tier 2: Lot & Exterior
COMMENT ON COLUMN listings.lot_size_acres IS 'Promoted from details JSONB (LotSizeAcres). Lot size in acres.';
COMMENT ON COLUMN listings.lot_size_sqft IS 'Promoted from details JSONB (LotSizeSquareFeet). Lot size in square feet.';
COMMENT ON COLUMN listings.lot_features IS 'Promoted from details JSONB (LotFeatures). E.g., Corner Lot, Cul-De-Sac, Landscaped.';
COMMENT ON COLUMN listings.pool_yn IS 'Promoted from details JSONB (PoolYN). True if property has a pool.';
COMMENT ON COLUMN listings.spa_yn IS 'Promoted from details JSONB (SpaYN). True if property has a spa/hot tub.';
COMMENT ON COLUMN listings.fireplace_yn IS 'Promoted from details JSONB (FireplaceYN). True if property has at least one fireplace.';
COMMENT ON COLUMN listings.fireplaces_total IS 'Promoted from details JSONB (FireplacesTotal). Number of fireplaces.';
COMMENT ON COLUMN listings.fencing IS 'Promoted from details JSONB (Fencing). E.g., Full, Partial, Chain Link, Privacy.';
COMMENT ON COLUMN listings.waterfront_yn IS 'Promoted from details JSONB (WaterfrontYN). True if on a waterfront (lake, river, ocean).';
COMMENT ON COLUMN listings.horse_yn IS 'Promoted from details JSONB (HorseYN). True if property is suitable for horses.';
COMMENT ON COLUMN listings.direction_faces IS 'Promoted from details JSONB (DirectionFaces). Direction front of home faces. E.g., North, South.';

-- Tier 2: Parking
COMMENT ON COLUMN listings.garage_yn IS 'Promoted from details JSONB (GarageYN). True if property has a garage.';
COMMENT ON COLUMN listings.garage_spaces IS 'Promoted from details JSONB (GarageSpaces). Number of garage spaces.';
COMMENT ON COLUMN listings.carport_yn IS 'Promoted from details JSONB (CarportYN). True if property has a carport.';
COMMENT ON COLUMN listings.carport_spaces IS 'Promoted from details JSONB (CarportSpaces). Number of carport spaces.';
COMMENT ON COLUMN listings.parking_total IS 'Promoted from details JSONB (ParkingTotal). Total parking spaces (garage + carport + open).';

-- Tier 2: Systems
COMMENT ON COLUMN listings.heating_yn IS 'Promoted from details JSONB (HeatingYN). True if property has a heating system.';
COMMENT ON COLUMN listings.cooling_yn IS 'Promoted from details JSONB (CoolingYN). True if property has air conditioning.';
COMMENT ON COLUMN listings.sewer IS 'Promoted from details JSONB (Sewer). E.g., Public Sewer, Septic Tank, None.';
COMMENT ON COLUMN listings.water IS 'Promoted from details JSONB (Water). E.g., Public, Well, Irrigation District.';

-- Tier 2: Bathrooms
COMMENT ON COLUMN listings.baths_full IS 'Promoted from details JSONB (BathsFull). Number of full bathrooms (toilet + sink + tub/shower).';
COMMENT ON COLUMN listings.baths_half IS 'Promoted from details JSONB (BathsHalf). Number of half bathrooms (toilet + sink only).';

-- Tier 2: Financial
COMMENT ON COLUMN listings.tax_annual_amount IS 'Promoted from details JSONB (TaxAmount). Annual property tax amount in dollars.';
COMMENT ON COLUMN listings.tax_assessed_value IS 'Promoted from details JSONB (TaxAssessedValue). County-assessed property value for tax purposes.';
COMMENT ON COLUMN listings.tax_year IS 'Promoted from details JSONB (TaxYear). Year of the tax assessment.';
COMMENT ON COLUMN listings.association_yn IS 'Promoted from details JSONB (AssociationYN). True if property is in an HOA.';
COMMENT ON COLUMN listings.association_fee IS 'Promoted from details JSONB (AssociationFee). Raw HOA fee amount (see association_fee_frequency for period).';
COMMENT ON COLUMN listings.association_fee_frequency IS 'Promoted from details JSONB (AssociationFeeFrequency). E.g., Monthly, Quarterly, Annually.';
COMMENT ON COLUMN listings.hoa_monthly IS 'Normalized monthly HOA cost. Computed from association_fee / association_fee_frequency by the mapper.';
COMMENT ON COLUMN listings.buyer_financing IS 'Promoted from details JSONB (BuyerFinancing). E.g., Cash, Conventional, FHA, VA. For closed listings.';
COMMENT ON COLUMN listings.concessions_amount IS 'Promoted from details JSONB (ConcessionsAmount). Dollar amount of seller concessions at closing.';

-- Tier 2: Location & Schools
COMMENT ON COLUMN listings.county IS 'Promoted from details JSONB (CountyOrParish). County name.';
COMMENT ON COLUMN listings.elementary_school IS 'Promoted from details JSONB (ElementarySchool). Assigned elementary school name.';
COMMENT ON COLUMN listings.middle_school IS 'Promoted from details JSONB (MiddleOrJuniorSchool). Assigned middle school name.';
COMMENT ON COLUMN listings.high_school IS 'Promoted from details JSONB (HighSchool). Assigned high school name.';
COMMENT ON COLUMN listings.school_district IS 'Promoted from details JSONB (SchoolDistrict). School district name.';
COMMENT ON COLUMN listings.view_description IS 'Promoted from details JSONB (View). E.g., Mountain(s), Lake, City, Golf Course.';
COMMENT ON COLUMN listings.parcel_number IS 'Promoted from details JSONB (ParcelNumber). County assessor parcel number (APN).';
COMMENT ON COLUMN listings.walk_score IS 'Promoted from details JSONB (WalkScore). Walk Score 0-100 if provided by MLS.';
COMMENT ON COLUMN listings.cross_street IS 'Promoted from details JSONB (CrossStreet). Nearest cross street for location reference.';
COMMENT ON COLUMN listings.irrigation_water_rights_yn IS 'Promoted from details JSONB (IrrigationWaterRightsYN). True if property includes irrigation water rights.';

-- Tier 2: Dates
COMMENT ON COLUMN listings.pending_timestamp IS 'Promoted from details JSONB (PendingTimestamp). When listing went to pending/under contract.';
COMMENT ON COLUMN listings.purchase_contract_date IS 'Promoted from details JSONB (PurchaseContractDate). Date the purchase contract was signed.';
COMMENT ON COLUMN listings.off_market_date IS 'Promoted from details JSONB (OffMarketDate). Date listing was taken off market.';
COMMENT ON COLUMN listings.original_entry_timestamp IS 'Promoted from details JSONB (OriginalEntryTimestamp). When listing was first entered into MLS.';
COMMENT ON COLUMN listings.status_change_timestamp IS 'Promoted from details JSONB (StatusChangeTimestamp). When StandardStatus last changed.';
COMMENT ON COLUMN listings.listing_contract_date IS 'Promoted from details JSONB (ListingContractDate). Date of listing agreement between seller and agent.';
COMMENT ON COLUMN listings.original_on_market_timestamp IS 'Promoted from details JSONB (OriginalOnMarketTimestamp). Original on-market date (for relist detection).';
COMMENT ON COLUMN listings.back_on_market_timestamp IS 'Promoted from details JSONB (BackOnMarketTimestamp). When listing returned to market after withdrawal/cancel.';

-- Tier 2: Agent & Office
COMMENT ON COLUMN listings.list_agent_email IS 'Promoted from details JSONB (ListAgentEmail). Listing agent email address.';
COMMENT ON COLUMN listings.list_agent_mls_id IS 'Promoted from details JSONB (ListAgentMlsId). Listing agent MLS member ID.';
COMMENT ON COLUMN listings.buyer_agent_name IS 'Promoted from details JSONB (BuyerAgentName). Buyer agent full name (populated on closed listings).';
COMMENT ON COLUMN listings.buyer_agent_mls_id IS 'Promoted from details JSONB (BuyerAgentMlsId). Buyer agent MLS member ID.';
COMMENT ON COLUMN listings.buyer_office_name IS 'Promoted from details JSONB (BuyerOfficeName). Buyer brokerage name.';

-- Tier 2: Media & Marketing
COMMENT ON COLUMN listings.photos_count IS 'Promoted from details JSONB (PhotosCount). Number of listing photos.';
COMMENT ON COLUMN listings.public_remarks IS 'Promoted from details JSONB (PublicRemarks). Public marketing description text.';
COMMENT ON COLUMN listings.virtual_tour_url IS 'Promoted from details JSONB (VirtualTourURLUnbranded). Unbranded virtual tour URL.';
COMMENT ON COLUMN listings.home_warranty_yn IS 'Promoted from details JSONB (HomeWarrantyYN). True if home warranty is included/offered.';
COMMENT ON COLUMN listings.senior_community_yn IS 'Promoted from details JSONB (SeniorCommunityYN). True if in a 55+ senior community.';

-- Tier 1: Generated columns
COMMENT ON COLUMN listings.price_per_sqft IS 'GENERATED: ListPrice / TotalLivingAreaSqFt. Use for price comparison sorting and search filters.';
COMMENT ON COLUMN listings.close_price_per_sqft IS 'GENERATED: ClosePrice / TotalLivingAreaSqFt. For closed listing comp analysis.';
COMMENT ON COLUMN listings.sale_to_list_ratio IS 'GENERATED: ClosePrice / OriginalListPrice. Values >1.0 = sold over asking. Only meaningful for closed listings.';
COMMENT ON COLUMN listings.sale_to_final_list_ratio IS 'GENERATED: ClosePrice / ListPrice (final asking). Compares to last listed price, not original.';
COMMENT ON COLUMN listings.total_price_change_pct IS 'GENERATED: (ListPrice - OriginalListPrice) / OriginalListPrice * 100. Negative = price reduction.';
COMMENT ON COLUMN listings.total_price_change_amt IS 'GENERATED: ListPrice - OriginalListPrice. Dollar amount of total price change.';
COMMENT ON COLUMN listings.price_per_acre IS 'GENERATED: ListPrice / lot_size_acres. Land value comparison metric.';
COMMENT ON COLUMN listings.price_per_bedroom IS 'GENERATED: ListPrice / BedroomsTotal. Per-bedroom affordability metric.';
COMMENT ON COLUMN listings.price_per_room IS 'GENERATED: ListPrice / rooms_total. Per-room value metric.';
COMMENT ON COLUMN listings.property_age IS 'GENERATED: current_year - year_built. Property age in years.';
COMMENT ON COLUMN listings.sqft_efficiency IS 'GENERATED: TotalLivingAreaSqFt / lot_size_sqft. Building density ratio (higher = more building per land).';
COMMENT ON COLUMN listings.bed_bath_ratio IS 'GENERATED: BedroomsTotal / BathroomsTotal. Layout balance metric.';
COMMENT ON COLUMN listings.above_grade_pct IS 'GENERATED: above_grade_finished_area / building_area_total. Fraction of living space above ground.';
COMMENT ON COLUMN listings.hoa_annual_cost IS 'GENERATED: hoa_monthly * 12. Annual HOA cost for budgeting.';
COMMENT ON COLUMN listings.hoa_pct_of_price IS 'GENERATED: (hoa_monthly * 12) / ListPrice * 100. HOA as percentage of purchase price.';
COMMENT ON COLUMN listings.tax_rate IS 'GENERATED: tax_annual_amount / tax_assessed_value * 100. Effective property tax rate percentage.';
COMMENT ON COLUMN listings.estimated_monthly_piti IS 'GENERATED: Estimated monthly payment = P&I (6.5%, 20% down, 30yr) + taxes/12 + insurance + HOA. Update rate via ALTER TABLE.';

-- Tier 3: Computed columns
COMMENT ON COLUMN listings.price_drop_count IS 'Tier 3: Number of price reductions from price_history. Updated by delta sync.';
COMMENT ON COLUMN listings.price_increase_count IS 'Tier 3: Number of price increases from price_history. Updated by delta sync.';
COMMENT ON COLUMN listings.total_price_changes IS 'Tier 3: Total price changes (drops + increases) from price_history. Updated by delta sync.';
COMMENT ON COLUMN listings.largest_price_drop_pct IS 'Tier 3: Largest single price reduction percentage. MIN(change_pct) from price_history.';
COMMENT ON COLUMN listings.days_since_last_price_change IS 'Tier 3: Days since most recent price change. Stale indicator for active listings.';
COMMENT ON COLUMN listings.days_to_pending IS 'Tier 3: Days from on-market to first pending status. Key market speed metric.';
COMMENT ON COLUMN listings.days_pending_to_close IS 'Tier 3: Days from pending to close. Measures escrow/closing timeline.';
COMMENT ON COLUMN listings.was_relisted IS 'Tier 3: True if listing was canceled/expired then relisted as Active. From status_history transitions.';
COMMENT ON COLUMN listings.back_on_market_count IS 'Tier 3: Number of times listing returned to Active after non-Active status.';
COMMENT ON COLUMN listings.status_change_count IS 'Tier 3: Total status transitions from status_history.';
COMMENT ON COLUMN listings.dom_percentile IS 'Tier 3: PERCENT_RANK of DOM within same City+PropertyType active set. 0.9 = slower than 90% of comparable listings.';
COMMENT ON COLUMN listings.price_percentile IS 'Tier 3: PERCENT_RANK of ListPrice within same City+PropertyType+Beds active set. 0.75 = more expensive than 75%.';
COMMENT ON COLUMN listings.listing_quality_score IS 'Tier 3: 0-100 score based on photos_count, virtual tour, remarks length, open houses. Marketing effort indicator.';
COMMENT ON COLUMN listings.view_count IS 'Tier 3: Total page views from engagement_metrics. Updated periodically.';
COMMENT ON COLUMN listings.save_count IS 'Tier 3: Number of users who saved/favorited this listing. From engagement_metrics.';
COMMENT ON COLUMN listings.inquiry_count IS 'Tier 3: Number of buyer inquiries received. From listing_inquiries count.';
