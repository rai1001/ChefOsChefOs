import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotelSettings } from "@/components/settings/HotelSettings";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { FeatureFlagsSettings } from "@/components/settings/FeatureFlagsSettings";
import { AlertSubscriptionsSettings } from "@/components/settings/AlertSubscriptionsSettings";
import { AgentConnectionsSettings } from "@/components/settings/AgentConnectionsSettings";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Users, Bell, Palette, Sparkles, Shield } from "lucide-react";

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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto gap-2 bg-transparent p-0">
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
            {isAdmin && (
              <TabsTrigger 
                value="features" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border"
              >
                <Sparkles className="h-4 w-4" />
                Features
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
            {isAdmin && (
              <TabsTrigger 
                value="agents" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border"
              >
                <Shield className="h-4 w-4" />
                Agentes
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="hotel" className="animate-fade-in">
            <HotelSettings />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team" className="animate-fade-in">
              <TeamManagement />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="features" className="animate-fade-in">
              <FeatureFlagsSettings />
            </TabsContent>
          )}

          <TabsContent value="notifications" className="animate-fade-in">
            <AlertSubscriptionsSettings />
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

          {isAdmin && (
            <TabsContent value="agents" className="animate-fade-in">
              <AgentConnectionsSettings />
            </TabsContent>
          )}
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
