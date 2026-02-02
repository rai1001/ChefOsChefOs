import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { OrderCard, OrderStatus } from "@/components/dashboard/OrderCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const allOrders = [
  {
    id: "1",
    orderNumber: "048",
    table: "Mesa 1",
    items: [
      { name: "Carpaccio de Res", quantity: 1 },
      { name: "Lasagna Bolognesa", quantity: 2 },
    ],
    status: "pending" as OrderStatus,
    time: "Hace 1 min",
  },
  {
    id: "2",
    orderNumber: "047",
    table: "Mesa 7",
    items: [
      { name: "Ensalada Mediterránea", quantity: 2 },
      { name: "Pollo al Limón", quantity: 1, notes: "Sin gluten" },
    ],
    status: "pending" as OrderStatus,
    time: "Hace 2 min",
  },
  {
    id: "3",
    orderNumber: "046",
    table: "Barra",
    items: [
      { name: "Tacos de Pescado", quantity: 3 },
    ],
    status: "preparing" as OrderStatus,
    time: "Hace 5 min",
  },
  {
    id: "4",
    orderNumber: "045",
    table: "Mesa 5",
    items: [
      { name: "Risotto de Hongos", quantity: 2 },
      { name: "Filete Mignon", quantity: 1, notes: "Término medio" },
    ],
    status: "preparing" as OrderStatus,
    time: "Hace 8 min",
  },
  {
    id: "5",
    orderNumber: "044",
    table: "Mesa 12",
    items: [
      { name: "Paella Valenciana", quantity: 1 },
    ],
    status: "ready" as OrderStatus,
    time: "Hace 12 min",
  },
  {
    id: "6",
    orderNumber: "043",
    table: "Mesa 3",
    items: [
      { name: "Sopa del Día", quantity: 3 },
      { name: "Pan Artesanal", quantity: 1 },
    ],
    status: "ready" as OrderStatus,
    time: "Hace 15 min",
  },
];

type FilterType = "all" | OrderStatus;

const Orders = () => {
  const [orders, setOrders] = useState(allOrders);
  const [filter, setFilter] = useState<FilterType>("all");

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  const filteredOrders = filter === "all" 
    ? orders.filter(o => o.status !== "completed")
    : orders.filter(o => o.status === filter);

  const counts = {
    pending: orders.filter(o => o.status === "pending").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    ready: orders.filter(o => o.status === "ready").length,
  };

  return (
    <MainLayout 
      title="Órdenes" 
      subtitle="Gestiona las órdenes en cocina"
    >
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Todas
            <Badge variant="secondary" className="ml-2 bg-background/20">
              {counts.pending + counts.preparing + counts.ready}
            </Badge>
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
            className={cn(filter === "pending" && "bg-warning hover:bg-warning/90")}
          >
            Pendientes
            <Badge variant="secondary" className="ml-2 bg-background/20">
              {counts.pending}
            </Badge>
          </Button>
          <Button
            variant={filter === "preparing" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("preparing")}
            className={cn(filter === "preparing" && "bg-info hover:bg-info/90")}
          >
            Preparando
            <Badge variant="secondary" className="ml-2 bg-background/20">
              {counts.preparing}
            </Badge>
          </Button>
          <Button
            variant={filter === "ready" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("ready")}
            className={cn(filter === "ready" && "bg-success hover:bg-success/90")}
          >
            Listos
            <Badge variant="secondary" className="ml-2 bg-background/20">
              {counts.ready}
            </Badge>
          </Button>
        </div>

        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Orden
        </Button>
      </div>

      {/* Orders Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredOrders.map((order, index) => (
          <OrderCard
            key={order.id}
            {...order}
            delay={index * 50}
            onStatusChange={(status) => handleStatusChange(order.id, status)}
          />
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="flex h-60 items-center justify-center rounded-2xl border border-dashed border-border">
          <p className="text-muted-foreground">
            No hay órdenes {filter !== "all" && `con estado "${filter}"`}
          </p>
        </div>
      )}
    </MainLayout>
  );
};

export default Orders;
