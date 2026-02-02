import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Clock, Phone, Mail, UserPlus, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaff, useCreateStaff, Staff as StaffType } from "@/hooks/useStaff";
import { useHotel } from "@/hooks/useHotel";
import { useRequireHotel } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const roleConfig: Record<string, { label: string; color: string }> = {
  chef: { label: "Chef Ejecutivo", color: "bg-primary/10 text-primary" },
  sous_chef: { label: "Sous Chef", color: "bg-accent/10 text-accent" },
  cocinero: { label: "Cocinero", color: "bg-info/10 text-info" },
  ayudante: { label: "Ayudante", color: "bg-muted text-muted-foreground" },
  camarero: { label: "Camarero", color: "bg-success/10 text-success" },
  bartender: { label: "Bartender", color: "bg-warning/10 text-warning" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-success text-success-foreground" },
  inactive: { label: "Inactivo", color: "bg-muted text-muted-foreground" },
  vacation: { label: "Vacaciones", color: "bg-warning text-warning-foreground" },
};

const inviteRoles = [
  { value: "admin", label: "Administrador" },
  { value: "jefe_cocina", label: "Jefe de Cocina" },
  { value: "maitre", label: "Maître" },
  { value: "produccion", label: "Producción" },
  { value: "rrhh", label: "RRHH" },
] as const;

type InviteRole = (typeof inviteRoles)[number]["value"];

const Staff = () => {
  const { hasHotel, error: hotelError } = useRequireHotel();
  const { data: staffList = [], isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const { sendInvitation, currentHotel } = useHotel();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ficha" | "invitar">("ficha");
  
  // Ficha form
  const [fichaName, setFichaName] = useState("");
  const [fichaEmail, setFichaEmail] = useState("");
  const [fichaPhone, setFichaPhone] = useState("");
  const [fichaRole, setFichaRole] = useState("cocinero");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("produccion");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const activeCount = staffList.filter(s => s.status === "active").length;

  const handleCreateFicha = async () => {
    if (!fichaName.trim()) return;
    
    await createStaff.mutateAsync({
      full_name: fichaName.trim(),
      email: fichaEmail || null,
      phone: fichaPhone || null,
      role: fichaRole,
      status: "active",
    });

    setFichaName("");
    setFichaEmail("");
    setFichaPhone("");
    setFichaRole("cocinero");
    setIsDialogOpen(false);
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !currentHotel) return;
    
    setIsSendingInvite(true);
    try {
      // Create invitation in DB
      const invitation = await sendInvitation.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      // Send email via edge function
      const { error } = await supabase.functions.invoke("send-invitation-email", {
        body: {
          email: inviteEmail.trim(),
          hotelName: currentHotel.name,
        role: inviteRole,
          token: invitation.token,
        },
      });

      if (error) {
        console.error("Error sending email:", error);
        toast.warning("Invitación creada pero no se pudo enviar el email");
      } else {
        toast.success("Invitación enviada correctamente");
      }

      setInviteEmail("");
      setInviteRole("produccion");
      setIsDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al enviar la invitaciÃ³n";
      toast.error(message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (!hasHotel) {
    return (
      <MainLayout title="Personal" subtitle="Gestión del equipo de trabajo">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Sin hotel seleccionado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {hotelError || "Debes crear o seleccionar un hotel para gestionar el personal"}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Personal" 
      subtitle="Gestión del equipo de trabajo"
    >
      {/* Summary */}
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="gap-2 px-4 py-2 text-base">
          <span className="h-2 w-2 rounded-full bg-success" />
          {activeCount} activos ahora
        </Badge>
        <Badge variant="outline" className="gap-2 px-4 py-2 text-base">
          {staffList.length} empleados en total
        </Badge>
      </div>

      {/* Header */}
      <div className="mt-6 flex items-center justify-end">
        <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar Personal
        </Button>
      </div>

      {/* Staff Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 mt-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="mt-6 flex h-[40vh] items-center justify-center rounded-2xl border border-dashed border-border">
          <div className="text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Sin personal registrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Añade empleados para gestionar turnos, tareas y horarios
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Personal
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {staffList.map((member, index) => {
            const role = roleConfig[member.role] || { label: member.role, color: "bg-muted text-muted-foreground" };
            const status = statusConfig[member.status] || statusConfig.active;
            
            return (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-lg animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Status indicator */}
                <div className="absolute right-4 top-4">
                  <Badge className={cn("gap-1.5", status.color)}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      member.status === "active" && "bg-success-foreground animate-pulse"
                    )} />
                    {status.label}
                  </Badge>
                </div>

                {/* Avatar & Info */}
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20 border-4 border-primary/10">
                    <AvatarFallback className="bg-primary/10 font-display text-xl text-primary">
                      {member.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                    {member.full_name}
                  </h3>
                  
                  <Badge variant="secondary" className={cn("mt-2", role.color)}>
                    {role.label}
                  </Badge>
                </div>

                {/* Contact Info */}
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.user_id && (
                    <Badge variant="outline" className="text-xs">
                      Cuenta vinculada
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Personal</DialogTitle>
            <DialogDescription>
              Crea una ficha de empleado o invita a alguien con cuenta
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ficha" | "invitar")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ficha">Ficha interna</TabsTrigger>
              <TabsTrigger value="invitar">Invitar usuario</TabsTrigger>
            </TabsList>

            <TabsContent value="ficha" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="ficha-name">Nombre completo *</Label>
                <Input
                  id="ficha-name"
                  placeholder="Ej: Carlos Rodríguez"
                  value={fichaName}
                  onChange={(e) => setFichaName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ficha-email">Email</Label>
                  <Input
                    id="ficha-email"
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={fichaEmail}
                    onChange={(e) => setFichaEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ficha-phone">Teléfono</Label>
                  <Input
                    id="ficha-phone"
                    placeholder="+34 612 345 678"
                    value={fichaPhone}
                    onChange={(e) => setFichaPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ficha-role">Rol</Label>
                <Select value={fichaRole} onValueChange={setFichaRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateFicha}
                  disabled={!fichaName.trim() || createStaff.isPending}
                >
                  {createStaff.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Ficha
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="invitar" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Envía una invitación por email para que pueda iniciar sesión y acceder al sistema.
              </p>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rol</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSendInvitation}
                  disabled={!inviteEmail.trim() || isSendingInvite}
                >
                  {isSendingInvite ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Enviar Invitación
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Staff;
