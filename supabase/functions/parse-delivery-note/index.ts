import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const normalizeName = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const namesMatch = (left: string, right: string) => {
      const a = normalizeName(left);
      const b = normalizeName(right);
      return a.includes(b) || b.includes(a);
    };

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { imageBase64, image, expectedItems } = await req.json();
    const imagePayload = imageBase64 || image;

    if (!imagePayload) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Parsing delivery note image with OCR...");

    const imageMatch = String(imagePayload).match(/^data:(.+);base64,(.*)$/);
    const mimeType = imageMatch?.[1] || "image/jpeg";
    const base64Payload = imageMatch?.[2] || String(imagePayload);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `Eres un experto en OCR de albaranes de entrega para restaurantes y cocinas.
Analiza la imagen del albarán y extrae los productos con sus cantidades.
Responde SOLO con un JSON válido con esta estructura:
{
  "supplier_name": "nombre del proveedor si es visible",
  "document_number": "número del albarán si es visible",
  "date": "fecha del albarán en formato YYYY-MM-DD si es visible",
  "items": [
    { "name": "nombre del producto", "quantity": número, "unit": "unidad si es visible (kg, ud, etc.)" }
  ]
}
Si no puedes identificar algún campo, déjalo como null.
Extrae todos los productos que puedas identificar, aunque la imagen no sea perfecta.`,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "Analiza este albarán y extrae los productos con sus cantidades:" },
                {
                  inlineData: {
                    data: base64Payload,
                    mimeType,
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content =
      data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
      "";

    console.log("Raw AI response:", content);

    // Extract JSON from response
    let result;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      result = {
        supplier_name: null,
        document_number: null,
        date: null,
        items: [],
        raw_text: content
      };
    }

    console.log("Parsed delivery note:", result);

    let reconciliation: Record<string, unknown> | null = null;
    if (Array.isArray(expectedItems) && Array.isArray(result?.items)) {
      const used = new Set<number>();
      const matched = [];
      const missing = [];

      for (const expected of expectedItems) {
        const index = result.items.findIndex(
          (item: { name: string }, i: number) =>
            !used.has(i) &&
            typeof expected?.name === "string" &&
            typeof item?.name === "string" &&
            namesMatch(expected.name, item.name),
        );
        if (index === -1) {
          missing.push(expected);
          continue;
        }
        used.add(index);
        const received = result.items[index];
        matched.push({
          expected,
          received,
          quantity_delta: (received?.quantity ?? 0) - (expected?.quantity ?? 0),
        });
      }

      const unexpected = result.items.filter((_: unknown, idx: number) => !used.has(idx));
      reconciliation = {
        matched,
        missing,
        unexpected,
        has_issues:
          missing.length > 0 ||
          unexpected.length > 0 ||
          matched.some((entry: { quantity_delta: number }) => entry.quantity_delta !== 0),
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: result, reconciliation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing delivery note:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
