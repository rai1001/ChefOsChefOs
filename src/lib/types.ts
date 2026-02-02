// ============================================
// ChefOs - Data Types
// ============================================

// Halls/Salones
export const HALLS = [
  "ROSALIA",
  "PONDAL", 
  "CASTELAO",
  "CURROS",
  "CUNQUEIRO",
  "HALL",
  "RESTAURANTE",
  "BAR"
] as const;

export type Hall = typeof HALLS[number];

// Shifts
export type ShiftType = "M" | "T" | "N"; // Mañana, Tarde, Noche

// Task Status
export type TaskStatus = "pending" | "in_progress" | "completed";

// Event Types
export type EventType = "banquete" | "conferencia" | "boda" | "reunion" | "catering" | "otro";

// ============================================
// Events
// ============================================
export interface Event {
  id: string;
  org_id: string;
  event_date: string; // ISO date
  hall: Hall;
  name: string;
  event_type?: EventType;
  attendees?: number;
  menu_name?: string;
  menu_id?: string;
  notes?: string;
  created_at: string;
}

export interface EventImport {
  org_id: string;
  import_date: string;
  hash: string;
  rows_imported: number;
}

// ============================================
// Forecasts (Previsión desayunos)
// ============================================
export interface Forecast {
  id: string;
  org_id: string;
  forecast_date: string; // ISO date
  guests: number;
  breakfasts: number;
  actual_breakfasts?: number;
  delta?: number;
  created_at: string;
}

export interface ForecastImport {
  org_id: string;
  import_date: string;
  hash: string;
}

// ============================================
// Products
// ============================================
export interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  supplier?: string;
  category?: string;
  min_stock?: number;
  created_at: string;
}

// ============================================
// Recipes / Escandallos
// ============================================
export interface RecipeItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface Recipe {
  id: string;
  name: string;
  category?: string;
  portions: number;
  items: RecipeItem[];
  total_cost: number;
  cost_per_portion: number;
  instructions?: string;
  created_at: string;
}

// ============================================
// Inventory
// ============================================
export interface InventoryLot {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit: string;
  expires_at: string;
  received_at: string;
  location?: string;
  batch_number?: string;
}

// ============================================
// Tasks / Production
// ============================================
export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  shift: ShiftType;
  status: TaskStatus;
  hall?: Hall;
  servings?: number;
  assigned_to?: string;
  priority?: "low" | "medium" | "high";
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// ============================================
// Shifts / Turnos
// ============================================
export interface ShiftAssignment {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  shift: ShiftType;
  department?: string;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

// ============================================
// Dashboard / KPIs
// ============================================
export interface DashboardKPIs {
  expiringLots: number;
  pendingTasks: number;
  upcomingEvents: number;
  weeklyBreakfasts: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  type: "expiry" | "task" | "import" | "stock" | "event";
  severity: "info" | "warning" | "critical";
  message: string;
  date: string;
  link?: string;
}

// ============================================
// Purchases
// ============================================
export interface PurchaseOrder {
  id: string;
  supplier?: string;
  status: "draft" | "pending" | "ordered" | "received";
  items: PurchaseItem[];
  total: number;
  created_at: string;
  expected_delivery?: string;
}

export interface PurchaseItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}
