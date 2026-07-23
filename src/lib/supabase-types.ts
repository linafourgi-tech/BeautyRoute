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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_history: {
        Row: {
          ai_response: Json
          client_id: string
          confidence_score: number | null
          generated_at: string
          id: string
          input_context: Json
          insight_type: string
          model_name: string
          tokens_used: number | null
          workspace_id: string
        }
        Insert: {
          ai_response: Json
          client_id: string
          confidence_score?: number | null
          generated_at?: string
          id?: string
          input_context: Json
          insight_type: string
          model_name: string
          tokens_used?: number | null
          workspace_id: string
        }
        Update: {
          ai_response?: Json
          client_id?: string
          confidence_score?: number | null
          generated_at?: string
          id?: string
          input_context?: Json
          insight_type?: string
          model_name?: string
          tokens_used?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          custom_price: number | null
          id: string
          service_id: string
        }
        Insert: {
          appointment_id: string
          custom_price?: number | null
          id?: string
          service_id: string
        }
        Update: {
          appointment_id?: string
          custom_price?: number | null
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_staff_id: string | null
          client_id: string
          created_at: string
          deposit_amount: number | null
          end_time: string
          id: string
          is_deposit_paid: boolean
          location_address: string | null
          notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_staff_id?: string | null
          client_id: string
          created_at?: string
          deposit_amount?: number | null
          end_time: string
          id?: string
          is_deposit_paid?: boolean
          location_address?: string | null
          notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_staff_id?: string | null
          client_id?: string
          created_at?: string
          deposit_amount?: number | null
          end_time?: string
          id?: string
          is_deposit_paid?: boolean
          location_address?: string | null
          notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_at: string
          record_id: string
          table_name: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          record_id: string
          table_name: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          record_id?: string
          table_name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          client_id: string
          tag_id: string
        }
        Insert: {
          client_id: string
          tag_id: string
        }
        Update: {
          client_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          allergies: string[] | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          instagram: string | null
          internal_notes: string | null
          last_visit_at: string | null
          next_appointment_at: string | null
          occupation: string | null
          phone: string | null
          tier: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allergies?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          instagram?: string | null
          internal_notes?: string | null
          last_visit_at?: string | null
          next_appointment_at?: string | null
          occupation?: string | null
          phone?: string | null
          tier?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allergies?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          instagram?: string | null
          internal_notes?: string | null
          last_visit_at?: string | null
          next_appointment_at?: string | null
          occupation?: string | null
          phone?: string | null
          tier?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          incurred_at: string
          receipt_file_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          incurred_at?: string
          receipt_file_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          incurred_at?: string
          receipt_file_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_purpose: string
          file_type: string
          file_url: string
          id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_purpose: string
          file_type: string
          file_url: string
          id?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_purpose?: string
          file_type?: string
          file_url?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          read_at: string | null
          recipient_profile_id: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          title: string
          workspace_id: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_profile_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title: string
          workspace_id: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_profile_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      revenues: {
        Row: {
          discount_amount: number | null
          gross_amount: number
          id: string
          invoice_number: string | null
          net_total: number | null
          payment_method: string
          processed_at: string
          tax_amount: number | null
          tip_amount: number | null
          visit_id: string | null
          workspace_id: string
        }
        Insert: {
          discount_amount?: number | null
          gross_amount: number
          id?: string
          invoice_number?: string | null
          net_total?: number | null
          payment_method: string
          processed_at?: string
          tax_amount?: number | null
          tip_amount?: number | null
          visit_id?: string | null
          workspace_id: string
        }
        Update: {
          discount_amount?: number | null
          gross_amount?: number
          id?: string
          invoice_number?: string | null
          net_total?: number | null
          payment_method?: string
          processed_at?: string
          tax_amount?: number | null
          tip_amount?: number | null
          visit_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenues_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          color_hex: string
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          workspace_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          color_hex?: string
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          color_hex?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color_hex: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color_hex?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color_hex?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          formula_data: Json
          id: string
          products_used: string[] | null
          staff_id: string | null
          summary_notes: string | null
          visit_date: string
          workspace_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          formula_data?: Json
          id?: string
          products_used?: string[] | null
          staff_id?: string | null
          summary_notes?: string | null
          visit_date?: string
          workspace_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          formula_data?: Json
          id?: string
          products_used?: string[] | null
          staff_id?: string | null
          summary_notes?: string | null
          visit_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          billing_meta: Json
          booking_rules: Json
          business_hours: Json
          notification_triggers: Json
          social_links: Json
          theme_config: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_meta?: Json
          booking_rules?: Json
          business_hours?: Json
          notification_triggers?: Json
          social_links?: Json
          theme_config?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_meta?: Json
          booking_rules?: Json
          business_hours?: Json
          notification_triggers?: Json
          social_links?: Json
          theme_config?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_staff: {
        Row: {
          base_commission_pct: number | null
          id: string
          is_active: boolean
          joined_at: string
          profile_id: string
          workspace_id: string
        }
        Insert: {
          base_commission_pct?: number | null
          id?: string
          is_active?: boolean
          joined_at?: string
          profile_id: string
          workspace_id: string
        }
        Update: {
          base_commission_pct?: number | null
          id?: string
          is_active?: boolean
          joined_at?: string
          profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_staff_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          city: string | null
          created_at: string
          currency: string
          display_brand: string
          district: string | null
          id: string
          locale: string
          name: string
          owner_id: string
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          currency?: string
          display_brand: string
          district?: string | null
          id?: string
          locale?: string
          name: string
          owner_id: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          currency?: string
          display_brand?: string
          district?: string | null
          id?: string
          locale?: string
          name?: string
          owner_id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_member: { Args: { workspace: string }; Returns: boolean }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "noshow"
      notification_channel: "app" | "whatsapp" | "sms" | "email"
      plan_tier: "Starter" | "Pro" | "Studio"
      service_category:
        | "consultation"
        | "haircut"
        | "styling"
        | "color"
        | "treatment"
        | "extensions"
        | "bridal"
        | "premium"
      user_role: "owner" | "staff" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "noshow",
      ],
      notification_channel: ["app", "whatsapp", "sms", "email"],
      plan_tier: ["Starter", "Pro", "Studio"],
      service_category: [
        "consultation",
        "haircut",
        "styling",
        "color",
        "treatment",
        "extensions",
        "bridal",
        "premium",
      ],
      user_role: ["owner", "staff", "admin"],
    },
  },
} as const
