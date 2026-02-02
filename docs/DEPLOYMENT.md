# Guía de Despliegue - ChefOS

Este documento describe el proceso de despliegue y configuración para producción.

---

## 📋 Índice

1. [Arquitectura de Despliegue](#arquitectura-de-despliegue)
2. [Entornos](#entornos)
3. [Proceso de Publicación](#proceso-de-publicación)
4. [Configuración de Dominio](#configuración-de-dominio)
5. [Variables de Entorno](#variables-de-entorno)
6. [Edge Functions](#edge-functions)
7. [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
8. [Monitorización](#monitorización)
9. [Rollback](#rollback)
10. [Checklist de Producción](#checklist-de-producción)

---

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────────┐
│                    Lovable Cloud                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌──────────────┐     ┌────────────┐  │
│   │   Frontend  │     │  Edge        │     │  Database  │  │
│   │   (React)   │────▶│  Functions   │────▶│ PostgreSQL │  │
│   │   Vite CDN  │     │  (Deno)      │     │            │  │
│   └─────────────┘     └──────────────┘     └────────────┘  │
│         │                    │                    │        │
│         ▼                    ▼                    ▼        │
│   ┌─────────────┐     ┌──────────────┐     ┌────────────┐  │
│   │   Preview   │     │   Secrets    │     │   Storage  │  │
│   │   + Prod    │     │   Manager    │     │   Buckets  │  │
│   └─────────────┘     └──────────────┘     └────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌍 Entornos

### Test (Preview)

- **URL**: `https://id-preview--{project-id}.lovable.app`
- **Propósito**: Desarrollo y pruebas
- **Datos**: Base de datos de pruebas
- **Actualizaciones**: Automáticas al guardar cambios

### Production (Live)

- **URL**: `https://{project-id}.lovable.app` o dominio personalizado
- **Propósito**: Usuarios finales
- **Datos**: Base de datos de producción
- **Actualizaciones**: Requieren publicación manual

### Diferencias Clave

| Aspecto | Test | Production |
|---------|------|------------|
| Despliegue frontend | Automático | Manual (Update) |
| Despliegue backend | Automático | Automático |
| Datos | Test DB | Prod DB |
| Usuarios | Desarrolladores | Clientes finales |

---

## 🚀 Proceso de Publicación

### Frontend (UI/Código)

1. **Realizar cambios** en el código
2. **Verificar en Preview** que funciona correctamente
3. **Clic en "Publish"** (botón superior derecho)
4. **Clic en "Update"** para aplicar cambios a producción

```
Cambio código → Preview automático → Test manual → Publish → Update
```

### Backend (Edge Functions)

Las Edge Functions se despliegan **automáticamente** al guardar:

1. Editar archivo en `supabase/functions/`
2. Guardar cambios
3. La función se despliega automáticamente
4. Disponible inmediatamente en Test y Production

⚠️ **IMPORTANTE**: Los cambios de backend son inmediatos en producción.

### Base de Datos (Migraciones)

Las migraciones se ejecutan tras aprobación del usuario:

1. Crear migración SQL
2. Usuario aprueba la migración
3. Se ejecuta automáticamente
4. Schema actualizado en ambos entornos

---

## 🌐 Configuración de Dominio

### Dominio por Defecto

```
https://{project-id}.lovable.app
```

### Dominio Personalizado

1. **Acceder a Settings → Domains**
2. **Añadir dominio** personalizado
3. **Configurar DNS** según instrucciones:

```dns
# Para dominio raíz (ejemplo.com)
A     @    76.76.21.21

# Para subdominio (app.ejemplo.com)  
CNAME app  cname.lovable.app
```

4. **Verificar** propagación DNS (puede tardar hasta 48h)
5. **SSL automático** una vez verificado

### Requisitos

- Plan de pago activo en Lovable
- Acceso a la configuración DNS del dominio
- Dominio registrado y activo

---

## 🔐 Variables de Entorno

### Variables Automáticas (NO editar)

```env
# Generadas automáticamente por Lovable Cloud
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=xxx
```

### Secrets para Edge Functions

Los secrets se gestionan desde el panel de Lovable:

| Secret | Descripción | Requerido |
|--------|-------------|-----------|
| `SUPABASE_URL` | URL del proyecto | Auto |
| `SUPABASE_ANON_KEY` | Clave pública | Auto |
| `SERVICE_ROLE_KEY` | Clave de servicio | Sí (no puede empezar por SUPABASE_) |
| `RESEND_API_KEY` | API key de Resend | Sí (emails) |
| `GEMINI_API_KEY` | API key de Google Gemini (IA) | Sí |

### Añadir Nuevos Secrets

1. El asistente detecta la necesidad
2. Se muestra formulario seguro
3. Usuario introduce el valor
4. Secret disponible en Edge Functions

---

## ⚡ Edge Functions

### Despliegue Automático

Las funciones en `supabase/functions/` se despliegan automáticamente:

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

### Verificación de Despliegue

1. **Editar función**
2. **Esperar build** (indicador en UI)
3. **Probar endpoint**:
   ```bash
   curl https://xxx.supabase.co/functions/v1/ai-assistant \
     -H "Authorization: Bearer {anon-key}" \
     -H "Content-Type: application/json" \
     -d '{"message": "test"}'
   ```

### Logs de Producción

Acceder a logs desde Cloud View → Edge Functions → Seleccionar función → Logs

---

## 🗄️ Migraciones de Base de Datos

### Proceso de Migración

1. **Crear SQL** con cambios necesarios
2. **Revisión automática** de seguridad (RLS)
3. **Aprobación del usuario**
4. **Ejecución automática**
5. **Regeneración de tipos** TypeScript

### Buenas Prácticas

```sql
-- ✅ CORRECTO: Migración reversible
ALTER TABLE products ADD COLUMN new_field TEXT;

-- ✅ CORRECTO: Con valor por defecto
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active';

-- ⚠️ CUIDADO: Cambio destructivo
ALTER TABLE products DROP COLUMN old_field;
-- Verificar primero que no hay datos importantes
```

### Cambios Destructivos

Para cambios que eliminan datos:

1. **Verificar datos en producción** antes de migrar
2. **Crear backup** si es necesario
3. **Comunicar al equipo** el impacto
4. **Ejecutar en horario de bajo uso**

---

## 📊 Monitorización

### Métricas Disponibles

1. **Analytics del proyecto**: Settings → Analytics
   - Pageviews
   - Usuarios únicos
   - Tiempo en página

2. **Logs de Edge Functions**: Cloud → Edge Functions
   - Requests/segundo
   - Latencia
   - Errores

3. **Base de datos**: Cloud → Database
   - Conexiones activas
   - Queries lentas
   - Uso de storage

### Alertas Recomendadas

| Métrica | Umbral | Acción |
|---------|--------|--------|
| Error rate | > 5% | Revisar logs |
| Latencia DB | > 500ms | Optimizar queries |
| Storage | > 80% | Ampliar plan |
| Edge function timeout | > 10s | Optimizar código |

### Troubleshooting

Si hay problemas de rendimiento:

1. **Verificar logs** de consola y red
2. **Revisar Edge Function logs**
3. **Considerar upgrade** de instancia en Settings → Cloud → Advanced

---

## ⏪ Rollback

### Frontend

El historial de versiones permite revertir:

1. Acceder al historial del proyecto
2. Seleccionar versión anterior
3. Restaurar

⚠️ **NOTA**: No revierte cambios de backend.

### Backend (Edge Functions)

Para revertir una Edge Function:

1. Recuperar código anterior (Git/historial)
2. Reemplazar código actual
3. Guardar para redesplegar

### Base de Datos

Las migraciones **NO son reversibles automáticamente**:

1. Crear migración inversa manualmente
2. Ejecutar como nueva migración
3. Verificar integridad de datos

---

## ✅ Checklist de Producción

### Antes de Publicar

- [ ] **Código revisado** y probado en Preview
- [ ] **Sin console.log** innecesarios
- [ ] **Manejo de errores** implementado
- [ ] **Loading states** en todas las operaciones async
- [ ] **RLS policies** verificadas para todas las tablas
- [ ] **Secrets configurados** para Edge Functions

### Seguridad

- [ ] **Autenticación** funcionando correctamente
- [ ] **Roles** asignados a usuarios de prueba
- [ ] **RLS activo** en todas las tablas con datos sensibles
- [ ] **Validación de inputs** en formularios
- [ ] **CORS configurado** en Edge Functions

### Rendimiento

- [ ] **Imágenes optimizadas** (WebP, lazy loading)
- [ ] **Queries eficientes** (índices, límites)
- [ ] **Bundle size** razonable
- [ ] **Caché** configurado donde aplique

### UX

- [ ] **Responsive** en móvil y desktop
- [ ] **Estados vacíos** mostrados correctamente
- [ ] **Mensajes de error** claros para el usuario
- [ ] **Feedback visual** en acciones (toasts, loading)

### Documentación

- [ ] **README actualizado**
- [ ] **Changelog** de la versión
- [ ] **Comunicación** a usuarios si hay breaking changes

---

## 📝 Notas Adicionales

### Tiempos de Propagación

| Cambio | Tiempo aproximado |
|--------|-------------------|
| Frontend (Update) | Inmediato |
| Edge Functions | 1-2 minutos |
| Migraciones DB | 30 segundos |
| DNS (dominio) | Hasta 48 horas |
| SSL certificado | 5-10 minutos |

### Límites de Producción

- **Conexiones DB**: Según plan
- **Edge Function timeout**: 60 segundos máximo
- **Request body**: 6MB máximo
- **Storage**: Según plan

### Soporte

- **Documentación**: https://docs.lovable.dev
- **Discord**: Comunidad de Lovable
- **Issues**: Reportar en el proyecto
