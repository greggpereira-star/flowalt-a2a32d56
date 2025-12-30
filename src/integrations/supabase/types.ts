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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          card_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_folders: {
        Row: {
          card_id: string
          created_at: string
          folder_id: string
          id: string
          sort_order: number | null
        }
        Insert: {
          card_id: string
          created_at?: string
          folder_id: string
          id?: string
          sort_order?: number | null
        }
        Update: {
          card_id?: string
          created_at?: string
          folder_id?: string
          id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_folders_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_folders_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      card_members: {
        Row: {
          card_id: string
          created_at: string
          function_title: string | null
          hourly_rate: number | null
          id: string
          is_owner: boolean | null
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          function_title?: string | null
          hourly_rate?: number | null
          id?: string
          is_owner?: boolean | null
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          function_title?: string | null
          hourly_rate?: number | null
          id?: string
          is_owner?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_members_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          actual_hours: number | null
          briefing_completed: boolean | null
          briefing_data: Json | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          owner_id: string | null
          sort_order: number | null
          space_id: string
          status: Database["public"]["Enums"]["card_status"]
          title: string
          traffic_briefing_data: Json | null
          updated_at: string
          urgency: Database["public"]["Enums"]["card_urgency"]
          workspace_id: string
        }
        Insert: {
          actual_hours?: number | null
          briefing_completed?: boolean | null
          briefing_data?: Json | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          owner_id?: string | null
          sort_order?: number | null
          space_id: string
          status?: Database["public"]["Enums"]["card_status"]
          title: string
          traffic_briefing_data?: Json | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["card_urgency"]
          workspace_id: string
        }
        Update: {
          actual_hours?: number | null
          briefing_completed?: boolean | null
          briefing_data?: Json | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          owner_id?: string | null
          sort_order?: number | null
          space_id?: string
          status?: Database["public"]["Enums"]["card_status"]
          title?: string
          traffic_briefing_data?: Json | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["card_urgency"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          assignee_id: string | null
          card_id: string
          completed_at: string | null
          created_at: string
          function_title: string | null
          id: string
          is_completed: boolean | null
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          card_id: string
          completed_at?: string | null
          created_at?: string
          function_title?: string | null
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          card_id?: string
          completed_at?: string | null
          created_at?: string
          function_title?: string | null
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
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
      comments: {
        Row: {
          card_id: string
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      dependencies: {
        Row: {
          blocking_card_id: string | null
          blocking_checklist_id: string | null
          created_at: string
          dependent_card_id: string | null
          dependent_checklist_id: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          blocking_card_id?: string | null
          blocking_checklist_id?: string | null
          created_at?: string
          dependent_card_id?: string | null
          dependent_checklist_id?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          blocking_card_id?: string | null
          blocking_checklist_id?: string | null
          created_at?: string
          dependent_card_id?: string | null
          dependent_checklist_id?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_blocking_card_id_fkey"
            columns: ["blocking_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_blocking_checklist_id_fkey"
            columns: ["blocking_checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_dependent_card_id_fkey"
            columns: ["dependent_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_dependent_checklist_id_fkey"
            columns: ["dependent_checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          is_personal: boolean | null
          name: string
          owner_id: string | null
          sort_order: number | null
          space_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_personal?: boolean | null
          name: string
          owner_id?: string | null
          sort_order?: number | null
          space_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_personal?: boolean | null
          name?: string
          owner_id?: string | null
          sort_order?: number | null
          space_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_workspace_id_fkey"
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
          email: string
          full_name: string | null
          hourly_rate: number | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          hourly_rate?: number | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spaces: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          name: string
          settings: Json | null
          sort_order: number | null
          type: Database["public"]["Enums"]["space_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          settings?: Json | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["space_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          settings?: Json | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["space_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_cards: {
        Row: {
          added_at: string
          added_by: string | null
          card_id: string
          id: string
          sprint_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          card_id: string
          id?: string
          sprint_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          card_id?: string
          id?: string
          sprint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_cards_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          allocated_hours: number | null
          capacity_hours: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          goal: string | null
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allocated_hours?: number | null
          capacity_hours?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          goal?: string | null
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allocated_hours?: number | null
          capacity_hours?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          goal?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          card_id: string
          checklist_id: string | null
          created_at: string
          duration_seconds: number
          ended_at: string | null
          function_title: string | null
          id: string
          is_running: boolean | null
          notes: string | null
          started_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          card_id: string
          checklist_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          function_title?: string | null
          id?: string
          is_running?: boolean | null
          notes?: string | null
          started_at: string
          user_id: string
          workspace_id: string
        }
        Update: {
          card_id?: string
          checklist_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          function_title?: string | null
          id?: string
          is_running?: boolean | null
          notes?: string | null
          started_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          department: string | null
          function_title: string | null
          id: string
          is_active: boolean | null
          joined_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          department?: string | null
          function_title?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          department?: string | null
          function_title?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["workspace_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["workspace_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_card_workspace: { Args: { _card_id: string }; Returns: string }
      has_admin_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "admin"
        | "coordinator"
        | "member"
        | "viewer"
      card_status:
        | "backlog"
        | "briefing"
        | "todo"
        | "in_progress"
        | "review"
        | "approved"
        | "delivered"
        | "archived"
      card_urgency: "low" | "medium" | "high" | "critical"
      space_type:
        | "designer"
        | "audiovisual"
        | "social_media"
        | "traffic"
        | "administrative"
        | "coordination"
        | "custom"
      workspace_status: "active" | "trial" | "suspended" | "inactive"
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
      app_role: [
        "super_admin",
        "owner",
        "admin",
        "coordinator",
        "member",
        "viewer",
      ],
      card_status: [
        "backlog",
        "briefing",
        "todo",
        "in_progress",
        "review",
        "approved",
        "delivered",
        "archived",
      ],
      card_urgency: ["low", "medium", "high", "critical"],
      space_type: [
        "designer",
        "audiovisual",
        "social_media",
        "traffic",
        "administrative",
        "coordination",
        "custom",
      ],
      workspace_status: ["active", "trial", "suspended", "inactive"],
    },
  },
} as const
