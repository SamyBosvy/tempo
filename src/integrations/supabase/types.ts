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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          invited_at: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          invited_at?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          invited_at?: string | null
        }
        Relationships: []
      }
      checkin_dismissals: {
        Row: {
          created_at: string
          event_id: string
          local_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          local_date: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          local_date?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_ratings: {
        Row: {
          at: string
          event_id: string | null
          id: string
          intent_outcome: string | null
          kind: string
          local_date: string
          note: string | null
          primed: boolean | null
          rating: number
          user_id: string
        }
        Insert: {
          at: string
          event_id?: string | null
          id?: string
          intent_outcome?: string | null
          kind: string
          local_date: string
          note?: string | null
          primed?: boolean | null
          rating: number
          user_id?: string
        }
        Update: {
          at?: string
          event_id?: string | null
          id?: string
          intent_outcome?: string | null
          kind?: string
          local_date?: string
          note?: string | null
          primed?: boolean | null
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      event_flags: {
        Row: {
          end_at: string
          event_id: string
          reason: string | null
          start_at: string
          stressful: boolean
          user_id: string
        }
        Insert: {
          end_at: string
          event_id: string
          reason?: string | null
          start_at: string
          stressful: boolean
          user_id?: string
        }
        Update: {
          end_at?: string
          event_id?: string
          reason?: string | null
          start_at?: string
          stressful?: boolean
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          actual_min: number
          created_at: string
          done_note: string | null
          ended_at: string
          energy_after: number | null
          energy_before: number | null
          id: string
          intention: string | null
          parked_thoughts: string[] | null
          planned_min: number
          started_at: string
          user_id: string
        }
        Insert: {
          actual_min: number
          created_at?: string
          done_note?: string | null
          ended_at: string
          energy_after?: number | null
          energy_before?: number | null
          id?: string
          intention?: string | null
          parked_thoughts?: string[] | null
          planned_min: number
          started_at: string
          user_id?: string
        }
        Update: {
          actual_min?: number
          created_at?: string
          done_note?: string | null
          ended_at?: string
          energy_after?: number | null
          energy_before?: number | null
          id?: string
          intention?: string | null
          parked_thoughts?: string[] | null
          planned_min?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          google_email: string | null
          refresh_token_ciphertext: string
          updated_at: string
          user_id: string
        }
        Insert: {
          google_email?: string | null
          refresh_token_ciphertext: string
          updated_at?: string
          user_id: string
        }
        Update: {
          google_email?: string | null
          refresh_token_ciphertext?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interruptions: {
        Row: {
          at: string
          custom_label: string | null
          id: string
          reason: string
          session_id: string
          source: string | null
          user_id: string
        }
        Insert: {
          at: string
          custom_label?: string | null
          id?: string
          reason: string
          session_id: string
          source?: string | null
          user_id?: string
        }
        Update: {
          at?: string
          custom_label?: string | null
          id?: string
          reason?: string
          session_id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interruptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_blocks: {
        Row: {
          end_at: string
          id: string
          kind: string
          label: string | null
          start_at: string
          user_id: string
        }
        Insert: {
          end_at: string
          id?: string
          kind: string
          label?: string | null
          start_at: string
          user_id?: string
        }
        Update: {
          end_at?: string
          id?: string
          kind?: string
          label?: string | null
          start_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prime_sessions: {
        Row: {
          at: string
          duration_s: number
          event_id: string | null
          id: string
          intention: string | null
          pattern: string
          user_id: string
        }
        Insert: {
          at: string
          duration_s: number
          event_id?: string | null
          id?: string
          intention?: string | null
          pattern: string
          user_id?: string
        }
        Update: {
          at?: string
          duration_s?: number
          event_id?: string | null
          id?: string
          intention?: string | null
          pattern?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_blocks: {
        Row: {
          active: boolean
          created_at: string
          days: number[]
          end_time: string
          id: string
          kind: string
          label: string | null
          start_time: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days: number[]
          end_time: string
          id?: string
          kind: string
          label?: string | null
          start_time: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days?: number[]
          end_time?: string
          id?: string
          kind?: string
          label?: string | null
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_skips: {
        Row: {
          block_id: string
          local_date: string
          user_id: string
        }
        Insert: {
          block_id: string
          local_date: string
          user_id?: string
        }
        Update: {
          block_id?: string
          local_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_skips_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "recurring_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          breath_minutes: number
          breath_pattern: string
          calendar_ids: string[]
          custom_interruption: string | null
          daily_focus_target_min: number
          end_notify: boolean
          end_sound: boolean
          eyes_closed: boolean
          google_connected_at: string | null
          google_email: string | null
          keywords: string[]
          meeting_buffer_min: number
          min_focus_min: number
          notifications: boolean
          prime_lead_min: number
          safety_ack_at: string | null
          theme: string
          updated_at: string
          user_id: string
          vibration: boolean
          wake_lock: boolean
          work_end: string
          work_start: string
        }
        Insert: {
          breath_minutes?: number
          breath_pattern?: string
          calendar_ids?: string[]
          custom_interruption?: string | null
          daily_focus_target_min?: number
          end_notify?: boolean
          end_sound?: boolean
          eyes_closed?: boolean
          google_connected_at?: string | null
          google_email?: string | null
          keywords?: string[]
          meeting_buffer_min?: number
          min_focus_min?: number
          notifications?: boolean
          prime_lead_min?: number
          safety_ack_at?: string | null
          theme?: string
          updated_at?: string
          user_id: string
          vibration?: boolean
          wake_lock?: boolean
          work_end?: string
          work_start?: string
        }
        Update: {
          breath_minutes?: number
          breath_pattern?: string
          calendar_ids?: string[]
          custom_interruption?: string | null
          daily_focus_target_min?: number
          end_notify?: boolean
          end_sound?: boolean
          eyes_closed?: boolean
          google_connected_at?: string | null
          google_email?: string | null
          keywords?: string[]
          meeting_buffer_min?: number
          min_focus_min?: number
          notifications?: boolean
          prime_lead_min?: number
          safety_ack_at?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
          vibration?: boolean
          wake_lock?: boolean
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_insights: { Args: { _tz: string }; Returns: Json }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_members: {
        Args: { _limit: number; _offset: number }
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          total: number
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "member"
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
    Enums: {
      app_role: ["owner", "member"],
    },
  },
} as const
