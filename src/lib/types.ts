// ── DB row types (mirror Supabase schema) ─────────────────────────────────

export type DbTableStatus = 'available' | 'occupied' | 'pending_payment' | 'reserved'
export type OrderStatus   = 'open' | 'closed' | 'voided'
export type ItemStatus    = 'pending' | 'preparing' | 'ready' | 'served' | 'voided'
export type PayMethod     = 'cash' | 'card' | 'gcash' | 'maya' | 'comp' | 'void'

export interface RestaurantTable {
  id: string          // 'T1' … 'T15'
  label: string
  section: string
  capacity: number
  status: DbTableStatus
  pos_x: number | null
  pos_y: number | null
  created_at: string
}

export interface MenuItem {
  id: string          // UUID
  name: string
  category: string    // generated: category3 for Food, category2 for Bar (Beer, Cocktails/Hard, etc.)
  category2: string   // DB top-level: Beer | Cocktails/Hard | Non-Alcohol | Cigarettes | Food
  category3: string   // DB sub-level: Meals | Pork | Chicken | Drinks | Palit Bote | etc.
  price: number
  cost: number | null
  description?: string | null
  modifiers?: string[]
  is_available: boolean
  sort_order: number
  created_at: string
  updated_at?: string | null
}

export interface Order {
  id: number
  table_id: string
  opened_by: string | null
  opened_at: string
  closed_at: string | null
  status: OrderStatus
  notes: string | null
}

export interface Payment {
  id: number
  order_id: number
  method: PayMethod
  amount: number
  tendered: number | null
  change_due: number | null
  processed_by: string | null
  processed_at: string
  notes: string | null
}

export interface OrderItem {
  id: number
  order_id: number
  menu_item_id: string
  qty: number
  unit_price: number
  modifiers: string[]
  notes: string | null
  status: ItemStatus
  payment_id: number | null
  seat: number | null
  fired_at: string | null
  completed_at: string | null
  voided_by: string | null
  void_reason: string | null
}

export interface InventoryRow {
  id: number
  menu_item_id: string
  quantity: number
  unit: string
  low_stock_threshold: number
  updated_at: string
}

// ── App-level derived types ────────────────────────────────────────────────

// Cart line: local optimistic state (maps to order_items once persisted)
export interface CartLine {
  lineId: string          // temp local ID ('L1', 'L2', …)
  itemId: string          // menu_items.id
  itemName: string        // denormalised for display
  category: string        // menu_items.category — used for inventory deduction routing
  unitPrice: number
  qty: number
  mods: string[]
  note: string
  seat: number            // 0 = shared, 1+ = per-seat
  dbId?: number           // order_items.id once written
}

// KDS ticket: derived from orders + order_items
export interface KdsTicket {
  id: string              // '#' + order_item.id
  itemId: number          // order_item.id — bumping a single item
  orderId: number
  tableId: string
  station: 'kitchen' | 'bar'
  server: string
  itemName: string
  qty: number
  elapsedSec: number      // computed live from fired_at (or order opened_at)
  status: 'firing' | 'aging' | 'late'
}

// Table with runtime-derived status and totals
export interface TableWithStatus {
  id: string
  label: string
  section: string
  capacity: number
  pos_x: number | null
  pos_y: number | null
  // Derived:
  status: 'available' | 'occupied' | 'aging' | 'attention' | 'reserved'
  openMin: number         // 0 if no open order
  checkTotal: number      // sum of cart lines
  server: string | null
}

