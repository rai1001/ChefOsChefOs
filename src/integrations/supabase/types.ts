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
      events: {
        Row: {
          client_contact: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          event_date: string
          event_type: string
          event_time: string | null
          hotel_id: string | null
          id: string
          menu_id: string | null
          name: string
          notes: string | null
          pax: number
          pax_confirmed: number
          pax_estimated: number
          status: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          event_date: string
          event_type?: string
          event_time?: string | null
          hotel_id?: string | null
          id?: string
          menu_id?: string | null
          name: string
          notes?: string | null
          pax?: number
          pax_confirmed?: number
          pax_estimated?: number
          status?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: string
          event_time?: string | null
          hotel_id?: string | null
          id?: string
          menu_id?: string | null
          name?: string
          notes?: string | null
          pax?: number
          pax_confirmed?: number
          pax_estimated?: number
          status?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          breakfast_pax: number | null
          created_at: string
          created_by: string | null
          extras_pax: number | null
          forecast_date: string
          full_board_pax: number | null
          half_board_pax: number | null
          hotel_id: string | null
          hotel_occupancy: number | null
          id: string
          notes: string | null
          predicted_occupancy: number | null
          updated_at: string
        }
        Insert: {
          breakfast_pax?: number | null
          created_at?: string
          created_by?: string | null
          extras_pax?: number | null
          forecast_date: string
          full_board_pax?: number | null
          half_board_pax?: number | null
          hotel_id?: string | null
          hotel_occupancy?: number | null
          id?: string
          notes?: string | null
          predicted_occupancy?: number | null
          updated_at?: string
        }
        Update: {
          breakfast_pax?: number | null
          created_at?: string
          created_by?: string | null
          extras_pax?: number | null
          forecast_date?: string
          full_board_pax?: number | null
          half_board_pax?: number | null
          hotel_id?: string | null
          hotel_occupancy?: number | null
          id?: string
          notes?: string | null
          predicted_occupancy?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_members: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          is_owner: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          is_owner?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          is_owner?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      inventory_lots: {
        Row: {
          barcode: string | null
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          entry_date: string
          expiry_date: string | null
          hotel_id: string | null
          id: string
          location: string | null
          lot_number: string | null
          movement_type: string | null
          notes: string | null
          product_id: string
          quantity: number
          reference_document: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          expiry_date?: string | null
          hotel_id?: string | null
          id?: string
          location?: string | null
          lot_number?: string | null
          movement_type?: string | null
          notes?: string | null
          product_id: string
          quantity: number
          reference_document?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          expiry_date?: string | null
          hotel_id?: string | null
          id?: string
          location?: string | null
          lot_number?: string | null
          movement_type?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_document?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          barcode: string | null
          created_at: string
          created_by: string | null
          hotel_id: string | null
          id: string
          lot_id: string | null
          movement_type: string
          notes: string | null
          product_id: string | null
          quantity: number
          reference_document: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          created_by?: string | null
          hotel_id?: string | null
          id?: string
          lot_id?: string | null
          movement_type: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          reference_document?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          created_by?: string | null
          hotel_id?: string | null
          id?: string
          lot_id?: string | null
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_document?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          hotel_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          hotel_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          hotel_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          preparation_notes: string | null
          product_id: string
          quantity_per_pax: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          preparation_notes?: string | null
          product_id: string
          quantity_per_pax: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          preparation_notes?: string | null
          product_id?: string
          quantity_per_pax?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          cost_per_pax: number | null
          created_at: string
          created_by: string | null
          description: string | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          cost_per_pax?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          cost_per_pax?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          default_critical_stock: number
          default_min_stock: number
          default_optimal_stock: number
          description: string | null
          hotel_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_critical_stock?: number
          default_min_stock?: number
          default_optimal_stock?: number
          description?: string | null
          hotel_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_critical_stock?: number
          default_min_stock?: number
          default_optimal_stock?: number
          description?: string | null
          hotel_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      production_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          event_id: string | null
          hotel_id: string | null
          id: string
          priority: string | null
          shift: string
          started_at: string | null
          status: string | null
          task_date: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          event_id?: string | null
          hotel_id?: string | null
          id?: string
          priority?: string | null
          shift: string
          started_at?: string | null
          status?: string | null
          task_date: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          event_id?: string | null
          hotel_id?: string | null
          id?: string
          priority?: string | null
          shift?: string
          started_at?: string | null
          status?: string | null
          task_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string[] | null
          category_id: string | null
          critical_stock: number
          cost_price: number | null
          created_at: string
          current_stock: number | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          min_stock: number | null
          name: string
          notes: string | null
          optimal_stock: number
          supplier_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          category_id?: string | null
          critical_stock?: number
          cost_price?: number | null
          created_at?: string
          current_stock?: number | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          min_stock?: number | null
          name: string
          notes?: string | null
          optimal_stock?: number
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          category_id?: string | null
          critical_stock?: number
          cost_price?: number | null
          created_at?: string
          current_stock?: number | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          min_stock?: number | null
          name?: string
          notes?: string | null
          optimal_stock?: number
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_hotel_id: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_hotel_id?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_hotel_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_hotel_id_fkey"
            columns: ["current_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          received_quantity: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          received_quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          received_quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_issues: string | null
          delivery_note_url: string | null
          delivery_status: string | null
          expected_date: string | null
          hotel_id: string | null
          id: string
          is_complete: boolean | null
          notes: string | null
          order_date: string
          received_at: string | null
          status: string | null
          supplier_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_issues?: string | null
          delivery_note_url?: string | null
          delivery_status?: string | null
          expected_date?: string | null
          hotel_id?: string | null
          id?: string
          is_complete?: boolean | null
          notes?: string | null
          order_date?: string
          received_at?: string | null
          status?: string | null
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_issues?: string | null
          delivery_note_url?: string | null
          delivery_status?: string | null
          expected_date?: string | null
          hotel_id?: string | null
          id?: string
          is_complete?: boolean | null
          notes?: string | null
          order_date?: string
          received_at?: string | null
          status?: string | null
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          hotel_id: string
          id: string
          notes: string | null
          phone: string | null
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          hotel_id: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          hotel_id?: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shift_assignments: {
        Row: {
          created_at: string
          end_time: string | null
          hotel_id: string
          id: string
          notes: string | null
          shift_date: string
          shift_type: string
          staff_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          hotel_id: string
          id?: string
          notes?: string | null
          shift_date: string
          shift_type: string
          staff_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          hotel_id?: string
          id?: string
          notes?: string | null
          shift_date?: string
          shift_type?: string
          staff_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          hotel_id: string | null
          id: string
          notes: string | null
          shift_date: string
          shift_type: string
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          hotel_id?: string | null
          id?: string
          notes?: string | null
          shift_date: string
          shift_type: string
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          hotel_id?: string | null
          id?: string
          notes?: string | null
          shift_date?: string
          shift_type?: string
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          delivery_days: string[] | null
          delivery_lead_days: number | null
          email: string | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          delivery_days?: string[] | null
          delivery_lead_days?: number | null
          email?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          delivery_days?: string[] | null
          delivery_lead_days?: number | null
          email?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          abbreviation: string
          created_at: string
          hotel_id: string | null
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
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
      venues: {
        Row: {
          capacity: number | null
          created_at: string
          hotel_id: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          hotel_id?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          hotel_id?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_hotel_id: { Args: never; Returns: string }
      has_management_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_hotel_owner: { Args: never; Returns: boolean }
      is_jefe_cocina: { Args: never; Returns: boolean }
      is_maitre: { Args: never; Returns: boolean }
      is_produccion: { Args: never; Returns: boolean }
      is_rrhh: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_belongs_to_hotel: { Args: { _hotel_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "jefe_cocina"
        | "maitre"
        | "produccion"
        | "rrhh"
        | "super_admin"
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
        "admin",
        "jefe_cocina",
        "maitre",
        "produccion",
        "rrhh",
        "super_admin",
      ],
    },
  },
} as const
