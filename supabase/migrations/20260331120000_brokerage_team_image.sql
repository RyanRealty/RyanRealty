-- Team / social proof image for homepage (separate from hero). Editable in Admin → Site pages.

ALTER TABLE brokerage_settings
  ADD COLUMN IF NOT EXISTS team_image_url text;

COMMENT ON COLUMN brokerage_settings.team_image_url IS 'Homepage social proof section team photo. When set, used in the testimonials block; otherwise falls back to hero image or static /images/team.png.';
