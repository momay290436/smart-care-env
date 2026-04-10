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
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_5s: {
        Row: {
          auditor_id: string
          created_at: string
          department_id: string
          id: string
          notes: string | null
          photo_after: string | null
          photo_before: string | null
          score_json: Json
          total_score: number
        }
        Insert: {
          auditor_id: string
          created_at?: string
          department_id: string
          id?: string
          notes?: string | null
          photo_after?: string | null
          photo_before?: string | null
          score_json?: Json
          total_score?: number
        }
        Update: {
          auditor_id?: string
          created_at?: string
          department_id?: string
          id?: string
          notes?: string | null
          photo_after?: string | null
          photo_before?: string | null
          score_json?: Json
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_5s_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      chemical_transactions: {
        Row: {
          chemical_id: string
          created_at: string
          id: string
          notes: string | null
          performed_by: string
          quantity: number
          transaction_type: string
        }
        Insert: {
          chemical_id: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by: string
          quantity: number
          transaction_type: string
        }
        Update: {
          chemical_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string
          quantity?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chemical_transactions_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          },
        ]
      }
      chemicals: {
        Row: {
          category: string
          created_at: string
          created_by: string
          current_stock: number
          department_id: string | null
          expiry_date: string | null
          first_aid_info: string
          ghs_pictograms: string[]
          id: string
          min_stock: number
          msds_url: string | null
          name_en: string
          name_th: string
          qr_code_data: string | null
          storage_building: string
          storage_floor: string
          storage_room: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          current_stock?: number
          department_id?: string | null
          expiry_date?: string | null
          first_aid_info?: string
          ghs_pictograms?: string[]
          id?: string
          min_stock?: number
          msds_url?: string | null
          name_en?: string
          name_th: string
          qr_code_data?: string | null
          storage_building?: string
          storage_floor?: string
          storage_room?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          current_stock?: number
          department_id?: string | null
          expiry_date?: string | null
          first_aid_info?: string
          ghs_pictograms?: string[]
          id?: string
          min_stock?: number
          msds_url?: string | null
          name_en?: string
          name_th?: string
          qr_code_data?: string | null
          storage_building?: string
          storage_floor?: string
          storage_room?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chemicals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      department_qr_points: {
        Row: {
          created_at: string
          department_id: string
          id: string
          point_name: string
          qr_code_data: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          point_name: string
          qr_code_data?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          point_name?: string
          qr_code_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_qr_points_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      department_staff_count: {
        Row: {
          created_at: string
          department_id: string
          id: string
          total_staff: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          total_staff?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          total_staff?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_staff_count_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      env_round_items: {
        Row: {
          category: string
          created_at: string
          id: string
          item_name: string
          notes: string | null
          photo_url: string | null
          result: string
          round_id: string
          severity: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          item_name: string
          notes?: string | null
          photo_url?: string | null
          result?: string
          round_id: string
          severity?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_name?: string
          notes?: string | null
          photo_url?: string | null
          result?: string
          round_id?: string
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "env_round_items_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "env_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      env_rounds: {
        Row: {
          completed_at: string | null
          created_at: string
          department_id: string | null
          id: string
          inspector_id: string
          inspector_name: string
          notes: string | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          inspector_id: string
          inspector_name?: string
          notes?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          inspector_id?: string
          inspector_name?: string
          notes?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "env_rounds_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          department_id: string | null
          id: string
          name: string
          qr_code_url: string | null
          qr_image_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          qr_code_url?: string | null
          qr_image_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          qr_code_url?: string | null
          qr_image_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      evacuation_beds: {
        Row: {
          bed_number: string
          created_at: string
          has_patient: boolean
          id: string
          is_safe: boolean
          patient_name: string | null
          priority: number
          safe_at: string | null
          updated_at: string
          ward: string
        }
        Insert: {
          bed_number: string
          created_at?: string
          has_patient?: boolean
          id?: string
          is_safe?: boolean
          patient_name?: string | null
          priority?: number
          safe_at?: string | null
          updated_at?: string
          ward?: string
        }
        Update: {
          bed_number?: string
          created_at?: string
          has_patient?: boolean
          id?: string
          is_safe?: boolean
          patient_name?: string | null
          priority?: number
          safe_at?: string | null
          updated_at?: string
          ward?: string
        }
        Relationships: []
      }
      evacuation_events: {
        Row: {
          building: string
          created_at: string
          floor: string | null
          id: string
          notes: string | null
          patients_safe: number
          patients_total: number
          reported_by: string
          resolved_at: string | null
          staff_safe: number
          staff_total: number
          status: string
          visitors_safe: number
        }
        Insert: {
          building: string
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          patients_safe?: number
          patients_total?: number
          reported_by: string
          resolved_at?: string | null
          staff_safe?: number
          staff_total?: number
          status?: string
          visitors_safe?: number
        }
        Update: {
          building?: string
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          patients_safe?: number
          patients_total?: number
          reported_by?: string
          resolved_at?: string | null
          staff_safe?: number
          staff_total?: number
          status?: string
          visitors_safe?: number
        }
        Relationships: []
      }
      fire_equipment_positions: {
        Row: {
          building: string | null
          created_at: string
          equipment_type: string
          floor: string | null
          id: string
          label: string
          status: string
          sub_type: string | null
          x: number
          y: number
        }
        Insert: {
          building?: string | null
          created_at?: string
          equipment_type?: string
          floor?: string | null
          id?: string
          label: string
          status?: string
          sub_type?: string | null
          x?: number
          y?: number
        }
        Update: {
          building?: string | null
          created_at?: string
          equipment_type?: string
          floor?: string | null
          id?: string
          label?: string
          status?: string
          sub_type?: string | null
          x?: number
          y?: number
        }
        Relationships: []
      }
      fire_extinguisher_checks: {
        Row: {
          checked_at: string
          checked_by: string
          condition_ok: boolean
          department_id: string | null
          id: string
          inspection_details: Json | null
          inspector_name: string | null
          location: string
          notes: string | null
          pressure_ok: boolean
        }
        Insert: {
          checked_at?: string
          checked_by: string
          condition_ok?: boolean
          department_id?: string | null
          id?: string
          inspection_details?: Json | null
          inspector_name?: string | null
          location: string
          notes?: string | null
          pressure_ok?: boolean
        }
        Update: {
          checked_at?: string
          checked_by?: string
          condition_ok?: boolean
          department_id?: string | null
          id?: string
          inspection_details?: Json | null
          inspector_name?: string | null
          location?: string
          notes?: string | null
          pressure_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fire_extinguisher_checks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      fire_extinguisher_locations: {
        Row: {
          building: string | null
          created_at: string
          detail: string | null
          floor: string | null
          id: string
          name: string
        }
        Insert: {
          building?: string | null
          created_at?: string
          detail?: string | null
          floor?: string | null
          id?: string
          name: string
        }
        Update: {
          building?: string | null
          created_at?: string
          detail?: string | null
          floor?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      maintenance_tickets: {
        Row: {
          created_at: string
          created_by: string
          department_id: string
          description: string | null
          id: string
          photo_url: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id: string
          description?: string | null
          id?: string
          photo_url?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string
          description?: string | null
          id?: string
          photo_url?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      page_permissions: {
        Row: {
          created_at: string
          id: string
          page_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_key?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_id: string
          created_at: string
          department_id: string | null
          full_name: string
          id: string
        }
        Insert: {
          auth_id: string
          created_at?: string
          department_id?: string | null
          full_name?: string
          id?: string
        }
        Update: {
          auth_id?: string
          created_at?: string
          department_id?: string | null
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tickets: {
        Row: {
          accepted_at: string | null
          assigned_technician_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          equipment_id: string
          id: string
          notes: string | null
          photo_url: string | null
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_technician_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          equipment_id: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_technician_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          equipment_id?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_tickets_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_tickets_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          department_id: string | null
          end_date: string | null
          event_type: string
          id: string
          notes: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          line_user_id: string | null
          name: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          line_user_id?: string | null
          name: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          line_user_id?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waste_logs: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          recorded_by: string
          waste_type: string
          weight: number
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          recorded_by: string
          waste_type: string
          weight?: number
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          recorded_by?: string
          waste_type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      water_meter_records: {
        Row: {
          created_at: string
          daily_total: number | null
          id: string
          meter_reading: number
          notes: string | null
          record_date: string
          record_time: string
          recorded_by: string
          recorder_name: string
          shift: string
          usage_amount: number
        }
        Insert: {
          created_at?: string
          daily_total?: number | null
          id?: string
          meter_reading?: number
          notes?: string | null
          record_date?: string
          record_time?: string
          recorded_by: string
          recorder_name?: string
          shift?: string
          usage_amount?: number
        }
        Update: {
          created_at?: string
          daily_total?: number | null
          id?: string
          meter_reading?: number
          notes?: string | null
          record_date?: string
          record_time?: string
          recorded_by?: string
          recorder_name?: string
          shift?: string
          usage_amount?: number
        }
        Relationships: []
      }
      water_quality_logs: {
        Row: {
          check_date: string
          check_point: string
          chlorine_value: number | null
          created_at: string
          id: string
          notes: string | null
          ph_value: number | null
          recorded_by: string
          status: string
          turbidity_value: number | null
        }
        Insert: {
          check_date?: string
          check_point?: string
          chlorine_value?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          ph_value?: number | null
          recorded_by: string
          status?: string
          turbidity_value?: number | null
        }
        Update: {
          check_date?: string
          check_point?: string
          chlorine_value?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          ph_value?: number | null
          recorded_by?: string
          status?: string
          turbidity_value?: number | null
        }
        Relationships: []
      }
      wayfinding_buildings: {
        Row: {
          aliases: string[]
          building_key: string
          category: string
          created_at: string
          description: string
          id: string
          name: string
          node_key: string
          short_name: string
          x: number
          y: number
        }
        Insert: {
          aliases?: string[]
          building_key: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          node_key: string
          short_name?: string
          x?: number
          y?: number
        }
        Update: {
          aliases?: string[]
          building_key?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          node_key?: string
          short_name?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "wayfinding_buildings_node_key_fkey"
            columns: ["node_key"]
            isOneToOne: false
            referencedRelation: "wayfinding_nodes"
            referencedColumns: ["node_key"]
          },
        ]
      }
      wayfinding_edges: {
        Row: {
          created_at: string
          from_node_key: string
          id: string
          to_node_key: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          from_node_key: string
          id?: string
          to_node_key: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          from_node_key?: string
          id?: string
          to_node_key?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wayfinding_edges_from_node_key_fkey"
            columns: ["from_node_key"]
            isOneToOne: false
            referencedRelation: "wayfinding_nodes"
            referencedColumns: ["node_key"]
          },
          {
            foreignKeyName: "wayfinding_edges_to_node_key_fkey"
            columns: ["to_node_key"]
            isOneToOne: false
            referencedRelation: "wayfinding_nodes"
            referencedColumns: ["node_key"]
          },
        ]
      }
      wayfinding_nodes: {
        Row: {
          created_at: string
          id: string
          is_assembly_point: boolean
          label: string
          node_key: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_assembly_point?: boolean
          label?: string
          node_key: string
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_assembly_point?: boolean
          label?: string
          node_key?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      wayfinding_routes: {
        Row: {
          created_at: string
          description: string
          from_building_key: string
          id: string
          node_path: string[]
          to_building_key: string
        }
        Insert: {
          created_at?: string
          description?: string
          from_building_key: string
          id?: string
          node_path?: string[]
          to_building_key: string
        }
        Update: {
          created_at?: string
          description?: string
          from_building_key?: string
          id?: string
          node_path?: string[]
          to_building_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_department_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "technician" | "manager"
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
    Enums: {
      app_role: ["admin", "user", "technician", "manager"],
    },
  },
} as const
