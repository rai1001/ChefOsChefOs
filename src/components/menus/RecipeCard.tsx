import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Euro, ChefHat } from "lucide-react";
import { MenuWithItems, useDuplicateMenu } from "@/hooks/useMenus";

interface Props {
  menu: MenuWithItems;
  onClick: () => void;
}

const typeLabels: Record<string, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  dinner: "Cena",
  snack: "Merienda",
  buffet: "Buffet",
  cocktail: "Cóctel",
};

export function RecipeCard({ menu, onClick }: Props) {
  const duplicateMenu = useDuplicateMenu();

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateMenu.mutate(menu.id);
  };

  const costPerPax = menu.cost_per_pax || 0;
  const ingredientCount = menu.menu_items.length;

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 animate-fade-in group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="font-display text-lg truncate">{menu.name}</CardTitle>
            {menu.description && (
              <CardDescription className="line-clamp-2 mt-1">
                {menu.description}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {menu.type && (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {typeLabels[menu.type] || menu.type}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <ChefHat className="h-4 w-4" />
              {ingredientCount} {ingredientCount === 1 ? "ingrediente" : "ingredientes"}
            </span>
            <span className="flex items-center gap-1 text-primary font-medium">
              <Euro className="h-4 w-4" />
              {costPerPax.toFixed(2)} €/pax
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDuplicate}
            disabled={duplicateMenu.isPending}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
