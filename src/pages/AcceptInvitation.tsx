import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "jefe_cocina" | "maitre" | "produccion" | "rrhh" | "super_admin";

interface InvitationData {
  id: string;
  hotel_id: string;
  email: string;
  role: AppRole;
  expires_at: string;
  hotel?: { name: string };
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token de invitación no válido");
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [token]);

  async function fetchInvitation() {
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, hotels(name)")
        .eq("token", token)
        .is("accepted_at", null)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        setError("La invitación no existe, ya fue usada o ha expirado");
        setLoading(false);
        return;
      }

      setInvitation({
        ...data,
        hotel: data.hotels,
      });
      setEmail(data.email);

      // Check if user already exists
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user?.email === data.email) {
        setIsNewUser(false);
      }

      setLoading(false);
    } catch (err) {
      setError("Error al cargar la invitación");
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!invitation) return;
    setSubmitting(true);

    try {
      if (isNewUser) {
        // Create new user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (authError) throw authError;

        const userId = authData.user?.id;
        if (!userId) throw new Error("Error al crear usuario");

        // Add to hotel_members
        const { error: memberError } = await supabase
          .from("hotel_members")
          .insert({
            hotel_id: invitation.hotel_id,
            user_id: userId,
            is_owner: false,
          });

        if (memberError) throw memberError;

        // Add role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: invitation.role,
          });

        if (roleError) throw roleError;

        // Update profile with current_hotel_id
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ current_hotel_id: invitation.hotel_id })
          .eq("id", userId);

        if (profileError) console.error("Error updating profile:", profileError);

        // Mark invitation as accepted
        await supabase
          .from("invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invitation.id);

        toast.success("¡Cuenta creada! Revisa tu email para confirmar.");
        navigate("/auth");
      } else {
        // Existing user - just add to hotel
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        if (!userId) throw new Error("Debes iniciar sesión primero");

        // Add to hotel_members
        const { error: memberError } = await supabase
          .from("hotel_members")
          .insert({
            hotel_id: invitation.hotel_id,
            user_id: userId,
            is_owner: false,
          });

        if (memberError) throw memberError;

        // Add role if not exists
        await supabase
          .from("user_roles")
          .upsert({
            user_id: userId,
            role: invitation.role,
          }, { onConflict: 'user_id,role' });

        // Update current hotel
        await supabase
          .from("profiles")
          .update({ current_hotel_id: invitation.hotel_id })
          .eq("id", userId);

        // Mark invitation as accepted
        await supabase
          .from("invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invitation.id);

        toast.success("¡Te has unido al hotel!");
        navigate("/");
      }
    } catch (err) {
      toast.error(err.message || "Error al aceptar invitación");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle className="text-destructive">Invitación no válida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
            <ChefHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">
            Invitación a {invitation?.hotel?.name}
          </CardTitle>
          <CardDescription>
            Has sido invitado a unirte como <strong>{invitation?.role}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNewUser ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-success font-medium">
                Ya tienes una cuenta. Haz clic en aceptar para unirte al hotel.
              </p>
            </div>
          )}

          <Button 
            onClick={handleAccept} 
            disabled={submitting || (isNewUser && (!fullName || !password))}
            className="w-full"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aceptar Invitación
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
