// ============================================
// ChefOs - In-Memory Stores (Stub/Demo mode)
// ============================================
// Offline-friendly stub: if no Supabase, use in-memory store

import { 
  Event, 
  Forecast, 
  Product, 
  Recipe, 
  InventoryLot, 
  Task, 
  ShiftAssignment,
  Employee,
  Alert,
  PurchaseOrder
} from "./types";
import { addDays, format, subDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";

// ============================================
// Generate IDs
// ============================================
export const generateId = () => Math.random().toString(36).substr(2, 9);
export const generateHash = (content: string) => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

// ============================================
// Mock Data Generators
// ============================================
const today = new Date();
const ORG_ID = "org_demo";

// Events
const mockEvents: Event[] = [
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 1), "yyyy-MM-dd"), hall: "ROSALIA", name: "Boda García-López", event_type: "boda", attendees: 150, menu_name: "Menú Premium", created_at: new Date().toISOString() },
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 1), "yyyy-MM-dd"), hall: "PONDAL", name: "Conferencia Tech", event_type: "conferencia", attendees: 80, created_at: new Date().toISOString() },
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 2), "yyyy-MM-dd"), hall: "CASTELAO", name: "Banquete Empresa XYZ", event_type: "banquete", attendees: 200, menu_name: "Menú Gala", created_at: new Date().toISOString() },
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 3), "yyyy-MM-dd"), hall: "CURROS", name: "Reunión Directiva", event_type: "reunion", attendees: 25, created_at: new Date().toISOString() },
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 5), "yyyy-MM-dd"), hall: "ROSALIA", name: "Cena de Gala", event_type: "banquete", attendees: 180, menu_name: "Menú Degustación", created_at: new Date().toISOString() },
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 7), "yyyy-MM-dd"), hall: "CUNQUEIRO", name: "Boda Martínez", event_type: "boda", attendees: 120, created_at: new Date().toISOString() },
  { id: generateId(), org_id: ORG_ID, event_date: format(addDays(today, 10), "yyyy-MM-dd"), hall: "RESTAURANTE", name: "Cena Privada VIP", event_type: "otro", attendees: 12, created_at: new Date().toISOString() },
];

// Forecasts
const mockForecasts: Forecast[] = Array.from({ length: 14 }, (_, i) => {
  const date = addDays(subDays(today, 3), i);
  const guests = Math.floor(Math.random() * 50) + 80;
  const breakfasts = Math.floor(guests * (0.85 + Math.random() * 0.1));
  const isPast = date < today;
  const actual = isPast ? breakfasts + Math.floor(Math.random() * 10) - 5 : undefined;
  return {
    id: generateId(),
    org_id: ORG_ID,
    forecast_date: format(date, "yyyy-MM-dd"),
    guests,
    breakfasts,
    actual_breakfasts: actual,
    delta: actual ? actual - breakfasts : undefined,
    created_at: new Date().toISOString(),
  };
});

// Products
const mockProducts: Product[] = [
  { id: generateId(), name: "Aceite de Oliva Virgen Extra", unit: "L", price: 8.50, supplier: "Oleicola Sur", category: "Aceites", min_stock: 10, created_at: new Date().toISOString() },
  { id: generateId(), name: "Harina 00", unit: "kg", price: 1.20, supplier: "Harineras Norte", category: "Harinas", min_stock: 25, created_at: new Date().toISOString() },
  { id: generateId(), name: "Tomates Cherry", unit: "kg", price: 4.50, supplier: "Huerta Fresca", category: "Vegetales", min_stock: 5, created_at: new Date().toISOString() },
  { id: generateId(), name: "Queso Parmesano DOP", unit: "kg", price: 22.00, supplier: "Lácteos Italia", category: "Lácteos", min_stock: 3, created_at: new Date().toISOString() },
  { id: generateId(), name: "Salmón Fresco", unit: "kg", price: 18.50, supplier: "Pescados Atlántico", category: "Pescados", min_stock: 5, created_at: new Date().toISOString() },
  { id: generateId(), name: "Arroz Arborio", unit: "kg", price: 3.80, supplier: "Arrocerías Levante", category: "Granos", min_stock: 15, created_at: new Date().toISOString() },
  { id: generateId(), name: "Mantequilla", unit: "kg", price: 9.20, supplier: "Lácteos Norte", category: "Lácteos", min_stock: 8, created_at: new Date().toISOString() },
  { id: generateId(), name: "Huevos Camperos", unit: "docena", price: 3.50, supplier: "Granja Eco", category: "Huevos", min_stock: 20, created_at: new Date().toISOString() },
];

