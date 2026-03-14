-- Migration 013: RLS Policies
-- Enable RLS on all tables. Public read where listed; authenticated own-row; super_admin full.
-- Section 31 permissions matrix: broker_admin/broker scoped access (implement super_admin here; scoped in app where needed).
-- Service role bypasses RLS by default in Supabase.

-- Helper: true when current user is super_admin (checks admin_roles.role = 'superuser' or profiles.admin_role if present)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles ar
    WHERE LOWER(ar.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
      AND ar.role = 'superuser'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: true when current user is broker_admin or super_admin (broker or superuser in admin_roles)
CREATE OR REPLACE FUNCTION public.is_broker_admin_or_above()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles ar
    WHERE LOWER(ar.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
      AND ar.role IN ('superuser', 'broker')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----- Geographic (public read) -----
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cities" ON cities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin cities" ON cities FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read neighborhoods" ON neighborhoods FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin neighborhoods" ON neighborhoods FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read communities" ON communities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin communities" ON communities FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Properties & Listings (public read) -----
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read properties" ON properties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin properties" ON properties FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read listings" ON listings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin listings" ON listings FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read status_history" ON status_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin status_history" ON status_history FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read price_history" ON price_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin price_history" ON price_history FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Listing Media (public read) -----
ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read listing_photos" ON listing_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin listing_photos" ON listing_photos FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE listing_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read listing_videos" ON listing_videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin listing_videos" ON listing_videos FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Agents & Offices (admin manage; sync uses service role) -----
ALTER TABLE listing_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read listing_agents" ON listing_agents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin listing_agents" ON listing_agents FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE mls_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin mls_members" ON mls_members FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE mls_offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin mls_offices" ON mls_offices FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Profiles (authenticated own row) -----
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admin profiles" ON profiles;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
    CREATE POLICY "Users read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id') THEN
    CREATE POLICY "Users read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
    CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
    CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
  CREATE POLICY "Super admin profiles" ON profiles FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
END $$;

-- ----- Brokers (read public; write admin / own) -----
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read brokers" ON brokers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin brokers" ON brokers FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Broker admin brokers" ON brokers FOR ALL TO authenticated USING (is_broker_admin_or_above()) WITH CHECK (is_broker_admin_or_above());

-- ----- User Engagement (authenticated own rows) -----
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own saved_listings" ON saved_listings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin saved_listings" ON saved_listings FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own saved_searches" ON saved_searches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin saved_searches" ON saved_searches FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own user_activities" ON user_activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Insert user_activities" ON user_activities FOR INSERT TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Super admin user_activities" ON user_activities FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read engagement_metrics" ON engagement_metrics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin engagement_metrics" ON engagement_metrics FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE shared_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read shared_collections" ON shared_collections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users own shared_collections" ON shared_collections FOR ALL TO authenticated USING (auth.uid() = creator_user_id) WITH CHECK (auth.uid() = creator_user_id);
CREATE POLICY "Super admin shared_collections" ON shared_collections FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Valuations & Reporting (public read for reporting/trending) -----
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin valuations" ON valuations FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE valuation_comps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin valuation_comps" ON valuation_comps FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE reporting_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reporting_cache" ON reporting_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin reporting_cache" ON reporting_cache FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE broker_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin broker_stats" ON broker_stats FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE trending_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trending_scores" ON trending_scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin trending_scores" ON trending_scores FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- CRM & Notifications -----
ALTER TABLE fub_contacts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin fub_contacts_cache" ON fub_contacts_cache FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin email_campaigns" ON email_campaigns FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own notification_queue" ON notification_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin notification_queue" ON notification_queue FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- AI & Content -----
ALTER TABLE ai_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin ai_content" ON ai_content FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE agent_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin agent_insights" ON agent_insights FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published blog_posts" ON blog_posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Super admin blog_posts" ON blog_posts FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Third Party Cache & Reviews -----
ALTER TABLE listing_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin listing_schools" ON listing_schools FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE listing_amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin listing_amenities" ON listing_amenities FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE census_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read census_data" ON census_data FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin census_data" ON census_data FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read visible reviews" ON reviews FOR SELECT TO anon, authenticated USING (is_hidden = false);
CREATE POLICY "Super admin reviews" ON reviews FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE page_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read page_images" ON page_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin page_images" ON page_images FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----- Infrastructure -----
ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin sync_checkpoints" ON sync_checkpoints FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin job_runs" ON job_runs FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE open_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read open_houses" ON open_houses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin open_houses" ON open_houses FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin settings" ON settings FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
