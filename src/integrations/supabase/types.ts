export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      dim_anslag: {
        Row: {
          anslag_id: number
          area_id: number
          code: string
          name_en: string | null
          name_sv: string
        }
        Insert: {
          anslag_id: number
          area_id: number
          code: string
          name_en?: string | null
          name_sv: string
        }
        Update: {
          anslag_id?: number
          area_id?: number
          code?: string
          name_en?: string | null
          name_sv?: string
        }
        Relationships: [
          {
            foreignKeyName: "dim_anslag_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "dim_area"
            referencedColumns: ["area_id"]
          },
        ]
      }
      dim_area: {
        Row: {
          area_id: number
          code: string
          name_en: string | null
          name_sv: string
          sort_order: number
        }
        Insert: {
          area_id: number
          code: string
          name_en?: string | null
          name_sv: string
          sort_order: number
        }
        Update: {
          area_id?: number
          code?: string
          name_en?: string | null
          name_sv?: string
          sort_order?: number
        }
        Relationships: []
      }
      dim_party: {
        Row: {
          code: string
          color_hex: string
          name_sv: string
          party_id: number
        }
        Insert: {
          code: string
          color_hex: string
          name_sv: string
          party_id: number
        }
        Update: {
          code?: string
          color_hex?: string
          name_sv?: string
          party_id?: number
        }
        Relationships: []
      }
      dim_year: {
        Row: {
          cpi_index: number | null
          gdp_nominal_sek: number | null
          is_historical: boolean
          year_id: number
        }
        Insert: {
          cpi_index?: number | null
          gdp_nominal_sek?: number | null
          is_historical?: boolean
          year_id: number
        }
        Update: {
          cpi_index?: number | null
          gdp_nominal_sek?: number | null
          is_historical?: boolean
          year_id?: number
        }
        Relationships: []
      }
      fact_budget: {
        Row: {
          amount_nominal_sek: number
          anslag_id: number | null
          area_id: number | null
          budget_type: string
          fact_id: number
          is_revenue: boolean
          party_id: number
          year_id: number
        }
        Insert: {
          amount_nominal_sek: number
          anslag_id?: number | null
          area_id?: number | null
          budget_type: string
          fact_id?: number
          is_revenue?: boolean
          party_id: number
          year_id: number
        }
        Update: {
          amount_nominal_sek?: number
          anslag_id?: number | null
          area_id?: number | null
          budget_type?: string
          fact_id?: number
          is_revenue?: boolean
          party_id?: number
          year_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fact_budget_anslag_id_fkey"
            columns: ["anslag_id"]
            isOneToOne: false
            referencedRelation: "dim_anslag"
            referencedColumns: ["anslag_id"]
          },
          {
            foreignKeyName: "fact_budget_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "dim_area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "fact_budget_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "dim_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "fact_budget_year_id_fkey"
            columns: ["year_id"]
            isOneToOne: false
            referencedRelation: "dim_year"
            referencedColumns: ["year_id"]
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