// Inventory Lots
const mockLots: InventoryLot[] = [
  { id: generateId(), product_id: mockProducts[0].id, product_name: "Aceite de Oliva Virgen Extra", quantity: 15, unit: "L", expires_at: format(addDays(today, 180), "yyyy-MM-dd"), received_at: format(subDays(today, 10), "yyyy-MM-dd"), location: "Almacén A1" },
  { id: generateId(), product_id: mockProducts[2].id, product_name: "Tomates Cherry", quantity: 8, unit: "kg", expires_at: format(addDays(today, 3), "yyyy-MM-dd"), received_at: format(subDays(today, 2), "yyyy-MM-dd"), location: "Cámara Fría 1" },
  { id: generateId(), product_id: mockProducts[3].id, product_name: "Queso Parmesano DOP", quantity: 2.5, unit: "kg", expires_at: format(addDays(today, 5), "yyyy-MM-dd"), received_at: format(subDays(today, 30), "yyyy-MM-dd"), location: "Cámara Fría 2" },
  { id: generateId(), product_id: mockProducts[4].id, product_name: "Salmón Fresco", quantity: 4, unit: "kg", expires_at: format(addDays(today, 2), "yyyy-MM-dd"), received_at: format(today, "yyyy-MM-dd"), location: "Cámara Fría 1" },
  { id: generateId(), product_id: mockProducts[5].id, product_name: "Arroz Arborio", quantity: 20, unit: "kg", expires_at: format(addDays(today, 365), "yyyy-MM-dd"), received_at: format(subDays(today, 15), "yyyy-MM-dd"), location: "Almacén A2" },
  { id: generateId(), product_id: mockProducts[7].id, product_name: "Huevos Camperos", quantity: 5, unit: "docena", expires_at: format(addDays(today, 7), "yyyy-MM-dd"), received_at: format(subDays(today, 7), "yyyy-MM-dd"), location: "Cámara Fría 1" },
];

// Tasks
const mockTasks: Task[] = [
  { id: generateId(), title: "Preparar mise en place desayunos", due_date: format(today, "yyyy-MM-dd"), shift: "M", status: "completed", servings: 95, priority: "high", created_at: new Date().toISOString(), completed_at: new Date().toISOString() },
  { id: generateId(), title: "Preparar salsas base", due_date: format(today, "yyyy-MM-dd"), shift: "M", status: "in_progress", priority: "medium", created_at: new Date().toISOString(), started_at: new Date().toISOString() },
  { id: generateId(), title: "Producción pan del día", due_date: format(today, "yyyy-MM-dd"), shift: "M", status: "pending", servings: 200, priority: "high", created_at: new Date().toISOString() },
  { id: generateId(), title: "Prep Boda García-López (150 pax)", due_date: format(addDays(today, 1), "yyyy-MM-dd"), shift: "M", status: "pending", hall: "ROSALIA", servings: 150, priority: "high", created_at: new Date().toISOString() },
  { id: generateId(), title: "Mise en place Conferencia Tech", due_date: format(addDays(today, 1), "yyyy-MM-dd"), shift: "T", status: "pending", hall: "PONDAL", servings: 80, priority: "medium", created_at: new Date().toISOString() },
  { id: generateId(), title: "Inventario semanal cámaras", due_date: format(addDays(today, 2), "yyyy-MM-dd"), shift: "M", status: "pending", priority: "medium", created_at: new Date().toISOString() },
];

// Employees
const mockEmployees: Employee[] = [
  { id: generateId(), name: "Carlos Rodríguez", role: "Chef Ejecutivo", department: "Cocina", email: "carlos@hotel.com", phone: "+34 600 111 222" },
  { id: generateId(), name: "María González", role: "Sous Chef", department: "Cocina", email: "maria@hotel.com", phone: "+34 600 111 223" },
  { id: generateId(), name: "Juan Pérez", role: "Cocinero", department: "Cocina", email: "juan@hotel.com", phone: "+34 600 111 224" },
  { id: generateId(), name: "Ana López", role: "Cocinera", department: "Cocina", email: "ana@hotel.com", phone: "+34 600 111 225" },
  { id: generateId(), name: "Pedro Martínez", role: "Ayudante Cocina", department: "Cocina", email: "pedro@hotel.com", phone: "+34 600 111 226" },
  { id: generateId(), name: "Laura Sánchez", role: "Pastelera", department: "Pastelería", email: "laura@hotel.com", phone: "+34 600 111 227" },
];

