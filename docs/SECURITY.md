# Seguridad - ChefOS

Este documento describe las medidas de seguridad implementadas y las mejores prácticas.

---

## 📋 Índice

1. [Modelo de Seguridad](#modelo-de-seguridad)
2. [Autenticación](#autenticación)
3. [Autorización y Roles](#autorización-y-roles)
4. [Row Level Security (RLS)](#row-level-security-rls)
5. [Protección de Datos](#protección-de-datos)
6. [Edge Functions](#edge-functions)
7. [Validación de Inputs](#validación-de-inputs)
8. [Secrets Management](#secrets-management)
9. [Auditoría](#auditoría)
10. [Incidentes de Seguridad](#incidentes-de-seguridad)
11. [Novedades de Seguridad (R1-R4, 2026-02-08)](#novedades-de-seguridad-r1-r4-2026-02-08)

---

## 🔒 Modelo de Seguridad

### Capas de Protección

```
┌─────────────────────────────────────────┐
│           CAPA DE APLICACIÓN            │
│  • Validación de formularios            │
│  • Sanitización de inputs               │
│  • CSRF protection                      │
├─────────────────────────────────────────┤
│           CAPA DE API                   │
│  • JWT verification                     │
│  • Rate limiting                        │
│  • CORS headers                         │
├─────────────────────────────────────────┤
│           CAPA DE DATOS                 │
│  • Row Level Security (RLS)             │
│  • Políticas por rol                    │
│  • Aislamiento multi-tenant             │
├─────────────────────────────────────────┤
│           CAPA DE INFRAESTRUCTURA       │
│  • Encriptación en tránsito (TLS)       │
│  • Encriptación en reposo               │
│  • Backups automáticos                  │
└─────────────────────────────────────────┘
```

### Principios

1. **Defense in Depth**: Múltiples capas de seguridad
2. **Least Privilege**: Mínimos permisos necesarios
3. **Zero Trust**: Verificar siempre, confiar nunca
4. **Secure by Default**: Configuraciones seguras por defecto

---

## 🔐 Autenticación

### Flujo de Autenticación

```
Usuario → Login Form → Supabase Auth → JWT Token → Sesión activa
                           ↓
                    Verificación email
                           ↓
                    Profile + Roles
```

### Implementación

```typescript
// useAuth.tsx
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error };
};

const signUp = async (email: string, password: string, fullName: string) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { full_name: fullName },
    },
  });
  return { error };
};
```

### Políticas de Contraseñas

- Mínimo 8 caracteres (por defecto Supabase)
- Verificación de email obligatoria
- Tokens de sesión con expiración

### Protección de Rutas

```typescript
// ProtectedRoute.tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" />;
  
  return children;
}
```

---

## 👥 Autorización y Roles

### Tabla de Roles

Los roles se almacenan en tabla separada, **NUNCA en profiles**:

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);
```

### ⚠️ CRÍTICO: Nunca Hacer

```typescript
// ❌ NUNCA verificar roles desde localStorage
const isAdmin = localStorage.getItem('role') === 'admin';

// ❌ NUNCA hardcodear credenciales
if (email === 'admin@hotel.com') { /* admin access */ }

// ❌ NUNCA confiar en datos del cliente
const { role } = userInput; // Puede ser manipulado
```

### ✅ Verificación Correcta

```typescript
// ✅ Verificar roles desde la base de datos
const { hasRole, hasManagementAccess } = useAuth();

if (hasRole('admin')) {
  // Acceso de administrador
}

// ✅ Usar funciones de base de datos
SELECT public.has_role(auth.uid(), 'admin');
```

### Función de Verificación

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

---

## 🛡️ Row Level Security (RLS)

### Activación Obligatoria

**TODA tabla con datos de usuario DEBE tener RLS activo**:

```sql
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
```

### Patrones de Políticas

#### 1. Aislamiento por Hotel

```sql
-- Solo ver datos del hotel del usuario
CREATE POLICY "hotel_isolation" ON public.events
FOR SELECT USING (
  hotel_id = public.get_user_hotel_id()
);
```

#### 2. Pertenencia a Hotel

```sql
-- El usuario debe pertenecer al hotel
CREATE POLICY "hotel_member" ON public.events
FOR ALL USING (
  public.user_belongs_to_hotel(hotel_id)
);
```

#### 3. Acceso por Rol

```sql
-- Solo admins pueden eliminar
CREATE POLICY "admin_delete" ON public.products
FOR DELETE USING (
  public.is_admin() OR public.is_jefe_cocina()
);
```

#### 4. Propietario del Registro

```sql
-- Solo el creador puede editar
CREATE POLICY "owner_update" ON public.production_tasks
FOR UPDATE USING (
  created_by = auth.uid() OR public.is_admin()
);
```

### Verificación de RLS

```sql
-- Listar tablas sin RLS
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND NOT rowsecurity;
```

---

## 🔏 Protección de Datos

### Datos Sensibles

| Dato | Protección |
|------|------------|
| Contraseñas | Hash (Supabase Auth) |
| Tokens | Almacenamiento seguro |
| Emails | RLS por hotel |
| Teléfonos | RLS por hotel |
| Datos financieros | RLS + rol admin |

### Multi-tenancy

Aislamiento estricto por `hotel_id`:

```typescript
// Toda operación incluye hotel_id
const { data, error } = await supabase
  .from("events")
  .insert({ ...event, hotel_id: hotelId });
```

### Encriptación

- **En tránsito**: TLS 1.3
- **En reposo**: AES-256 (Supabase)
- **Backups**: Encriptados

---

## ⚡ Edge Functions

### Validación de JWT

```typescript
// Verificar autenticación en Edge Function
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: corsHeaders
  });
}

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);

const { data: { user }, error } = await supabaseClient.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Invalid token' }), {
    status: 401,
    headers: corsHeaders
  });
}
```

### CORS Headers

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
};

// Manejar preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

### Validación de Inputs

```typescript
// Validar y sanitizar inputs
const { message, hotel_id } = await req.json();

if (!message || typeof message !== 'string') {
  return new Response(JSON.stringify({ error: 'Invalid message' }), {
    status: 400,
    headers: corsHeaders
  });
}

// Limitar longitud
const sanitizedMessage = message.trim().slice(0, 10000);
```

---

## ✅ Validación de Inputs

### Frontend (React Hook Form + Zod)

```typescript
import { z } from 'zod';

const eventSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.number().min(1).max(10000),
  notes: z.string().max(5000).optional(),
});

// Uso
const form = useForm<z.infer<typeof eventSchema>>({
  resolver: zodResolver(eventSchema),
});
```

### Backend (Edge Functions)

```typescript
// Validación manual en Edge Function
function validateEvent(data: unknown): Event | null {
  if (!data || typeof data !== 'object') return null;
  
  const { name, event_date, pax } = data as Record<string, unknown>;
  
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof pax !== 'number' || pax < 1) return null;
  
  return { name, event_date, pax } as Event;
}
```

### Sanitización SQL

Supabase client ya protege contra SQL injection, pero:

```typescript
// ✅ CORRECTO: Usar el cliente
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('name', userInput);

