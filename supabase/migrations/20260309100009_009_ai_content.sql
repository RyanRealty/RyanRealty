-- Migration 009: AI & Content
-- AI-generated content, agent insights, blog posts. Section 6, 14.

CREATE TABLE IF NOT EXISTS ai_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  content_type text NOT NULL,
  content_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  generated_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_content IS 'AI-generated content per entity (description, faq, etc). status: draft/approved/published.';

CREATE TABLE IF NOT EXISTS agent_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'pending',
  data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_insights IS 'AI optimization agent insights (pending/approved/dismissed/implemented).';

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text,
  excerpt text,
  author_broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL,
  category text,
  tags text[] DEFAULT '{}',
  hero_image_url text,
  seo_title text,
  seo_description text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE blog_posts IS 'Blog posts. status=draft|published; RLS allows public read where status=published.';
