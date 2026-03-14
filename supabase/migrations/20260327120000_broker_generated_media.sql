-- Broker-generated media: Synthesia intro videos and saved photos. Save, edit (title), delete; set any video as broker intro.
CREATE TABLE IF NOT EXISTS broker_generated_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video', 'photo')),
  url text NOT NULL,
  title text,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('synthesia', 'upload')),
  external_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_generated_media_broker_id ON broker_generated_media (broker_id);
COMMENT ON TABLE broker_generated_media IS 'Videos and photos generated or uploaded for brokers (e.g. Synthesia intro videos). One can be set as broker intro_video_url.';
