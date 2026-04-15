export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _backfill_state: {
        Row: {
          completed_at: string | null
          id: number
          last_key: string
          phase: string
          rows_processed: number
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: number
          last_key?: string
          phase?: string
          rows_processed?: number
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: number
          last_key?: string
          phase?: string
          rows_processed?: number
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          created_at: string
          event_at: string
          event_type: string
          id: string
          listing_key: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          event_at?: string
          event_type: string
          id?: string
          listing_key: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          event_at?: string
          event_type?: string
          id?: string
          listing_key?: string
          payload?: Json | null
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action_type: string
          admin_email: string
          created_at: string
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string | null
          role: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          role?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          role?: string | null
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          broker_id: string | null
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          broker_id?: string | null
          created_at?: string
          email: string
          id?: string
          role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          broker_id?: string | null
          created_at?: string
          email?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_roles_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_insights: {
        Row: {
          created_at: string
          data: Json | null
          description: string | null
          id: string
          insight_type: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          insight_type: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          insight_type?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_content: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content_text: string
          content_type: string
          created_at: string
          entity_id: string
          entity_type: string
          generated_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content_text: string
          content_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          generated_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content_text?: string
          content_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          generated_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      banner_images: {
        Row: {
          attribution: string | null
          created_at: string
          entity_key: string
          entity_type: string
          id: string
          source: string | null
          storage_path: string
        }
        Insert: {
          attribution?: string | null
          created_at?: string
          entity_key: string
          entity_type: string
          id?: string
          source?: string | null
          storage_path: string
        }
        Update: {
          attribution?: string | null
          created_at?: string
          entity_key?: string
          entity_type?: string
          id?: string
          source?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_broker_id: string | null
          category: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          hero_image_url: string | null
          id: string
          published_at: string | null
          scheduled_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_broker_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_broker_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_broker_id_fkey"
            columns: ["author_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_settings: {
        Row: {
          auto_publish_enabled: boolean
          id: string
          max_posts_per_day: number
          updated_at: string
        }
        Insert: {
          auto_publish_enabled?: boolean
          id?: string
          max_posts_per_day?: number
          updated_at?: string
        }
        Update: {
          auto_publish_enabled?: boolean
          id?: string
          max_posts_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      broker_generated_media: {
        Row: {
          broker_id: string
          created_at: string
          external_id: string | null
          id: string
          metadata: Json | null
          source: string
          title: string | null
          type: string
          url: string
        }
        Insert: {
          broker_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          title?: string | null
          type: string
          url: string
        }
        Update: {
          broker_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          title?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_generated_media_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_stats: {
        Row: {
          broker_id: string
          computed_at: string
          created_at: string
          id: string
          metrics: Json
          period_end: string
          period_start: string
          period_type: string
        }
        Insert: {
          broker_id: string
          computed_at?: string
          created_at?: string
          id?: string
          metrics?: Json
          period_end: string
          period_start: string
          period_type: string
        }
        Update: {
          broker_id?: string
          computed_at?: string
          created_at?: string
          id?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          period_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_stats_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      brokerage_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          hero_image_url: string | null
          hero_video_url: string | null
          id: string
          logo_url: string | null
          name: string
          postal_code: string | null
          primary_email: string | null
          primary_phone: string | null
          state: string | null
          tagline: string | null
          team_image_url: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          state?: string | null
          tagline?: string | null
          team_image_url?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          state?: string | null
          tagline?: string | null
          team_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      brokers: {
        Row: {
          bio: string | null
          created_at: string
          designations: string[] | null
          display_name: string
          email: string | null
          google_business_id: string | null
          google_review_url: string | null
          id: string
          intro_video_url: string | null
          is_active: boolean
          license_number: string | null
          mls_id: string | null
          phone: string | null
          photo_url: string | null
          realtor_id: string | null
          saved_headshot_urls: string[] | null
          slug: string
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_x: string | null
          social_youtube: string | null
          sort_order: number
          specialties: string[] | null
          tagline: string | null
          title: string
          updated_at: string
          years_experience: number | null
          yelp_id: string | null
          zillow_id: string | null
          zillow_review_url: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          designations?: string[] | null
          display_name?: string
          email?: string | null
          google_business_id?: string | null
          google_review_url?: string | null
          id?: string
          intro_video_url?: string | null
          is_active?: boolean
          license_number?: string | null
          mls_id?: string | null
          phone?: string | null
          photo_url?: string | null
          realtor_id?: string | null
          saved_headshot_urls?: string[] | null
          slug: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          sort_order?: number
          specialties?: string[] | null
          tagline?: string | null
          title?: string
          updated_at?: string
          years_experience?: number | null
          yelp_id?: string | null
          zillow_id?: string | null
          zillow_review_url?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          designations?: string[] | null
          display_name?: string
          email?: string | null
          google_business_id?: string | null
          google_review_url?: string | null
          id?: string
          intro_video_url?: string | null
          is_active?: boolean
          license_number?: string | null
          mls_id?: string | null
          phone?: string | null
          photo_url?: string | null
          realtor_id?: string | null
          saved_headshot_urls?: string[] | null
          slug?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          sort_order?: number
          specialties?: string[] | null
          tagline?: string | null
          title?: string
          updated_at?: string
          years_experience?: number | null
          yelp_id?: string | null
          zillow_id?: string | null
          zillow_review_url?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          boundary_geojson: Json | null
          created_at: string
          description: string | null
          hero_image_url: string | null
          hero_video_url: string | null
          id: string
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          state: string
          updated_at: string
        }
        Insert: {
          boundary_geojson?: Json | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          state: string
          updated_at?: string
        }
        Update: {
          boundary_geojson?: Json | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          boundary_geojson: Json | null
          city_id: string | null
          created_at: string
          description: string | null
          hero_image_url: string | null
          hero_video_url: string | null
          id: string
          is_resort: boolean
          name: string
          neighborhood_id: string | null
          resort_content: Json | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          boundary_geojson?: Json | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          is_resort?: boolean
          name: string
          neighborhood_id?: string | null
          resort_content?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          boundary_geojson?: Json | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          is_resort?: boolean
          name?: string
          neighborhood_id?: string | null
          resort_content?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      community_engagement_metrics: {
        Row: {
          entity_key: string
          id: string
          like_count: number
          save_count: number
          share_count: number
          updated_at: string
          view_count: number
        }
        Insert: {
          entity_key: string
          id?: string
          like_count?: number
          save_count?: number
          share_count?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          entity_key?: string
          id?: string
          like_count?: number
          save_count?: number
          share_count?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          click_count: number
          created_at: string
          fub_campaign_id: string | null
          id: string
          open_count: number
          sent_at: string | null
          sent_count: number
          subject: string | null
          template_type: string | null
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          fub_campaign_id?: string | null
          id?: string
          open_count?: number
          sent_at?: string | null
          sent_count?: number
          subject?: string | null
          template_type?: string | null
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          fub_campaign_id?: string | null
          id?: string
          open_count?: number
          sent_at?: string | null
          sent_count?: number
          subject?: string | null
          template_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      engagement_metrics: {
        Row: {
          id: string
          like_count: number
          listing_key: string
          save_count: number
          share_count: number
          updated_at: string
          view_count: number
        }
        Insert: {
          id?: string
          like_count?: number
          listing_key: string
          save_count?: number
          share_count?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          id?: string
          like_count?: number
          listing_key?: string
          save_count?: number
          share_count?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      expired_listings: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_source: string | null
          created_at: string
          days_on_market: number | null
          enrichment_notes: string | null
          expired_at: string | null
          full_address: string
          id: string
          list_agent_name: string | null
          list_office_name: string | null
          list_price: number | null
          listing_key: string
          original_list_price: number | null
          owner_name: string | null
          postal_code: string | null
          standard_status: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_source?: string | null
          created_at?: string
          days_on_market?: number | null
          enrichment_notes?: string | null
          expired_at?: string | null
          full_address: string
          id?: string
          list_agent_name?: string | null
          list_office_name?: string | null
          list_price?: number | null
          listing_key: string
          original_list_price?: number | null
          owner_name?: string | null
          postal_code?: string | null
          standard_status?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_source?: string | null
          created_at?: string
          days_on_market?: number | null
          enrichment_notes?: string | null
          expired_at?: string | null
          full_address?: string
          id?: string
          list_agent_name?: string | null
          list_office_name?: string | null
          list_price?: number | null
          listing_key?: string
          original_list_price?: number | null
          owner_name?: string | null
          postal_code?: string | null
          standard_status?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      geo_places: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          name: string
          parent_id: string | null
          slug: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          parent_id?: string | null
          slug: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          parent_id?: string | null
          slug?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_places_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "geo_places"
            referencedColumns: ["id"]
          },
        ]
      }
      headshot_prompts: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      hero_videos: {
        Row: {
          created_at: string
          entity_key: string
          entity_type: string
          id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          entity_type: string
          id?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          entity_type?: string
          id?: string
          storage_path?: string
        }
        Relationships: []
      }
      liked_communities: {
        Row: {
          created_at: string
          entity_key: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          listing_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_key?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_agents: {
        Row: {
          agent_email: string | null
          agent_first_name: string | null
          agent_last_name: string | null
          agent_license: string | null
          agent_mls_id: string | null
          agent_name: string | null
          agent_phone: string | null
          agent_role: string | null
          created_at: string
          id: string
          listing_key: string
          office_mls_id: string | null
          office_name: string | null
          office_phone: string | null
        }
        Insert: {
          agent_email?: string | null
          agent_first_name?: string | null
          agent_last_name?: string | null
          agent_license?: string | null
          agent_mls_id?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          agent_role?: string | null
          created_at?: string
          id?: string
          listing_key: string
          office_mls_id?: string | null
          office_name?: string | null
          office_phone?: string | null
        }
        Update: {
          agent_email?: string | null
          agent_first_name?: string | null
          agent_last_name?: string | null
          agent_license?: string | null
          agent_mls_id?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          agent_role?: string | null
          created_at?: string
          id?: string
          listing_key?: string
          office_mls_id?: string | null
          office_name?: string | null
          office_phone?: string | null
        }
        Relationships: []
      }
      listing_history: {
        Row: {
          created_at: string
          description: string | null
          event: string | null
          event_date: string | null
          id: string
          listing_key: string
          price: number | null
          price_change: number | null
          raw: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event?: string | null
          event_date?: string | null
          id?: string
          listing_key: string
          price?: number | null
          price_change?: number | null
          raw?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event?: string | null
          event_date?: string | null
          id?: string
          listing_key?: string
          price?: number | null
          price_change?: number | null
          raw?: Json | null
        }
        Relationships: []
      }
      listing_inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          listing_address: string | null
          listing_key: string
          listing_url: string | null
          message: string | null
          mls_number: string | null
          name: string | null
          phone: string | null
          type: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          listing_address?: string | null
          listing_key: string
          listing_url?: string | null
          message?: string | null
          mls_number?: string | null
          name?: string | null
          phone?: string | null
          type: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          listing_address?: string | null
          listing_key?: string
          listing_url?: string | null
          message?: string | null
          mls_number?: string | null
          name?: string | null
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      listing_photo_classifications: {
        Row: {
          created_at: string
          id: string
          listing_key: string
          photo_index: number
          photo_url: string | null
          quality_score: number
          tags: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          listing_key: string
          photo_index: number
          photo_url?: string | null
          quality_score?: number
          tags?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          listing_key?: string
          photo_index?: number
          photo_url?: string | null
          quality_score?: number
          tags?: string[]
        }
        Relationships: []
      }
      listing_photos: {
        Row: {
          caption: string | null
          cdn_url: string | null
          classification: string | null
          created_at: string
          id: string
          is_hero: boolean
          listing_key: string
          photo_url: string
          sort_order: number
          source: string | null
        }
        Insert: {
          caption?: string | null
          cdn_url?: string | null
          classification?: string | null
          created_at?: string
          id?: string
          is_hero?: boolean
          listing_key: string
          photo_url: string
          sort_order?: number
          source?: string | null
        }
        Update: {
          caption?: string | null
          cdn_url?: string | null
          classification?: string | null
          created_at?: string
          id?: string
          is_hero?: boolean
          listing_key?: string
          photo_url?: string
          sort_order?: number
          source?: string | null
        }
        Relationships: []
      }
      listing_sync_status: {
        Row: {
          documents_synced: boolean
          floor_plans_synced: boolean
          floplans_synced: boolean
          historical_data_synced: boolean
          history_synced: boolean
          listing_key: string
          notes_synced: boolean
          open_houses_synced: boolean
          photos_synced: boolean
          price_history_synced: boolean
          rental_calendar_synced: boolean
          rooms_synced: boolean
          rules_synced: boolean
          tickets_synced: boolean
          tour_of_homes_synced: boolean
          units_synced: boolean
          updated_at: string
          videos_synced: boolean
          virtual_tours_synced: boolean
        }
        Insert: {
          documents_synced?: boolean
          floor_plans_synced?: boolean
          floplans_synced?: boolean
          historical_data_synced?: boolean
          history_synced?: boolean
          listing_key: string
          notes_synced?: boolean
          open_houses_synced?: boolean
          photos_synced?: boolean
          price_history_synced?: boolean
          rental_calendar_synced?: boolean
          rooms_synced?: boolean
          rules_synced?: boolean
          tickets_synced?: boolean
          tour_of_homes_synced?: boolean
          units_synced?: boolean
          updated_at?: string
          videos_synced?: boolean
          virtual_tours_synced?: boolean
        }
        Update: {
          documents_synced?: boolean
          floor_plans_synced?: boolean
          floplans_synced?: boolean
          historical_data_synced?: boolean
          history_synced?: boolean
          listing_key?: string
          notes_synced?: boolean
          open_houses_synced?: boolean
          photos_synced?: boolean
          price_history_synced?: boolean
          rental_calendar_synced?: boolean
          rooms_synced?: boolean
          rules_synced?: boolean
          tickets_synced?: boolean
          tour_of_homes_synced?: boolean
          units_synced?: boolean
          updated_at?: string
          videos_synced?: boolean
          virtual_tours_synced?: boolean
        }
        Relationships: []
      }
      listing_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          listing_key: string
          sort_order: number
          source: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          listing_key: string
          sort_order?: number
          source?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          listing_key?: string
          sort_order?: number
          source?: string | null
          video_url?: string
        }
        Relationships: []
      }
      listing_views: {
        Row: {
          city: string
          id: string
          listing_key: string
          viewed_at: string
        }
        Insert: {
          city: string
          id?: string
          listing_key: string
          viewed_at?: string
        }
        Update: {
          city?: string
          id?: string
          listing_key?: string
          viewed_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          above_grade_finished_area: number | null
          above_grade_pct: number | null
          amenities: Json | null
          architectural_style: string | null
          association_fee: number | null
          association_fee_frequency: string | null
          association_yn: boolean | null
          back_on_market_count: number | null
          back_on_market_timestamp: string | null
          basement_yn: boolean | null
          BathroomsTotal: number | null
          baths_full: number | null
          baths_half: number | null
          bed_bath_ratio: number | null
          BedroomsTotal: number | null
          below_grade_finished_area: number | null
          building_area_total: number | null
          buyer_agent_mls_id: string | null
          buyer_agent_name: string | null
          buyer_financing: string | null
          buyer_office_name: string | null
          carport_spaces: number | null
          carport_yn: boolean | null
          City: string | null
          close_price_per_sqft: number | null
          CloseDate: string | null
          ClosePrice: number | null
          concessions_amount: number | null
          construction_materials: string | null
          cooling_yn: boolean | null
          county: string | null
          cross_street: string | null
          CumulativeDaysOnMarket: number | null
          days_pending_to_close: number | null
          days_since_last_price_change: number | null
          days_to_pending: number | null
          DaysOnMarket: number | null
          details: Json | null
          direction_faces: string | null
          dom_percentile: number | null
          elementary_school: string | null
          estimated_monthly_piti: number | null
          fencing: string | null
          fireplace_yn: boolean | null
          fireplaces_total: number | null
          foundation_details: string | null
          garage_spaces: number | null
          garage_yn: boolean | null
          has_virtual_tour: boolean
          heating_yn: boolean | null
          high_school: string | null
          history_finalized: boolean
          history_verified_full: boolean
          hoa_annual_cost: number | null
          hoa_monthly: number | null
          hoa_pct_of_price: number | null
          home_warranty_yn: boolean | null
          horse_yn: boolean | null
          inquiry_count: number | null
          irrigation_water_rights_yn: boolean | null
          is_finalized: boolean
          largest_price_drop_pct: number | null
          Latitude: number | null
          levels: string | null
          list_agent_email: string | null
          list_agent_mls_id: string | null
          ListAgentName: string | null
          ListDate: string | null
          listing_contract_date: string | null
          listing_quality_score: number | null
          ListingKey: string | null
          ListNumber: string
          ListOfficeName: string | null
          ListPrice: number | null
          Longitude: number | null
          lot_features: string | null
          lot_size_acres: number | null
          lot_size_sqft: number | null
          media_finalized: boolean
          middle_school: string | null
          mls_source: string
          ModificationTimestamp: string | null
          new_construction_yn: boolean | null
          off_market_date: string | null
          OnMarketDate: string | null
          OpenHouses: Json | null
          original_entry_timestamp: string | null
          original_on_market_timestamp: string | null
          OriginalListPrice: number | null
          parcel_number: string | null
          parking_total: number | null
          pending_timestamp: string | null
          photos_count: number | null
          PhotoURL: string | null
          pool_yn: boolean | null
          PostalCode: string | null
          price_drop_count: number | null
          price_increase_count: number | null
          price_per_acre: number | null
          price_per_bedroom: number | null
          price_per_room: number | null
          price_per_sqft: number | null
          price_percentile: number | null
          property_age: number | null
          property_attached_yn: boolean | null
          property_cluster_id: string | null
          property_sub_type: string | null
          PropertyType: string | null
          public_remarks: string | null
          purchase_contract_date: string | null
          roof: string | null
          rooms_total: number | null
          sale_to_final_list_ratio: number | null
          sale_to_list_ratio: number | null
          save_count: number | null
          school_district: string | null
          senior_community_yn: boolean | null
          sewer: string | null
          spa_yn: boolean | null
          sqft_efficiency: number | null
          StandardStatus: string | null
          State: string | null
          status_change_count: number | null
          status_change_timestamp: string | null
          stories_total: number | null
          StreetName: string | null
          StreetNumber: string | null
          SubdivisionName: string | null
          tax_annual_amount: number | null
          tax_assessed_value: number | null
          tax_rate: number | null
          tax_year: number | null
          total_price_change_amt: number | null
          total_price_change_pct: number | null
          total_price_changes: number | null
          TotalLivingAreaSqFt: number | null
          view_count: number | null
          view_description: string | null
          virtual_tour_url: string | null
          walk_score: number | null
          was_relisted: boolean | null
          water: string | null
          waterfront_yn: boolean | null
          year_built: number | null
        }
        Insert: {
          above_grade_finished_area?: number | null
          above_grade_pct?: number | null
          amenities?: Json | null
          architectural_style?: string | null
          association_fee?: number | null
          association_fee_frequency?: string | null
          association_yn?: boolean | null
          back_on_market_count?: number | null
          back_on_market_timestamp?: string | null
          basement_yn?: boolean | null
          BathroomsTotal?: number | null
          baths_full?: number | null
          baths_half?: number | null
          bed_bath_ratio?: number | null
          BedroomsTotal?: number | null
          below_grade_finished_area?: number | null
          building_area_total?: number | null
          buyer_agent_mls_id?: string | null
          buyer_agent_name?: string | null
          buyer_financing?: string | null
          buyer_office_name?: string | null
          carport_spaces?: number | null
          carport_yn?: boolean | null
          City?: string | null
          close_price_per_sqft?: number | null
          CloseDate?: string | null
          ClosePrice?: number | null
          concessions_amount?: number | null
          construction_materials?: string | null
          cooling_yn?: boolean | null
          county?: string | null
          cross_street?: string | null
          CumulativeDaysOnMarket?: number | null
          days_pending_to_close?: number | null
          days_since_last_price_change?: number | null
          days_to_pending?: number | null
          DaysOnMarket?: number | null
          details?: Json | null
          direction_faces?: string | null
          dom_percentile?: number | null
          elementary_school?: string | null
          estimated_monthly_piti?: number | null
          fencing?: string | null
          fireplace_yn?: boolean | null
          fireplaces_total?: number | null
          foundation_details?: string | null
          garage_spaces?: number | null
          garage_yn?: boolean | null
          has_virtual_tour?: boolean
          heating_yn?: boolean | null
          high_school?: string | null
          history_finalized?: boolean
          history_verified_full?: boolean
          hoa_annual_cost?: number | null
          hoa_monthly?: number | null
          hoa_pct_of_price?: number | null
          home_warranty_yn?: boolean | null
          horse_yn?: boolean | null
          inquiry_count?: number | null
          irrigation_water_rights_yn?: boolean | null
          is_finalized?: boolean
          largest_price_drop_pct?: number | null
          Latitude?: number | null
          levels?: string | null
          list_agent_email?: string | null
          list_agent_mls_id?: string | null
          ListAgentName?: string | null
          ListDate?: string | null
          listing_contract_date?: string | null
          listing_quality_score?: number | null
          ListingKey?: string | null
          ListNumber: string
          ListOfficeName?: string | null
          ListPrice?: number | null
          Longitude?: number | null
          lot_features?: string | null
          lot_size_acres?: number | null
          lot_size_sqft?: number | null
          media_finalized?: boolean
          middle_school?: string | null
          mls_source?: string
          ModificationTimestamp?: string | null
          new_construction_yn?: boolean | null
          off_market_date?: string | null
          OnMarketDate?: string | null
          OpenHouses?: Json | null
          original_entry_timestamp?: string | null
          original_on_market_timestamp?: string | null
          OriginalListPrice?: number | null
          parcel_number?: string | null
          parking_total?: number | null
          pending_timestamp?: string | null
          photos_count?: number | null
          PhotoURL?: string | null
          pool_yn?: boolean | null
          PostalCode?: string | null
          price_drop_count?: number | null
          price_increase_count?: number | null
          price_per_acre?: number | null
          price_per_bedroom?: number | null
          price_per_room?: number | null
          price_per_sqft?: number | null
          price_percentile?: number | null
          property_age?: number | null
          property_attached_yn?: boolean | null
          property_cluster_id?: string | null
          property_sub_type?: string | null
          PropertyType?: string | null
          public_remarks?: string | null
          purchase_contract_date?: string | null
          roof?: string | null
          rooms_total?: number | null
          sale_to_final_list_ratio?: number | null
          sale_to_list_ratio?: number | null
          save_count?: number | null
          school_district?: string | null
          senior_community_yn?: boolean | null
          sewer?: string | null
          spa_yn?: boolean | null
          sqft_efficiency?: number | null
          StandardStatus?: string | null
          State?: string | null
          status_change_count?: number | null
          status_change_timestamp?: string | null
          stories_total?: number | null
          StreetName?: string | null
          StreetNumber?: string | null
          SubdivisionName?: string | null
          tax_annual_amount?: number | null
          tax_assessed_value?: number | null
          tax_rate?: number | null
          tax_year?: number | null
          total_price_change_amt?: number | null
          total_price_change_pct?: number | null
          total_price_changes?: number | null
          TotalLivingAreaSqFt?: number | null
          view_count?: number | null
          view_description?: string | null
          virtual_tour_url?: string | null
          walk_score?: number | null
          was_relisted?: boolean | null
          water?: string | null
          waterfront_yn?: boolean | null
          year_built?: number | null
        }
        Update: {
          above_grade_finished_area?: number | null
          above_grade_pct?: number | null
          amenities?: Json | null
          architectural_style?: string | null
          association_fee?: number | null
          association_fee_frequency?: string | null
          association_yn?: boolean | null
          back_on_market_count?: number | null
          back_on_market_timestamp?: string | null
          basement_yn?: boolean | null
          BathroomsTotal?: number | null
          baths_full?: number | null
          baths_half?: number | null
          bed_bath_ratio?: number | null
          BedroomsTotal?: number | null
          below_grade_finished_area?: number | null
          building_area_total?: number | null
          buyer_agent_mls_id?: string | null
          buyer_agent_name?: string | null
          buyer_financing?: string | null
          buyer_office_name?: string | null
          carport_spaces?: number | null
          carport_yn?: boolean | null
          City?: string | null
          close_price_per_sqft?: number | null
          CloseDate?: string | null
          ClosePrice?: number | null
          concessions_amount?: number | null
          construction_materials?: string | null
          cooling_yn?: boolean | null
          county?: string | null
          cross_street?: string | null
          CumulativeDaysOnMarket?: number | null
          days_pending_to_close?: number | null
          days_since_last_price_change?: number | null
          days_to_pending?: number | null
          DaysOnMarket?: number | null
          details?: Json | null
          direction_faces?: string | null
          dom_percentile?: number | null
          elementary_school?: string | null
          estimated_monthly_piti?: number | null
          fencing?: string | null
          fireplace_yn?: boolean | null
          fireplaces_total?: number | null
          foundation_details?: string | null
          garage_spaces?: number | null
          garage_yn?: boolean | null
          has_virtual_tour?: boolean
          heating_yn?: boolean | null
          high_school?: string | null
          history_finalized?: boolean
          history_verified_full?: boolean
          hoa_annual_cost?: number | null
          hoa_monthly?: number | null
          hoa_pct_of_price?: number | null
          home_warranty_yn?: boolean | null
          horse_yn?: boolean | null
          inquiry_count?: number | null
          irrigation_water_rights_yn?: boolean | null
          is_finalized?: boolean
          largest_price_drop_pct?: number | null
          Latitude?: number | null
          levels?: string | null
          list_agent_email?: string | null
          list_agent_mls_id?: string | null
          ListAgentName?: string | null
          ListDate?: string | null
          listing_contract_date?: string | null
          listing_quality_score?: number | null
          ListingKey?: string | null
          ListNumber?: string
          ListOfficeName?: string | null
          ListPrice?: number | null
          Longitude?: number | null
          lot_features?: string | null
          lot_size_acres?: number | null
          lot_size_sqft?: number | null
          media_finalized?: boolean
          middle_school?: string | null
          mls_source?: string
          ModificationTimestamp?: string | null
          new_construction_yn?: boolean | null
          off_market_date?: string | null
          OnMarketDate?: string | null
          OpenHouses?: Json | null
          original_entry_timestamp?: string | null
          original_on_market_timestamp?: string | null
          OriginalListPrice?: number | null
          parcel_number?: string | null
          parking_total?: number | null
          pending_timestamp?: string | null
          photos_count?: number | null
          PhotoURL?: string | null
          pool_yn?: boolean | null
          PostalCode?: string | null
          price_drop_count?: number | null
          price_increase_count?: number | null
          price_per_acre?: number | null
          price_per_bedroom?: number | null
          price_per_room?: number | null
          price_per_sqft?: number | null
          price_percentile?: number | null
          property_age?: number | null
          property_attached_yn?: boolean | null
          property_cluster_id?: string | null
          property_sub_type?: string | null
          PropertyType?: string | null
          public_remarks?: string | null
          purchase_contract_date?: string | null
          roof?: string | null
          rooms_total?: number | null
          sale_to_final_list_ratio?: number | null
          sale_to_list_ratio?: number | null
          save_count?: number | null
          school_district?: string | null
          senior_community_yn?: boolean | null
          sewer?: string | null
          spa_yn?: boolean | null
          sqft_efficiency?: number | null
          StandardStatus?: string | null
          State?: string | null
          status_change_count?: number | null
          status_change_timestamp?: string | null
          stories_total?: number | null
          StreetName?: string | null
          StreetNumber?: string | null
          SubdivisionName?: string | null
          tax_annual_amount?: number | null
          tax_assessed_value?: number | null
          tax_rate?: number | null
          tax_year?: number | null
          total_price_change_amt?: number | null
          total_price_change_pct?: number | null
          total_price_changes?: number | null
          TotalLivingAreaSqFt?: number | null
          view_count?: number | null
          view_description?: string | null
          virtual_tour_url?: string | null
          walk_score?: number | null
          was_relisted?: boolean | null
          water?: string | null
          waterfront_yn?: boolean | null
          year_built?: number | null
        }
        Relationships: []
      }
      listings_historical: {
        Row: {
          BathroomsTotal: number | null
          BedroomsTotal: number | null
          City: string | null
          CloseDate: string | null
          created_at: string
          details: Json | null
          Latitude: number | null
          ListAgentName: string | null
          ListDate: string | null
          ListingKey: string
          ListNumber: string | null
          ListOfficeName: string | null
          ListPrice: number | null
          Longitude: number | null
          ModificationTimestamp: string | null
          PhotoURL: string | null
          PostalCode: string | null
          PropertyType: string | null
          spark_raw: Json | null
          StandardStatus: string | null
          State: string | null
          StreetName: string | null
          StreetNumber: string | null
          SubdivisionName: string | null
          TotalLivingAreaSqFt: number | null
          updated_at: string
        }
        Insert: {
          BathroomsTotal?: number | null
          BedroomsTotal?: number | null
          City?: string | null
          CloseDate?: string | null
          created_at?: string
          details?: Json | null
          Latitude?: number | null
          ListAgentName?: string | null
          ListDate?: string | null
          ListingKey: string
          ListNumber?: string | null
          ListOfficeName?: string | null
          ListPrice?: number | null
          Longitude?: number | null
          ModificationTimestamp?: string | null
          PhotoURL?: string | null
          PostalCode?: string | null
          PropertyType?: string | null
          spark_raw?: Json | null
          StandardStatus?: string | null
          State?: string | null
          StreetName?: string | null
          StreetNumber?: string | null
          SubdivisionName?: string | null
          TotalLivingAreaSqFt?: number | null
          updated_at?: string
        }
        Update: {
          BathroomsTotal?: number | null
          BedroomsTotal?: number | null
          City?: string | null
          CloseDate?: string | null
          created_at?: string
          details?: Json | null
          Latitude?: number | null
          ListAgentName?: string | null
          ListDate?: string | null
          ListingKey?: string
          ListNumber?: string | null
          ListOfficeName?: string | null
          ListPrice?: number | null
          Longitude?: number | null
          ModificationTimestamp?: string | null
          PhotoURL?: string | null
          PostalCode?: string | null
          PropertyType?: string | null
          spark_raw?: Json | null
          StandardStatus?: string | null
          State?: string | null
          StreetName?: string | null
          StreetNumber?: string | null
          SubdivisionName?: string | null
          TotalLivingAreaSqFt?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      market_narratives: {
        Row: {
          buyer_outlook: string
          faq: Json
          generated_at: string
          generated_from_stats_id: string | null
          geo_slug: string
          geo_type: string
          id: string
          inventory_analysis: string
          overview: string
          period_end: string
          period_start: string
          period_type: string
          price_analysis: string
          seller_outlook: string
          speed_analysis: string
        }
        Insert: {
          buyer_outlook: string
          faq?: Json
          generated_at?: string
          generated_from_stats_id?: string | null
          geo_slug: string
          geo_type: string
          id?: string
          inventory_analysis: string
          overview: string
          period_end: string
          period_start: string
          period_type: string
          price_analysis: string
          seller_outlook: string
          speed_analysis: string
        }
        Update: {
          buyer_outlook?: string
          faq?: Json
          generated_at?: string
          generated_from_stats_id?: string | null
          geo_slug?: string
          geo_type?: string
          id?: string
          inventory_analysis?: string
          overview?: string
          period_end?: string
          period_start?: string
          period_type?: string
          price_analysis?: string
          seller_outlook?: string
          speed_analysis?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_narratives_generated_from_stats_id_fkey"
            columns: ["generated_from_stats_id"]
            isOneToOne: false
            referencedRelation: "market_stats_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      market_pulse_live: {
        Row: {
          active_count: number
          avg_list_price: number | null
          geo_label: string
          geo_slug: string
          geo_type: string
          id: string
          market_health_label: string | null
          market_health_score: number | null
          median_list_price: number | null
          new_count_30d: number
          new_count_7d: number
          pending_count: number
          updated_at: string
        }
        Insert: {
          active_count?: number
          avg_list_price?: number | null
          geo_label: string
          geo_slug: string
          geo_type: string
          id?: string
          market_health_label?: string | null
          market_health_score?: number | null
          median_list_price?: number | null
          new_count_30d?: number
          new_count_7d?: number
          pending_count?: number
          updated_at?: string
        }
        Update: {
          active_count?: number
          avg_list_price?: number | null
          geo_label?: string
          geo_slug?: string
          geo_type?: string
          id?: string
          market_health_label?: string | null
          market_health_score?: number | null
          median_list_price?: number | null
          new_count_30d?: number
          new_count_7d?: number
          pending_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      market_reports: {
        Row: {
          content_html: string | null
          created_at: string
          id: string
          image_storage_path: string | null
          period_end: string
          period_start: string
          period_type: string
          slug: string
          title: string
        }
        Insert: {
          content_html?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          period_end: string
          period_start: string
          period_type: string
          slug: string
          title: string
        }
        Update: {
          content_html?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      market_stats_cache: {
        Row: {
          avg_sale_price: number | null
          avg_sale_to_list_ratio: number | null
          bedroom_breakdown: Json
          computed_at: string
          created_at: string
          geo_label: string
          geo_slug: string
          geo_type: string
          id: string
          market_health_label: string | null
          market_health_score: number | null
          median_dom: number | null
          median_ppsf: number | null
          median_sale_price: number | null
          period_end: string
          period_start: string
          period_type: string
          price_band_counts: Json
          property_type_breakdown: Json
          sold_count: number
          speed_p25: number | null
          speed_p50: number | null
          speed_p75: number | null
          total_volume: number | null
          updated_at: string
          yoy_median_price_delta_pct: number | null
          yoy_sold_delta_pct: number | null
        }
        Insert: {
          avg_sale_price?: number | null
          avg_sale_to_list_ratio?: number | null
          bedroom_breakdown?: Json
          computed_at?: string
          created_at?: string
          geo_label: string
          geo_slug: string
          geo_type: string
          id?: string
          market_health_label?: string | null
          market_health_score?: number | null
          median_dom?: number | null
          median_ppsf?: number | null
          median_sale_price?: number | null
          period_end: string
          period_start: string
          period_type: string
          price_band_counts?: Json
          property_type_breakdown?: Json
          sold_count?: number
          speed_p25?: number | null
          speed_p50?: number | null
          speed_p75?: number | null
          total_volume?: number | null
          updated_at?: string
          yoy_median_price_delta_pct?: number | null
          yoy_sold_delta_pct?: number | null
        }
        Update: {
          avg_sale_price?: number | null
          avg_sale_to_list_ratio?: number | null
          bedroom_breakdown?: Json
          computed_at?: string
          created_at?: string
          geo_label?: string
          geo_slug?: string
          geo_type?: string
          id?: string
          market_health_label?: string | null
          market_health_score?: number | null
          median_dom?: number | null
          median_ppsf?: number | null
          median_sale_price?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          price_band_counts?: Json
          property_type_breakdown?: Json
          sold_count?: number
          speed_p25?: number | null
          speed_p50?: number | null
          speed_p75?: number | null
          total_volume?: number | null
          updated_at?: string
          yoy_median_price_delta_pct?: number | null
          yoy_sold_delta_pct?: number | null
        }
        Relationships: []
      }
      neighborhoods: {
        Row: {
          boundary_geojson: Json | null
          city_id: string | null
          created_at: string
          description: string | null
          hero_image_url: string | null
          id: string
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          boundary_geojson?: Json | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          boundary_geojson?: Json | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          notification_type: string
          payload: Json
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          notification_type: string
          payload?: Json
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          notification_type?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      open_house_rsvps: {
        Row: {
          created_at: string
          id: string
          open_house_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          open_house_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          open_house_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_house_rsvps_open_house_id_fkey"
            columns: ["open_house_id"]
            isOneToOne: false
            referencedRelation: "open_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      open_houses: {
        Row: {
          created_at: string
          end_time: string | null
          event_date: string
          host_agent_name: string | null
          id: string
          listing_key: string
          open_house_key: string
          remarks: string | null
          rsvp_count: number
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          event_date: string
          host_agent_name?: string | null
          id?: string
          listing_key: string
          open_house_key: string
          remarks?: string | null
          rsvp_count?: number
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          event_date?: string
          host_agent_name?: string | null
          id?: string
          listing_key?: string
          open_house_key?: string
          remarks?: string | null
          rsvp_count?: number
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      optimization_runs: {
        Row: {
          findings: Json | null
          id: string
          run_at: string
          suggested_changes: Json | null
          summary: string | null
        }
        Insert: {
          findings?: Json | null
          id?: string
          run_at?: string
          suggested_changes?: Json | null
          summary?: string | null
        }
        Update: {
          findings?: Json | null
          id?: string
          run_at?: string
          suggested_changes?: Json | null
          summary?: string | null
        }
        Relationships: []
      }
      page_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          page_id: string
          page_type: string
          photographer_name: string | null
          photographer_url: string | null
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          page_id: string
          page_type: string
          photographer_name?: string | null
          photographer_url?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          page_id?: string
          page_type?: string
          photographer_name?: string | null
          photographer_url?: string | null
          source?: string
        }
        Relationships: []
      }
      place_attractions: {
        Row: {
          created_at: string
          description: string | null
          entity_key: string
          id: string
          is_coming: boolean
          name: string
          phone: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_key: string
          id?: string
          is_coming?: boolean
          name: string
          phone?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_key?: string
          id?: string
          is_coming?: boolean
          name?: string
          phone?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      price_history: {
        Row: {
          change_pct: number | null
          changed_at: string
          created_at: string
          id: string
          listing_key: string
          new_price: number | null
          old_price: number | null
        }
        Insert: {
          change_pct?: number | null
          changed_at?: string
          created_at?: string
          id?: string
          listing_key: string
          new_price?: number | null
          old_price?: number | null
        }
        Update: {
          change_pct?: number | null
          changed_at?: string
          created_at?: string
          id?: string
          listing_key?: string
          new_price?: number | null
          old_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          buyer_preferences: Json | null
          default_city: string | null
          display_name: string | null
          id: string
          lead_score: number | null
          lead_tier: string | null
          notification_preferences: Json | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_preferences?: Json | null
          default_city?: string | null
          display_name?: string | null
          id: string
          lead_score?: number | null
          lead_tier?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_preferences?: Json | null
          default_city?: string | null
          display_name?: string | null
          id?: string
          lead_score?: number | null
          lead_tier?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          city: string | null
          community_id: string | null
          county: string | null
          created_at: string
          geography: unknown
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood_id: string | null
          parcel_number: string | null
          postal_code: string | null
          state: string | null
          street_name: string | null
          street_number: string | null
          street_suffix: string | null
          unit_number: string | null
          unparsed_address: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          community_id?: string | null
          county?: string | null
          created_at?: string
          geography?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          parcel_number?: string | null
          postal_code?: string | null
          state?: string | null
          street_name?: string | null
          street_number?: string | null
          street_suffix?: string | null
          unit_number?: string | null
          unparsed_address: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          community_id?: string | null
          county?: string | null
          created_at?: string
          geography?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          parcel_number?: string | null
          postal_code?: string | null
          state?: string | null
          street_name?: string | null
          street_number?: string | null
          street_suffix?: string | null
          unit_number?: string | null
          unparsed_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_listings_breakdown: {
        Row: {
          by_city: Json
          by_status: Json
          id: number
          total: number
          updated_at: string
        }
        Insert: {
          by_city?: Json
          by_status?: Json
          id?: number
          total?: number
          updated_at?: string
        }
        Update: {
          by_city?: Json
          by_status?: Json
          id?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      reporting_cache: {
        Row: {
          computed_at: string
          created_at: string
          geo_name: string
          geo_type: string
          id: string
          metrics: Json
          period_end: string
          period_start: string
          period_type: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          geo_name: string
          geo_type: string
          id?: string
          metrics?: Json
          period_end: string
          period_start: string
          period_type: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          geo_name?: string
          geo_type?: string
          id?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          period_type?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          broker_id: string | null
          created_at: string
          id: string
          is_hidden: boolean
          rating: number
          review_date: string | null
          reviewer_name: string | null
          source: string
          synced_at: string
          text: string | null
        }
        Insert: {
          broker_id?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          rating: number
          review_date?: string | null
          reviewer_name?: string | null
          source: string
          synced_at?: string
          text?: string | null
        }
        Update: {
          broker_id?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          rating?: number
          review_date?: string | null
          reviewer_name?: string | null
          source?: string
          synced_at?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_cities: {
        Row: {
          city_slug: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          city_slug: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          city_slug?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_communities: {
        Row: {
          created_at: string
          entity_key: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_listings: {
        Row: {
          collection_name: string
          created_at: string
          id: string
          listing_key: string
          user_id: string
        }
        Insert: {
          collection_name?: string
          created_at?: string
          id?: string
          listing_key: string
          user_id: string
        }
        Update: {
          collection_name?: string
          created_at?: string
          id?: string
          listing_key?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          cache_listing_keys: string[]
          cache_refreshed_at: string | null
          created_at: string
          filters: Json
          filters_hash: string | null
          id: string
          is_paused: boolean
          is_public: boolean
          last_notified_at: string | null
          name: string
          notification_frequency: string
          public_click_count: number
          public_title: string | null
          result_count: number
          user_id: string
        }
        Insert: {
          cache_listing_keys?: string[]
          cache_refreshed_at?: string | null
          created_at?: string
          filters?: Json
          filters_hash?: string | null
          id?: string
          is_paused?: boolean
          is_public?: boolean
          last_notified_at?: string | null
          name: string
          notification_frequency?: string
          public_click_count?: number
          public_title?: string | null
          result_count?: number
          user_id: string
        }
        Update: {
          cache_listing_keys?: string[]
          cache_refreshed_at?: string | null
          created_at?: string
          filters?: Json
          filters_hash?: string | null
          id?: string
          is_paused?: boolean
          is_public?: boolean
          last_notified_at?: string | null
          name?: string
          notification_frequency?: string
          public_click_count?: number
          public_title?: string | null
          result_count?: number
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          body_html: string
          id: string
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          id?: string
          key: string
          title?: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          id?: string
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      status_history: {
        Row: {
          changed_at: string
          created_at: string
          id: string
          listing_key: string
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          changed_at?: string
          created_at?: string
          id?: string
          listing_key: string
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          changed_at?: string
          created_at?: string
          id?: string
          listing_key?: string
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: []
      }
      strict_verify_runs: {
        Row: {
          completed_at: string
          concurrency_param: number | null
          duration_ms: number | null
          error_message: string | null
          fetch_failures: number
          history_rows_inserted: number
          id: string
          limit_param: number | null
          marked_verified: number
          ok: boolean
          processed: number
          query_succeeded: boolean
          started_at: string
          year_filter: number | null
        }
        Insert: {
          completed_at?: string
          concurrency_param?: number | null
          duration_ms?: number | null
          error_message?: string | null
          fetch_failures?: number
          history_rows_inserted?: number
          id?: string
          limit_param?: number | null
          marked_verified?: number
          ok?: boolean
          processed?: number
          query_succeeded?: boolean
          started_at?: string
          year_filter?: number | null
        }
        Update: {
          completed_at?: string
          concurrency_param?: number | null
          duration_ms?: number | null
          error_message?: string | null
          fetch_failures?: number
          history_rows_inserted?: number
          id?: string
          limit_param?: number | null
          marked_verified?: number
          ok?: boolean
          processed?: number
          query_succeeded?: boolean
          started_at?: string
          year_filter?: number | null
        }
        Relationships: []
      }
      subdivision_descriptions: {
        Row: {
          attractions: string | null
          created_at: string
          description: string
          dining: string | null
          entity_key: string
          id: string
        }
        Insert: {
          attractions?: string | null
          created_at?: string
          description: string
          dining?: string | null
          entity_key: string
          id?: string
        }
        Update: {
          attractions?: string | null
          created_at?: string
          description?: string
          dining?: string | null
          entity_key?: string
          id?: string
        }
        Relationships: []
      }
      subdivision_flags: {
        Row: {
          entity_key: string
          is_resort: boolean
          updated_at: string
        }
        Insert: {
          entity_key: string
          is_resort?: boolean
          updated_at?: string
        }
        Update: {
          entity_key?: string
          is_resort?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sync_alerts: {
        Row: {
          alert_type: string
          channels_notified: string[] | null
          environment: string
          id: string
          resolved: boolean
          resolved_at: string | null
          triggered_at: string
        }
        Insert: {
          alert_type: string
          channels_notified?: string[] | null
          environment: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          triggered_at?: string
        }
        Update: {
          alert_type?: string
          channels_notified?: string[] | null
          environment?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          triggered_at?: string
        }
        Relationships: []
      }
      sync_checkpoints: {
        Row: {
          completed_at: string | null
          created_at: string
          error_log: Json
          id: string
          last_listing_key: string | null
          last_modification_ts: string | null
          metadata: Json | null
          next_url: string | null
          processed_count: number
          speed_records_per_min: number | null
          started_at: string
          status: string
          sync_type: string
          total_count: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_log?: Json
          id?: string
          last_listing_key?: string | null
          last_modification_ts?: string | null
          metadata?: Json | null
          next_url?: string | null
          processed_count?: number
          speed_records_per_min?: number | null
          started_at?: string
          status: string
          sync_type: string
          total_count?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_log?: Json
          id?: string
          last_listing_key?: string | null
          last_modification_ts?: string | null
          metadata?: Json | null
          next_url?: string | null
          processed_count?: number
          speed_records_per_min?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          total_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_cursor: {
        Row: {
          abort_requested: boolean
          cron_enabled: boolean
          error: string | null
          id: string
          next_history_offset: number
          next_listing_page: number
          paused: boolean
          phase: string
          refresh_next_url: string | null
          run_history_rows: number
          run_listings_upserted: number
          run_started_at: string | null
          total_listing_pages: number | null
          updated_at: string
        }
        Insert: {
          abort_requested?: boolean
          cron_enabled?: boolean
          error?: string | null
          id?: string
          next_history_offset?: number
          next_listing_page?: number
          paused?: boolean
          phase?: string
          refresh_next_url?: string | null
          run_history_rows?: number
          run_listings_upserted?: number
          run_started_at?: string | null
          total_listing_pages?: number | null
          updated_at?: string
        }
        Update: {
          abort_requested?: boolean
          cron_enabled?: boolean
          error?: string | null
          id?: string
          next_history_offset?: number
          next_listing_page?: number
          paused?: boolean
          phase?: string
          refresh_next_url?: string | null
          run_history_rows?: number
          run_listings_upserted?: number
          run_started_at?: string | null
          total_listing_pages?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_history: {
        Row: {
          completed_at: string
          created_at: string
          duration_seconds: number
          error: string | null
          history_rows_upserted: number
          id: string
          listings_upserted: number
          photos_updated: number
          run_type: string
          started_at: string
        }
        Insert: {
          completed_at: string
          created_at?: string
          duration_seconds: number
          error?: string | null
          history_rows_upserted?: number
          id?: string
          listings_upserted?: number
          photos_updated?: number
          run_type: string
          started_at: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          error?: string | null
          history_rows_upserted?: number
          id?: string
          listings_upserted?: number
          photos_updated?: number
          run_type?: string
          started_at?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          error_message: string | null
          id: string
          page: number
          records_processed: number
          resource_id: string | null
          resource_type: string
          skiptoken: string | null
          started_at: string | null
          status: string
          total_records_expected: number | null
          updated_at: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          page?: number
          records_processed?: number
          resource_id?: string | null
          resource_type: string
          skiptoken?: string | null
          started_at?: string | null
          status?: string
          total_records_expected?: number | null
          updated_at?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          page?: number
          records_processed?: number
          resource_id?: string | null
          resource_type?: string
          skiptoken?: string | null
          started_at?: string | null
          status?: string
          total_records_expected?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          alert_sent: boolean
          duration_ms: number | null
          endpoint: string
          environment: string
          error_message: string | null
          id: string
          logged_at: string
          method: string
          records_returned: number | null
          response_status: number | null
          sync_cycle_id: string | null
        }
        Insert: {
          alert_sent?: boolean
          duration_ms?: number | null
          endpoint: string
          environment: string
          error_message?: string | null
          id?: string
          logged_at?: string
          method?: string
          records_returned?: number | null
          response_status?: number | null
          sync_cycle_id?: string | null
        }
        Update: {
          alert_sent?: boolean
          duration_ms?: number | null
          endpoint?: string
          environment?: string
          error_message?: string | null
          id?: string
          logged_at?: string
          method?: string
          records_returned?: number | null
          response_status?: number | null
          sync_cycle_id?: string | null
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          id: string
          last_delta_sync_at: string | null
          last_full_sync_at: string | null
          terminal_from_year: number | null
          terminal_scope_counts_cache: Json | null
          terminal_scope_counts_cache_checked_at: string | null
          terminal_to_year: number | null
          updated_at: string
          year_sync_matrix_cache: Json | null
        }
        Insert: {
          id?: string
          last_delta_sync_at?: string | null
          last_full_sync_at?: string | null
          terminal_from_year?: number | null
          terminal_scope_counts_cache?: Json | null
          terminal_scope_counts_cache_checked_at?: string | null
          terminal_to_year?: number | null
          updated_at?: string
          year_sync_matrix_cache?: Json | null
        }
        Update: {
          id?: string
          last_delta_sync_at?: string | null
          last_full_sync_at?: string | null
          terminal_from_year?: number | null
          terminal_scope_counts_cache?: Json | null
          terminal_scope_counts_cache_checked_at?: string | null
          terminal_to_year?: number | null
          updated_at?: string
          year_sync_matrix_cache?: Json | null
        }
        Relationships: []
      }
      sync_state_by_resource: {
        Row: {
          last_error_message: string | null
          last_sync_duration_ms: number | null
          last_sync_status: string | null
          last_sync_timestamp: string | null
          resource_type: string
          updated_at: string
        }
        Insert: {
          last_error_message?: string | null
          last_sync_duration_ms?: number | null
          last_sync_status?: string | null
          last_sync_timestamp?: string | null
          resource_type: string
          updated_at?: string
        }
        Update: {
          last_error_message?: string | null
          last_sync_duration_ms?: number | null
          last_sync_status?: string | null
          last_sync_timestamp?: string | null
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_year_cursor: {
        Row: {
          current_year: number | null
          id: string
          next_history_offset: number
          next_listing_page: number
          phase: string
          total_listings: number | null
          updated_at: string
        }
        Insert: {
          current_year?: number | null
          id?: string
          next_history_offset?: number
          next_listing_page?: number
          phase?: string
          total_listings?: number | null
          updated_at?: string
        }
        Update: {
          current_year?: number | null
          id?: string
          next_history_offset?: number
          next_listing_page?: number
          phase?: string
          total_listings?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tc_sessions: {
        Row: {
          actions_taken: string | null
          created_at: string
          id: number
          output_links: string | null
          request_body: string | null
          request_type: string | null
          sender: string
          sender_tier: string
          session_id: string
          status: string
          thread_id: string
          timestamp: string
          transaction_addr: string | null
          updated_at: string
        }
        Insert: {
          actions_taken?: string | null
          created_at?: string
          id?: number
          output_links?: string | null
          request_body?: string | null
          request_type?: string | null
          sender: string
          sender_tier?: string
          session_id: string
          status?: string
          thread_id: string
          timestamp?: string
          transaction_addr?: string | null
          updated_at?: string
        }
        Update: {
          actions_taken?: string | null
          created_at?: string
          id?: number
          output_links?: string | null
          request_body?: string | null
          request_type?: string | null
          sender?: string
          sender_tier?: string
          session_id?: string
          status?: string
          thread_id?: string
          timestamp?: string
          transaction_addr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
          visitor_cookie_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          visitor_cookie_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          visitor_cookie_id?: string | null
        }
        Relationships: []
      }
      user_buying_preferences: {
        Row: {
          down_payment_percent: number
          interest_rate: number
          loan_term_years: number
          max_price: number | null
          min_baths: number | null
          min_beds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          down_payment_percent?: number
          interest_rate?: number
          loan_term_years?: number
          max_price?: number | null
          min_baths?: number | null
          min_beds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          down_payment_percent?: number
          interest_rate?: number
          loan_term_years?: number
          max_price?: number | null
          min_baths?: number | null
          min_beds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          event_at: string
          event_type: string
          id: string
          listing_key: string | null
          page_path: string | null
          payload: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          event_at?: string
          event_type: string
          id?: string
          listing_key?: string | null
          page_path?: string | null
          payload?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          event_at?: string
          event_type?: string
          id?: string
          listing_key?: string | null
          page_path?: string | null
          payload?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      valuation_comps: {
        Row: {
          adjustment_amount: number | null
          adjustment_reason: string | null
          comp_address: string | null
          comp_listing_key: string | null
          comp_sold_date: string | null
          comp_sold_price: number | null
          comp_sqft: number | null
          created_at: string
          distance_miles: number | null
          id: string
          similarity_score: number | null
          valuation_id: string
        }
        Insert: {
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          comp_address?: string | null
          comp_listing_key?: string | null
          comp_sold_date?: string | null
          comp_sold_price?: number | null
          comp_sqft?: number | null
          created_at?: string
          distance_miles?: number | null
          id?: string
          similarity_score?: number | null
          valuation_id: string
        }
        Update: {
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          comp_address?: string | null
          comp_listing_key?: string | null
          comp_sold_date?: string | null
          comp_sold_price?: number | null
          comp_sqft?: number | null
          created_at?: string
          distance_miles?: number | null
          id?: string
          similarity_score?: number | null
          valuation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_comps_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_requests: {
        Row: {
          address_city: string
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          source_url: string | null
        }
        Insert: {
          address_city: string
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          source_url?: string | null
        }
        Update: {
          address_city?: string
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      valuations: {
        Row: {
          comp_count: number | null
          computed_at: string
          confidence: string | null
          created_at: string
          estimated_value: number
          id: string
          methodology_version: string | null
          property_id: string
          value_high: number | null
          value_low: number | null
        }
        Insert: {
          comp_count?: number | null
          computed_at?: string
          confidence?: string | null
          created_at?: string
          estimated_value: number
          id?: string
          methodology_version?: string | null
          property_id: string
          value_high?: number | null
          value_low?: number | null
        }
        Update: {
          comp_count?: number | null
          computed_at?: string
          confidence?: string | null
          created_at?: string
          estimated_value?: number
          id?: string
          methodology_version?: string | null
          property_id?: string
          value_high?: number | null
          value_low?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      video_tours_cache: {
        Row: {
          listings: Json
          scope: string
          updated_at: string
        }
        Insert: {
          listings?: Json
          scope: string
          updated_at?: string
        }
        Update: {
          listings?: Json
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          created_at: string
          id: string
          path: string | null
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visit_id?: string
        }
        Relationships: []
      }
      year_sync_log: {
        Row: {
          completed_at: string
          error: string | null
          history_inserted: number
          id: string
          listings_finalized: number
          listings_upserted: number
          status: string
          year: number
        }
        Insert: {
          completed_at?: string
          error?: string | null
          history_inserted?: number
          id?: string
          listings_finalized?: number
          listings_upserted?: number
          status: string
          year: number
        }
        Update: {
          completed_at?: string
          error?: string | null
          history_inserted?: number
          id?: string
          listings_finalized?: number
          listings_upserted?: number
          status?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      listing_year_finalization_stats: {
        Row: {
          finalized_listings: number | null
          list_year: number | null
          total_listings: number | null
          verified_full_listings: number | null
        }
        Relationships: []
      }
      listing_year_on_market_finalization_stats: {
        Row: {
          finalized_listings: number | null
          list_year: number | null
          total_listings: number | null
          verified_full_listings: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _backfill_tick: { Args: never; Returns: undefined }
      _is_excluded_property_type: {
        Args: {
          include_acreage: boolean
          include_commercial?: boolean
          include_condo_town: boolean
          include_manufactured: boolean
          pt: string
        }
        Returns: boolean
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _unmask: { Args: { val: string }; Returns: string }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      apply_close_price_from_history_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      apply_listing_dom_metrics_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      apply_original_list_price_from_details_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      backfill_all_historical_stats: {
        Args: { p_months_back?: number }
        Returns: Json
      }
      cleanup_old_events: {
        Args: {
          p_listing_views_days?: number
          p_user_events_days?: number
          p_visits_days?: number
        }
        Returns: Json
      }
      compute_and_cache_period_stats: {
        Args: {
          p_geo_slug: string
          p_geo_type: string
          p_period_end?: string
          p_period_start: string
          p_period_type: string
        }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      generate_market_narrative: {
        Args: {
          p_geo_slug: string
          p_geo_type: string
          p_period_start: string
          p_period_type: string
        }
        Returns: Json
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_beacon_metrics: {
        Args: {
          p_as_of?: string
          p_city: string
          p_include_acreage?: boolean
          p_include_commercial?: boolean
          p_include_condo_town?: boolean
          p_include_manufactured?: boolean
          p_max_price?: number
          p_min_price?: number
          p_period_end: string
          p_period_start: string
          p_subdivision?: string
        }
        Returns: Json
      }
      get_beacon_price_bands: {
        Args: {
          p_city: string
          p_include_acreage?: boolean
          p_include_commercial?: boolean
          p_include_condo_town?: boolean
          p_include_manufactured?: boolean
          p_max_price?: number
          p_min_price?: number
          p_period_end: string
          p_period_start: string
          p_sales_12mo?: boolean
          p_subdivision?: string
        }
        Returns: Json
      }
      get_browse_cities_stats: {
        Args: never
        Returns: {
          active_count: number
          city_name: string
          community_count: number
          median_price: number
        }[]
      }
      get_city_metrics_timeseries:
        | { Args: { p_city: string; p_num_months?: number }; Returns: Json }
        | {
            Args: {
              p_city: string
              p_include_acreage?: boolean
              p_include_commercial?: boolean
              p_include_condo_town?: boolean
              p_include_manufactured?: boolean
              p_max_price?: number
              p_min_price?: number
              p_num_months?: number
              p_subdivision?: string
            }
            Returns: Json
          }
      get_city_navigation: {
        Args: { p_city_slug: string }
        Returns: {
          city_name: string
          city_slug: string
          community_name: string
          community_slug: string
          listing_count: number
          neighborhood_name: string
          neighborhood_slug: string
        }[]
      }
      get_city_period_metrics:
        | {
            Args: {
              p_as_of?: string
              p_city: string
              p_period_end: string
              p_period_start: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_as_of?: string
              p_city: string
              p_include_acreage?: boolean
              p_include_commercial?: boolean
              p_include_condo_town?: boolean
              p_include_manufactured?: boolean
              p_max_price?: number
              p_min_price?: number
              p_period_end: string
              p_period_start: string
              p_subdivision?: string
            }
            Returns: Json
          }
      get_city_price_bands:
        | {
            Args: {
              p_city: string
              p_period_end: string
              p_period_start: string
              p_sales_12mo?: boolean
            }
            Returns: Json
          }
        | {
            Args: {
              p_city: string
              p_include_acreage?: boolean
              p_include_commercial?: boolean
              p_include_condo_town?: boolean
              p_include_manufactured?: boolean
              p_max_price?: number
              p_min_price?: number
              p_period_end: string
              p_period_start: string
              p_sales_12mo?: boolean
              p_subdivision?: string
            }
            Returns: Json
          }
      get_city_status_counts: {
        Args: { p_city: string; p_subdivision?: string }
        Returns: Json
      }
      get_cma_comps: {
        Args: {
          p_max_count?: number
          p_months_back?: number
          p_radius_miles?: number
          p_subject_property_id: string
        }
        Returns: {
          address: string
          baths_full: number
          beds_total: number
          close_date: string
          close_price: number
          distance_miles: number
          garage_spaces: number
          listing_id: string
          listing_key: string
          living_area: number
          lot_size_acres: number
          pool_yn: boolean
          property_type: string
          year_built: number
        }[]
      }
      get_cma_comps_by_community: {
        Args: {
          p_community_id: string
          p_exclude_property_id: string
          p_max_count?: number
          p_months_back?: number
        }
        Returns: {
          address: string
          baths_full: number
          beds_total: number
          close_date: string
          close_price: number
          distance_miles: number
          garage_spaces: number
          listing_id: string
          listing_key: string
          living_area: number
          lot_size_acres: number
          pool_yn: boolean
          property_type: string
          year_built: number
        }[]
      }
      get_cma_comps_by_listing_key: {
        Args: {
          p_listing_key: string
          p_max_count?: number
          p_months_back?: number
          p_radius_miles?: number
        }
        Returns: {
          address: string
          baths_full: number
          beds_total: number
          close_date: string
          close_price: number
          distance_miles: number
          garage_spaces: number
          listing_id: string
          listing_key: string
          living_area: number
          lot_size_acres: number
          pool_yn: boolean
          property_type: string
          year_built: number
        }[]
      }
      get_homepage_market_stats: {
        Args: { p_city: string }
        Returns: {
          active_count: number
          avg_dom: number
          avg_price: number
          closed_last_12_months: number
          median_price: number
          new_listings_last_30_days: number
          pending_count: number
        }[]
      }
      get_listing_hierarchy: {
        Args: { p_listing_key: string }
        Returns: {
          city_id: string
          city_name: string
          city_slug: string
          community_id: string
          community_name: string
          community_slug: string
          listing_key: string
          neighborhood_id: string
          neighborhood_name: string
          neighborhood_slug: string
          subdivision_name: string
        }[]
      }
      get_listing_media_counts: {
        Args: never
        Returns: {
          total_listings: number
          with_photos: number
          with_videos: number
        }[]
      }
      get_listing_sync_status_breakdown: { Args: never; Returns: Json }
      get_listings_breakdown: { Args: never; Returns: Json }
      get_mortgage_rate: { Args: never; Returns: number }
      get_neighborhood_listings: {
        Args: { p_limit?: number; p_neighborhood_id: string }
        Returns: {
          above_grade_finished_area: number | null
          above_grade_pct: number | null
          amenities: Json | null
          architectural_style: string | null
          association_fee: number | null
          association_fee_frequency: string | null
          association_yn: boolean | null
          back_on_market_count: number | null
          back_on_market_timestamp: string | null
          basement_yn: boolean | null
          BathroomsTotal: number | null
          baths_full: number | null
          baths_half: number | null
          bed_bath_ratio: number | null
          BedroomsTotal: number | null
          below_grade_finished_area: number | null
          building_area_total: number | null
          buyer_agent_mls_id: string | null
          buyer_agent_name: string | null
          buyer_financing: string | null
          buyer_office_name: string | null
          carport_spaces: number | null
          carport_yn: boolean | null
          City: string | null
          close_price_per_sqft: number | null
          CloseDate: string | null
          ClosePrice: number | null
          concessions_amount: number | null
          construction_materials: string | null
          cooling_yn: boolean | null
          county: string | null
          cross_street: string | null
          CumulativeDaysOnMarket: number | null
          days_pending_to_close: number | null
          days_since_last_price_change: number | null
          days_to_pending: number | null
          DaysOnMarket: number | null
          details: Json | null
          direction_faces: string | null
          dom_percentile: number | null
          elementary_school: string | null
          estimated_monthly_piti: number | null
          fencing: string | null
          fireplace_yn: boolean | null
          fireplaces_total: number | null
          foundation_details: string | null
          garage_spaces: number | null
          garage_yn: boolean | null
          has_virtual_tour: boolean
          heating_yn: boolean | null
          high_school: string | null
          history_finalized: boolean
          history_verified_full: boolean
          hoa_annual_cost: number | null
          hoa_monthly: number | null
          hoa_pct_of_price: number | null
          home_warranty_yn: boolean | null
          horse_yn: boolean | null
          inquiry_count: number | null
          irrigation_water_rights_yn: boolean | null
          is_finalized: boolean
          largest_price_drop_pct: number | null
          Latitude: number | null
          levels: string | null
          list_agent_email: string | null
          list_agent_mls_id: string | null
          ListAgentName: string | null
          ListDate: string | null
          listing_contract_date: string | null
          listing_quality_score: number | null
          ListingKey: string | null
          ListNumber: string
          ListOfficeName: string | null
          ListPrice: number | null
          Longitude: number | null
          lot_features: string | null
          lot_size_acres: number | null
          lot_size_sqft: number | null
          media_finalized: boolean
          middle_school: string | null
          mls_source: string
          ModificationTimestamp: string | null
          new_construction_yn: boolean | null
          off_market_date: string | null
          OnMarketDate: string | null
          OpenHouses: Json | null
          original_entry_timestamp: string | null
          original_on_market_timestamp: string | null
          OriginalListPrice: number | null
          parcel_number: string | null
          parking_total: number | null
          pending_timestamp: string | null
          photos_count: number | null
          PhotoURL: string | null
          pool_yn: boolean | null
          PostalCode: string | null
          price_drop_count: number | null
          price_increase_count: number | null
          price_per_acre: number | null
          price_per_bedroom: number | null
          price_per_room: number | null
          price_per_sqft: number | null
          price_percentile: number | null
          property_age: number | null
          property_attached_yn: boolean | null
          property_cluster_id: string | null
          property_sub_type: string | null
          PropertyType: string | null
          public_remarks: string | null
          purchase_contract_date: string | null
          roof: string | null
          rooms_total: number | null
          sale_to_final_list_ratio: number | null
          sale_to_list_ratio: number | null
          save_count: number | null
          school_district: string | null
          senior_community_yn: boolean | null
          sewer: string | null
          spa_yn: boolean | null
          sqft_efficiency: number | null
          StandardStatus: string | null
          State: string | null
          status_change_count: number | null
          status_change_timestamp: string | null
          stories_total: number | null
          StreetName: string | null
          StreetNumber: string | null
          SubdivisionName: string | null
          tax_annual_amount: number | null
          tax_assessed_value: number | null
          tax_rate: number | null
          tax_year: number | null
          total_price_change_amt: number | null
          total_price_change_pct: number | null
          total_price_changes: number | null
          TotalLivingAreaSqFt: number | null
          view_count: number | null
          view_description: string | null
          virtual_tour_url: string | null
          walk_score: number | null
          was_relisted: boolean | null
          water: string | null
          waterfront_yn: boolean | null
          year_built: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_neighborhoods_in_city_stats: {
        Args: { p_city_id: string }
        Returns: {
          listing_count: number
          median_price: number
          name: string
          neighborhood_id: string
          slug: string
        }[]
      }
      get_subdivision_status_counts: { Args: { p_city: string }; Returns: Json }
      get_trending_listing_keys: {
        Args: { p_city: string; p_limit?: number }
        Returns: {
          listing_key: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_broker_admin_or_above: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      map_communities_to_neighborhoods: {
        Args: { p_city_id: string; p_dry_run?: boolean }
        Returns: {
          community_name: string
          listing_count: number
          neighborhood_name: string
        }[]
      }
      map_properties_to_neighborhood: {
        Args: {
          p_boundary_geojson: Json
          p_dry_run?: boolean
          p_neighborhood_id: string
        }
        Returns: number
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      refresh_current_period_stats: { Args: never; Returns: Json }
      refresh_listing_year_sync_stats: { Args: never; Returns: undefined }
      refresh_listings_breakdown: { Args: never; Returns: undefined }
      refresh_market_pulse: { Args: never; Returns: Json }
      report_listing_history_row_count: { Args: never; Returns: number }
      report_listings_missing_both_dates_count: { Args: never; Returns: number }
      resolve_listing_neighborhood: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: {
          city_id: string
          city_name: string
          neighborhood_id: string
          neighborhood_name: string
          neighborhood_slug: string
        }[]
      }
      resolve_neighborhood_for_point: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: string
      }
      search_listings_advanced:
        | {
            Args: {
              p_city?: string
              p_garage_min?: number
              p_has_fireplace?: boolean
              p_has_golf_course?: boolean
              p_has_open_house?: boolean
              p_has_pool?: boolean
              p_has_view?: boolean
              p_has_waterfront?: boolean
              p_keywords?: string
              p_limit?: number
              p_lot_acres_max?: number
              p_lot_acres_min?: number
              p_max_baths?: number
              p_max_beds?: number
              p_max_price?: number
              p_max_sqft?: number
              p_min_baths?: number
              p_min_beds?: number
              p_min_price?: number
              p_min_sqft?: number
              p_new_listings_days?: number
              p_offset?: number
              p_postal_code?: string
              p_property_subtype?: string
              p_property_type?: string
              p_sort?: string
              p_status_filter?: string
              p_subdivision?: string
              p_view_contains?: string
              p_year_built_max?: number
              p_year_built_min?: number
            }
            Returns: {
              BathroomsTotal: number
              BedroomsTotal: number
              City: string
              details: Json
              full_count: number
              Latitude: number
              ListingKey: string
              ListNumber: string
              ListPrice: number
              Longitude: number
              ModificationTimestamp: string
              PhotoURL: string
              PostalCode: string
              PropertyType: string
              StandardStatus: string
              State: string
              StreetName: string
              StreetNumber: string
              SubdivisionName: string
              TotalLivingAreaSqFt: number
            }[]
          }
        | {
            Args: {
              p_city?: string
              p_garage_min?: number
              p_has_open_house?: boolean
              p_has_pool?: boolean
              p_has_view?: boolean
              p_has_waterfront?: boolean
              p_keywords?: string
              p_limit?: number
              p_lot_acres_max?: number
              p_lot_acres_min?: number
              p_max_baths?: number
              p_max_beds?: number
              p_max_price?: number
              p_max_sqft?: number
              p_min_baths?: number
              p_min_beds?: number
              p_min_price?: number
              p_min_sqft?: number
              p_new_listings_days?: number
              p_offset?: number
              p_postal_code?: string
              p_property_subtype?: string
              p_property_type?: string
              p_sort?: string
              p_status_filter?: string
              p_subdivision?: string
              p_year_built_max?: number
              p_year_built_min?: number
            }
            Returns: {
              BathroomsTotal: number
              BedroomsTotal: number
              City: string
              details: Json
              full_count: number
              Latitude: number
              ListingKey: string
              ListNumber: string
              ListPrice: number
              Longitude: number
              ModificationTimestamp: string
              PhotoURL: string
              PostalCode: string
              PropertyType: string
              StandardStatus: string
              State: string
              StreetName: string
              StreetNumber: string
              SubdivisionName: string
              TotalLivingAreaSqFt: number
            }[]
          }
      slugify_text: { Args: { p_input: string }; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sync_new_communities_from_listings: {
        Args: { p_city?: string }
        Returns: {
          community_name: string
          community_slug: string
          listings_count: number
          neighborhood_name: string
        }[]
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

