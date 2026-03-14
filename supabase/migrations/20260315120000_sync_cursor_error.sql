-- Store last sync error on cursor so UI can show "Last error" without losing position.
ALTER TABLE sync_cursor ADD COLUMN IF NOT EXISTS error text;
COMMENT ON COLUMN sync_cursor.error IS 'Last error message from Spark or sync; cleared when a new run starts.';
