-- Add Attractions and Places to eat (dining) tab content for subdivisions.
ALTER TABLE subdivision_descriptions
  ADD COLUMN IF NOT EXISTS attractions text,
  ADD COLUMN IF NOT EXISTS dining text;

COMMENT ON COLUMN subdivision_descriptions.attractions IS 'AI-generated attractions / things to do for subdivision page tab.';
COMMENT ON COLUMN subdivision_descriptions.dining IS 'AI-generated places to eat / dining for subdivision page tab.';
