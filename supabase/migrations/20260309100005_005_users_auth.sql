-- Migration 005: Users & Auth
-- Profiles extend auth.users; brokers link to profiles. Section 6, Section 31 roles.
-- Note: If you have an existing profiles table with user_id as PK, add: id uuid REFERENCES auth.users(id)
-- and backfill id from user_id, then use id as the primary key (or run these migrations on a fresh DB).

-- Profiles (extends Supabase auth.users; one row per user)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  display_name text,
  email text,
  phone text,
  admin_role text CHECK (admin_role IN ('super_admin', 'broker_admin', 'broker', 'viewer')),
  buyer_preferences jsonb,
  notification_preferences jsonb,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Extended profile per auth.users. admin_role for admin backend access.';

-- If profiles already existed with user_id as PK, add id and backfill so RLS helpers (is_super_admin) work
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id') THEN
    ALTER TABLE profiles ADD COLUMN id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    UPDATE profiles SET id = user_id;
    ALTER TABLE profiles ALTER COLUMN id SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_id_legacy ON profiles(id);
  END IF;
END $$;

-- Brokers (site brokers; profile_id links to profiles)
CREATE TABLE IF NOT EXISTS brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  bio text,
  tagline text,
  specialties text[],
  designations text[],
  years_experience integer,
  license_number text,
  mls_id text,
  headshot_url text,
  service_area_communities text[],
  social_instagram text,
  social_facebook text,
  social_linkedin text,
  social_x text,
  social_youtube text,
  social_tiktok text,
  zillow_id text,
  realtor_id text,
  yelp_id text,
  google_business_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE brokers IS 'Broker profiles. profile_id links to auth; nullable for manual/imported brokers.';
