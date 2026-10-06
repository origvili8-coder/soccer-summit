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
      league_settings: {
        Row: {
          id: number
          training_cost_per_point: number
          transfer_window_open: boolean
        }
        Insert: {
          id?: number
          training_cost_per_point?: number
          transfer_window_open?: boolean
        }
        Update: {
          id?: number
          training_cost_per_point?: number
          transfer_window_open?: boolean
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_formation: string
          away_ready: boolean
          away_score: number
          away_team_id: string
          away_xi: Json
          created_at: string
          events: Json
          home_formation: string
          home_ready: boolean
          home_score: number
          home_team_id: string
          home_xi: Json
          id: string
          is_friendly: boolean
          round_id: string | null
          started_at: string | null
          stats: Json
          status: string
          subs: Json
        }
        Insert: {
          away_formation?: string
          away_ready?: boolean
          away_score?: number
          away_team_id: string
          away_xi?: Json
          created_at?: string
          events?: Json
          home_formation?: string
          home_ready?: boolean
          home_score?: number
          home_team_id: string
          home_xi?: Json
          id?: string
          is_friendly?: boolean
          round_id?: string | null
          started_at?: string | null
          stats?: Json
          status?: string
          subs?: Json
        }
        Update: {
          away_formation?: string
          away_ready?: boolean
          away_score?: number
          away_team_id?: string
          away_xi?: Json
          created_at?: string
          events?: Json
          home_formation?: string
          home_ready?: boolean
          home_score?: number
          home_team_id?: string
          home_xi?: Json
          id?: string
          is_friendly?: boolean
          round_id?: string | null
          started_at?: string | null
          stats?: Json
          status?: string
          subs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          match_id: string | null
          offer_id: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string | null
          offer_id?: string | null
          recipient_id: string
          sender_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string | null
          offer_id?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "transfer_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          asking_price: number
          assists: number
          avatar_url: string | null
          created_at: string
          detailed_position: string
          goals: number
          id: string
          loan_from_team_id: string | null
          loan_until_round: number | null
          name: string
          position: Database["public"]["Enums"]["player_position"]
          rating: number
          red_cards: number
          suspended_matches: number
          team_id: string | null
          transfer_listed: boolean
          yellow_cards: number
        }
        Insert: {
          asking_price?: number
          assists?: number
          avatar_url?: string | null
          created_at?: string
          detailed_position?: string
          goals?: number
          id?: string
          loan_from_team_id?: string | null
          loan_until_round?: number | null
          name: string
          position: Database["public"]["Enums"]["player_position"]
          rating?: number
          red_cards?: number
          suspended_matches?: number
          team_id?: string | null
          transfer_listed?: boolean
          yellow_cards?: number
        }
        Update: {
          asking_price?: number
          assists?: number
          avatar_url?: string | null
          created_at?: string
          detailed_position?: string
          goals?: number
          id?: string
          loan_from_team_id?: string | null
          loan_until_round?: number | null
          name?: string
          position?: Database["public"]["Enums"]["player_position"]
          rating?: number
          red_cards?: number
          suspended_matches?: number
          team_id?: string | null
          transfer_listed?: boolean
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_loan_from_team_id_fkey"
            columns: ["loan_from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          team_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          team_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          team_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          id: string
          number: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: number
          status?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          bench: Json
          budget: number
          color: string
          created_at: string
          formation: string
          id: string
          lineup: Json
          logo_url: string | null
          name: string
          short_name: string
        }
        Insert: {
          bench?: Json
          budget?: number
          color?: string
          created_at?: string
          formation?: string
          id?: string
          lineup?: Json
          logo_url?: string | null
          name: string
          short_name?: string
        }
        Update: {
          bench?: Json
          budget?: number
          color?: string
          created_at?: string
          formation?: string
          id?: string
          lineup?: Json
          logo_url?: string | null
          name?: string
          short_name?: string
        }
        Relationships: []
      }
      transfer_offers: {
        Row: {
          amount: number
          buyer_team_id: string
          created_at: string
          created_by: string
          id: string
          kind: string
          loan_rounds: number | null
          player_id: string
          seller_team_id: string
          status: string
        }
        Insert: {
          amount: number
          buyer_team_id: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          loan_rounds?: number | null
          player_id: string
          seller_team_id: string
          status?: string
        }
        Update: {
          amount?: number
          buyer_team_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          loan_rounds?: number | null
          player_id?: string
          seller_team_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_offers_buyer_team_id_fkey"
            columns: ["buyer_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_offers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_offers_seller_team_id_fkey"
            columns: ["seller_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_offer: { Args: { _offer_id: string }; Returns: undefined }
      cancel_or_reject_offer: {
        Args: { _offer_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_team_id: { Args: never; Returns: string }
      save_lineup: {
        Args: { _formation: string; _lineup: Json }
        Returns: undefined
      }
      save_lineup_v2: {
        Args: { _bench: Json; _formation: string; _lineup: Json }
        Returns: undefined
      }
      set_transfer_listing: {
        Args: { _listed: boolean; _player_id: string; _price: number }
        Returns: undefined
      }
      train_player: {
        Args: { _player_id: string; _points: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager"
      player_position: "GK" | "DEF" | "MID" | "FWD"
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
      app_role: ["admin", "manager"],
      player_position: ["GK", "DEF", "MID", "FWD"],
    },
  },
} as const