// ============================================
// Stores (State Management)
// ============================================
class Store<T> {
  private items: T[] = [];
  
  constructor(initialData: T[] = []) {
    this.items = [...initialData];
  }
  
  getAll(): T[] {
    return [...this.items];
  }
  
  getById(id: string, idKey: keyof T = "id" as keyof T): T | undefined {
    return this.items.find(item => item[idKey] === id);
  }
  
  add(item: T): void {
    this.items.push(item);
  }
  
  addMany(items: T[]): void {
    this.items.push(...items);
  }
  
  update(id: string, updates: Partial<T>, idKey: keyof T = "id" as keyof T): void {
    const index = this.items.findIndex(item => item[idKey] === id);
    if (index !== -1) {
      this.items[index] = { ...this.items[index], ...updates };
    }
  }
  
  delete(id: string, idKey: keyof T = "id" as keyof T): void {
    this.items = this.items.filter(item => item[idKey] !== id);
  }
  
  reset(data: T[] = []): void {
    this.items = [...data];
  }
  
  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }
}

// Initialize stores with mock data
export const eventsStore = new Store<Event>(mockEvents);
export const forecastsStore = new Store<Forecast>(mockForecasts);
export const productsStore = new Store<Product>(mockProducts);
export const lotsStore = new Store<InventoryLot>(mockLots);
export const tasksStore = new Store<Task>(mockTasks);
export const employeesStore = new Store<Employee>(mockEmployees);

// ============================================
// Helper Functions
// ============================================
export function getUpcomingEvents(days: number = 7): Event[] {
  const now = new Date();
  const futureDate = addDays(now, days);
  
  return eventsStore.filter(event => {
    const eventDate = parseISO(event.event_date);
    return eventDate >= now && eventDate <= futureDate;
  }).sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export function getExpiringLots(days: number = 7): InventoryLot[] {
  const now = new Date();
  const futureDate = addDays(now, days);
  
  return lotsStore.filter(lot => {
    const expiryDate = parseISO(lot.expires_at);
    return expiryDate <= futureDate && expiryDate >= now;
  }).sort((a, b) => a.expires_at.localeCompare(b.expires_at));
}

export function getWeekForecasts(): Forecast[] {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  return forecastsStore.filter(forecast => {
    const date = parseISO(forecast.forecast_date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  }).sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));
}

export function getUpcomingForecasts(days: number = 7): Forecast[] {
  const now = new Date();
  const futureDate = addDays(now, days);
  
  return forecastsStore.filter(forecast => {
    const date = parseISO(forecast.forecast_date);
    return date >= now && date <= futureDate;
  }).sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));
}

export function getPendingTasks(): Task[] {
  return tasksStore.filter(task => task.status !== "completed")
    .sort((a, b) => {
      // Sort by priority first, then by date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority || "medium"];
      const bPriority = priorityOrder[b.priority || "medium"];
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.due_date.localeCompare(b.due_date);
    });
}

export function getAlerts(): Alert[] {
  const alerts: Alert[] = [];
  
  // Expiring lots
  const expiringLots = getExpiringLots(7);
  expiringLots.forEach(lot => {
    const daysUntil = Math.ceil((parseISO(lot.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    alerts.push({
      id: `expiry-${lot.id}`,
      type: "expiry",
      severity: daysUntil <= 2 ? "critical" : "warning",
      message: `${lot.product_name}: caduca en ${daysUntil} días (${lot.quantity} ${lot.unit})`,
      date: lot.expires_at,
    });
  });
  
  // Overdue tasks
  const overdueTasks = tasksStore.filter(task => 
    task.status !== "completed" && parseISO(task.due_date) < new Date()
  );
  overdueTasks.forEach(task => {
    alerts.push({
      id: `task-${task.id}`,
      type: "task",
      severity: "critical",
      message: `Tarea atrasada: ${task.title}`,
      date: task.due_date,
    });
  });
  
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
