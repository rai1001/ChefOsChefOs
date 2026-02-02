import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Users, Mail, Trash2, Send, Loader2, Shield, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const SuperAdmin = () => {
  const { roles, loading: authLoading } = useAuth();
  const {
    isSuperAdmin,
    allHotels,
    allMembers,
    allInvitations,
    isLoading,
    createHotel,
    deleteHotel,
    inviteOwner,
    cancelInvitation,
  } = useSuperAdmin();

  const [newHotelOpen, setNewHotelOpen] = useState(false);
  const [inviteOwnerOpen, setInviteOwnerOpen] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  
  const [hotelForm, setHotelForm] = useState({
    name: '',
    slug: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });
  
  const [ownerEmail, setOwnerEmail] = useState('');

  // Wait for auth to load
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect if not super admin
  if (!roles.includes('super_admin')) {
    return <Navigate to="/" replace />;
  }

  const handleCreateHotel = async () => {
    if (!hotelForm.name || !hotelForm.slug) return;
    
    await createHotel.mutateAsync(hotelForm);
    setHotelForm({ name: '', slug: '', address: '', phone: '', email: '', website: '' });
    setNewHotelOpen(false);
  };

  const handleInviteOwner = async () => {
    if (!selectedHotelId || !ownerEmail) return;
    
    await inviteOwner.mutateAsync({ hotelId: selectedHotelId, email: ownerEmail });
    setOwnerEmail('');
    setInviteOwnerOpen(false);
    setSelectedHotelId(null);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const getHotelMembers = (hotelId: string) => {
    return allMembers?.filter(m => m.hotel_id === hotelId) || [];
  };

  const getHotelInvitations = (hotelId: string) => {
    return allInvitations?.filter(i => i.hotel_id === hotelId) || [];
  };

  return (
    <MainLayout 
      title="Panel Super Admin" 
      subtitle="Gestión de hoteles y propietarios"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hoteles</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allHotels?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allMembers?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invitaciones Pendientes</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allInvitations?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="hotels" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="hotels" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Hoteles
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Invitaciones
              </TabsTrigger>
            </TabsList>
            
            <Dialog open={newHotelOpen} onOpenChange={setNewHotelOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Hotel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Hotel</DialogTitle>
                  <DialogDescription>
                    Crea un nuevo hotel en el sistema. Después podrás invitar al propietario.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Hotel *</Label>
                    <Input
                      id="name"
                      value={hotelForm.name}
                      onChange={(e) => {
                        setHotelForm({
                          ...hotelForm,
                          name: e.target.value,
                          slug: generateSlug(e.target.value),
                        });
                      }}
                      placeholder="Hotel Paradise"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL) *</Label>
                    <Input
                      id="slug"
                      value={hotelForm.slug}
                      onChange={(e) => setHotelForm({ ...hotelForm, slug: e.target.value })}
                      placeholder="hotel-paradise"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={hotelForm.address}
                      onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                      placeholder="Calle Principal 123"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        value={hotelForm.phone}
                        onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })}
                        placeholder="+34 600 000 000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hotel-email">Email</Label>
                      <Input
                        id="hotel-email"
                        type="email"
                        value={hotelForm.email}
                        onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })}
                        placeholder="info@hotel.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={hotelForm.website}
                      onChange={(e) => setHotelForm({ ...hotelForm, website: e.target.value })}
                      placeholder="https://hotel.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewHotelOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateHotel}
                    disabled={!hotelForm.name || !hotelForm.slug || createHotel.isPending}
                  >
                    {createHotel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear Hotel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="hotels" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : allHotels?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No hay hoteles</h3>
                  <p className="text-muted-foreground text-sm">
                    Crea el primer hotel para empezar
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {allHotels?.map((hotel) => {
                  const members = getHotelMembers(hotel.id);
                  const invitations = getHotelInvitations(hotel.id);
                  const owner = members.find(m => m.is_owner);
                  
                  return (
                    <Card key={hotel.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Building2 className="h-5 w-5" />
                              {hotel.name}
                              {hotel.is_active ? (
                                <Badge variant="default" className="ml-2">Activo</Badge>
                              ) : (
                                <Badge variant="secondary" className="ml-2">Inactivo</Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              /{hotel.slug} • {hotel.address || 'Sin dirección'}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={inviteOwnerOpen && selectedHotelId === hotel.id} onOpenChange={(open) => {
                              setInviteOwnerOpen(open);
                              if (!open) setSelectedHotelId(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedHotelId(hotel.id)}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Invitar Owner
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Invitar Propietario</DialogTitle>
                                  <DialogDescription>
                                    Envía una invitación para que el propietario se una a {hotel.name}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="owner-email">Email del propietario</Label>
                                    <Input
                                      id="owner-email"
                                      type="email"
                                      value={ownerEmail}
                                      onChange={(e) => setOwnerEmail(e.target.value)}
                                      placeholder="propietario@hotel.com"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => {
                                    setInviteOwnerOpen(false);
                                    setSelectedHotelId(null);
                                  }}>
                                    Cancelar
                                  </Button>
                                  <Button 
                                    onClick={handleInviteOwner}
                                    disabled={!ownerEmail || inviteOwner.isPending}
                                  >
                                    {inviteOwner.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Enviar Invitación
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => deleteHotel.mutate(hotel.id)}
                              disabled={deleteHotel.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Owner */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Propietario
                            </h4>
                            {owner ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="secondary">{owner.profile?.email}</Badge>
                                <span className="text-muted-foreground">
                                  {owner.profile?.full_name || 'Sin nombre'}
                                </span>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Sin propietario asignado</p>
                            )}
                          </div>

                          {/* Members */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Miembros ({members.length})
                            </h4>
                            {members.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {members.map((member) => (
                                  <Badge key={member.id} variant="outline">
                                    {member.profile?.email}
                                    {member.is_owner && ' (Owner)'}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Sin miembros</p>
                            )}
                          </div>

                          {/* Pending Invitations */}
                          {invitations.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Invitaciones Pendientes ({invitations.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {invitations.map((inv) => (
                                  <Badge key={inv.id} variant="outline" className="flex items-center gap-1">
                                    {inv.email} - {inv.role}
                                    <button
                                      onClick={() => cancelInvitation.mutate(inv.id)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Todas las Invitaciones Pendientes</CardTitle>
                <CardDescription>
                  Lista de todas las invitaciones que aún no han sido aceptadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allInvitations?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay invitaciones pendientes
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Hotel</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Expira</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allInvitations?.map((inv) => {
                        const hotel = allHotels?.find(h => h.id === inv.hotel_id);
                        return (
                          <TableRow key={inv.id}>
                            <TableCell>{inv.email}</TableCell>
                            <TableCell>{hotel?.name || 'Hotel desconocido'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{inv.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(inv.expires_at), "d MMM yyyy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelInvitation.mutate(inv.id)}
                                disabled={cancelInvitation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default SuperAdmin;
