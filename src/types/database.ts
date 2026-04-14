export type MemberRole = 'read' | 'write' | 'admin'
export type RequirementLevel = 'mandatory' | 'discuss'
export type CandidateStatus = 'to_see' | 'tried' | 'shortlist' | 'selected' | 'rejected'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          description: string
          share_code: string
          replacement_enabled: boolean
          created_at: string
          created_by: string
          is_active: boolean
          selected_candidate_id: string | null
          decision_notes: string
          decision_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string
          share_code?: string
          replacement_enabled?: boolean
          created_at?: string
          created_by: string
          is_active?: boolean
        }
        Update: {
          name?: string
          description?: string
          replacement_enabled?: boolean
          is_active?: boolean
          selected_candidate_id?: string | null
          decision_notes?: string
          decision_at?: string | null
        }
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: MemberRole
          joined_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: MemberRole
          joined_at?: string
        }
        Update: {
          role?: MemberRole
        }
      }
      current_vehicle: {
        Row: {
          id: string
          workspace_id: string
          brand: string
          model: string
          engine: string
          year: number | null
          options: string
          photo_attachment_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          brand?: string
          model?: string
          engine?: string
          year?: number | null
          options?: string
          photo_attachment_id?: string | null
        }
        Update: {
          brand?: string
          model?: string
          engine?: string
          year?: number | null
          options?: string
          photo_attachment_id?: string | null
        }
      }
      requirements: {
        Row: {
          id: string
          workspace_id: string
          label: string
          description: string
          level: RequirementLevel
          weight: number | null
          tags: string[]
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          label: string
          description?: string
          level?: RequirementLevel
          weight?: number | null
          tags?: string[]
          sort_order?: number
        }
        Update: {
          label?: string
          description?: string
          level?: RequirementLevel
          weight?: number | null
          tags?: string[]
          sort_order?: number
        }
      }
      candidates: {
        Row: {
          id: string
          workspace_id: string
          brand: string
          model: string
          trim: string
          engine: string
          price: number | null
          options: string
          garage_location: string
          manufacturer_url: string
          event_date: string | null
          status: CandidateStatus
          reject_reason: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          brand?: string
          model?: string
          trim?: string
          engine?: string
          price?: number | null
          options?: string
          garage_location?: string
          manufacturer_url?: string
          event_date?: string | null
          status?: CandidateStatus
          reject_reason?: string
        }
        Update: {
          brand?: string
          model?: string
          trim?: string
          engine?: string
          price?: number | null
          options?: string
          garage_location?: string
          manufacturer_url?: string
          event_date?: string | null
          status?: CandidateStatus
          reject_reason?: string
        }
      }
      candidate_specs: {
        Row: {
          candidate_id: string
          specs: Json
          updated_at: string
        }
        Insert: {
          candidate_id: string
          specs?: Json
        }
        Update: {
          specs?: Json
        }
      }
      candidate_reviews: {
        Row: {
          id: string
          candidate_id: string
          user_id: string
          score: number
          free_text: string
          pros: string
          cons: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          user_id: string
          score: number
          free_text?: string
          pros?: string
          cons?: string
        }
        Update: {
          score?: number
          free_text?: string
          pros?: string
          cons?: string
        }
      }
      notes: {
        Row: {
          id: string
          workspace_id: string
          body: string
          updated_at: string
          updated_by: string | null
          edit_lock_user_id: string | null
          edit_lock_expires_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          body?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          updated_by?: string | null
          edit_lock_user_id?: string | null
          edit_lock_expires_at?: string | null
        }
      }
      comments: {
        Row: {
          id: string
          candidate_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          user_id: string
          body: string
        }
        Update: never
      }
      activity_log: {
        Row: {
          id: string
          workspace_id: string
          user_id: string | null
          action_type: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id?: string | null
          action_type: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json
        }
        Update: never
      }
      attachments: {
        Row: {
          id: string
          workspace_id: string
          candidate_id: string | null
          storage_path: string
          mime_type: string
          size_bytes: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          candidate_id?: string | null
          storage_path: string
          mime_type?: string
          size_bytes: number
          created_by: string
        }
        Update: never
      }
    }
    Functions: {
      join_workspace: { Args: { p_code: string }; Returns: string }
    }
  }
}
