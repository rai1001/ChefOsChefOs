# Edge Functions - ChefOS

## 📍 Ubicación

```
supabase/functions/
├── ai-assistant/
│   └── index.ts
├── parse-delivery-note/
│   └── index.ts
├── parse-menu-image/
│   └── index.ts
└── send-invitation-email/
    └── index.ts
```

## ⚙️ Configuración

**Archivo:** `supabase/config.toml`

```toml
project_id = "sdfqlchgbbtzhmujlthi"

[functions.parse-menu-image]
verify_jwt = false

[functions.parse-delivery-note]
verify_jwt = false

[functions.send-invitation-email]
verify_jwt = false

[functions.ai-assistant]
verify_jwt = false
```

> **Nota:** `verify_jwt = false` permite llamadas públicas. La autenticación se verifica manualmente en el código cuando es necesaria.

---

## 🤖 ai-assistant

**Propósito:** Asistente de IA para chat y sugerencias de menú.

### Endpoint
```
POST /functions/v1/ai-assistant
```

### Request Body
```typescript
{
  messages: Array<{ role: 'user' | 'assistant', content: string }>,
  type: 'chat' | 'suggest_menu',
  context?: any
}
```

### Comportamiento
1. Extrae token JWT del header `Authorization`
2. Obtiene contexto del hotel:
   - Próximos eventos (10)
   - Menús activos (20)
   - Tareas pendientes (10)
3. Construye prompt según tipo:
   - `chat`: Asistente general ChefOS
   - `suggest_menu`: Sugeridor de menús
4. Llama a Google Gemini API (streaming)
5. Retorna streaming SSE

### Modelo IA
- `gemini-2.5-flash`

### Secrets necesarios
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SERVICE_ROLE_KEY`

### Response
- **200:** Stream de eventos SSE
- **429:** Rate limit
- **500:** Error

### Ejemplo de uso
```typescript
const response = await supabase.functions.invoke('ai-assistant', {
  body: {
    messages: [{ role: 'user', content: '¿Qué eventos hay hoy?' }],
    type: 'chat'
  }
});
```

---

## 📷 parse-menu-image

**Propósito:** Extracción OCR de menús desde imágenes.

### Endpoint
```
POST /functions/v1/parse-menu-image
```

### Request Body
```typescript
{
  imageBase64: string,  // Imagen en base64
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}
```

### Comportamiento
1. Recibe imagen en base64
2. Envía a Google Gemini API con prompt de extracción
3. Parsea respuesta JSON
4. Retorna datos estructurados

### Modelo IA
- `google/gemini-2.5-flash`

### Secrets necesarios
- `GEMINI_API_KEY`

### Response
```typescript
{
  success: boolean,
  data: {
    mealType: string,
    serviceFormat?: string,
    sections: Array<{
      name: string,
      items: Array<{
        name: string,
        description?: string,
        highlighted?: boolean
      }>
    }>,
    observations?: string
  },
  message: string
}
```

### Ejemplo de uso
```typescript
const response = await supabase.functions.invoke('parse-menu-image', {
  body: {
    imageBase64: 'iVBORw0KGgo...',
    mealType: 'lunch'
  }
});
```

---

## 📄 parse-delivery-note

**Propósito:** Extracción OCR de albaranes de entrega.

### Endpoint
```
POST /functions/v1/parse-delivery-note
```

### Request Body
```typescript
{
  imageBase64: string  // Imagen del albarán en base64
}
```

### Comportamiento
1. Recibe imagen del albarán
2. Envía a Google Gemini API para OCR
3. Extrae:
   - Nombre del proveedor
   - Número de documento
   - Fecha
   - Productos con cantidades
4. Retorna datos estructurados

### Modelo IA
- `google/gemini-2.5-flash`

### Secrets necesarios
- `GEMINI_API_KEY`

### Response
```typescript
{
  success: boolean,
  data: {
    supplier_name: string | null,
    document_number: string | null,
    date: string | null,  // YYYY-MM-DD
    items: Array<{
      name: string,
      quantity: number,
      unit?: string
    }>
  }
}
```

### Ejemplo de uso
```typescript
const response = await supabase.functions.invoke('parse-delivery-note', {
  body: {
    imageBase64: 'data:image/jpeg;base64,/9j/4AAQ...'
  }
});
```

---

## ✉️ send-invitation-email

**Propósito:** Envío de emails de invitación al equipo.

### Endpoint
```
POST /functions/v1/send-invitation-email
```

### Request Body
```typescript
{
  email: string,
  hotelName: string,
  role: 'admin' | 'jefe_cocina' | 'maitre' | 'produccion' | 'rrhh',
  token: string,
  inviterName?: string
}
```

### Comportamiento
1. Valida campos requeridos
2. Construye email HTML con diseño ChefOS
3. Envía via Resend API
4. Retorna resultado

### Secrets necesarios
- `RESEND_API_KEY`

### Response
```typescript
{
  success: boolean,
  id?: string  // ID del email enviado
}
```

### Template del email
- Header con logo ChefOS
- Mensaje de invitación personalizado
- Botón "Aceptar Invitación"
- Footer con información de expiración (7 días)

### Ejemplo de uso
```typescript
const response = await supabase.functions.invoke('send-invitation-email', {
  body: {
    email: 'nuevo@equipo.com',
    hotelName: 'Hotel Ejemplo',
    role: 'maitre',
    token: 'abc123...',
    inviterName: 'Juan García'
  }
});
```

---

## 🔧 Desarrollo Local

### Requisitos
- Deno instalado
- Supabase CLI

### Comandos
```bash
# Servir funciones localmente
supabase functions serve

# Servir función específica
supabase functions serve ai-assistant

# Ver logs
supabase functions logs ai-assistant
```

### Variables de entorno locales
Crear `.env.local` en `supabase/functions/`:
```env
GEMINI_API_KEY=your_key
RESEND_API_KEY=your_key
SUPABASE_URL=your_url
SERVICE_ROLE_KEY=your_key
```

---

## 📝 Headers CORS

Todas las funciones incluyen:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ...',
};

// Manejar preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

---

## 🚀 Despliegue

Las funciones se despliegan automáticamente al hacer push a Lovable. No requiere acciones manuales.

Para verificar estado:
1. Ir a Lovable Cloud
2. Ver logs de funciones
3. Probar endpoints
