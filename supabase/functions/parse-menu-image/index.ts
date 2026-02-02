/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY is not configured');
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

    const imageMatch = imageBase64.match(/^data:(.+);base64,(.*)$/);
    const mimeType = imageMatch?.[1] || 'image/jpeg';
    const base64Payload = imageMatch?.[2] || imageBase64;

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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response received, parsing JSON...');

    // Parse JSON from response (handle potential markdown wrapping)
    let menuData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      menuData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('Failed to parse menu data from AI response');
    }

    console.log('Menu extracted successfully:', menuData.sections?.length, 'sections');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: menuData,
        message: `Extracted ${menuData.sections?.reduce((acc: number, s: { items?: unknown[] }) => acc + (s.items?.length || 0), 0) || 0} items`
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
