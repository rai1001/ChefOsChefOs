import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotelSettings } from "@/components/settings/HotelSettings";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Users, Bell, Palette, Shield, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('jefe_cocina');

  return (
    <MainLayout 
      title="Ajustes" 
      subtitle="Configura tu sistema ChefOs"
    >
      <div className="mx-auto max-w-4xl">
        <Tabs defaultValue="hotel" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="hotel" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border"
            >
              <Building2 className="h-4 w-4" />
              Hotel
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger 
                value="team" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border"
              >
                <Users className="h-4 w-4" />
                Equipo
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="notifications" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border"
            >
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger 
              value="appearance" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border"
            >
              <Palette className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hotel" className="animate-fade-in">
            <HotelSettings />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team" className="animate-fade-in">
              <TeamManagement />
            </TabsContent>
          )}

          <TabsContent value="notifications" className="animate-fade-in">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                Notificaciones
              </h2>
              <p className="text-muted-foreground">
                Configuración de notificaciones próximamente...
              </p>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="animate-fade-in">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                Apariencia
              </h2>
              <p className="text-muted-foreground">
                Configuración de tema y apariencia próximamente...
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            ChefOs v1.0.0 • Sistema de Gestión de Cocina
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
