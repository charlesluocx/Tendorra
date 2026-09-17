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
      project_categories: {
        Row: {
          category_id: string
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
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          file_name: string
          file_path: string
          id: string
          project_id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          project_id: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          project_id?: string
          uploaded_at?: string
        }
        Relationships: [
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
          id: string
          phase: string
          project_id: string
          started_at: string
        }
        Insert: {
          id?: string
          phase: string
          project_id: string
          started_at?: string
        }
        Update: {
          id?: string
          phase?: string
          project_id?: string
          started_at?: string
        }
        Relationships: [
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
          created_at?: string
          current_phase?: string | null
          id?: string
          name?: string
          owner_id?: string
          postcode?: string | null
          project_type?: string | null
          status?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          category_id: string
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
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_scope_items: {
        Row: {
          category_id: string
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
            foreignKeyName: "rfq_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
