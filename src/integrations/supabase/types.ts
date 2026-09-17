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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          source_activity_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          source_activity_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          source_activity_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "action_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_source_activity_id_fkey"
            columns: ["source_activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          commitments: Json
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          key_dates: Json
          occurred_at: string
          project_id: string
          source_id: string | null
          source_type: string
          summary: string
        }
        Insert: {
          commitments?: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_dates?: Json
          occurred_at?: string
          project_id: string
          source_id?: string | null
          source_type: string
          summary: string
        }
        Update: {
          commitments?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_dates?: Json
          occurred_at?: string
          project_id?: string
          source_id?: string | null
          source_type?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      call_notes: {
        Row: {
          call_date: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          note_text: string
          participants: string | null
          project_id: string
        }
        Insert: {
          call_date?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_text: string
          participants?: string | null
          project_id: string
        }
        Update: {
          call_date?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_text?: string
          participants?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "call_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string | null
          stale_after_days: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug?: string | null
          stale_after_days?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string | null
          stale_after_days?: number
        }
        Relationships: []
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_inboxes: {
        Row: {
          access_token: string | null
          company_id: string
          connected_at: string
          email_address: string
          id: string
          last_synced_at: string | null
          ms_account_id: string | null
          provider: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          company_id: string
          connected_at?: string
          email_address: string
          id?: string
          last_synced_at?: string | null
          ms_account_id?: string | null
          provider?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          company_id?: string
          connected_at?: string
          email_address?: string
          id?: string
          last_synced_at?: string | null
          ms_account_id?: string | null
          provider?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_inboxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_continuing: boolean
          is_predefined: boolean
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_continuing?: boolean
          is_predefined?: boolean
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_continuing?: boolean
          is_predefined?: boolean
          name?: string
          status?: string
        }
        Relationships: []
      }
      consultants: {
        Row: {
          auth_user_id: string | null
          category_id: string
          created_at: string
          email: string
          id: string
          name: string
          service_postcode: string | null
        }
        Insert: {
          auth_user_id?: string | null
          category_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          service_postcode?: string | null
        }
        Update: {
          auth_user_id?: string | null
          category_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          service_postcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "consultant_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_checklist_items: {
        Row: {
          id: string
          phase_id: string
          position: number
          title: string
        }
        Insert: {
          id?: string
          phase_id: string
          position: number
          title: string
        }
        Update: {
          id?: string
          phase_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_checklist_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_phases: {
        Row: {
          id: string
          name: string
          position: number
        }
        Insert: {
          id?: string
          name: string
          position: number
        }
        Update: {
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_categories: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          phase: string | null
          project_id: string
          reason: string | null
          source: string
          status: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          phase?: string | null
          project_id: string
          reason?: string | null
          source?: string
          status?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          phase?: string | null
          project_id?: string
          reason?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "consultant_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklist_items: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          expected_at: string | null
          id: string
          phase_id: string
          position: number
          project_id: string
          status: string
          template_item_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          expected_at?: string | null
          id?: string
          phase_id: string
          position?: number
          project_id: string
          status?: string
          template_item_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          expected_at?: string | null
          id?: string
          phase_id?: string
          position?: number
          project_id?: string
          status?: string
          template_item_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          company_id: string
          file_name: string
          file_path: string
          id: string
          project_id: string
          uploaded_at: string
        }
        Insert: {
          company_id: string
          file_name: string
          file_path: string
          id?: string
          project_id: string
          uploaded_at?: string
        }
        Update: {
          company_id?: string
          file_name?: string
          file_path?: string
          id?: string
          project_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          company_id: string
          id: string
          phase: string
          project_id: string
          started_at: string
        }
        Insert: {
          company_id: string
          id?: string
          phase: string
          project_id: string
          started_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          phase?: string
          project_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string
          company_id: string
          created_at: string
          current_phase: string | null
          id: string
          name: string
          owner_id: string
          postcode: string | null
          project_type: string | null
          status: string
        }
        Insert: {
          address: string
          company_id: string
          created_at?: string
          current_phase?: string | null
          id?: string
          name: string
          owner_id: string
          postcode?: string | null
          project_type?: string | null
          status?: string
        }
        Update: {
          address?: string
          company_id?: string
          created_at?: string
          current_phase?: string | null
          id?: string
          name?: string
          owner_id?: string
          postcode?: string | null
          project_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          category_id: string
          company_id: string
          consultant_id: string
          created_at: string
          fee_amount: number | null
          id: string
          invite_token: string
          payment_terms: string | null
          project_id: string
          start_availability: string | null
          status: string
          submitted_at: string | null
          turnaround: string | null
        }
        Insert: {
          category_id: string
          company_id: string
          consultant_id: string
          created_at?: string
          fee_amount?: number | null
          id?: string
          invite_token: string
          payment_terms?: string | null
          project_id: string
          start_availability?: string | null
          status?: string
          submitted_at?: string | null
          turnaround?: string | null
        }
        Update: {
          category_id?: string
          company_id?: string
          consultant_id?: string
          created_at?: string
          fee_amount?: number | null
          id?: string
          invite_token?: string
          payment_terms?: string | null
          project_id?: string
          start_availability?: string | null
          status?: string
          submitted_at?: string | null
          turnaround?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "consultant_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_scope_items: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          item_text: string
          position: number
          project_id: string
          source: string
          updated_at: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          item_text: string
          position?: number
          project_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          item_text?: string
          position?: number
          project_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_scope_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "consultant_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_scope_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfq_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tagged_emails: {
        Row: {
          activity_id: string | null
          body_preview: string | null
          company_id: string
          connection_id: string | null
          from_address: string | null
          id: string
          ms_message_id: string
          parse_status: string
          parsed_at: string | null
          project_id: string
          received_at: string | null
          subject: string | null
          tagged_at: string
          tagged_by: string | null
        }
        Insert: {
          activity_id?: string | null
          body_preview?: string | null
          company_id: string
          connection_id?: string | null
          from_address?: string | null
          id?: string
          ms_message_id: string
          parse_status?: string
          parsed_at?: string | null
          project_id: string
          received_at?: string | null
          subject?: string | null
          tagged_at?: string
          tagged_by?: string | null
        }
        Update: {
          activity_id?: string | null
          body_preview?: string | null
          company_id?: string
          connection_id?: string | null
          from_address?: string | null
          id?: string
          ms_message_id?: string
          parse_status?: string
          parsed_at?: string | null
          project_id?: string
          received_at?: string | null
          subject?: string | null
          tagged_at?: string
          tagged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tagged_emails_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tagged_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tagged_emails_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connected_inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tagged_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_status"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tagged_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      project_activity_status: {
        Row: {
          company_id: string | null
          is_stale: boolean | null
          last_activity_at: string | null
          name: string | null
          project_id: string | null
          stale_after_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      is_company_member: { Args: { cid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
