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
  updated_at?: string
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
  // Joined:
  menu_items?: MenuItem
}

export interface InventoryRow {
  id: number
  menu_item_id: string
  quantity: number
  unit: string
  low_stock_threshold: number
  updated_at: string
  // Joined:
  menu_items?: MenuItem
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
  id: string              // '#' + order.id
  orderId: number
  tableId: string
  station: 'kitchen' | 'bar'
  server: string
  items: string[]         // item names
  elapsedSec: number      // computed live from opened_at
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
export interface Database {
  public: {
    Tables: {
      restaurant_tables: {
        Row: RestaurantTable
        Insert: Omit<RestaurantTable, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<RestaurantTable, 'id'>>
      }
      menu_items: {
        Row: MenuItem
        Insert: Omit<MenuItem, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<MenuItem, 'id'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'opened_at'> & { opened_at?: string }
        Update: Partial<Omit<Order, 'id'>>
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'processed_at'> & { processed_at?: string }
        Update: Partial<Omit<Payment, 'id'>>
      }
      order_items: {
        Row: OrderItem
        Insert: Omit<OrderItem, 'id'>
        Update: Partial<Omit<OrderItem, 'id'>>
      }
      inventory: {
        Row: InventoryRow
        Insert: Omit<InventoryRow, 'id' | 'updated_at'> & { updated_at?: string }
        Update: Partial<Omit<InventoryRow, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
