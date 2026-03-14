-- Broker profile extensions: tagline, specialties, designations, years_experience, social links.
-- Step 10 notes: support these on BrokerCard, BrokerHero, BrokerBio when present.

ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS specialties text[],
  ADD COLUMN IF NOT EXISTS designations text[],
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_linkedin text,
  ADD COLUMN IF NOT EXISTS social_youtube text,
  ADD COLUMN IF NOT EXISTS social_tiktok text;

COMMENT ON COLUMN brokers.tagline IS 'Short tagline for broker hero.';
COMMENT ON COLUMN brokers.specialties IS 'e.g. First-time buyers, Luxury, Land.';
COMMENT ON COLUMN brokers.designations IS 'e.g. CRS, GRI.';
COMMENT ON COLUMN brokers.years_experience IS 'Years in real estate (optional).';
COMMENT ON COLUMN brokers.social_instagram IS 'Instagram profile URL.';
