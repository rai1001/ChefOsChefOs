import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MenuItemCard } from "@/components/dashboard/MenuItemCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Grid3X3, List } from "lucide-react";

const menuItems = [
  {
    name: "Risotto de Hongos",
    description: "Arroz arborio cremoso con hongos porcini, trufa negra y parmesano reggiano",
    price: 285,
    category: "Pastas",
    prepTime: "25 min",
    isPopular: true,
  },
  {
    name: "Filete Mignon",
    description: "Corte premium de res, acompañado de puré de papa trufado y vegetales glaseados",
    price: 450,
    category: "Carnes",
    prepTime: "30 min",
    isPopular: true,
  },
  {
    name: "Tacos de Pescado",
    description: "Pescado fresco empanizado con coleslaw asiático y salsa de chipotle",
    price: 195,
    category: "Mariscos",
    prepTime: "15 min",
    isSpicy: true,
  },
  {
    name: "Ensalada César",
    description: "Lechuga romana, crutones artesanales, aderezo César casero y parmesano",
    price: 145,
    category: "Entradas",
    prepTime: "10 min",
  },
  {
    name: "Carpaccio de Res",
    description: "Finas láminas de res, alcaparras, arúgula y reducción de balsámico",
    price: 185,
    category: "Entradas",
    prepTime: "12 min",
  },
  {
    name: "Pasta Carbonara",
    description: "Spaghetti con pancetta curada, huevo, pecorino romano y pimienta negra",
    price: 225,
    category: "Pastas",
    prepTime: "18 min",
  },
  {
    name: "Paella Valenciana",
    description: "Arroz con azafrán, mariscos frescos, pollo y chorizo español",
    price: 395,
    category: "Especialidades",
    prepTime: "35 min",
    isPopular: true,
  },
  {
    name: "Pollo al Limón",
    description: "Pechuga de pollo marinada con hierbas mediterráneas y salsa de limón",
    price: 245,
    category: "Carnes",
    prepTime: "22 min",
  },
  {
    name: "Tiramisú",
    description: "Postre italiano clásico con mascarpone, café espresso y cacao",
    price: 125,
    category: "Postres",
    prepTime: "5 min",
    isPopular: true,
  },
  {
    name: "Crème Brûlée",
    description: "Crema de vainilla con costra de caramelo crujiente",
    price: 115,
    category: "Postres",
    prepTime: "5 min",
  },
  {
    name: "Sopa del Día",
    description: "Preparación diaria del chef con ingredientes de temporada",
    price: 95,
    category: "Entradas",
    prepTime: "8 min",
  },
  {
    name: "Lasagna Bolognesa",
    description: "Capas de pasta fresca, ragú de carne, bechamel y quesos gratinados",
    price: 265,
    category: "Pastas",
    prepTime: "20 min",
    isSpicy: true,
  },
];

const categories = ["Todos", "Entradas", "Pastas", "Carnes", "Mariscos", "Especialidades", "Postres"];

const Menu = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "Todos" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout 
      title="Menú" 
      subtitle="Gestiona los platillos del restaurante"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar platillos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Platillo
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item, index) => (
          <MenuItemCard
            key={item.name}
            {...item}
            delay={index * 50}
          />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="flex h-60 items-center justify-center rounded-2xl border border-dashed border-border">
          <p className="text-muted-foreground">
            No se encontraron platillos
          </p>
        </div>
      )}
    </MainLayout>
  );
};

export default Menu;
