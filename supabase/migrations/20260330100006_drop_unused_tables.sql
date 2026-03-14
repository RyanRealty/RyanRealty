-- Drop tables from the normalized schema (001-013) that have zero usage in app code.
-- Verified by searching all app/, components/, lib/, inngest/ directories.
-- These tables were created speculatively and never wired into the application.

-- Each DROP is guarded with IF EXISTS for safety.

-- MLS directory tables (never queried; agent data comes from listing_agents)
DROP TABLE IF EXISTS mls_members CASCADE;
DROP TABLE IF EXISTS mls_offices CASCADE;

-- Trending scores (never populated or queried; engagement_metrics is used instead)
DROP TABLE IF EXISTS trending_scores CASCADE;

-- FUB contacts cache (never queried; FUB integration uses direct API calls)
DROP TABLE IF EXISTS fub_contacts_cache CASCADE;

-- Third-party enrichment caches (never populated or queried)
DROP TABLE IF EXISTS listing_schools CASCADE;
DROP TABLE IF EXISTS listing_amenities CASCADE;
DROP TABLE IF EXISTS census_data CASCADE;

-- Job runs (never queried; sync tracking uses sync_cursor and sync_checkpoints)
DROP TABLE IF EXISTS job_runs CASCADE;

-- Shared collections (never wired into UI)
DROP TABLE IF EXISTS shared_collections CASCADE;

-- Listing price history from replication schema (listing_history and price_history are used instead)
DROP TABLE IF EXISTS listing_price_history CASCADE;