// ── Supabase Database shape ────────────────────────────────────────────────
// Rules: (1) flat Insert/Update (no Omit<T,K> intersections), (2) Row types
// must not include optional join fields — both break Supabase's type inference.
export interface Database {
  public: {
    Tables: {
      users: {
        Row: { id: string; name: string; role: string; is_active: boolean | null; created_at: string | null }
        Insert: { id: string; name: string; role: string; is_active?: boolean | null; created_at?: string | null }
        Update: { name?: string; role?: string; is_active?: boolean | null }
        Relationships: []
      }
      restaurant_tables: {
        Row: { id: string; label: string; section: string; capacity: number; status: DbTableStatus; pos_x: number | null; pos_y: number | null; created_at: string }
        Insert: { id: string; label: string; section: string; capacity: number; status: DbTableStatus; pos_x?: number | null; pos_y?: number | null; created_at?: string }
        Update: { label?: string; section?: string; capacity?: number; status?: DbTableStatus; pos_x?: number | null; pos_y?: number | null }
        Relationships: []
      }
      menu_items: {
        Row: { id: string; name: string; category: string; category2: string; category3: string; price: number; cost: number | null; description: string | null; modifiers: string[]; is_available: boolean; sort_order: number; created_at: string; updated_at: string | null }
        Insert: { id?: string; name: string; category: string; category2: string; category3: string; price: number; cost?: number | null; description?: string | null; modifiers?: string[]; is_available?: boolean; sort_order?: number; created_at?: string; updated_at?: string | null }
        Update: { name?: string; category?: string; category2?: string; category3?: string; price?: number; cost?: number | null; description?: string | null; modifiers?: string[]; is_available?: boolean; sort_order?: number; updated_at?: string | null }
        Relationships: []
      }
      orders: {
        Row: { id: number; table_id: string; opened_by: string | null; opened_at: string; closed_at: string | null; status: OrderStatus; notes: string | null }
        Insert: { table_id: string; opened_by?: string | null; opened_at?: string; closed_at?: string | null; status?: OrderStatus; notes?: string | null }
        Update: { table_id?: string; opened_by?: string | null; opened_at?: string; closed_at?: string | null; status?: OrderStatus; notes?: string | null }
        Relationships: []
        // opened_by is uuid FK → public.users(id) ON DELETE SET NULL
      }
      payments: {
        Row: { id: number; order_id: number; method: PayMethod; amount: number; tendered: number | null; change_due: number | null; processed_by: string | null; processed_at: string; notes: string | null }
        Insert: { order_id: number; method: PayMethod; amount: number; tendered?: number | null; change_due?: number | null; processed_by?: string | null; processed_at?: string; notes?: string | null }
        Update: { order_id?: number; method?: PayMethod; amount?: number; tendered?: number | null; change_due?: number | null; processed_by?: string | null; processed_at?: string; notes?: string | null }
        Relationships: []
      }
      order_items: {
        Row: { id: number; order_id: number; menu_item_id: string; qty: number; unit_price: number; modifiers: string[]; notes: string | null; status: ItemStatus; payment_id: number | null; seat: number | null; fired_at: string | null; completed_at: string | null; voided_by: string | null; void_reason: string | null }
        Insert: { order_id: number; menu_item_id: string; qty: number; unit_price: number; modifiers?: string[]; notes?: string | null; status?: ItemStatus; payment_id?: number | null; seat?: number | null; fired_at?: string | null; completed_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Update: { order_id?: number; menu_item_id?: string; qty?: number; unit_price?: number; modifiers?: string[]; notes?: string | null; status?: ItemStatus; payment_id?: number | null; seat?: number | null; fired_at?: string | null; completed_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Relationships: []
      }
      inventory: {
        Row: { id: number; menu_item_id: string; quantity: number; unit: string; low_stock_threshold: number; updated_at: string }
        Insert: { menu_item_id: string; quantity: number; unit: string; low_stock_threshold?: number; updated_at?: string }
        Update: { menu_item_id?: string; quantity?: number; unit?: string; low_stock_threshold?: number; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      deduct_inventory:    { Args: { p_menu_item_id: string; p_qty: number }; Returns: void }
      restore_inventory:   { Args: { p_menu_item_id: string; p_qty: number }; Returns: void }
      verify_staff_login:  { Args: { p_name: string; p_password: string }; Returns: { id: string; name: string; role: string }[] }
    }
    Enums: Record<never, never>
  }
}
