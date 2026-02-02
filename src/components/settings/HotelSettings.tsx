import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHotel } from "@/hooks/useHotel";
import { Loader2, Building2, Save } from "lucide-react";

export function HotelSettings() {
  const { currentHotel, updateHotel, isLoading } = useHotel();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
  });

  useEffect(() => {
    if (currentHotel) {
      setFormData({
        name: currentHotel.name || "",
        address: currentHotel.address || "",
        phone: currentHotel.phone || "",
        email: currentHotel.email || "",
        website: currentHotel.website || "",
      });
    }
  }, [currentHotel]);

  const handleSave = async () => {
    await updateHotel.mutateAsync(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentHotel) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">
          Sin hotel asignado
        </h3>
        <p className="text-sm text-muted-foreground">
          No perteneces a ningún hotel. Contacta a un administrador para recibir una invitación.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Información del Hotel
          </h2>
          <p className="text-sm text-muted-foreground">
            Datos básicos de tu establecimiento
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Hotel</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Hotel Gran Vía"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+34 91 123 4567"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Calle Gran Vía 123, Madrid"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="contacto@hotel.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Sitio Web</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="www.hotel.com"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={updateHotel.isPending}
          className="gap-2"
        >
          {updateHotel.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
