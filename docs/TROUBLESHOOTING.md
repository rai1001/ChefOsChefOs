# Troubleshooting - ChefOS

Guía de resolución de problemas comunes.

---

## 📋 Índice

1. [Errores de Autenticación](#errores-de-autenticación)
2. [Errores de Base de Datos](#errores-de-base-de-datos)
3. [Errores de Edge Functions](#errores-de-edge-functions)
4. [Problemas de UI](#problemas-de-ui)
5. [Problemas de Rendimiento](#problemas-de-rendimiento)
6. [Importación de Datos](#importación-de-datos)
7. [Herramientas de Diagnóstico](#herramientas-de-diagnóstico)

---

## 🔐 Errores de Autenticación

### "Invalid login credentials"

**Causa**: Email o contraseña incorrectos.

**Solución**:
1. Verificar que el email está escrito correctamente
2. Usar "Olvidé mi contraseña" para resetear
3. Verificar que el usuario existe en la base de datos

### "Email not confirmed"

**Causa**: El usuario no ha verificado su email.

**Solución**:
1. Revisar bandeja de entrada y spam
2. Reenviar email de verificación desde login
3. En desarrollo, activar auto-confirm en configuración de Auth

### "User not found"

**Causa**: El usuario no existe o fue eliminado.

**Solución**:
```sql
-- Verificar si el usuario existe
SELECT * FROM auth.users WHERE email = 'usuario@ejemplo.com';
```

### Session Expired

**Causa**: Token JWT expirado.

**Solución**:
```typescript
// El cliente de Supabase maneja refresh automáticamente
// Si persiste, cerrar sesión y volver a entrar
await supabase.auth.signOut();
```

---

## 🗄️ Errores de Base de Datos

### "new row violates row-level security policy"

**Causa**: La operación no cumple las políticas RLS.

**Diagnóstico**:
1. Verificar que el usuario está autenticado
2. Verificar que `hotel_id` está incluido en el insert
3. Verificar que el usuario pertenece al hotel

**Solución**:
```typescript
// ❌ Incorrecto
await supabase.from('events').insert({ name: 'Evento' });

// ✅ Correcto
await supabase.from('events').insert({ 
  name: 'Evento',
  hotel_id: currentHotelId  // Requerido por RLS
});
```

### "duplicate key value violates unique constraint"

**Causa**: Intento de insertar un valor duplicado en campo único.

**Solución**:
```typescript
// Usar upsert en lugar de insert
const { data, error } = await supabase
  .from('products')
  .upsert({ id: existingId, name: 'Nuevo nombre' });
```

### "foreign key violation"

**Causa**: Referencia a un registro que no existe.

**Diagnóstico**:
```sql
-- Verificar que el registro referenciado existe
SELECT * FROM products WHERE id = 'product-id';
SELECT * FROM suppliers WHERE id = 'supplier-id';
```

### Datos no aparecen

**Posibles causas**:
1. RLS bloqueando acceso
2. Hotel ID incorrecto
3. Query con límite alcanzado (default 1000)

**Solución**:
```typescript
// Verificar que el query no está limitado
const { data } = await supabase
  .from('events')
  .select('*')
  .limit(5000);  // Aumentar límite si necesario
```

---

## ⚡ Errores de Edge Functions

### "Function not found"

**Causa**: La función no está desplegada o el nombre es incorrecto.

**Solución**:
1. Verificar nombre en `supabase/functions/`
2. Verificar que `index.ts` existe en la carpeta
3. Esperar a que se complete el build

### "Internal Server Error" (500)

**Diagnóstico**:
1. Revisar logs de la función en Cloud View
2. Verificar secrets configurados
3. Revisar errores en el código

**Logs**:
```typescript
// Añadir logging para debug
console.log('Request body:', await req.json());
console.log('User:', user?.id);
```

### CORS Error

**Causa**: Headers CORS faltantes.

**Solución**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
};

// Manejar OPTIONS
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Incluir headers en respuesta
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### Timeout (504)

**Causa**: La función tarda más de 60 segundos.

**Solución**:
1. Optimizar operaciones
2. Dividir en operaciones más pequeñas
3. Usar procesamiento asíncrono

### Secret no disponible

**Diagnóstico**:
```typescript
const apiKey = Deno.env.get('API_KEY');
console.log('API Key exists:', !!apiKey);
```

**Solución**:
1. Verificar que el secret está configurado en Cloud
2. Nombre exacto (case sensitive)
3. Redesplegar función

---

## 🖥️ Problemas de UI

### Componente no renderiza

**Diagnóstico**:
1. Revisar consola del navegador
2. Verificar errores de TypeScript
3. Verificar imports

**Errores comunes**:
```typescript
// ❌ Import incorrecto
import Button from '@/components/ui/button';

// ✅ Import correcto
import { Button } from '@/components/ui/button';
```

### Datos no se actualizan

**Causa**: Caché de React Query.

**Solución**:
```typescript
// Invalidar queries manualmente
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['events'] });
```

### Loading infinito

**Diagnóstico**:
1. Verificar Network tab
2. Verificar errores en consola
3. Verificar que el hook no está en loading forever

```typescript
const { data, isLoading, error } = useQuery(...);

// Debug
console.log({ data, isLoading, error });
```

### Formulario no envía

**Posibles causas**:
1. Validación fallando silenciosamente
2. Error en mutation no manejado

**Solución**:
```typescript
const form = useForm({
  resolver: zodResolver(schema),
});

// Debug validación
console.log('Form errors:', form.formState.errors);
```

---

## 🚀 Problemas de Rendimiento

### Carga lenta

**Diagnóstico**:
1. Network tab → tiempo de respuesta
2. Performance tab → renderizado
3. Queries lentas en DB

**Soluciones**:
```typescript
// Limitar datos cargados
const { data } = useQuery({
  queryKey: ['events', page],
  queryFn: () => fetchEvents({ limit: 20, offset: page * 20 })
});

// Lazy loading de componentes
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### Queries lentas

**Diagnóstico** (Analytics Query):
```sql
SELECT 
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**Solución**: Añadir índices:
```sql
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_hotel ON events(hotel_id);
```

### Bundle size grande

**Diagnóstico**:
```bash
npm run build
# Ver tamaño del output
```

**Soluciones**:
1. Dynamic imports para rutas
2. Tree shaking
3. Optimizar imágenes

---

## 📥 Importación de Datos

### Excel no se importa

**Causas comunes**:
1. Formato de fecha incorrecto
2. Columnas con nombres diferentes
3. Celdas vacías

**Diagnóstico**:
```typescript
// En el parser de XLSX
console.log('Raw data:', rawData);
console.log('Parsed rows:', parsedRows);
```

### Fechas incorrectas

**Causa**: Excel almacena fechas como números.

**Solución**:
```typescript
import * as XLSX from 'xlsx';

// Convertir fecha de Excel
function excelDateToJS(excelDate: number): Date {
  return new Date((excelDate - 25569) * 86400 * 1000);
}

// O usar XLSX.SSF
const dateStr = XLSX.SSF.format('yyyy-mm-dd', cellValue);
```

### Datos duplicados

**Causa**: Importación no reemplaza correctamente.

**Solución**:
```typescript
// Borrar antes de insertar
await supabase
  .from('events')
  .delete()
  .eq('hotel_id', hotelId)
  .is('created_by', null);

await supabase
  .from('events')
  .insert(newEvents);
```

---

## 🔧 Herramientas de Diagnóstico

### Console Logs

```typescript
// En componentes
useEffect(() => {
  console.log('Component mounted');
  console.log('Props:', props);
  console.log('State:', state);
}, []);

// En hooks
const { data, error, isLoading } = useQuery(...);
console.log('Query state:', { data, error, isLoading });
```

### Network Inspector

1. Abrir DevTools → Network
2. Filtrar por Fetch/XHR
3. Verificar requests a Supabase
4. Revisar payloads y respuestas

### React Query DevTools

```typescript
// Ya incluido en desarrollo
// Acceder desde el icono flotante
```

### Supabase Logs

1. Cloud View → Edge Functions
2. Seleccionar función
3. Ver logs en tiempo real

### Database Analytics

```sql
-- Errores recientes de Postgres
SELECT * FROM postgres_logs
WHERE parsed.error_severity IS NOT NULL
ORDER BY timestamp DESC
LIMIT 20;

-- Errores de Auth
SELECT * FROM auth_logs
WHERE metadata.level = 'error'
ORDER BY timestamp DESC
LIMIT 20;
```

---

## 📞 Escalación

Si el problema persiste:

1. **Documentar** el error exacto
2. **Reproducir** los pasos
3. **Capturar** logs y screenshots
4. **Verificar** que no es un problema conocido
5. **Reportar** al equipo de desarrollo

### Información a Incluir

- Mensaje de error exacto
- Pasos para reproducir
- Usuario y hotel afectados
- Timestamp del error
- Logs relevantes
- Screenshots si aplica
