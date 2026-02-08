import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHotel } from "@/hooks/useHotel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ChevronDown, Check, Crown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function HotelSelector() {
  const { user, refreshUserData } = useAuth();
  const { currentHotel, userHotels, switchHotel } = useHotel();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [hotelName, setHotelName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const hasNoHotel = !userHotels || userHotels.length === 0;

  const handleCreateHotel = async () => {
    if (!hotelName.trim() || !user?.id) return;
    
    setIsCreating(true);
    try {
      // Create hotel
      const slug = hotelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { data: hotel, error: hotelError } = await supabase
        .from("hotels")
        .insert({
          name: hotelName.trim(),
          slug: `${slug}-${Date.now()}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (hotelError) throw hotelError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from("hotel_members")
        .insert({
          hotel_id: hotel.id,
          user_id: user.id,
          is_owner: true,
        });

      if (memberError) throw memberError;

      // Add admin role to user
      await supabase
        .from("user_roles")
        .upsert({
          user_id: user.id,
          role: "admin",
        }, { onConflict: "user_id,role" });

      // Set as current hotel
      await supabase
        .from("profiles")
        .update({ current_hotel_id: hotel.id })
        .eq("id", user.id);

      await refreshUserData();

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["user-hotels"] });
      queryClient.invalidateQueries({ queryKey: ["current-hotel"] });
      queryClient.invalidateQueries({ queryKey: ["hotel-members"] });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });

      toast.success("Hotel creado correctamente");
      setIsCreateOpen(false);
      setHotelName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al crear hotel: " + message);
    } finally {
      setIsCreating(false);
    }
  };

  // Show create button if no hotel
  if (hasNoHotel) {
    return (
      <>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Crear Hotel
        </Button>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear tu hotel</DialogTitle>
              <DialogDescription>
                Crea tu primer hotel para empezar a gestionar tu cocina
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="hotel-name">Nombre del hotel</Label>
                <Input
                  id="hotel-name"
                  placeholder="Ej: Hotel Gran Vía"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateHotel}
                disabled={!hotelName.trim() || isCreating}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Hotel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Show simple badge if only one hotel
  if (userHotels.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{currentHotel?.name || userHotels[0]?.name}</span>
      </div>
    );
  }

  // Show dropdown for multiple hotels
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="h-4 w-4" />
          {currentHotel?.name || "Seleccionar hotel"}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Tus hoteles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userHotels.map((hotel) => (
          <DropdownMenuItem
            key={hotel.id}
            onClick={() => switchHotel.mutate(hotel.id)}
            className={cn(
              "flex items-center justify-between cursor-pointer",
              currentHotel?.id === hotel.id && "bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{hotel.name}</span>
              {hotel.is_owner && <Crown className="h-3 w-3 text-warning" />}
            </div>
            {currentHotel?.id === hotel.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