// ❌ NUNCA: Raw SQL con input de usuario
// await supabase.rpc('execute_sql', { query: `SELECT * WHERE name = '${userInput}'` });
```

---

## 🔑 Secrets Management

### Almacenamiento Seguro

Los secrets se gestionan mediante Lovable Cloud:

```
┌──────────────────┐
│  Lovable Cloud   │
│  Secrets Vault   │
├──────────────────┤
│ RESEND_API_KEY   │──▶ Edge Functions
│ GEMINI_API_KEY   │
│ SERVICE_ROLE_KEY │
└──────────────────┘
```

### Acceso en Edge Functions

```typescript
// Acceder a secrets
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
```

### Nunca Exponer

```typescript
// ❌ NUNCA loguear secrets
console.log('API Key:', Deno.env.get('SECRET_KEY'));

// ❌ NUNCA devolver en respuestas
return new Response(JSON.stringify({ 
  key: Deno.env.get('SECRET_KEY') // ¡PELIGRO!
}));

// ❌ NUNCA en código cliente
const apiKey = import.meta.env.VITE_SECRET_API_KEY; // Solo para claves públicas
```

---

## 📝 Auditoría

### Campos de Auditoría

Todas las tablas principales incluyen:

```sql
created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now(),
created_by UUID REFERENCES auth.users(id)
```

### Trigger de Updated_at

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Trazabilidad

- **Quién**: `created_by`, sesión de usuario
- **Cuándo**: `created_at`, `updated_at`
- **Qué**: Registro completo en la tabla
- **Desde dónde**: Logs de Edge Functions

---

## 🚨 Incidentes de Seguridad

### Proceso de Respuesta

1. **Detección**: Monitorear logs y alertas
2. **Contención**: Revocar accesos comprometidos
3. **Investigación**: Analizar causa raíz
4. **Remediación**: Corregir vulnerabilidad
5. **Comunicación**: Notificar afectados si aplica

### Acciones Inmediatas

```sql
-- Revocar todos los tokens de un usuario
-- (El usuario deberá hacer login de nuevo)
UPDATE auth.users 
SET aud = gen_random_uuid() 
WHERE id = 'user-id-comprometido';
```

### Contacto de Seguridad

Para reportar vulnerabilidades:
- Documentar en el proyecto
- Notificar al equipo de desarrollo
- No publicar detalles hasta resolución

---

## 🔐 Novedades de Seguridad (R1-R4, 2026-02-08)

### Feature Flags sensibles en OFF por defecto

Los flags operativos y de IA se inicializan en `false` por hotel:

- `ai_purchase_suggestions`
- `ai_daily_briefing`
- `ai_menu_recommender`
- `ai_ops_alert_copy`
- `clawtbot_integration`

Esto reduce exposición inicial y obliga activación explícita por `admin/super_admin`.

### Firma de conexión para agentes (`agent-bridge`)

`agent-bridge` opera con firma Ed25519 y anti-replay, no con JWT de usuario.

- Headers obligatorios: `x-agent-id`, `x-agent-ts`, `x-agent-nonce`, `x-agent-signature`
- Ventana de tiempo: ±60 segundos
- Anti-replay: tabla `agent_nonces` con expiración
- Control de alcance: `allowed_scopes` por conexión
- Auditoría: cada operación inserta registro en `ops_audit_log`

Cadena canónica firmada:

```text
METHOD
PATH
QUERY_CANONICAL
SHA256_HEX_BODY
TIMESTAMP_SECONDS
NONCE
AGENT_ID
```

### Flujos críticos con aprobación explícita

Cambios con umbral económico (compras y menús) usan:

- `approval_policies`
- `approval_requests`
- `approval_events`

Cuando se supera el umbral, la operación queda en estado pendiente y se registra evento auditable.

### Auditoría operativa centralizada

`ops_audit_log` captura mutaciones operativas clave (compras, inventario, tareas, bridge de agentes), con:

- `hotel_id`
- `entity`
- `action`
- `payload` JSON
- `actor_user_id` opcional

Este registro se usa para trazabilidad e investigación de incidentes.

---

## 📊 Resumen de Controles

| Control | Implementado | Verificación |
|---------|--------------|--------------|
| Autenticación JWT | ✅ | Login/Logout funcional |
| RLS en tablas | ✅ | Linter de seguridad |
| Roles separados | ✅ | Tabla user_roles |
| Validación inputs | ✅ | Zod schemas |
| CORS configurado | ✅ | Edge Functions |
| Secrets seguros | ✅ | Cloud Vault |
| Multi-tenancy | ✅ | hotel_id en queries |
| Auditoría | ✅ | Timestamps + created_by |
| Firma de agente Ed25519 | ✅ | Timestamp + nonce + scope |
| Encriptación TLS | ✅ | Supabase default |
| Protección SQL | ✅ | Supabase client |
