/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  extractFirstJsonObject,
  extractGeminiTextFromGenerateContent,
} from "../_shared/edgeAiExtract.ts";

type ParsedMenu = {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  serviceFormat?: string | null;
  sections: Array<{
    name: string;
    items: Array<{
      name: string;
      description?: string | null;
      highlighted?: boolean;
    }>;
  }>;
  observations?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!MISTRAL_API_KEY && !GEMINI_API_KEY) {
      console.error("No AI provider configured (missing MISTRAL_API_KEY/GEMINI_API_KEY)");
      throw new Error("OCR provider is not configured");
    }

    const { imageBase64, mealType } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing menu image for meal type:', mealType || 'unknown');

    const systemPrompt = `Eres un experto en extracción de datos de menús de restaurantes y hoteles.
Tu tarea es analizar la imagen de un menú y extraer todos los elementos en formato JSON estructurado.

Responde SOLO con un objeto JSON válido sin markdown ni texto adicional.

El formato debe ser:
{
  "mealType": "breakfast|lunch|dinner|snack",
  "serviceFormat": "string (ej: HOTEL BUFFET)",
  "sections": [
    {
      "name": "string (ej: GUARNICIÓN, PRIMER PLATO, SEGUNDO PLATO, POSTRES)",
      "items": [
        {
          "name": "string",
          "description": "string (notas adicionales si existen)",
          "highlighted": boolean (true si el texto está resaltado/marcado)
        }
      ]
    }
  ],
  "observations": "string (observaciones específicas del documento)"
}

Extrae TODOS los elementos visibles, incluyendo:
- Bebidas, cafés, tés, zumos
- Frutas y frutos secos
- Lácteos (yogures, leches, cuajada)
- Cereales y panes
- Huevos y tortillas
- Embutidos y quesos
- Ensaladas y verduras
- Primeros platos (arroces, pastas, sopas)
- Segundos platos (carnes, pescados)
- Postres
- Guarniciones`;

    const imageMatch = String(imageBase64).match(/^data:(.+);base64,(.*)$/);
    const mimeType = imageMatch?.[1] || "image/jpeg";
    const base64Payload = imageMatch?.[2] || String(imageBase64);
    const dataUrl = imageMatch ? String(imageBase64) : `data:${mimeType};base64,${base64Payload}`;

    // Prefer Mistral OCR if configured (better for dense text documents)
    if (MISTRAL_API_KEY) {
      const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: {
            type: "image_url",
            image_url: { url: dataUrl },
          },
          // NOTE: Mistral OCR only supports json_schema for document_annotation_format.
          document_annotation_format: {
            type: "json_schema",
            json_schema: {
              name: "menu_ocr",
              description: "Menu extraction schema",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  mealType: {
                    type: "string",
                    enum: ["breakfast", "lunch", "dinner", "snack"],
                  },
                  serviceFormat: {
                    type: ["string", "null"],
                  },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              name: { type: "string" },
                              description: { type: ["string", "null"] },
                              highlighted: { type: "boolean" },
                            },
                            required: ["name"],
                          },
                        },
                      },
                      required: ["name", "items"],
                    },
                  },
                  observations: {
                    type: ["string", "null"],
                  },
                },
                required: ["mealType", "sections"],
              },
          },
          },
          document_annotation_prompt: mealType
            ? `${systemPrompt}\n\nINSTRUCCION EXTRA: El campo mealType debe ser "${mealType}".`
            : systemPrompt,
        }),
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        console.error("Mistral OCR error:", ocrResponse.status, errorText);
        throw new Error(`Mistral OCR error: ${ocrResponse.status}`);
      }

      const ocrData = await ocrResponse.json();
      const annotation = typeof ocrData?.document_annotation === "string" ? ocrData.document_annotation : "";
      if (!annotation) {
        console.error("Mistral OCR response missing document_annotation");
        throw new Error("Mistral OCR did not return structured output");
      }

      const menuData = extractFirstJsonObject(annotation) as unknown as ParsedMenu;
      const itemsCount = Array.isArray(menuData?.sections)
        ? menuData.sections.reduce((acc, s) => acc + (Array.isArray(s.items) ? s.items.length : 0), 0)
        : 0;
      return new Response(
        JSON.stringify({
          success: true,
          data: menuData,
          message: `Extracted ${itemsCount} items`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Payload,
                    mimeType,
                  },
                },
                {
                  text: mealType
                    ? `Extrae los elementos del menú de ${mealType} de esta imagen.`
                    : 'Extrae todos los elementos del menú de esta imagen.',
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI Gateway error:', response.status, errorData);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = extractGeminiTextFromGenerateContent(data);

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response received, parsing JSON...');

    // Parse JSON from response (handle potential markdown wrapping)
    const menuData = extractFirstJsonObject(content) as unknown as ParsedMenu;
    const itemsCount = Array.isArray(menuData?.sections)
      ? menuData.sections.reduce((acc, s) => acc + (Array.isArray(s.items) ? s.items.length : 0), 0)
      : 0;

    console.log('Menu extracted successfully:', menuData.sections?.length, 'sections');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: menuData,
        message: `Extracted ${itemsCount} items`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing menu image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
