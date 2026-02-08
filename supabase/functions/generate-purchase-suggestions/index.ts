import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Signal {
  product_id: string;
  product_name: string;
  forecast_qty: number;
  event_qty: number;
  menu_qty: number;
  current_qty: number;
  safety_stock_qty?: number;
  lead_time_days?: number;
  daily_demand_rate?: number;
  pack_size?: number;
}

function roundPack(value: number, packSize: number): number {
  if (value <= 0) return 0;
  if (packSize <= 1) return Math.ceil(value);
  return Math.ceil(value / packSize) * packSize;
}

function computeSuggestion(signal: Signal) {
  const demand =
    signal.forecast_qty +
    signal.event_qty +
    signal.menu_qty +
    (signal.safety_stock_qty ?? 0) +
    (signal.lead_time_days ?? 0) * (signal.daily_demand_rate ?? 0);

  const requiredQty = Math.max(demand - signal.current_qty, 0);
  const recommendedQty = roundPack(requiredQty, signal.pack_size ?? 1);

  return {
    product_id: signal.product_id,
    product_name: signal.product_name,
    required_qty: Number(requiredQty.toFixed(2)),
    current_qty: Number(signal.current_qty.toFixed(2)),
    recommended_qty: Number(recommendedQty.toFixed(2)),
    reason: `Demanda ${demand.toFixed(2)} y stock ${signal.current_qty.toFixed(2)}`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { signals } = await req.json();
    if (!Array.isArray(signals)) {
      return new Response(
        JSON.stringify({ success: false, error: "signals array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const suggestions = signals.map((signal: Signal) => computeSuggestion(signal));

    return new Response(
      JSON.stringify({ success: true, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
