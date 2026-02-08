import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function composeAlertMessage(input: {
  hotelName: string;
  criticalStockCount: number;
  urgentPurchaseCount: number;
  overdueTaskCount: number;
  eventsWithoutMenuCount: number;
}): string {
  return [
    `Alertas operativas para ${input.hotelName}`,
    `- Stock crítico: ${input.criticalStockCount}`,
    `- Compras urgentes: ${input.urgentPurchaseCount}`,
    `- Tareas vencidas: ${input.overdueTaskCount}`,
    `- Eventos sin menú: ${input.eventsWithoutMenuCount}`,
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials missing");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseClient;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const day = now.getUTCDay();

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("alert_subscriptions")
      .select("*")
      .eq("enabled", true);

    if (subscriptionError) throw subscriptionError;

    const sent: Array<{ email: string; hotel_id: string; frequency: string; dry_run: boolean }> = [];

    for (const subscription of subscriptions ?? []) {
      if (subscription.frequency === "weekly" && subscription.weekday !== day) continue;

      const [hotelResult, profileResult, stockResult, purchaseResult, taskResult, eventResult] =
        await Promise.all([
          supabase.from("hotels").select("id, name").eq("id", subscription.hotel_id).maybeSingle(),
          supabase.from("profiles").select("email").eq("id", subscription.user_id).maybeSingle(),
          supabase
            .from("products")
            .select("id")
            .eq("hotel_id", subscription.hotel_id)
            .eq("is_active", true)
            .lte("current_stock", 0),
          supabase
            .from("purchases")
            .select("id")
            .eq("hotel_id", subscription.hotel_id)
            .in("status", ["draft", "pending"])
            .lte("order_date", today),
          supabase
            .from("production_tasks")
            .select("id")
            .eq("hotel_id", subscription.hotel_id)
            .eq("status", "pending")
            .lt("task_date", today),
          supabase
            .from("events")
            .select("id")
            .eq("hotel_id", subscription.hotel_id)
            .is("menu_id", null)
            .gte("event_date", today),
        ]);

      const email = profileResult.data?.email;
      if (!email) continue;

      const message = composeAlertMessage({
        hotelName: hotelResult.data?.name ?? "Hotel",
        criticalStockCount: stockResult.data?.length ?? 0,
        urgentPurchaseCount: purchaseResult.data?.length ?? 0,
        overdueTaskCount: taskResult.data?.length ?? 0,
        eventsWithoutMenuCount: eventResult.data?.length ?? 0,
      });

      if (resend) {
        await resend.emails.send({
          from: "ChefOs <onboarding@resend.dev>",
          to: [email],
          subject: `ChefOs · Alertas operativas ${today}`,
          text: message,
        });
      }

      sent.push({
        email,
        hotel_id: subscription.hotel_id,
        frequency: subscription.frequency,
        dry_run: !resend,
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("send-ops-alert error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
