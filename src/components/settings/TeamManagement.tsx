import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useHotel, Invitation } from "@/hooks/useHotel";
import { useAuth } from "@/hooks/useAuth";
import { 
  Plus, 
  Mail, 
  Clock, 
  Trash2, 
  UserPlus,
  Shield,
  ChefHat,
  Users,
  Loader2,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const roleConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "bg-destructive/10 text-destructive" },
  jefe_cocina: { label: "Jefe de Cocina", icon: ChefHat, color: "bg-primary/10 text-primary" },
  maitre: { label: "Maître", icon: Users, color: "bg-accent/10 text-accent" },
  produccion: { label: "Producción", icon: ChefHat, color: "bg-info/10 text-info" },
  rrhh: { label: "RRHH", icon: Users, color: "bg-warning/10 text-warning" },
};

export function TeamManagement() {
  const { user } = useAuth();
  const { 
    hotelMembers, 
    invitations, 
    isLoading, 
    sendInvitation, 
    cancelInvitation, 
    removeMember 
  } = useHotel();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Invitation['role']>("produccion");

  const handleSendInvitation = async () => {
    if (!inviteEmail) return;
    
    await sendInvitation.mutateAsync({ email: inviteEmail, role: inviteRole });
    setInviteEmail("");
    setInviteRole("produccion");
    setInviteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Equipo del Hotel
          </h2>
          <p className="text-sm text-muted-foreground">
            {hotelMembers?.length || 0} miembros • {invitations?.length || 0} invitaciones pendientes
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invitar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invitar nuevo usuario</DialogTitle>
              <DialogDescription>
                Envía una invitación por email para unirse al equipo del hotel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Invitation['role'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSendInvitation} 
                disabled={!inviteEmail || sendInvitation.isPending}
              >
                {sendInvitation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Invitación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Members */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="font-medium text-foreground mb-4">Miembros Activos</h3>
        <div className="space-y-3">
          {hotelMembers?.map((member, index) => {
            const memberRoles = member.roles || [];
            const isCurrentUser = member.user_id === user?.id;
            
            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-4 transition-all hover:shadow-sm animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.profile?.full_name?.split(" ").map(n => n[0]).join("") || 
                       member.profile?.email?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {member.profile?.full_name || member.profile?.email}
                      </p>
                      {member.is_owner && (
                        <Crown className="h-4 w-4 text-warning" />
                      )}
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">Tú</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {memberRoles.map(role => {
                        const config = roleConfig[role];
                        if (!config) return null;
                        return (
                          <Badge key={role} variant="secondary" className={cn("text-xs", config.color)}>
                            {config.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {!isCurrentUser && !member.is_owner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará a {member.profile?.full_name || member.profile?.email} del hotel. 
                          No podrá acceder a los datos hasta que sea invitado de nuevo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMember.mutate(member.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
          {(!hotelMembers || hotelMembers.length === 0) && (
            <p className="text-center text-muted-foreground py-8">
              No hay miembros en el equipo
            </p>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations && invitations.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Invitaciones Pendientes
          </h3>
          <div className="space-y-3">
            {invitations.map((invitation, index) => {
              const roleInfo = roleConfig[invitation.role];
              
              return (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                      <Mail className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{invitation.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={cn("text-xs", roleInfo?.color)}>
                          {roleInfo?.label || invitation.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Expira: {format(new Date(invitation.expires_at), "d MMM yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => cancelInvitation.mutate(invitation.id)}
                    disabled={cancelInvitation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
