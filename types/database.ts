/**
 * Supabase database types. Extend as needed; optionally replace with
 * `supabase gen types typescript --local > types/database.ts`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      user_events: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          event_type: string
          event_at: string
          page_path: string | null
          listing_key: string | null
          payload: Json | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          event_type: string
          event_at?: string
          page_path?: string | null
          listing_key?: string | null
          payload?: Json | null
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          event_type?: string
          event_at?: string
          page_path?: string | null
          listing_key?: string | null
          payload?: Json | null
        }
      }
      admin_actions: {
        Row: {
          id: string
          admin_email: string
          role: string | null
          action_type: string
          resource_type: string | null
          resource_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_email: string
          role?: string | null
          action_type: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['admin_actions']['Insert']>
      }
      likes: {
        Row: {
          id: string
          user_id: string
          listing_key: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          listing_key: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          listing_key?: string
          created_at?: string
        }
      }
      saved_listings: {
        Row: {
          id: string
          user_id: string
          listing_key: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          listing_key: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['saved_listings']['Insert']>
      }
      visits: {
        Row: {
          id: string
          visit_id: string
          path: string | null
          referrer: string | null
          user_agent: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          visit_id: string
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['visits']['Insert']>
      }
      listing_views: {
        Row: {
          id: string
          listing_key: string
          city: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          listing_key: string
          city?: string | null
          viewed_at?: string
        }
        Update: Partial<Database['public']['Tables']['listing_views']['Insert']>
      }
      site_pages: {
        Row: {
          id: string
          key: string
          title: string | null
          body_html: string | null
        }
        Insert: {
          id?: string
          key: string
          title?: string | null
          body_html?: string | null
        }
        Update: Partial<Database['public']['Tables']['site_pages']['Insert']>
      }
      admin_roles: {
        Row: {
          id: string
          email: string
          role: string
          broker_id: string | null
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role: string
          broker_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['admin_roles']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
