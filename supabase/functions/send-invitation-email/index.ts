import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationEmailRequest {
  email: string;
  hotelName: string;
  role: string;
  token: string;
  inviterName?: string;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  jefe_cocina: "Jefe de Cocina",
  maitre: "Maître",
  produccion: "Producción",
  rrhh: "Recursos Humanos",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { email, hotelName, role, token, inviterName }: InvitationEmailRequest = await req.json();

    if (!email || !hotelName || !token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://id-preview--a58ca4e1-7f67-4e5c-8745-d134cc9f1214.lovable.app";
    const acceptUrl = `${appUrl}/accept-invitation?token=${token}`;
    const roleLabel = roleLabels[role] || role;

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a ChefOs</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:32px;text-align:center;">
              <div style="width:64px;height:64px;background-color:rgba(255,255,255,0.2);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:32px;">👨‍🍳</span>
              </div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">ChefOs</h1>
              <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Gestión de Cocina</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#18181b;">¡Te han invitado!</h2>
              <p style="margin:0 0 24px;color:#52525b;line-height:1.6;">
                ${inviterName ? `<strong>${inviterName}</strong> te ha invitado a` : "Has sido invitado a"} 
                unirte al equipo de <strong>${hotelName}</strong> como <strong>${roleLabel}</strong>.
              </p>
              
              <a href="${acceptUrl}" 
                 style="display:block;background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:600;text-align:center;font-size:16px;">
                Aceptar Invitación
              </a>
              
              <p style="margin:24px 0 0;color:#71717a;font-size:13px;text-align:center;">
                Este enlace expira en 7 días
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:24px;text-align:center;border-top:1px solid #f4f4f5;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">
                Si no esperabas esta invitación, puedes ignorar este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "ChefOs <onboarding@resend.dev>",
      to: [email],
      subject: `Invitación a ${hotelName} - ChefOs`,
      html: emailHtml,
    });

    console.log("Invitation email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
