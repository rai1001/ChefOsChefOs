import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MenuOCRImport } from "@/components/import/MenuOCRImport";
import { GeneratePurchaseOrderDialog } from "@/components/menus/GeneratePurchaseOrderDialog";
import { CreateRecipeDialog } from "@/components/menus/CreateRecipeDialog";
import { RecipeCard } from "@/components/menus/RecipeCard";
import { RecipeDetailDialog } from "@/components/menus/RecipeDetailDialog";
import { ProductionSheetDialog } from "@/components/menus/ProductionSheetDialog";
import { MenuVersionHistoryDialog } from "@/components/menus/MenuVersionHistoryDialog";
import { ApprovalInbox } from "@/components/approvals/ApprovalInbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed, Coffee, Utensils, Moon, Sun } from "lucide-react";
import { useMenusWithItems, MenuWithItems } from "@/hooks/useMenus";

interface MenuSection {
  name: string;
  items: Array<{
    name: string;
    description?: string;
    highlighted?: boolean;
  }>;
}

interface ParsedMenu {
  mealType: string;
  serviceFormat?: string;
  sections: MenuSection[];
  observations?: string;
}

const Menus = () => {
  const [importedMenus, setImportedMenus] = useState<ParsedMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuWithItems | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sheetMenu, setSheetMenu] = useState<MenuWithItems | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [versionMenu, setVersionMenu] = useState<MenuWithItems | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);

  const { data: savedMenus = [], isLoading } = useMenusWithItems();

  const handleMenuImport = (menuData: ParsedMenu) => {
    setImportedMenus((prev) => [...prev, menuData]);
    console.log("Imported menu:", menuData);
  };

  const handleOpenDetail = (menu: MenuWithItems) => {
    setSelectedMenu(menu);
    setDetailOpen(true);
  };

  const handleGenerateSheet = (menu: MenuWithItems) => {
    setSheetMenu(menu);
    setSheetOpen(true);
    setDetailOpen(false);
  };

  const handleOpenVersions = (menu: MenuWithItems) => {
    setVersionMenu(menu);
    setVersionOpen(true);
  };

  const getMealIcon = (type: string) => {
    switch (type) {
      case "breakfast":
        return <Sun className="h-5 w-5" />;
      case "lunch":
        return <Utensils className="h-5 w-5" />;
      case "dinner":
        return <Moon className="h-5 w-5" />;
      case "snack":
        return <Coffee className="h-5 w-5" />;
      default:
        return <UtensilsCrossed className="h-5 w-5" />;
    }
  };

  const getMealLabel = (type: string) => {
    const labels: Record<string, string> = {
      breakfast: "Desayuno",
      lunch: "Comida",
      dinner: "Cena",
      snack: "Merienda",
    };
    return labels[type] || type;
  };

  const hasContent = savedMenus.length > 0 || importedMenus.length > 0;

  return (
    <MainLayout
      title="Menús y Escandallos"
      subtitle="Recetas con costes e ingredientes"
    >
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Recetas detalladas</Badge>
          <Badge variant="secondary">Coste por porción</Badge>
          <Badge variant="secondary">Escandallo</Badge>
        </div>
        <div className="flex items-center gap-2">
          <MenuOCRImport onImport={handleMenuImport} />
          <CreateRecipeDialog />
        </div>
      </div>

      <div className="mb-6">
        <ApprovalInbox entity="menu" />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {/* Saved Menus from DB */}
      {!isLoading && savedMenus.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold mb-4">
            Recetas guardadas ({savedMenus.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedMenus.map((menu) => (
              <RecipeCard
                key={menu.id}
                menu={menu}
                onClick={() => handleOpenDetail(menu)}
                onHistory={() => handleOpenVersions(menu)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Imported Menus Grid (OCR) */}
      {importedMenus.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold mb-4">
            Menús importados (OCR)
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {importedMenus.map((menu, idx) => (
              <div
                key={idx}
                className="rounded-xl border bg-card p-4 animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary">
                    {getMealIcon(menu.mealType)}
                    <span className="font-display font-semibold">
                      {getMealLabel(menu.mealType)}
                    </span>
                  </div>
                  {menu.serviceFormat && (
                    <Badge variant="outline" className="text-xs">
                      {menu.serviceFormat}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {menu.sections.reduce((acc, s) => acc + s.items.length, 0)} elementos
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                  {menu.sections.map((section, sIdx) => (
                    <div key={sIdx}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {section.name}
                      </h4>
                      <ul className="text-sm">
                        {section.items.slice(0, 3).map((item, iIdx) => (
                          <li
                            key={iIdx}
                            className={item.highlighted ? "text-warning font-medium" : ""}
                          >
                            {item.name}
                          </li>
                        ))}
                        {section.items.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{section.items.length - 3} más...
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
                {menu.observations && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    {menu.observations}
                  </p>
                )}
                <div className="mt-3 pt-3 border-t">
                  <GeneratePurchaseOrderDialog menu={menu} menuIndex={idx} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasContent && (
        <div className="flex h-[50vh] items-center justify-center rounded-2xl border border-dashed border-border">
          <div className="text-center">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">
              Menús y Escandallos
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Define recetas con costes por porción, ingredientes vinculados a
              productos, y genera hojas de producción escaladas.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Usa <strong>OCR</strong> para escanear menús impresos con IA
            </p>
            <div className="flex justify-center gap-2">
              <MenuOCRImport onImport={handleMenuImport} />
              <CreateRecipeDialog />
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedMenu && (
        <RecipeDetailDialog
          menu={selectedMenu}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onGenerateSheet={handleGenerateSheet}
        />
      )}

      {/* Production Sheet Dialog */}
      <ProductionSheetDialog
        menu={sheetMenu}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <MenuVersionHistoryDialog
        open={versionOpen}
        onOpenChange={setVersionOpen}
        menuId={versionMenu?.id ?? null}
        menuName={versionMenu?.name}
      />
    </MainLayout>
  );
};

export default Menus;
