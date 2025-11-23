// Auto-generated types from Supabase CLI
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'candidate'
          profession_id: string | null
          medical_field_id: string | null
          health_authority_id: string | null
          payment_status: 'paid' | 'unpaid' | 'pending'
          status: 'active' | 'suspended' | 'inactive'
          exam_access_enabled: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          last_login_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'admin' | 'candidate'
          profession_id?: string | null
          medical_field_id?: string | null
          health_authority_id?: string | null
          payment_status?: 'paid' | 'unpaid' | 'pending'
          status?: 'active' | 'suspended' | 'inactive'
          exam_access_enabled?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'candidate'
          profession_id?: string | null
          medical_field_id?: string | null
          health_authority_id?: string | null
          payment_status?: 'paid' | 'unpaid' | 'pending'
          status?: 'active' | 'suspended' | 'inactive'
          exam_access_enabled?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
      }
      // Add other table types as needed
      // This is a simplified version - generate full types from Supabase CLI
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

