-- Migration 001: Core Geographic Tables
-- Cities, neighborhoods, communities. PostGIS enabled for boundary_geojson / future spatial use.
-- Ref: MASTER_PLAN Section 6 (Data Architecture), PLATFORM_REQUIREMENTS_v25.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Cities (state-level geographic unit)
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  state text NOT NULL,
  description text,
  hero_image_url text,
  hero_video_url text,
  boundary_geojson jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cities IS 'Cities (e.g. Bend). Slug used in URLs: /cities/bend-or.';

-- Neighborhoods (belong to a city)
CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
  description text,
  hero_image_url text,
  boundary_geojson jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE neighborhoods IS 'Neighborhoods within a city. FK to cities.';

-- Communities (subdivisions; may be resort)
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  hero_image_url text,
  hero_video_url text,
  boundary_geojson jsonb,
  is_resort boolean NOT NULL DEFAULT false,
  resort_content jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE communities IS 'Subdivisions/communities (e.g. Tetherow, Crosswater). is_resort drives resort content.';
