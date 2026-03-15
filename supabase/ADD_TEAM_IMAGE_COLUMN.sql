-- Run this once in Supabase Dashboard → SQL Editor to fix "Could not find team_image_url column".
-- Adds the team image URL column so Admin → Site pages → Team image upload works.

ALTER TABLE brokerage_settings
  ADD COLUMN IF NOT EXISTS team_image_url text;

COMMENT ON COLUMN brokerage_settings.team_image_url IS 'Homepage social proof section team photo. When set, used in the testimonials block; otherwise falls back to hero image or static /images/team.png.';
