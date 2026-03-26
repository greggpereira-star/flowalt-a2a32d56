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
      access_logs: {
        Row: {
          access_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          access_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "access_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_estimates: {
        Row: {
          card_id: string | null
          confidence_score: number | null
          created_at: string
          estimated_hours: number
          id: string
          input_features: Json | null
          model_version: string
          workspace_id: string
        }
        Insert: {
          card_id?: string | null
          confidence_score?: number | null
          created_at?: string
          estimated_hours: number
          id?: string
          input_features?: Json | null
          model_version?: string
          workspace_id: string
        }
        Update: {
          card_id?: string | null
          confidence_score?: number | null
          created_at?: string
          estimated_hours?: number
          id?: string
          input_features?: Json | null
          model_version?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_estimates_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_estimates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_estimates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_approval_requests: {
        Row: {
          approver_id: string
          comment: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          id: string
          proposal_id: string
          status: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          proposal_id: string
          status?: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          proposal_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_approval_requests_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_approval_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          max_level_order: number | null
          min_level_order: number
          name: string
          notify_by_email: boolean
          notify_in_app: boolean
          required_approvers_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_level_order?: number | null
          min_level_order?: number
          name: string
          notify_by_email?: boolean
          notify_in_app?: boolean
          required_approvers_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_level_order?: number | null
          min_level_order?: number
          name?: string
          notify_by_email?: boolean
          notify_in_app?: boolean
          required_approvers_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_approval_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_approval_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_approvers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_senior: boolean
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_senior?: boolean
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_senior?: boolean
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_approvers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_approvers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_contract_services: {
        Row: {
          contract_id: string
          created_at: string
          hours_allocated: number
          id: string
          service_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          hours_allocated: number
          id?: string
          service_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          hours_allocated?: number
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_contract_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_services"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_contracts: {
        Row: {
          client_id: string | null
          client_name: string
          contracted_hours: number
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          level_id: string | null
          monthly_value: number
          proposal_id: string | null
          start_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          contracted_hours: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          level_id?: string | null
          monthly_value: number
          proposal_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          contracted_hours?: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          level_id?: string | null
          monthly_value?: number
          proposal_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_contracts_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_cost_params: {
        Row: {
          base_hourly_cost: number
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          overhead_percent: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          base_hourly_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          overhead_percent?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          base_hourly_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          overhead_percent?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_cost_params_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_cost_params_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_levels: {
        Row: {
          block_pdf_before_approval: boolean
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_active: boolean
          max_cost_per_hour: number
          max_hours: number
          max_monthly_price: number
          min_cost_per_hour: number
          min_hours: number
          min_monthly_price: number
          name: string
          requires_reinforced_approval: boolean
          target_margin_percent: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          block_pdf_before_approval?: boolean
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          max_cost_per_hour: number
          max_hours: number
          max_monthly_price: number
          min_cost_per_hour: number
          min_hours: number
          min_monthly_price: number
          name: string
          requires_reinforced_approval?: boolean
          target_margin_percent?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          block_pdf_before_approval?: boolean
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          max_cost_per_hour?: number
          max_hours?: number
          max_monthly_price?: number
          min_cost_per_hour?: number
          min_hours?: number
          min_monthly_price?: number
          name?: string
          requires_reinforced_approval?: boolean
          target_margin_percent?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_monthly_hours: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          notes: string | null
          realized_hours: number
          updated_at: string
          updated_by: string | null
          year_month: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          realized_hours?: number
          updated_at?: string
          updated_by?: string | null
          year_month: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          realized_hours?: number
          updated_at?: string
          updated_by?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_monthly_hours_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_proposal_history: {
        Row: {
          action: string
          comment: string | null
          created_at: string
          created_by: string | null
          from_status: string | null
          id: string
          metadata: Json | null
          proposal_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          proposal_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          proposal_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_proposal_history_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_proposal_items: {
        Row: {
          created_at: string
          hours_per_month: number
          id: string
          notes: string | null
          proposal_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_per_month: number
          id?: string
          notes?: string | null
          proposal_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_per_month?: number
          id?: string
          notes?: string | null
          proposal_id?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_proposal_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_services"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_proposals: {
        Row: {
          approval_comment: string | null
          approved_at: string | null
          approved_by: string | null
          calculated_level_id: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          estimated_cost: number | null
          estimated_margin_percent: number | null
          final_price: number | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          proposal_number: number
          seller_id: string
          sent_at: string | null
          status: string
          submitted_at: string | null
          suggested_max_price: number | null
          suggested_min_price: number | null
          total_hours: number
          updated_at: string
          won_at: string | null
          workspace_id: string
        }
        Insert: {
          approval_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_level_id?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          estimated_cost?: number | null
          estimated_margin_percent?: number | null
          final_price?: number | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          proposal_number?: number
          seller_id: string
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          suggested_max_price?: number | null
          suggested_min_price?: number | null
          total_hours?: number
          updated_at?: string
          won_at?: string | null
          workspace_id: string
        }
        Update: {
          approval_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_level_id?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          estimated_cost?: number | null
          estimated_margin_percent?: number | null
          final_price?: number | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          proposal_number?: number
          seller_id?: string
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          suggested_max_price?: number | null
          suggested_min_price?: number | null
          total_hours?: number
          updated_at?: string
          won_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_proposals_calculated_level_id_fkey"
            columns: ["calculated_level_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      altcontrol_services: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          minimum_level_id: string | null
          name: string
          requires_minimum_level: boolean
          service_type: string
          suggested_max_hours: number | null
          suggested_min_hours: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          minimum_level_id?: string | null
          name: string
          requires_minimum_level?: boolean
          service_type?: string
          suggested_max_hours?: number | null
          suggested_min_hours?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          minimum_level_id?: string | null
          name?: string
          requires_minimum_level?: boolean
          service_type?: string
          suggested_max_hours?: number | null
          suggested_min_hours?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altcontrol_services_minimum_level_id_fkey"
            columns: ["minimum_level_id"]
            isOneToOne: false
            referencedRelation: "altcontrol_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altcontrol_services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "altcontrol_services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          snapshot_date: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "analytics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          request_method: string
          request_path: string
          response_body: Json | null
          response_status: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          request_method: string
          request_path: string
          response_body?: Json | null
          response_status: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          request_method?: string
          request_path?: string
          response_body?: Json | null
          response_status?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[]
          rate_limit_per_hour: number | null
          rate_limit_per_minute: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[]
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_logs: {
        Row: {
          api_key_id: string | null
          correlation_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          request_size: number | null
          response_size: number | null
          response_time_ms: number | null
          status_code: number
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          api_key_id?: string | null
          correlation_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          request_size?: number | null
          response_size?: number | null
          response_time_ms?: number | null
          status_code: number
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          api_key_id?: string | null
          correlation_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          request_size?: number | null
          response_size?: number | null
          response_time_ms?: number | null
          status_code?: number
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "api_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          api_key_id: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          api_key_id?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      application_logs: {
        Row: {
          context: Json | null
          correlation_id: string | null
          created_at: string
          id: string
          level: string
          message: string
          service: string
          session_id: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          level: string
          message: string
          service: string
          session_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          service?: string
          session_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "application_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
          actor_type: string | null
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
          actor_type?: string | null
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
          actor_type?: string | null
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
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
      automation_logs: {
        Row: {
          action_result: Json | null
          action_type: string
          automation_id: string
          card_id: string
          error_message: string | null
          executed_at: string
          id: string
          success: boolean
          trigger_status: string
        }
        Insert: {
          action_result?: Json | null
          action_type: string
          automation_id: string
          card_id: string
          error_message?: string | null
          executed_at?: string
          id?: string
          success?: boolean
          trigger_status: string
        }
        Update: {
          action_result?: Json | null
          action_type?: string
          automation_id?: string
          card_id?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          success?: boolean
          trigger_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "card_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string | null
          bank_name: string | null
          bank_statement_amount: number
          bank_statement_date: string
          bank_statement_description: string | null
          bank_statement_type: string
          created_at: string
          difference_amount: number | null
          difference_reason: string | null
          external_id: string | null
          id: string
          invoice_id: string | null
          match_confidence: number | null
          match_reason: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          source: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bank_account_id?: string | null
          bank_name?: string | null
          bank_statement_amount: number
          bank_statement_date: string
          bank_statement_description?: string | null
          bank_statement_type: string
          created_at?: string
          difference_amount?: number | null
          difference_reason?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          source?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bank_account_id?: string | null
          bank_name?: string | null
          bank_statement_amount?: number
          bank_statement_date?: string
          bank_statement_description?: string | null
          bank_statement_type?: string
          created_at?: string
          difference_amount?: number | null
          difference_reason?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          source?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      base_calendar_events: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          generate_notice: boolean | null
          id: string
          is_national: boolean | null
          notice_days_before: number | null
          recurrence: string | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          generate_notice?: boolean | null
          id?: string
          is_national?: boolean | null
          notice_days_before?: number | null
          recurrence?: string | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          generate_notice?: boolean | null
          id?: string
          is_national?: boolean | null
          notice_days_before?: number | null
          recurrence?: string | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "base_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "card_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_custom_fields: {
        Row: {
          card_id: string
          created_at: string
          field_key: string
          field_value: string | null
          id: string
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          field_key: string
          field_value?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          field_key?: string
          field_value?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_custom_fields_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
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
      card_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          card_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          permission: string
          status: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          card_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          permission?: string
          status?: string
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          card_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permission?: string
          status?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_invites_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "card_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_kits: {
        Row: {
          actual_return_date: string | null
          card_id: string
          checkout_date: string | null
          created_at: string
          expected_return_date: string | null
          id: string
          item_id: string
          notes: string | null
          quantity_checked_out: number | null
          quantity_required: number | null
          responsible_user_id: string | null
          status: string | null
          unit_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_return_date?: string | null
          card_id: string
          checkout_date?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity_checked_out?: number | null
          quantity_required?: number | null
          responsible_user_id?: string | null
          status?: string | null
          unit_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_return_date?: string | null
          card_id?: string
          checkout_date?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity_checked_out?: number | null
          quantity_required?: number | null
          responsible_user_id?: string | null
          status?: string | null
          unit_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_kits_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_kits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_kits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "card_kits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "card_kits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_kits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "card_kits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "card_kits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_members: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          card_id: string
          created_at: string
          function_title: string | null
          hourly_rate: number | null
          id: string
          is_owner: boolean | null
          user_id: string
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          card_id: string
          created_at?: string
          function_title?: string | null
          hourly_rate?: number | null
          id?: string
          is_owner?: boolean | null
          user_id: string
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
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
      card_stage_history: {
        Row: {
          card_id: string
          created_at: string
          from_stage: string | null
          gates_failed: string[] | null
          gates_passed: string[] | null
          id: string
          reason: string | null
          time_in_previous_stage: string | null
          to_stage: string
          transition_type: string
          triggered_by: string | null
          workflow_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          from_stage?: string | null
          gates_failed?: string[] | null
          gates_passed?: string[] | null
          id?: string
          reason?: string | null
          time_in_previous_stage?: string | null
          to_stage: string
          transition_type?: string
          triggered_by?: string | null
          workflow_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          from_stage?: string | null
          gates_failed?: string[] | null
          gates_passed?: string[] | null
          id?: string
          reason?: string | null
          time_in_previous_stage?: string | null
          to_stage?: string
          transition_type?: string
          triggered_by?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_stage_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_stage_history_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          actual_hours: number | null
          briefing_completed: boolean | null
          briefing_data: Json | null
          card_type: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_stage: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          owner_id: string | null
          sort_order: number | null
          space_id: string
          stage_entered_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["card_status"]
          title: string
          traffic_briefing_data: Json | null
          updated_at: string
          urgency: Database["public"]["Enums"]["card_urgency"]
          visibility: string
          workflow_id: string | null
          workspace_id: string
        }
        Insert: {
          actual_hours?: number | null
          briefing_completed?: boolean | null
          briefing_data?: Json | null
          card_type?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          owner_id?: string | null
          sort_order?: number | null
          space_id: string
          stage_entered_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          title: string
          traffic_briefing_data?: Json | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["card_urgency"]
          visibility?: string
          workflow_id?: string | null
          workspace_id: string
        }
        Update: {
          actual_hours?: number | null
          briefing_completed?: boolean | null
          briefing_data?: Json | null
          card_type?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          owner_id?: string | null
          sort_order?: number | null
          space_id?: string
          stage_entered_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          title?: string
          traffic_briefing_data?: Json | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["card_urgency"]
          visibility?: string
          workflow_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
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
            foreignKeyName: "cards_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
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
      client_cards: {
        Row: {
          about_client: string | null
          agreed_deliverables: string | null
          brand_essence: string | null
          brand_files: Json | null
          challenges: string | null
          color: string | null
          competitors: string | null
          contract_end_date: string | null
          contract_notes: string | null
          contract_start_date: string | null
          contract_type: string | null
          contracted_services: string[] | null
          created_at: string
          created_by: string | null
          financial_state:
            | Database["public"]["Enums"]["client_financial_state"]
            | null
          health_score: number | null
          id: string
          important_links: Json | null
          keywords: string[] | null
          language_restrictions: string | null
          language_style: string | null
          legacy_client_id: string | null
          logo_url: string | null
          name: string
          objectives: string | null
          payment_day: number | null
          personality: string | null
          positioning: string | null
          products_services: string | null
          relationship_tone: string | null
          responsible_user_id: string | null
          scope_limits: string | null
          segment: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["client_status"]
          target_audience: string | null
          updated_at: string
          visual_guidelines: string | null
          workspace_id: string
        }
        Insert: {
          about_client?: string | null
          agreed_deliverables?: string | null
          brand_essence?: string | null
          brand_files?: Json | null
          challenges?: string | null
          color?: string | null
          competitors?: string | null
          contract_end_date?: string | null
          contract_notes?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          contracted_services?: string[] | null
          created_at?: string
          created_by?: string | null
          financial_state?:
            | Database["public"]["Enums"]["client_financial_state"]
            | null
          health_score?: number | null
          id?: string
          important_links?: Json | null
          keywords?: string[] | null
          language_restrictions?: string | null
          language_style?: string | null
          legacy_client_id?: string | null
          logo_url?: string | null
          name: string
          objectives?: string | null
          payment_day?: number | null
          personality?: string | null
          positioning?: string | null
          products_services?: string | null
          relationship_tone?: string | null
          responsible_user_id?: string | null
          scope_limits?: string | null
          segment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          target_audience?: string | null
          updated_at?: string
          visual_guidelines?: string | null
          workspace_id: string
        }
        Update: {
          about_client?: string | null
          agreed_deliverables?: string | null
          brand_essence?: string | null
          brand_files?: Json | null
          challenges?: string | null
          color?: string | null
          competitors?: string | null
          contract_end_date?: string | null
          contract_notes?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          contracted_services?: string[] | null
          created_at?: string
          created_by?: string | null
          financial_state?:
            | Database["public"]["Enums"]["client_financial_state"]
            | null
          health_score?: number | null
          id?: string
          important_links?: Json | null
          keywords?: string[] | null
          language_restrictions?: string | null
          language_style?: string | null
          legacy_client_id?: string | null
          logo_url?: string | null
          name?: string
          objectives?: string | null
          payment_day?: number | null
          personality?: string | null
          positioning?: string | null
          products_services?: string | null
          relationship_tone?: string | null
          responsible_user_id?: string | null
          scope_limits?: string | null
          segment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          target_audience?: string | null
          updated_at?: string
          visual_guidelines?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cards_legacy_client_id_fkey"
            columns: ["legacy_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "client_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contract_attachments: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
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
            foreignKeyName: "client_contract_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      client_financials: {
        Row: {
          billing_type: string | null
          client_card_id: string
          contract_value: number | null
          created_at: string
          expected_margin: number | null
          financial_notes: string | null
          id: string
          real_margin: number | null
          total_cost: number | null
          total_hours: number | null
          total_revenue: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_type?: string | null
          client_card_id: string
          contract_value?: number | null
          created_at?: string
          expected_margin?: number | null
          financial_notes?: string | null
          id?: string
          real_margin?: number | null
          total_cost?: number | null
          total_hours?: number | null
          total_revenue?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_type?: string | null
          client_card_id?: string
          contract_value?: number | null
          created_at?: string
          expected_margin?: number | null
          financial_notes?: string | null
          id?: string
          real_margin?: number | null
          total_cost?: number | null
          total_hours?: number | null
          total_revenue?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_financials_client_card_id_fkey"
            columns: ["client_card_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_financials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "client_financials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_policies: {
        Row: {
          auto_pause_on_negative_margin: boolean | null
          auto_pause_on_overdue_payment: boolean | null
          briefing_approvers: string[] | null
          budget_alert_threshold: number | null
          client_card_id: string
          created_at: string
          created_by: string | null
          delivery_approvers: string[] | null
          hours_alert_threshold: number | null
          id: string
          margin_alert_threshold: number | null
          max_budget_per_month: number | null
          max_monthly_hours: number | null
          max_tasks_per_month: number | null
          monthly_report_enabled: boolean | null
          notes: string | null
          overdue_days_to_pause: number | null
          report_recipients: string[] | null
          requires_briefing_approval: boolean | null
          requires_delivery_approval: boolean | null
          updated_at: string
          weekly_report_enabled: boolean | null
          workspace_id: string
        }
        Insert: {
          auto_pause_on_negative_margin?: boolean | null
          auto_pause_on_overdue_payment?: boolean | null
          briefing_approvers?: string[] | null
          budget_alert_threshold?: number | null
          client_card_id: string
          created_at?: string
          created_by?: string | null
          delivery_approvers?: string[] | null
          hours_alert_threshold?: number | null
          id?: string
          margin_alert_threshold?: number | null
          max_budget_per_month?: number | null
          max_monthly_hours?: number | null
          max_tasks_per_month?: number | null
          monthly_report_enabled?: boolean | null
          notes?: string | null
          overdue_days_to_pause?: number | null
          report_recipients?: string[] | null
          requires_briefing_approval?: boolean | null
          requires_delivery_approval?: boolean | null
          updated_at?: string
          weekly_report_enabled?: boolean | null
          workspace_id: string
        }
        Update: {
          auto_pause_on_negative_margin?: boolean | null
          auto_pause_on_overdue_payment?: boolean | null
          briefing_approvers?: string[] | null
          budget_alert_threshold?: number | null
          client_card_id?: string
          created_at?: string
          created_by?: string | null
          delivery_approvers?: string[] | null
          hours_alert_threshold?: number | null
          id?: string
          margin_alert_threshold?: number | null
          max_budget_per_month?: number | null
          max_monthly_hours?: number | null
          max_tasks_per_month?: number | null
          monthly_report_enabled?: boolean | null
          notes?: string | null
          overdue_days_to_pause?: number | null
          report_recipients?: string[] | null
          requires_briefing_approval?: boolean | null
          requires_delivery_approval?: boolean | null
          updated_at?: string
          weekly_report_enabled?: boolean | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_policies_client_card_id_fkey"
            columns: ["client_card_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "client_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_upsell_suggestions: {
        Row: {
          accepted_at: string | null
          client_card_id: string
          created_at: string
          description: string | null
          id: string
          potential_revenue_increase: number | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string | null
          suggested_value: number | null
          suggestion_type: string
          title: string
          trigger_metric: string
          trigger_value: number | null
          updated_at: string
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          client_card_id: string
          created_at?: string
          description?: string | null
          id?: string
          potential_revenue_increase?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string | null
          suggested_value?: number | null
          suggestion_type: string
          title: string
          trigger_metric: string
          trigger_value?: number | null
          updated_at?: string
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          client_card_id?: string
          created_at?: string
          description?: string | null
          id?: string
          potential_revenue_increase?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string | null
          suggested_value?: number | null
          suggestion_type?: string
          title?: string
          trigger_metric?: string
          trigger_value?: number | null
          updated_at?: string
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_upsell_suggestions_client_card_id_fkey"
            columns: ["client_card_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_upsell_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "client_upsell_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_absences: {
        Row: {
          absence_type: string
          approved_at: string | null
          approved_by: string | null
          collaborator_id: string
          created_at: string
          days_count: number
          document_type: string | null
          document_url: string | null
          end_date: string
          id: string
          is_paid: boolean | null
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_date: string
          status: string | null
          total_value: number | null
          updated_at: string
          vacation_bonus: boolean | null
          vacation_bonus_days: number | null
          vacation_third: number | null
          vacation_value: number | null
          workspace_id: string
        }
        Insert: {
          absence_type: string
          approved_at?: string | null
          approved_by?: string | null
          collaborator_id: string
          created_at?: string
          days_count: number
          document_type?: string | null
          document_url?: string | null
          end_date: string
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          start_date: string
          status?: string | null
          total_value?: number | null
          updated_at?: string
          vacation_bonus?: boolean | null
          vacation_bonus_days?: number | null
          vacation_third?: number | null
          vacation_value?: number | null
          workspace_id: string
        }
        Update: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          collaborator_id?: string
          created_at?: string
          days_count?: number
          document_type?: string | null
          document_url?: string | null
          end_date?: string
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          start_date?: string
          status?: string | null
          total_value?: number | null
          updated_at?: string
          vacation_bonus?: boolean | null
          vacation_bonus_days?: number | null
          vacation_third?: number | null
          vacation_value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_absences_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborator_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_absences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "collaborator_absences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_audit: {
        Row: {
          action: string
          changes: Json | null
          collaborator_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          performed_by: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          collaborator_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          collaborator_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_audit_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborator_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "collaborator_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_benefits: {
        Row: {
          bonus_enabled: boolean | null
          bonus_type: string | null
          bonus_value: number | null
          collaborator_id: string
          created_at: string
          dental_plan_enabled: boolean | null
          dental_plan_value: number | null
          gym_enabled: boolean | null
          gym_value: number | null
          health_plan_employee_percentage: number | null
          health_plan_enabled: boolean | null
          health_plan_value: number | null
          id: string
          notes: string | null
          parking_enabled: boolean | null
          parking_value: number | null
          updated_at: string
          va_enabled: boolean | null
          va_value: number | null
          vr_enabled: boolean | null
          vr_value: number | null
          vt_discount_percentage: number | null
          vt_enabled: boolean | null
          vt_value: number | null
          workspace_id: string
        }
        Insert: {
          bonus_enabled?: boolean | null
          bonus_type?: string | null
          bonus_value?: number | null
          collaborator_id: string
          created_at?: string
          dental_plan_enabled?: boolean | null
          dental_plan_value?: number | null
          gym_enabled?: boolean | null
          gym_value?: number | null
          health_plan_employee_percentage?: number | null
          health_plan_enabled?: boolean | null
          health_plan_value?: number | null
          id?: string
          notes?: string | null
          parking_enabled?: boolean | null
          parking_value?: number | null
          updated_at?: string
          va_enabled?: boolean | null
          va_value?: number | null
          vr_enabled?: boolean | null
          vr_value?: number | null
          vt_discount_percentage?: number | null
          vt_enabled?: boolean | null
          vt_value?: number | null
          workspace_id: string
        }
        Update: {
          bonus_enabled?: boolean | null
          bonus_type?: string | null
          bonus_value?: number | null
          collaborator_id?: string
          created_at?: string
          dental_plan_enabled?: boolean | null
          dental_plan_value?: number | null
          gym_enabled?: boolean | null
          gym_value?: number | null
          health_plan_employee_percentage?: number | null
          health_plan_enabled?: boolean | null
          health_plan_value?: number | null
          id?: string
          notes?: string | null
          parking_enabled?: boolean | null
          parking_value?: number | null
          updated_at?: string
          va_enabled?: boolean | null
          va_value?: number | null
          vr_enabled?: boolean | null
          vr_value?: number | null
          vt_discount_percentage?: number | null
          vt_enabled?: boolean | null
          vt_value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_benefits_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborator_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_benefits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "collaborator_benefits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_details: {
        Row: {
          address: Json | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          base_salary: number | null
          birth_date: string | null
          contract_type: string | null
          cpf: string | null
          created_at: string
          documents: Json | null
          emergency_contact: Json | null
          full_name: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          member_id: string
          notes: string | null
          partner_percentage: number | null
          pix_key: string | null
          rg: string | null
          updated_at: string
          weekly_hours: number | null
          workspace_id: string
        }
        Insert: {
          address?: Json | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          base_salary?: number | null
          birth_date?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          documents?: Json | null
          emergency_contact?: Json | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          member_id: string
          notes?: string | null
          partner_percentage?: number | null
          pix_key?: string | null
          rg?: string | null
          updated_at?: string
          weekly_hours?: number | null
          workspace_id: string
        }
        Update: {
          address?: Json | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          base_salary?: number | null
          birth_date?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          documents?: Json | null
          emergency_contact?: Json | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string
          notes?: string | null
          partner_percentage?: number | null
          pix_key?: string | null
          rg?: string | null
          updated_at?: string
          weekly_hours?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_details_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_details_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "collaborator_details_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_payroll: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_salary: number
          bonus: number | null
          collaborator_id: string
          commission: number | null
          created_at: string
          created_by: string | null
          dental_plan_value: number | null
          fgts_percentage: number | null
          fgts_value: number | null
          gross_salary: number | null
          health_plan_discount: number | null
          health_plan_value: number | null
          id: string
          inss_patronal: number | null
          inss_percentage: number | null
          inss_value: number | null
          irrf_base: number | null
          irrf_value: number | null
          net_salary: number | null
          notes: string | null
          other_benefits: number | null
          other_discounts: number | null
          other_discounts_description: string | null
          overtime_hours: number | null
          overtime_value: number | null
          paid_at: string | null
          payment_date: string | null
          provision_13th: number | null
          provision_vacation: number | null
          provision_vacation_13th: number | null
          reference_month: string
          status: string | null
          total_cost: number | null
          total_discounts: number | null
          transaction_id: string | null
          updated_at: string
          va_value: number | null
          vr_value: number | null
          vt_discount: number | null
          vt_value: number | null
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_salary?: number
          bonus?: number | null
          collaborator_id: string
          commission?: number | null
          created_at?: string
          created_by?: string | null
          dental_plan_value?: number | null
          fgts_percentage?: number | null
          fgts_value?: number | null
          gross_salary?: number | null
          health_plan_discount?: number | null
          health_plan_value?: number | null
          id?: string
          inss_patronal?: number | null
          inss_percentage?: number | null
          inss_value?: number | null
          irrf_base?: number | null
          irrf_value?: number | null
          net_salary?: number | null
          notes?: string | null
          other_benefits?: number | null
          other_discounts?: number | null
          other_discounts_description?: string | null
          overtime_hours?: number | null
          overtime_value?: number | null
          paid_at?: string | null
          payment_date?: string | null
          provision_13th?: number | null
          provision_vacation?: number | null
          provision_vacation_13th?: number | null
          reference_month: string
          status?: string | null
          total_cost?: number | null
          total_discounts?: number | null
          transaction_id?: string | null
          updated_at?: string
          va_value?: number | null
          vr_value?: number | null
          vt_discount?: number | null
          vt_value?: number | null
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_salary?: number
          bonus?: number | null
          collaborator_id?: string
          commission?: number | null
          created_at?: string
          created_by?: string | null
          dental_plan_value?: number | null
          fgts_percentage?: number | null
          fgts_value?: number | null
          gross_salary?: number | null
          health_plan_discount?: number | null
          health_plan_value?: number | null
          id?: string
          inss_patronal?: number | null
          inss_percentage?: number | null
          inss_value?: number | null
          irrf_base?: number | null
          irrf_value?: number | null
          net_salary?: number | null
          notes?: string | null
          other_benefits?: number | null
          other_discounts?: number | null
          other_discounts_description?: string | null
          overtime_hours?: number | null
          overtime_value?: number | null
          paid_at?: string | null
          payment_date?: string | null
          provision_13th?: number | null
          provision_vacation?: number | null
          provision_vacation_13th?: number | null
          reference_month?: string
          status?: string | null
          total_cost?: number | null
          total_discounts?: number | null
          transaction_id?: string | null
          updated_at?: string
          va_value?: number | null
          vr_value?: number | null
          vt_discount?: number | null
          vt_value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_payroll_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborator_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_payroll_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "collaborator_payroll_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_payroll_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "collaborator_payroll_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_vacation_balance: {
        Row: {
          acquisition_end: string
          acquisition_start: string
          collaborator_id: string
          concession_end: string
          concession_start: string
          created_at: string
          days_remaining: number | null
          days_sold: number | null
          days_taken: number | null
          id: string
          is_expired: boolean | null
          notes: string | null
          status: string | null
          total_days: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acquisition_end: string
          acquisition_start: string
          collaborator_id: string
          concession_end: string
          concession_start: string
          created_at?: string
          days_remaining?: number | null
          days_sold?: number | null
          days_taken?: number | null
          id?: string
          is_expired?: boolean | null
          notes?: string | null
          status?: string | null
          total_days?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acquisition_end?: string
          acquisition_start?: string
          collaborator_id?: string
          concession_end?: string
          concession_start?: string
          created_at?: string
          days_remaining?: number | null
          days_sold?: number | null
          days_taken?: number | null
          id?: string
          is_expired?: boolean | null
          notes?: string | null
          status?: string | null
          total_days?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_vacation_balance_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborator_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_vacation_balance_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "collaborator_vacation_balance_workspace_id_fkey"
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
      cost_centers: {
        Row: {
          budget_monthly: number | null
          budget_yearly: number | null
          center_type: string | null
          code: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          responsible_user_id: string | null
          revenue_target_monthly: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_monthly?: number | null
          budget_yearly?: number | null
          center_type?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          responsible_user_id?: string | null
          revenue_target_monthly?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_monthly?: number | null
          budget_yearly?: number | null
          center_type?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          responsible_user_id?: string | null
          revenue_target_monthly?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cost_centers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_snapshots: {
        Row: {
          computed_at: string
          id: string
          metrics: Json
          snapshot_date: string
          snapshot_type: string
          workspace_id: string
        }
        Insert: {
          computed_at?: string
          id?: string
          metrics?: Json
          snapshot_date: string
          snapshot_type: string
          workspace_id: string
        }
        Update: {
          computed_at?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
          snapshot_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "dashboard_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dda_audit_events: {
        Row: {
          action: string
          boleto_id: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          performed_at: string
          performed_by: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          boleto_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          boleto_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dda_audit_events_boleto_id_fkey"
            columns: ["boleto_id"]
            isOneToOne: false
            referencedRelation: "dda_boletos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "dda_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dda_boletos: {
        Row: {
          barcode: string | null
          bill_type: string | null
          category_id: string | null
          cedente_agencia: string | null
          cedente_banco: string | null
          cedente_conta: string | null
          cedente_documento: string | null
          cedente_nome: string
          created_at: string
          created_by: string | null
          data_baixa: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          deleted_at: string | null
          digitable_line: string | null
          external_id: string | null
          id: string
          linked_ap_id: string | null
          metadata: Json | null
          notes: string | null
          pluggy_bill_id: string | null
          pluggy_item_id: string | null
          raw_payload: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          sacado_documento: string | null
          sacado_nome: string | null
          source: string | null
          status: string
          synced_at: string | null
          transaction_id: string | null
          updated_at: string
          valor_abatimento: number | null
          valor_atualizado: number | null
          valor_desconto: number | null
          valor_original: number
          workflow_status: string | null
          workspace_id: string
        }
        Insert: {
          barcode?: string | null
          bill_type?: string | null
          category_id?: string | null
          cedente_agencia?: string | null
          cedente_banco?: string | null
          cedente_conta?: string | null
          cedente_documento?: string | null
          cedente_nome: string
          created_at?: string
          created_by?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          deleted_at?: string | null
          digitable_line?: string | null
          external_id?: string | null
          id?: string
          linked_ap_id?: string | null
          metadata?: Json | null
          notes?: string | null
          pluggy_bill_id?: string | null
          pluggy_item_id?: string | null
          raw_payload?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sacado_documento?: string | null
          sacado_nome?: string | null
          source?: string | null
          status?: string
          synced_at?: string | null
          transaction_id?: string | null
          updated_at?: string
          valor_abatimento?: number | null
          valor_atualizado?: number | null
          valor_desconto?: number | null
          valor_original: number
          workflow_status?: string | null
          workspace_id: string
        }
        Update: {
          barcode?: string | null
          bill_type?: string | null
          category_id?: string | null
          cedente_agencia?: string | null
          cedente_banco?: string | null
          cedente_conta?: string | null
          cedente_documento?: string | null
          cedente_nome?: string
          created_at?: string
          created_by?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          digitable_line?: string | null
          external_id?: string | null
          id?: string
          linked_ap_id?: string | null
          metadata?: Json | null
          notes?: string | null
          pluggy_bill_id?: string | null
          pluggy_item_id?: string | null
          raw_payload?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sacado_documento?: string | null
          sacado_nome?: string | null
          source?: string | null
          status?: string
          synced_at?: string | null
          transaction_id?: string | null
          updated_at?: string
          valor_abatimento?: number | null
          valor_atualizado?: number | null
          valor_desconto?: number | null
          valor_original?: number
          workflow_status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dda_boletos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_boletos_linked_ap_id_fkey"
            columns: ["linked_ap_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "dda_boletos_linked_ap_id_fkey"
            columns: ["linked_ap_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_boletos_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "dda_boletos_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_boletos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "dda_boletos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dda_sync_logs: {
        Row: {
          boletos_found: number | null
          boletos_new: number | null
          boletos_updated: number | null
          cursor_position: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json | null
          pluggy_item_id: string | null
          raw_response_sample: Json | null
          source: string
          started_at: string | null
          status: string
          synced_at: string
          synced_by: string | null
          workspace_id: string
        }
        Insert: {
          boletos_found?: number | null
          boletos_new?: number | null
          boletos_updated?: number | null
          cursor_position?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          pluggy_item_id?: string | null
          raw_response_sample?: Json | null
          source?: string
          started_at?: string | null
          status: string
          synced_at?: string
          synced_by?: string | null
          workspace_id: string
        }
        Update: {
          boletos_found?: number | null
          boletos_new?: number | null
          boletos_updated?: number | null
          cursor_position?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          pluggy_item_id?: string | null
          raw_response_sample?: Json | null
          source?: string
          started_at?: string | null
          status?: string
          synced_at?: string
          synced_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dda_sync_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "dda_sync_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
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
      depreciation_schedules: {
        Row: {
          accumulated_depreciation: number
          book_value: number
          created_at: string
          depreciation_amount: number
          financial_entry_id: string | null
          id: string
          is_posted_to_dre: boolean | null
          item_id: string | null
          month_ref: string
          unit_id: string | null
          workspace_id: string
        }
        Insert: {
          accumulated_depreciation?: number
          book_value?: number
          created_at?: string
          depreciation_amount?: number
          financial_entry_id?: string | null
          id?: string
          is_posted_to_dre?: boolean | null
          item_id?: string | null
          month_ref: string
          unit_id?: string | null
          workspace_id: string
        }
        Update: {
          accumulated_depreciation?: number
          book_value?: number
          created_at?: string
          depreciation_amount?: number
          financial_entry_id?: string | null
          id?: string
          is_posted_to_dre?: boolean | null
          item_id?: string | null
          month_ref?: string
          unit_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "depreciation_schedules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "depreciation_schedules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "depreciation_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "depreciation_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          is_processed: boolean | null
          metadata: Json | null
          payload: Json
          processed_at: string | null
          version: number | null
          workspace_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_processed?: boolean | null
          metadata?: Json | null
          payload: Json
          processed_at?: string | null
          version?: number | null
          workspace_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_processed?: boolean | null
          metadata?: Json | null
          payload?: Json
          processed_at?: string | null
          version?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "domain_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          created_at: string
          email: string
          error: string | null
          id: string
          metadata: Json | null
          sent_at: string | null
          status: string
          subject: string
          type: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string
          subject: string
          type: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string
          type?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications_log: {
        Row: {
          correlation_id: string | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_version: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_version?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_version?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_notifications_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_audit: {
        Row: {
          action: string
          created_at: string
          current_value: number | null
          entitlement_key: string
          id: string
          limit_value: number | null
          metadata: Json | null
          reason_code: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          current_value?: number | null
          entitlement_key: string
          id?: string
          limit_value?: number | null
          metadata?: Json | null
          reason_code: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          current_value?: number | null
          entitlement_key?: string
          id?: string
          limit_value?: number | null
          metadata?: Json | null
          reason_code?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "entitlement_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_registry: {
        Row: {
          category: string
          created_at: string
          default_enabled: boolean
          default_limit: number | null
          description: string | null
          enforcement_scope: string
          key: string
          name: string
          type: string
          ui_visibility: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          default_limit?: number | null
          description?: string | null
          enforcement_scope?: string
          key: string
          name: string
          type?: string
          ui_visibility?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          default_limit?: number | null
          description?: string | null
          enforcement_scope?: string
          key?: string
          name?: string
          type?: string
          ui_visibility?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          created_at: string
          event_id: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean | null
          card_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          is_recurring: boolean | null
          location: string | null
          recurrence_rule: string | null
          space_id: string | null
          start_time: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          all_day?: boolean | null
          card_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          recurrence_rule?: string | null
          space_id?: string | null
          start_time: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          all_day?: boolean | null
          card_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          recurrence_rule?: string | null
          space_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_collaborator_salary_history: {
        Row: {
          collaborator_id: string
          created_at: string
          effective_date: string
          id: string
          new_salary: number
          previous_salary: number | null
          reason: string | null
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          effective_date?: string
          id?: string
          new_salary: number
          previous_salary?: number | null
          reason?: string | null
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          new_salary?: number
          previous_salary?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_collaborator_salary_history_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "external_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      external_collaborators: {
        Row: {
          address: Json | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          base_salary: number | null
          birth_date: string | null
          contract_type: string | null
          cost_center_id: string | null
          cpf: string | null
          created_at: string
          department: string | null
          documents: Json | null
          email: string | null
          emergency_contact: Json | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          notes: string | null
          phone: string | null
          pix_key: string | null
          rg: string | null
          termination_date: string | null
          updated_at: string
          weekly_hours: number | null
          workspace_id: string
        }
        Insert: {
          address?: Json | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          base_salary?: number | null
          birth_date?: string | null
          contract_type?: string | null
          cost_center_id?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          documents?: Json | null
          email?: string | null
          emergency_contact?: Json | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          rg?: string | null
          termination_date?: string | null
          updated_at?: string
          weekly_hours?: number | null
          workspace_id: string
        }
        Update: {
          address?: Json | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          base_salary?: number | null
          birth_date?: string | null
          contract_type?: string | null
          cost_center_id?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          documents?: Json | null
          email?: string | null
          emergency_contact?: Json | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          rg?: string | null
          termination_date?: string | null
          updated_at?: string
          weekly_hours?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_collaborators_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_collaborators_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "external_collaborators_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          flag_key: string
          id: string
          metadata: Json | null
          rollout_percentage: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          flag_key: string
          id?: string
          metadata?: Json | null
          rollout_percentage?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_key?: string
          id?: string
          metadata?: Json | null
          rollout_percentage?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "feature_flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_category: string | null
          alert_type: string
          assigned_to_role: string | null
          assigned_to_user_id: string | null
          created_at: string
          data: Json | null
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          snoozed_until: string | null
          status: string | null
          suggested_actions: Json | null
          title: string
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_category?: string | null
          alert_type: string
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          data?: Json | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          snoozed_until?: string | null
          status?: string | null
          suggested_actions?: Json | null
          title: string
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_category?: string | null
          alert_type?: string
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          data?: Json | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          snoozed_until?: string | null
          status?: string | null
          suggested_actions?: Json | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "financial_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_trail: {
        Row: {
          action: string
          anomaly_score: number | null
          anomaly_type: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          is_anomaly: boolean | null
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          requires_approval: boolean | null
          user_agent: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          anomaly_score?: number | null
          anomaly_type?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          is_anomaly?: boolean | null
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          requires_approval?: boolean | null
          user_agent?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          anomaly_score?: number | null
          anomaly_type?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          is_anomaly?: boolean | null
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          requires_approval?: boolean | null
          user_agent?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_trail_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "financial_audit_trail_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "financial_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          data: Json
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          previous_period_data: Json | null
          report_type: string
          status: string | null
          variation_percentage: number | null
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          period_type: string
          previous_period_data?: Json | null
          report_type: string
          status?: string | null
          variation_percentage?: number | null
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          previous_period_data?: Json | null
          report_type?: string
          status?: string | null
          variation_percentage?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "financial_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_members: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string
          created_by: string | null
          folder_id: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          created_by?: string | null
          folder_id: string
          id?: string
          permission?: string
          user_id: string
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          created_by?: string | null
          folder_id?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_members_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_templates: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          is_system: boolean | null
          name: string
          space_type: string
          template_config: Json
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name: string
          space_type: string
          template_config?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name?: string
          space_type?: string
          template_config?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "folder_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_views: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
          source_template_id: string | null
          updated_at: string
          view_config: Json
          view_type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          source_template_id?: string | null
          updated_at?: string
          view_config?: Json
          view_type: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          source_template_id?: string | null
          updated_at?: string
          view_config?: Json
          view_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_views_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_views_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "view_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "folder_views_workspace_id_fkey"
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
          is_restricted: boolean
          is_system: boolean | null
          name: string
          owner_id: string | null
          sort_order: number | null
          space_id: string
          updated_at: string
          visibility: string | null
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
          is_restricted?: boolean
          is_system?: boolean | null
          name: string
          owner_id?: string | null
          sort_order?: number | null
          space_id: string
          updated_at?: string
          visibility?: string | null
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
          is_restricted?: boolean
          is_system?: boolean | null
          name?: string
          owner_id?: string | null
          sort_order?: number | null
          space_id?: string
          updated_at?: string
          visibility?: string | null
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
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
      insurance_contracts: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          cost_per_cycle: number | null
          coverage_summary: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          insurer: string
          is_active: boolean | null
          notes: string | null
          owner_user_id: string | null
          policy_number: string | null
          renewal_date: string | null
          start_date: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cost_per_cycle?: number | null
          coverage_summary?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          insurer: string
          is_active?: boolean | null
          notes?: string | null
          owner_user_id?: string | null
          policy_number?: string | null
          renewal_date?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cost_per_cycle?: number | null
          coverage_summary?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          insurer?: string
          is_active?: boolean | null
          notes?: string | null
          owner_user_id?: string | null
          policy_number?: string | null
          renewal_date?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_contracts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "insurance_contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_item_links: {
        Row: {
          created_at: string
          id: string
          insurance_id: string
          item_id: string | null
          unit_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insurance_id: string
          item_id?: string | null
          unit_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insurance_id?: string
          item_id?: string | null
          unit_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_item_links_insurance_id_fkey"
            columns: ["insurance_id"]
            isOneToOne: false
            referencedRelation: "insurance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_item_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_item_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "insurance_item_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "insurance_item_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_item_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "insurance_item_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "insurance_item_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          configured_at: string
          configured_by: string | null
          credentials: Json
          id: string
          integration_type: string
          is_active: boolean | null
          last_sync_at: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          configured_at?: string
          configured_by?: string | null
          credentials: Json
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_sync_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          configured_at?: string
          configured_by?: string | null
          credentials?: Json
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "integration_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          metadata: Json | null
          page_url: string | null
          rating: number | null
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          page_url?: string | null
          rating?: number | null
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          page_url?: string | null
          rating?: number | null
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "internal_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          capitalization_threshold: number | null
          category: Database["public"]["Enums"]["inventory_category"]
          code: string
          created_at: string
          created_by: string | null
          current_stock: number | null
          department_id: string | null
          depreciation_method:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          description: string | null
          id: string
          is_active: boolean | null
          is_serialized: boolean | null
          manufacturer: string | null
          min_stock: number | null
          model: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_value: number | null
          residual_value: number | null
          status_condition: Database["public"]["Enums"]["item_condition"]
          updated_at: string
          useful_life_months: number | null
          workspace_id: string
        }
        Insert: {
          capitalization_threshold?: number | null
          category?: Database["public"]["Enums"]["inventory_category"]
          code: string
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          department_id?: string | null
          depreciation_method?:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_serialized?: boolean | null
          manufacturer?: string | null
          min_stock?: number | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_value?: number | null
          residual_value?: number | null
          status_condition?: Database["public"]["Enums"]["item_condition"]
          updated_at?: string
          useful_life_months?: number | null
          workspace_id: string
        }
        Update: {
          capitalization_threshold?: number | null
          category?: Database["public"]["Enums"]["inventory_category"]
          code?: string
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          department_id?: string | null
          depreciation_method?:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_serialized?: boolean | null
          manufacturer?: string | null
          min_stock?: number | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_value?: number | null
          residual_value?: number | null
          status_condition?: Database["public"]["Enums"]["item_condition"]
          updated_at?: string
          useful_life_months?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          card_id: string | null
          checkin_condition:
            | Database["public"]["Enums"]["item_condition"]
            | null
          checkin_notes: string | null
          checkout_term_accepted: boolean | null
          created_at: string
          created_by: string | null
          department_id: string | null
          from_location_id: string | null
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          occurred_at: string
          quantity: number
          requested_by_user_id: string | null
          responsible_user_id: string | null
          to_location_id: string | null
          unit_id: string | null
          workspace_id: string
        }
        Insert: {
          card_id?: string | null
          checkin_condition?:
            | Database["public"]["Enums"]["item_condition"]
            | null
          checkin_notes?: string | null
          checkout_term_accepted?: boolean | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          from_location_id?: string | null
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          occurred_at?: string
          quantity?: number
          requested_by_user_id?: string | null
          responsible_user_id?: string | null
          to_location_id?: string | null
          unit_id?: string | null
          workspace_id: string
        }
        Update: {
          card_id?: string | null
          checkin_condition?:
            | Database["public"]["Enums"]["item_condition"]
            | null
          checkin_notes?: string | null
          checkout_term_accepted?: boolean | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          from_location_id?: string | null
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          occurred_at?: string
          quantity?: number
          requested_by_user_id?: string | null
          responsible_user_id?: string | null
          to_location_id?: string | null
          unit_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "inventory_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_units: {
        Row: {
          created_at: string
          current_holder_id: string | null
          current_location_id: string | null
          current_status: Database["public"]["Enums"]["unit_status"]
          id: string
          invoice_ref: string | null
          is_active: boolean | null
          item_condition: string | null
          item_id: string
          notes: string | null
          serial_number: string | null
          tag_qr_code: string | null
          updated_at: string
          warranty_end_date: string | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_terms_url: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_holder_id?: string | null
          current_location_id?: string | null
          current_status?: Database["public"]["Enums"]["unit_status"]
          id?: string
          invoice_ref?: string | null
          is_active?: boolean | null
          item_condition?: string | null
          item_id: string
          notes?: string | null
          serial_number?: string | null
          tag_qr_code?: string | null
          updated_at?: string
          warranty_end_date?: string | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_terms_url?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_holder_id?: string | null
          current_location_id?: string | null
          current_status?: Database["public"]["Enums"]["unit_status"]
          id?: string
          invoice_ref?: string | null
          is_active?: boolean | null
          item_condition?: string | null
          item_id?: string
          notes?: string | null
          serial_number?: string | null
          tag_qr_code?: string | null
          updated_at?: string
          warranty_end_date?: string | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_terms_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_units_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          access_key: string | null
          card_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          external_id: string | null
          gross_amount: number
          id: string
          invoice_number: string
          invoice_series: string | null
          invoice_type: string
          issue_date: string
          metadata: Json | null
          net_amount: number
          pdf_url: string | null
          recipient_document: string | null
          recipient_email: string | null
          recipient_name: string | null
          service_code: string | null
          source: string | null
          status: string
          tax_amount: number
          taxes: Json | null
          transaction_id: string | null
          updated_at: string
          workspace_id: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          card_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          gross_amount?: number
          id?: string
          invoice_number: string
          invoice_series?: string | null
          invoice_type?: string
          issue_date: string
          metadata?: Json | null
          net_amount?: number
          pdf_url?: string | null
          recipient_document?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          service_code?: string | null
          source?: string | null
          status?: string
          tax_amount?: number
          taxes?: Json | null
          transaction_id?: string | null
          updated_at?: string
          workspace_id: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          card_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          gross_amount?: number
          id?: string
          invoice_number?: string
          invoice_series?: string | null
          invoice_type?: string
          issue_date?: string
          metadata?: Json | null
          net_amount?: number
          pdf_url?: string | null
          recipient_document?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          service_code?: string | null
          source?: string | null
          status?: string
          tax_amount?: number
          taxes?: Json | null
          transaction_id?: string | null
          updated_at?: string
          workspace_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_template_items: {
        Row: {
          created_at: string
          id: string
          is_required: boolean | null
          item_id: string
          quantity: number | null
          template_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean | null
          item_id: string
          quantity?: number | null
          template_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean | null
          item_id?: string
          quantity?: number | null
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_template_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_template_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "kit_template_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "kit_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_template_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "kit_template_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_templates: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          space_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          space_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          space_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "kit_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          id: string
          is_resolved: boolean | null
          is_warranty_claim: boolean | null
          item_id: string | null
          linked_card_id: string | null
          linked_financial_entry_id: string | null
          maintenance_type: string | null
          next_maintenance_date: string | null
          notes: string | null
          performed_by: string | null
          problem_description: string
          scheduled_date: string | null
          service_date: string
          solution_description: string | null
          status: string | null
          unit_id: string | null
          updated_at: string
          vendor: string | null
          vendor_contact: string | null
          warranty_until: string | null
          workspace_id: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_resolved?: boolean | null
          is_warranty_claim?: boolean | null
          item_id?: string | null
          linked_card_id?: string | null
          linked_financial_entry_id?: string | null
          maintenance_type?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          performed_by?: string | null
          problem_description: string
          scheduled_date?: string | null
          service_date: string
          solution_description?: string | null
          status?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
          vendor_contact?: string | null
          warranty_until?: string | null
          workspace_id: string
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_resolved?: boolean | null
          is_warranty_claim?: boolean | null
          item_id?: string | null
          linked_card_id?: string | null
          linked_financial_entry_id?: string | null
          maintenance_type?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          performed_by?: string | null
          problem_description?: string
          scheduled_date?: string | null
          service_date?: string
          solution_description?: string | null
          status?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
          vendor_contact?: string | null
          warranty_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "maintenance_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "maintenance_records_linked_card_id_fkey"
            columns: ["linked_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "maintenance_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "maintenance_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_maps: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          nodes: Json
          space_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string
          nodes?: Json
          space_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          nodes?: Json
          space_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mind_maps_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_maps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "mind_maps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      module_usage: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          module_name: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module_name: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module_name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "module_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_reads: {
        Row: {
          confirmed_at: string | null
          id: string
          ip_address: unknown
          notice_id: string
          read_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          id?: string
          ip_address?: unknown
          notice_id: string
          read_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          id?: string
          ip_address?: unknown
          notice_id?: string
          read_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          auto_generated: boolean | null
          category: string
          content: string | null
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          id: string
          priority: string
          requires_confirmation: boolean | null
          source_id: string | null
          source_type: string | null
          starts_at: string | null
          status: string
          target_roles: string[] | null
          target_spaces: string[] | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          auto_generated?: boolean | null
          category?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          priority?: string
          requires_confirmation?: boolean | null
          source_id?: string | null
          source_type?: string | null
          starts_at?: string | null
          status?: string
          target_roles?: string[] | null
          target_spaces?: string[] | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          auto_generated?: boolean | null
          category?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          priority?: string
          requires_confirmation?: boolean | null
          source_id?: string | null
          source_type?: string | null
          starts_at?: string | null
          status?: string
          target_roles?: string[] | null
          target_spaces?: string[] | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
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
      oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          expires_at: string
          platform: string
          return_url: string | null
          scopes: string | null
          state: string
          used_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          expires_at: string
          platform: string
          return_url?: string | null
          scopes?: string | null
          state: string
          used_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          platform?: string
          return_url?: string | null
          scopes?: string | null
          state?: string
          used_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          config: Json | null
          created_at: string
          enabled: boolean
          entitlement_key: string
          id: string
          limit_value: number | null
          plan_key: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          entitlement_key: string
          id?: string
          limit_value?: number | null
          plan_key: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          entitlement_key?: string
          id?: string
          limit_value?: number | null
          plan_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "entitlement_registry"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_entitlements_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "workspace_entitlements_effective"
            referencedColumns: ["entitlement_key"]
          },
        ]
      }
      platform_super_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pluggy_items: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          connector_name: string | null
          id: string
          metadata: Json | null
          pluggy_item_id: string
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          connector_name?: string | null
          id?: string
          metadata?: Json | null
          pluggy_item_id: string
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          connector_name?: string | null
          id?: string
          metadata?: Json | null
          pluggy_item_id?: string
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "pluggy_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          default_assignments: Json | null
          description: string | null
          estimated_duration_hours: number | null
          id: string
          is_active: boolean
          name: string
          steps: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          default_assignments?: Json | null
          description?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          steps?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          default_assignments?: Json | null
          description?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "process_templates_workspace_id_fkey"
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
          birthday: string | null
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
          birthday?: string | null
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
          birthday?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean | null
          p256dh: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean | null
          p256dh: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean | null
          p256dh?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "push_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_history: {
        Row: {
          badges_count: number | null
          cards_completed: number | null
          cards_created: number | null
          created_at: string
          hours_logged: number | null
          id: string
          rank: number
          recorded_at: string
          score: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          badges_count?: number | null
          cards_completed?: number | null
          cards_created?: number | null
          created_at?: string
          hours_logged?: number | null
          id?: string
          rank: number
          recorded_at?: string
          score: number
          user_id: string
          workspace_id: string
        }
        Update: {
          badges_count?: number | null
          cards_completed?: number | null
          cards_created?: number | null
          created_at?: string
          hours_logged?: number | null
          id?: string
          rank?: number
          recorded_at?: string
          score?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ranking_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_history: {
        Row: {
          collaborator_id: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          new_salary: number
          previous_salary: number | null
          reason: string | null
          workspace_id: string
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          new_salary: number
          previous_salary?: number | null
          reason?: string | null
          workspace_id: string
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          new_salary?: number
          previous_salary?: number | null
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_history_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborator_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "salary_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_hashtag_library: {
        Row: {
          avg_engagement_boost: number | null
          category: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          hashtags: string[]
          id: string
          name: string
          updated_at: string | null
          usage_count: number | null
          workspace_id: string
        }
        Insert: {
          avg_engagement_boost?: number | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          hashtags: string[]
          id?: string
          name: string
          updated_at?: string | null
          usage_count?: number | null
          workspace_id: string
        }
        Update: {
          avg_engagement_boost?: number | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          hashtags?: string[]
          id?: string
          name?: string
          updated_at?: string | null
          usage_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_hashtag_library_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_hashtag_library_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_hashtag_library_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_jobs: {
        Row: {
          action: string
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          post_id: string | null
          result: Json | null
          started_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          action: string
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          post_id?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          action?: string
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          post_id?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_platform_assets: {
        Row: {
          asset_id: string
          asset_meta: Json | null
          asset_name: string
          asset_type: string
          created_at: string | null
          id: string
          is_active: boolean
          platform_connection_id: string
          platform_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          asset_id: string
          asset_meta?: Json | null
          asset_name: string
          asset_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          platform_connection_id: string
          platform_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          asset_id?: string
          asset_meta?: Json | null
          asset_name?: string
          asset_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          platform_connection_id?: string
          platform_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_platform_assets_platform_connection_id_fkey"
            columns: ["platform_connection_id"]
            isOneToOne: false
            referencedRelation: "social_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_platform_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_platform_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_platforms: {
        Row: {
          access_token_encrypted: string | null
          account_id: string
          account_metrics: Json | null
          account_metrics_updated_at: string | null
          account_name: string
          account_type: string | null
          asset_selected_at: string | null
          asset_token_encrypted: string | null
          connection_status: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_sync_at: string | null
          last_tested_at: string | null
          last_validated_at: string | null
          linked_page_id: string | null
          linked_page_name: string | null
          platform: string
          platform_account_type: string | null
          profile_image_url: string | null
          refresh_token_encrypted: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_id: string
          account_metrics?: Json | null
          account_metrics_updated_at?: string | null
          account_name: string
          account_type?: string | null
          asset_selected_at?: string | null
          asset_token_encrypted?: string | null
          connection_status?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_tested_at?: string | null
          last_validated_at?: string | null
          linked_page_id?: string | null
          linked_page_name?: string | null
          platform: string
          platform_account_type?: string | null
          profile_image_url?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_id?: string
          account_metrics?: Json | null
          account_metrics_updated_at?: string | null
          account_name?: string
          account_type?: string | null
          asset_selected_at?: string | null
          asset_token_encrypted?: string | null
          connection_status?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_tested_at?: string | null
          last_validated_at?: string | null
          linked_page_id?: string | null
          linked_page_name?: string | null
          platform?: string
          platform_account_type?: string | null
          profile_image_url?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_platforms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_platforms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_templates: {
        Row: {
          caption_template: string | null
          content_pillar: string | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          funnel_stage: string | null
          hashtag_library_ids: string[] | null
          id: string
          is_active: boolean | null
          name: string
          platform: string | null
          usage_count: number | null
          workspace_id: string
        }
        Insert: {
          caption_template?: string | null
          content_pillar?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          funnel_stage?: string | null
          hashtag_library_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          platform?: string | null
          usage_count?: number | null
          workspace_id: string
        }
        Update: {
          caption_template?: string | null
          content_pillar?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          funnel_stage?: string | null
          hashtag_library_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          platform?: string | null
          usage_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_post_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          ab_test_group: string | null
          alt_text: string | null
          approved_at: string | null
          approved_by: string | null
          campaign_name: string | null
          caption: string | null
          card_id: string | null
          client_id: string | null
          content_fingerprint: string | null
          content_pillar: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          error_code: string | null
          error_message: string | null
          first_comment: string | null
          funnel_stage: string | null
          hashtags: string[] | null
          id: string
          job_id: string | null
          last_error_code: string | null
          last_error_message: string | null
          location_id: string | null
          location_name: string | null
          max_retries: number | null
          media_urls: Json | null
          metrics: Json | null
          metrics_updated_at: string | null
          next_retry_at: string | null
          platform: string
          platform_connection_id: string | null
          platform_post_id: string | null
          platform_url: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          published_at: string | null
          retry_count: number | null
          scheduled_at: string | null
          status: string
          timezone: string | null
          title: string | null
          updated_at: string | null
          user_tags: Json | null
          utm_params: Json | null
          visibility: string | null
          workspace_id: string
        }
        Insert: {
          ab_test_group?: string | null
          alt_text?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_name?: string | null
          caption?: string | null
          card_id?: string | null
          client_id?: string | null
          content_fingerprint?: string | null
          content_pillar?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          first_comment?: string | null
          funnel_stage?: string | null
          hashtags?: string[] | null
          id?: string
          job_id?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          location_id?: string | null
          location_name?: string | null
          max_retries?: number | null
          media_urls?: Json | null
          metrics?: Json | null
          metrics_updated_at?: string | null
          next_retry_at?: string | null
          platform: string
          platform_connection_id?: string | null
          platform_post_id?: string | null
          platform_url?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          user_tags?: Json | null
          utm_params?: Json | null
          visibility?: string | null
          workspace_id: string
        }
        Update: {
          ab_test_group?: string | null
          alt_text?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_name?: string | null
          caption?: string | null
          card_id?: string | null
          client_id?: string | null
          content_fingerprint?: string | null
          content_pillar?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          first_comment?: string | null
          funnel_stage?: string | null
          hashtags?: string[] | null
          id?: string
          job_id?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          location_id?: string | null
          location_name?: string | null
          max_retries?: number | null
          media_urls?: Json | null
          metrics?: Json | null
          metrics_updated_at?: string | null
          next_retry_at?: string | null
          platform?: string
          platform_connection_id?: string | null
          platform_post_id?: string | null
          platform_url?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          user_tags?: Json | null
          utm_params?: Json | null
          visibility?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_platform_connection_id_fkey"
            columns: ["platform_connection_id"]
            isOneToOne: false
            referencedRelation: "social_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_custom_field_definitions: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_options: Json | null
          field_type: string
          id: string
          is_filterable: boolean | null
          is_required: boolean | null
          is_visible_on_card: boolean | null
          sort_order: number | null
          space_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_options?: Json | null
          field_type: string
          id?: string
          is_filterable?: boolean | null
          is_required?: boolean | null
          is_visible_on_card?: boolean | null
          sort_order?: number | null
          space_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_filterable?: boolean | null
          is_required?: boolean | null
          is_visible_on_card?: boolean | null
          sort_order?: number | null
          space_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_custom_field_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "space_custom_field_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_templates: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          custom_fields_config: Json | null
          definition: Json
          description: string | null
          folders_config: Json | null
          icon: string | null
          id: string | null
          is_optional: boolean
          is_user_template: boolean | null
          key: string
          name: string
          updated_at: string
          views_config: Json | null
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields_config?: Json | null
          definition?: Json
          description?: string | null
          folders_config?: Json | null
          icon?: string | null
          id?: string | null
          is_optional?: boolean
          is_user_template?: boolean | null
          key: string
          name: string
          updated_at?: string
          views_config?: Json | null
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields_config?: Json | null
          definition?: Json
          description?: string | null
          folders_config?: Json | null
          icon?: string | null
          id?: string | null
          is_optional?: boolean
          is_user_template?: boolean | null
          key?: string
          name?: string
          updated_at?: string
          views_config?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "space_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "space_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          access_level: string
          allowed_roles: Database["public"]["Enums"]["app_role"][] | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          is_system: boolean | null
          name: string
          settings: Json | null
          sort_order: number | null
          space_type: string | null
          template_key: string | null
          type: Database["public"]["Enums"]["space_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_level?: string
          allowed_roles?: Database["public"]["Enums"]["app_role"][] | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_system?: boolean | null
          name: string
          settings?: Json | null
          sort_order?: number | null
          space_type?: string | null
          template_key?: string | null
          type?: Database["public"]["Enums"]["space_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_level?: string
          allowed_roles?: Database["public"]["Enums"]["app_role"][] | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_system?: boolean | null
          name?: string
          settings?: Json | null
          sort_order?: number | null
          space_type?: string | null
          template_key?: string | null
          type?: Database["public"]["Enums"]["space_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "sprints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_checklist_templates: {
        Row: {
          created_at: string
          default_assignee_role: string | null
          description: string | null
          id: string
          is_required: boolean | null
          sort_order: number
          stage_id: string
          title: string
        }
        Insert: {
          created_at?: string
          default_assignee_role?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number
          stage_id: string
          title: string
        }
        Update: {
          created_at?: string
          default_assignee_role?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number
          stage_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_checklist_templates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      structured_logs: {
        Row: {
          context: Json | null
          correlation_id: string | null
          created_at: string
          id: string
          log_level: string
          message: string
          service: string
          session_id: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          log_level?: string
          message: string
          service: string
          session_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          log_level?: string
          message?: string
          service?: string
          session_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structured_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "structured_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_licenses: {
        Row: {
          auto_renew: boolean | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cancellation_terms_url: string | null
          cost_per_cycle: number
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          linked_financial_entry_id: string | null
          notes: string | null
          owner_user_id: string | null
          payment_method: string | null
          plan_name: string | null
          product_name: string
          renewal_date: string | null
          seats_total: number | null
          seats_used: number | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          vendor: string
          workspace_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancellation_terms_url?: string | null
          cost_per_cycle?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          linked_financial_entry_id?: string | null
          notes?: string | null
          owner_user_id?: string | null
          payment_method?: string | null
          plan_name?: string | null
          product_name: string
          renewal_date?: string | null
          seats_total?: number | null
          seats_used?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          vendor: string
          workspace_id: string
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancellation_terms_url?: string | null
          cost_per_cycle?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          linked_financial_entry_id?: string | null
          notes?: string | null
          owner_user_id?: string | null
          payment_method?: string | null
          plan_name?: string | null
          product_name?: string
          renewal_date?: string | null
          seats_total?: number | null
          seats_used?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          vendor?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_licenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_licenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscription_licenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          mode: string
          reason: string
          scope: Json | null
          started_at: string
          super_admin_user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          mode?: string
          reason: string
          scope?: Json | null
          started_at?: string
          super_admin_user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: string
          reason?: string
          scope?: Json | null
          started_at?: string
          super_admin_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "support_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          correlation_id: string | null
          created_at: string
          dimensions: Json | null
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          workspace_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_type: string
          metric_value: number
          workspace_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "system_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          iss_aliquota: number | null
          iss_retido_na_fonte: boolean | null
          lp_cofins_aliquota: number | null
          lp_csll_aliquota: number | null
          lp_irpj_adicional: number | null
          lp_irpj_aliquota: number | null
          lp_pis_aliquota: number | null
          lp_presuncao_servicos: number | null
          lr_cofins_aliquota: number | null
          lr_csll_aliquota: number | null
          lr_irpj_adicional: number | null
          lr_irpj_aliquota: number | null
          lr_pis_aliquota: number | null
          notes: string | null
          retencao_cofins_aliquota: number | null
          retencao_csll_aliquota: number | null
          retencao_inss_aliquota: number | null
          retencao_irrf_aliquota: number | null
          retencao_pis_aliquota: number | null
          simples_aliquota_efetiva: number | null
          simples_anexo: string | null
          simples_faixa: number | null
          tax_regime: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          iss_aliquota?: number | null
          iss_retido_na_fonte?: boolean | null
          lp_cofins_aliquota?: number | null
          lp_csll_aliquota?: number | null
          lp_irpj_adicional?: number | null
          lp_irpj_aliquota?: number | null
          lp_pis_aliquota?: number | null
          lp_presuncao_servicos?: number | null
          lr_cofins_aliquota?: number | null
          lr_csll_aliquota?: number | null
          lr_irpj_adicional?: number | null
          lr_irpj_aliquota?: number | null
          lr_pis_aliquota?: number | null
          notes?: string | null
          retencao_cofins_aliquota?: number | null
          retencao_csll_aliquota?: number | null
          retencao_inss_aliquota?: number | null
          retencao_irrf_aliquota?: number | null
          retencao_pis_aliquota?: number | null
          simples_aliquota_efetiva?: number | null
          simples_anexo?: string | null
          simples_faixa?: number | null
          tax_regime?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          iss_aliquota?: number | null
          iss_retido_na_fonte?: boolean | null
          lp_cofins_aliquota?: number | null
          lp_csll_aliquota?: number | null
          lp_irpj_adicional?: number | null
          lp_irpj_aliquota?: number | null
          lp_pis_aliquota?: number | null
          lp_presuncao_servicos?: number | null
          lr_cofins_aliquota?: number | null
          lr_csll_aliquota?: number | null
          lr_irpj_adicional?: number | null
          lr_irpj_aliquota?: number | null
          lr_pis_aliquota?: number | null
          notes?: string | null
          retencao_cofins_aliquota?: number | null
          retencao_csll_aliquota?: number | null
          retencao_inss_aliquota?: number | null
          retencao_irrf_aliquota?: number | null
          retencao_pis_aliquota?: number | null
          simples_aliquota_efetiva?: number | null
          simples_anexo?: string | null
          simples_faixa?: number | null
          tax_regime?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tax_settings_workspace_id_fkey"
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
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
      transaction_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          card_id: string | null
          category_id: string | null
          client_id: string | null
          collaborator_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          installment_number: number | null
          invoice_number: string | null
          invoice_url: string | null
          metadata: Json | null
          notes: string | null
          paid_date: string | null
          parent_transaction_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"] | null
          status: Database["public"]["Enums"]["transaction_status"]
          total_installments: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category_id?: string | null
          client_id?: string | null
          collaborator_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          installment_number?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          notes?: string | null
          paid_date?: string | null
          parent_transaction_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          status?: Database["public"]["Enums"]["transaction_status"]
          total_installments?: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category_id?: string | null
          client_id?: string | null
          collaborator_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          notes?: string | null
          paid_date?: string | null
          parent_transaction_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          status?: Database["public"]["Enums"]["transaction_status"]
          total_installments?: number | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "card_financial_history_view"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          module: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "usage_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_type: string
          earned_at: string
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          badge_type: string
          earned_at?: string
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          badge_type?: string
          earned_at?: string
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_badges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_birthdays: {
        Row: {
          birth_date: string
          created_at: string | null
          updated_at: string | null
          user_id: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          birth_date: string
          created_at?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          birth_date?: string
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_birthdays_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_birthdays_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goal_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          current_value: number | null
          goal_id: string
          id: string
          reward_claimed: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          goal_id: string
          id?: string
          reward_claimed?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          goal_id?: string
          id?: string
          reward_claimed?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "weekly_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_levels: {
        Row: {
          created_at: string
          current_level: number
          id: string
          level_name: string
          next_level_score: number
          total_score: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          id?: string
          level_name?: string
          next_level_score?: number
          total_score?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          id?: string
          level_name?: string
          next_level_score?: number
          total_score?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          id: string
          notify_authentication: boolean
          notify_cards: boolean
          notify_gamification: boolean
          notify_governance: boolean
          notify_system: boolean
          notify_workspace: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_authentication?: boolean
          notify_cards?: boolean
          notify_gamification?: boolean
          notify_governance?: boolean
          notify_system?: boolean
          notify_workspace?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_authentication?: boolean
          notify_cards?: boolean
          notify_gamification?: boolean
          notify_governance?: boolean
          notify_system?: boolean
          notify_workspace?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          actions_count: Json | null
          badges_earned: string[] | null
          completed: boolean | null
          created_at: string | null
          current_step: number | null
          id: string
          steps_completed: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actions_count?: Json | null
          badges_earned?: string[] | null
          completed?: boolean | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          steps_completed?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actions_count?: Json | null
          badges_earned?: string[] | null
          completed?: boolean | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          steps_completed?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_preferences_workspace_id_fkey"
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_views: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          query: Json
          scope_id: string | null
          scope_type: string
          sort: Json | null
          updated_at: string
          user_id: string
          view_mode: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          query?: Json
          scope_id?: string | null
          scope_type: string
          sort?: Json | null
          updated_at?: string
          user_id: string
          view_mode?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          query?: Json
          scope_id?: string | null
          scope_type?: string
          sort?: Json | null
          updated_at?: string
          user_id?: string
          view_mode?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_saved_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_view_last_state: {
        Row: {
          id: string
          last_query: Json | null
          last_used_at: string | null
          last_view_mode: string | null
          scope_id: string | null
          scope_type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          last_query?: Json | null
          last_used_at?: string | null
          last_view_mode?: string | null
          scope_id?: string | null
          scope_type: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          last_query?: Json | null
          last_used_at?: string | null
          last_view_mode?: string | null
          scope_id?: string | null
          scope_type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_view_last_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_view_last_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      view_templates: {
        Row: {
          created_at: string | null
          default_config: Json
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          sort_order: number | null
          space_type: string
          updated_at: string | null
          view_type: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_config?: Json
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          sort_order?: number | null
          space_type: string
          updated_at?: string | null
          view_type: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_config?: Json
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          sort_order?: number | null
          space_type?: string
          updated_at?: string | null
          view_type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "view_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          event_type: string
          event_version: string | null
          id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          retry_count: number
          subscription_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          event_type: string
          event_version?: string | null
          id?: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          subscription_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          event_version?: string | null
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          secret: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "webhook_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_goals: {
        Row: {
          created_at: string
          description: string | null
          goal_type: string
          id: string
          is_active: boolean | null
          reward_badge: string | null
          reward_points: number | null
          target_value: number
          title: string
          week_start: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          reward_badge?: string | null
          reward_points?: number | null
          target_value: number
          title: string
          week_start: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          reward_badge?: string | null
          reward_points?: number | null
          target_value?: number
          title?: string
          week_start?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "weekly_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json
          triggered_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json
          triggered_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json
          triggered_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workflow_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_stages: {
        Row: {
          allow_auto_assignment: boolean | null
          allow_auto_checklist: boolean | null
          allow_auto_transition: boolean | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_final: boolean | null
          is_initial: boolean | null
          is_optional: boolean | null
          min_checklist_progress: number | null
          name: string
          requires_briefing: boolean | null
          requires_checklist: boolean | null
          requires_no_dependencies: boolean | null
          sla_critical_hours: number | null
          sla_warning_hours: number | null
          slug: string
          sort_order: number
          updated_at: string
          wip_limit: number | null
          wip_limit_per_person: number | null
          workflow_id: string
        }
        Insert: {
          allow_auto_assignment?: boolean | null
          allow_auto_checklist?: boolean | null
          allow_auto_transition?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_final?: boolean | null
          is_initial?: boolean | null
          is_optional?: boolean | null
          min_checklist_progress?: number | null
          name: string
          requires_briefing?: boolean | null
          requires_checklist?: boolean | null
          requires_no_dependencies?: boolean | null
          sla_critical_hours?: number | null
          sla_warning_hours?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
          wip_limit?: number | null
          wip_limit_per_person?: number | null
          workflow_id: string
        }
        Update: {
          allow_auto_assignment?: boolean | null
          allow_auto_checklist?: boolean | null
          allow_auto_transition?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_final?: boolean | null
          is_initial?: boolean | null
          is_optional?: boolean | null
          min_checklist_progress?: number | null
          name?: string
          requires_briefing?: boolean | null
          requires_checklist?: boolean | null
          requires_no_dependencies?: boolean | null
          sla_critical_hours?: number | null
          sla_warning_hours?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
          wip_limit?: number | null
          wip_limit_per_person?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stages_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          allowed_roles: string[] | null
          created_at: string
          from_stage_id: string
          id: string
          is_allowed: boolean | null
          is_backward: boolean | null
          is_forward: boolean | null
          requires_approval: boolean | null
          requires_reason: boolean | null
          to_stage_id: string
          workflow_id: string
        }
        Insert: {
          allowed_roles?: string[] | null
          created_at?: string
          from_stage_id: string
          id?: string
          is_allowed?: boolean | null
          is_backward?: boolean | null
          is_forward?: boolean | null
          requires_approval?: boolean | null
          requires_reason?: boolean | null
          to_stage_id: string
          workflow_id: string
        }
        Update: {
          allowed_roles?: string[] | null
          created_at?: string
          from_stage_id?: string
          id?: string
          is_allowed?: boolean | null
          is_backward?: boolean | null
          is_forward?: boolean | null
          requires_approval?: boolean | null
          requires_reason?: boolean | null
          to_stage_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_entitlement_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          enabled_override: boolean | null
          entitlement_key: string
          expires_at: string | null
          id: string
          limit_override: number | null
          reason: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled_override?: boolean | null
          entitlement_key: string
          expires_at?: string | null
          id?: string
          limit_override?: number | null
          reason: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled_override?: boolean | null
          entitlement_key?: string
          expires_at?: string | null
          id?: string
          limit_override?: number | null
          reason?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_entitlement_overrides_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "entitlement_registry"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "workspace_entitlement_overrides_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "workspace_entitlements_effective"
            referencedColumns: ["entitlement_key"]
          },
          {
            foreignKeyName: "workspace_entitlement_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_entitlement_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_entitlements: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_entitlements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_entitlements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          can_view_financials: boolean | null
          can_view_salaries: boolean | null
          department: string | null
          function_title: string | null
          id: string
          is_active: boolean | null
          joined_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          can_view_financials?: boolean | null
          can_view_salaries?: boolean | null
          department?: string | null
          function_title?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          can_view_financials?: boolean | null
          can_view_salaries?: boolean | null
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
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_plans: {
        Row: {
          api_keys_limit: number
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id: string | null
          provider_subscription_id: string | null
          seats_limit: number
          spaces_limit: number
          status: Database["public"]["Enums"]["plan_status"]
          storage_mb_limit: number
          trial_ends_at: string | null
          updated_at: string
          webhooks_limit: number
          workspace_id: string
        }
        Insert: {
          api_keys_limit?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          seats_limit?: number
          spaces_limit?: number
          status?: Database["public"]["Enums"]["plan_status"]
          storage_mb_limit?: number
          trial_ends_at?: string | null
          updated_at?: string
          webhooks_limit?: number
          workspace_id: string
        }
        Update: {
          api_keys_limit?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          seats_limit?: number
          spaces_limit?: number
          status?: Database["public"]["Enums"]["plan_status"]
          storage_mb_limit?: number
          trial_ends_at?: string | null
          updated_at?: string
          webhooks_limit?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_usage: {
        Row: {
          api_keys_used: number | null
          automations_runs: number | null
          created_at: string
          events_ingested: number | null
          id: string
          period_end: string
          period_start: string
          seats_used: number | null
          spaces_used: number | null
          storage_mb_used: number | null
          updated_at: string
          webhooks_used: number | null
          workspace_id: string
        }
        Insert: {
          api_keys_used?: number | null
          automations_runs?: number | null
          created_at?: string
          events_ingested?: number | null
          id?: string
          period_end?: string
          period_start?: string
          seats_used?: number | null
          spaces_used?: number | null
          storage_mb_used?: number | null
          updated_at?: string
          webhooks_used?: number | null
          workspace_id: string
        }
        Update: {
          api_keys_used?: number | null
          automations_runs?: number | null
          created_at?: string
          events_ingested?: number | null
          id?: string
          period_end?: string
          period_start?: string
          seats_used?: number | null
          spaces_used?: number | null
          storage_mb_used?: number | null
          updated_at?: string
          webhooks_used?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_usage_workspace_id_fkey"
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
      api_keys_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          key_prefix: string | null
          last_used_at: string | null
          name: string | null
          permissions: string[] | null
          rate_limit_per_hour: number | null
          rate_limit_per_minute: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          permissions?: string[] | null
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          permissions?: string[] | null
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_financial_history_view: {
        Row: {
          amount: number | null
          card_id: string | null
          created_at: string | null
          description: string | null
          entry_date: string | null
          entry_id: string | null
          entry_status: string | null
          entry_type: string | null
          metadata: Json | null
          source_type: string | null
          workspace_id: string | null
        }
        Insert: {
          amount?: number | null
          card_id?: string | null
          created_at?: string | null
          description?: string | null
          entry_date?: string | null
          entry_id?: string | null
          entry_status?: never
          entry_type?: never
          metadata?: Json | null
          source_type?: never
          workspace_id?: string | null
        }
        Update: {
          amount?: number | null
          card_id?: string | null
          created_at?: string | null
          description?: string | null
          entry_date?: string | null
          entry_id?: string | null
          entry_status?: never
          entry_type?: never
          metadata?: Json | null
          source_type?: never
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_movements_history_view: {
        Row: {
          card_id: string | null
          created_at: string | null
          entry_date: string | null
          entry_id: string | null
          entry_type: Database["public"]["Enums"]["movement_type"] | null
          estimated_value: number | null
          item_name: string | null
          notes: string | null
          quantity: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciation_by_department_view: {
        Row: {
          department_id: string | null
          items_count: number | null
          month_ref: string | null
          total_accumulated: number | null
          total_book_value: number | null
          total_depreciation: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "depreciation_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciation_summary_view: {
        Row: {
          last_calculation: string | null
          monthly_depreciation: number | null
          total_accumulated: number | null
          total_book_value: number | null
          total_items: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "depreciation_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_summary_view: {
        Row: {
          cash_amount: number | null
          month: number | null
          non_cash_amount: number | null
          total_amount: number | null
          type: Database["public"]["Enums"]["transaction_type"] | null
          workspace_id: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_alerts_summary: {
        Row: {
          acknowledged_alerts: number | null
          active_alerts: number | null
          critical_alerts: number | null
          high_alerts: number | null
          low_alerts: number | null
          medium_alerts: number | null
          resolved_alerts: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "financial_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_exec_kpis: {
        Row: {
          book_value: number | null
          expired_warranties: number | null
          expiring_subscriptions_30d: number | null
          expiring_warranties_30d: number | null
          low_stock_count: number | null
          monthly_license_cost: number | null
          monthly_maintenance_cost: number | null
          out_of_stock_count: number | null
          overdue_returns: number | null
          pending_maintenance: number | null
          potential_savings: number | null
          total_asset_value: number | null
          total_depreciation: number | null
          total_items: number | null
          underutilized_licenses: number | null
          workspace_id: string | null
          yearly_license_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movement_history: {
        Row: {
          card_id: string | null
          card_title: string | null
          created_at: string | null
          department_id: string | null
          department_name: string | null
          id: string | null
          item_code: string | null
          item_id: string | null
          item_name: string | null
          movement_type: Database["public"]["Enums"]["movement_type"] | null
          notes: string | null
          occurred_at: string | null
          quantity: number | null
          serial_number: string | null
          stock_delta: number | null
          unit_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "inventory_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_summary: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"] | null
          code: string | null
          current_stock: number | null
          department_id: string | null
          is_serialized: boolean | null
          item_id: string | null
          min_stock: number | null
          name: string | null
          purchase_value: number | null
          residual_value: number | null
          status_condition: Database["public"]["Enums"]["item_condition"] | null
          stock_status: string | null
          units_checked_out: number | null
          units_in_maintenance: number | null
          units_in_stock: number | null
          useful_life_months: number | null
          workspace_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["inventory_category"] | null
          code?: string | null
          current_stock?: number | null
          department_id?: string | null
          is_serialized?: boolean | null
          item_id?: string | null
          min_stock?: number | null
          name?: string | null
          purchase_value?: number | null
          residual_value?: number | null
          status_condition?:
            | Database["public"]["Enums"]["item_condition"]
            | null
          stock_status?: never
          units_checked_out?: never
          units_in_maintenance?: never
          units_in_stock?: never
          useful_life_months?: number | null
          workspace_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"] | null
          code?: string | null
          current_stock?: number | null
          department_id?: string | null
          is_serialized?: boolean | null
          item_id?: string | null
          min_stock?: number | null
          name?: string | null
          purchase_value?: number | null
          residual_value?: number | null
          status_condition?:
            | Database["public"]["Enums"]["item_condition"]
            | null
          stock_status?: never
          units_checked_out?: never
          units_in_maintenance?: never
          units_in_stock?: never
          useful_life_months?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_costs_view: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string | null
          id: string | null
          is_resolved: boolean | null
          is_warranty_claim: boolean | null
          item_id: string | null
          item_name: string | null
          maintenance_type: string | null
          month: number | null
          performed_by: string | null
          problem_description: string | null
          scheduled_date: string | null
          serial_number: string | null
          solution_description: string | null
          status: string | null
          unit_id: string | null
          vendor: string | null
          workspace_id: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "maintenance_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "maintenance_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "warranty_status_view"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "maintenance_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "maintenance_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_costs_summary_view: {
        Row: {
          expiring_soon_count: number | null
          total_monthly_cost: number | null
          total_seats: number | null
          total_seats_used: number | null
          total_subscriptions: number | null
          total_yearly_cost: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_licenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscription_licenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_status_view: {
        Row: {
          auto_renew: boolean | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          cost_per_cycle: number | null
          days_until_renewal: number | null
          id: string | null
          is_active: boolean | null
          monthly_cost: number | null
          plan_name: string | null
          product_name: string | null
          renewal_date: string | null
          renewal_status: string | null
          seats_total: number | null
          seats_used: number | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          utilization_percent: number | null
          vendor: string | null
          workspace_id: string | null
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cost_per_cycle?: number | null
          days_until_renewal?: never
          id?: string | null
          is_active?: boolean | null
          monthly_cost?: never
          plan_name?: string | null
          product_name?: string | null
          renewal_date?: string | null
          renewal_status?: never
          seats_total?: number | null
          seats_used?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          utilization_percent?: never
          vendor?: string | null
          workspace_id?: string | null
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cost_per_cycle?: number | null
          days_until_renewal?: never
          id?: string | null
          is_active?: boolean | null
          monthly_cost?: never
          plan_name?: string | null
          product_name?: string | null
          renewal_date?: string | null
          renewal_status?: never
          seats_total?: number | null
          seats_used?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          utilization_percent?: never
          vendor?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_licenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscription_licenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_view: {
        Row: {
          active_cards: number | null
          errors_24h: number | null
          last_card_created: string | null
          last_time_entry: string | null
          team_size: number | null
          total_cards: number | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          active_cards?: never
          errors_24h?: never
          last_card_created?: never
          last_time_entry?: never
          team_size?: never
          total_cards?: never
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          active_cards?: never
          errors_24h?: never
          last_card_created?: never
          last_time_entry?: never
          team_size?: never
          total_cards?: never
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      warranty_status_view: {
        Row: {
          current_status: Database["public"]["Enums"]["unit_status"] | null
          days_until_expiry: number | null
          item_condition: string | null
          item_id: string | null
          item_name: string | null
          serial_number: string | null
          unit_id: string | null
          warranty_end_date: string | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_status: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inventory_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          events: string[] | null
          id: string | null
          is_active: boolean | null
          name: string | null
          secret: string | null
          updated_at: string | null
          url: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          events?: string[] | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          secret?: never
          updated_at?: string | null
          url?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          events?: string[] | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          secret?: never
          updated_at?: string | null
          url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "webhook_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_entitlements_effective: {
        Row: {
          category: string | null
          description: string | null
          enabled: boolean | null
          enforcement_scope: string | null
          entitlement_key: string | null
          limit_value: number | null
          name: string | null
          override_expires_at: string | null
          override_reason: string | null
          plan_key: string | null
          source: string | null
          type: string | null
          ui_visibility: string | null
          unit: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "system_health_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_workspace_invite: { Args: { p_token: string }; Returns: Json }
      add_user_score: {
        Args: { p_points: number; p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      apply_folder_template: {
        Args: { p_folder_id: string; p_template_id: string }
        Returns: Json
      }
      archive_old_notices: { Args: never; Returns: undefined }
      award_badge: {
        Args: {
          p_badge_type: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      calculate_card_kit_cost: {
        Args: { p_card_id: string }
        Returns: {
          items_count: number
          total_cost: number
        }[]
      }
      calculate_depreciation: {
        Args: { p_month: string; p_workspace_id: string }
        Returns: number
      }
      calculate_inss: {
        Args: { p_salary: number }
        Returns: {
          inss_percentage: number
          inss_value: number
        }[]
      }
      calculate_irrf: {
        Args: { p_base_salary: number; p_dependents?: number }
        Returns: {
          irrf_base: number
          irrf_value: number
        }[]
      }
      calculate_monthly_depreciation: {
        Args: { p_month_ref: string; p_workspace_id: string }
        Returns: {
          dre_entry_id: string
          items_processed: number
          total_depreciation: number
        }[]
      }
      calculate_taxes: {
        Args: {
          p_gross_revenue: number
          p_reference_date?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      calculate_user_level: {
        Args: { score: number }
        Returns: {
          level: number
          level_name: string
          next_level_score: number
        }[]
      }
      can_access_card: {
        Args: { p_card_id: string; p_user_id: string }
        Returns: boolean
      }
      can_access_folder: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_space: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_transaction_attachment: {
        Args: { _transaction_id: string; _user_id: string }
        Returns: boolean
      }
      can_delete_checklist: {
        Args: { _checklist_id: string; _user_id: string }
        Returns: boolean
      }
      can_delete_transaction_attachment: {
        Args: {
          _attachment_owner_id: string
          _transaction_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_manage_financial: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      can_receive_card_notification: {
        Args: { _card_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_financial: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      can_view_sensitive_financial: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      change_member_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      check_entitlement_with_log: {
        Args: {
          p_action?: string
          p_entitlement_key: string
          p_workspace_id: string
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_api_key_id: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      check_saved_views_limit: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      check_social_entitlement_safe: {
        Args: { p_action: string; p_workspace_id: string }
        Returns: Json
      }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      compute_daily_snapshot: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      compute_dashboard_snapshot: {
        Args: { p_snapshot_type: string; p_workspace_id: string }
        Returns: undefined
      }
      compute_executive_kpis: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      create_clients_space_for_workspace: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      create_default_workflow: {
        Args: { p_created_by: string; p_workspace_id: string }
        Returns: string
      }
      create_workspace_invite: {
        Args: {
          p_email: string
          p_role?: Database["public"]["Enums"]["app_role"]
          p_workspace_id: string
        }
        Returns: Json
      }
      emit_domain_event: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_causation_id?: string
          p_correlation_id?: string
          p_event_type: string
          p_metadata?: Json
          p_payload: Json
          p_workspace_id: string
        }
        Returns: string
      }
      enforce_entitlement: {
        Args: {
          p_action?: string
          p_current_value?: number
          p_entitlement_key: string
          p_user_id?: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      expire_old_invites: { Args: never; Returns: undefined }
      fix_space_order: { Args: { p_workspace_id: string }; Returns: number }
      generate_birthday_notices: { Args: never; Returns: undefined }
      generate_payroll: {
        Args: {
          p_collaborator_id?: string
          p_reference_month: string
          p_workspace_id: string
        }
        Returns: number
      }
      get_aggregated_metrics: {
        Args: {
          p_end_date?: string
          p_metric_type?: string
          p_start_date?: string
          p_workspace_id: string
        }
        Returns: {
          avg_value: number
          count: number
          last_value: number
          max_value: number
          metric_name: string
          metric_type: string
          min_value: number
        }[]
      }
      get_card_financial_summary: {
        Args: { p_card_id: string }
        Returns: {
          kit_estimated_cost: number
          movements_count: number
          total_expenses: number
          total_income: number
          transactions_count: number
        }[]
      }
      get_card_workspace: { Args: { _card_id: string }; Returns: string }
      get_folder_workspace_id: { Args: { _folder_id: string }; Returns: string }
      get_idempotent_response: {
        Args: { p_idempotency_key: string; p_workspace_id: string }
        Returns: {
          found: boolean
          response_body: Json
          response_status: number
        }[]
      }
      get_item_movement_timeline: {
        Args: { p_item_id: string; p_limit?: number }
        Returns: {
          card_title: string
          department_name: string
          id: string
          movement_type: string
          notes: string
          occurred_at: string
          quantity: number
          running_balance: number
          serial_number: string
          stock_delta: number
        }[]
      }
      get_or_create_marketing_card: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      get_unprocessed_events: {
        Args: { p_limit?: number; p_workspace_id: string }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          correlation_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          payload: Json
          version: number
        }[]
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      get_user_role_in_workspace: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: string
      }
      get_workspace_plan: {
        Args: { p_workspace_id: string }
        Returns: {
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          seats_limit: number
          spaces_limit: number
          status: Database["public"]["Enums"]["plan_status"]
        }[]
      }
      has_active_support_session: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: {
          expires_at: string
          is_active: boolean
          mode: string
        }[]
      }
      has_admin_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_billing_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_card_permission: {
        Args: { p_card_id: string; p_permission: string; p_user_id: string }
        Returns: boolean
      }
      has_elevated_role: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      has_entitlement: {
        Args: { p_entitlement_key: string; p_workspace_id: string }
        Returns: boolean
      }
      has_finance_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_folder_admin_access: {
        Args: { _folder_id: string; _user_id: string }
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
      has_salary_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_social_write_entitlement: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      initialize_space_custom_fields: {
        Args: { p_space_type: string; p_workspace_id: string }
        Returns: number
      }
      is_card_member: {
        Args: { _card_id: string; _user_id: string }
        Returns: boolean
      }
      is_folder_member: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      is_folder_owner: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin_with_session: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      is_super_admin_with_write_session: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_for_folder: {
        Args: { p_folder_id: string; p_user_id: string }
        Returns: boolean
      }
      log_entitlement_block: {
        Args: {
          p_action: string
          p_current_value?: number
          p_entitlement_key: string
          p_limit_value?: number
          p_metadata?: Json
          p_reason_code: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      log_module_usage: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_module: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      log_structured: {
        Args: {
          p_context?: Json
          p_correlation_id?: string
          p_level: string
          p_message: string
          p_service: string
          p_session_id?: string
          p_workspace_id?: string
        }
        Returns: undefined
      }
      mark_events_processed: {
        Args: { p_event_ids: string[] }
        Returns: number
      }
      match_dda_with_transactions: {
        Args: {
          p_tolerance_amount?: number
          p_tolerance_days?: number
          p_workspace_id: string
        }
        Returns: {
          boleto_id: string
          match_reason: string
          match_score: number
          transaction_id: string
        }[]
      }
      migrate_clients_to_client_cards: {
        Args: { p_workspace_id: string }
        Returns: number
      }
      promote_to_owner: {
        Args: { p_target_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      record_metric:
        | {
            Args: {
              p_correlation_id?: string
              p_dimensions?: Json
              p_metric_name: string
              p_metric_type: string
              p_metric_value: number
              p_workspace_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_correlation_id?: string
              p_dimensions?: Json
              p_metric_name: string
              p_metric_type: string
              p_metric_value: number
              p_workspace_id: string
            }
            Returns: string
          }
      reorder_spaces: {
        Args: { p_items: Json; p_reason?: string; p_workspace_id: string }
        Returns: Json
      }
      request_webhook_replay: {
        Args: { p_delivery_id: string; p_workspace_id: string }
        Returns: Json
      }
      resolve_entitlement: {
        Args: { p_entitlement_key: string; p_workspace_id: string }
        Returns: Json
      }
      revoke_workspace_invite: { Args: { p_invite_id: string }; Returns: Json }
      run_subscription_check_job: { Args: never; Returns: undefined }
      run_warranty_check_job: { Args: never; Returns: undefined }
      store_idempotent_response: {
        Args: {
          p_idempotency_key: string
          p_request_method: string
          p_request_path: string
          p_response_body: Json
          p_response_status: number
          p_workspace_id: string
        }
        Returns: undefined
      }
      transfer_ownership:
        | {
            Args: { p_new_owner_id: string; p_workspace_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_demote_self?: boolean
              p_new_owner_id: string
              p_workspace_id: string
            }
            Returns: Json
          }
      update_goal_progress: {
        Args: {
          p_goal_type: string
          p_increment?: number
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      upgrade_workspace_plan: {
        Args: {
          p_new_tier: Database["public"]["Enums"]["plan_tier"]
          p_provider?: Database["public"]["Enums"]["billing_provider"]
          p_workspace_id: string
        }
        Returns: undefined
      }
      user_has_workspace_access: { Args: { ws_id: string }; Returns: boolean }
      user_is_workspace_admin: { Args: { ws_id: string }; Returns: boolean }
      user_wants_notification: {
        Args: { p_category: string; p_user_id: string }
        Returns: boolean
      }
      validate_api_key: {
        Args: { api_key: string }
        Returns: {
          permissions: string[]
          workspace_id: string
        }[]
      }
      validate_checkout_availability: {
        Args: { p_item_id: string; p_quantity?: number; p_unit_id?: string }
        Returns: Json
      }
      within_limit:
        | {
            Args: {
              p_current_value?: number
              p_entitlement_key: string
              p_workspace_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_increment?: number
              p_metric: string
              p_workspace_id: string
            }
            Returns: boolean
          }
    }
    Enums: {
      alert_severity_level: "low" | "medium" | "high" | "critical"
      alert_status_type: "open" | "acknowledged" | "resolved" | "snoozed"
      alert_type_inventory:
        | "warranty_expiring"
        | "subscription_expiring"
        | "low_stock"
        | "preventive_maintenance_due"
        | "insurance_expiring"
        | "license_underutilized"
        | "item_eol"
      app_role:
        | "super_admin"
        | "owner"
        | "admin"
        | "coordinator"
        | "finance"
        | "member"
        | "viewer"
      billing_cycle: "monthly" | "quarterly" | "yearly" | "custom"
      billing_provider: "manual" | "stripe"
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
      client_financial_state: "healthy" | "attention" | "critical" | "loss"
      client_status: "active" | "paused" | "closed"
      content_pillar_type:
        | "educational"
        | "sales"
        | "entertainment"
        | "relationship"
        | "institutional"
        | "other"
      depreciation_method:
        | "straight_line"
        | "declining_balance"
        | "units_of_production"
      event_type: "meeting" | "recording" | "milestone" | "deadline" | "other"
      funnel_stage_type: "tofu" | "mofu" | "bofu"
      inventory_category: "consumable" | "equipment" | "asset"
      item_condition: "good" | "fair" | "defective" | "maintenance"
      movement_type: "IN" | "OUT" | "RETURN" | "TRANSFER" | "ADJUST"
      plan_status: "active" | "past_due" | "canceled" | "trialing"
      plan_tier: "free" | "pro" | "enterprise"
      recurrence_type: "none" | "monthly" | "yearly"
      social_content_type:
        | "feed"
        | "story"
        | "reels"
        | "carousel"
        | "video"
        | "short"
        | "article"
      social_platform_type:
        | "instagram"
        | "facebook"
        | "linkedin"
        | "tiktok"
        | "youtube"
        | "twitter"
      social_post_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "archived"
      space_type:
        | "designer"
        | "audiovisual"
        | "social_media"
        | "traffic"
        | "administrative"
        | "coordination"
        | "custom"
      subscription_status: "active" | "expiring" | "expired" | "cancelled"
      transaction_status: "pending" | "paid" | "cancelled" | "overdue"
      transaction_type: "income" | "expense" | "transfer"
      unit_status: "in_stock" | "checked_out" | "maintenance" | "retired"
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
      alert_severity_level: ["low", "medium", "high", "critical"],
      alert_status_type: ["open", "acknowledged", "resolved", "snoozed"],
      alert_type_inventory: [
        "warranty_expiring",
        "subscription_expiring",
        "low_stock",
        "preventive_maintenance_due",
        "insurance_expiring",
        "license_underutilized",
        "item_eol",
      ],
      app_role: [
        "super_admin",
        "owner",
        "admin",
        "coordinator",
        "finance",
        "member",
        "viewer",
      ],
      billing_cycle: ["monthly", "quarterly", "yearly", "custom"],
      billing_provider: ["manual", "stripe"],
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
      client_financial_state: ["healthy", "attention", "critical", "loss"],
      client_status: ["active", "paused", "closed"],
      content_pillar_type: [
        "educational",
        "sales",
        "entertainment",
        "relationship",
        "institutional",
        "other",
      ],
      depreciation_method: [
        "straight_line",
        "declining_balance",
        "units_of_production",
      ],
      event_type: ["meeting", "recording", "milestone", "deadline", "other"],
      funnel_stage_type: ["tofu", "mofu", "bofu"],
      inventory_category: ["consumable", "equipment", "asset"],
      item_condition: ["good", "fair", "defective", "maintenance"],
      movement_type: ["IN", "OUT", "RETURN", "TRANSFER", "ADJUST"],
      plan_status: ["active", "past_due", "canceled", "trialing"],
      plan_tier: ["free", "pro", "enterprise"],
      recurrence_type: ["none", "monthly", "yearly"],
      social_content_type: [
        "feed",
        "story",
        "reels",
        "carousel",
        "video",
        "short",
        "article",
      ],
      social_platform_type: [
        "instagram",
        "facebook",
        "linkedin",
        "tiktok",
        "youtube",
        "twitter",
      ],
      social_post_status: [
        "draft",
        "pending_approval",
        "approved",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "archived",
      ],
      space_type: [
        "designer",
        "audiovisual",
        "social_media",
        "traffic",
        "administrative",
        "coordination",
        "custom",
      ],
      subscription_status: ["active", "expiring", "expired", "cancelled"],
      transaction_status: ["pending", "paid", "cancelled", "overdue"],
      transaction_type: ["income", "expense", "transfer"],
      unit_status: ["in_stock", "checked_out", "maintenance", "retired"],
      workspace_status: ["active", "trial", "suspended", "inactive"],
    },
  },
} as const
