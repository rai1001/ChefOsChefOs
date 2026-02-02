# ChefOS - Sistema de Gestión de Cocina para Hoteles

## 📋 Descripción General

**ChefOS** es una aplicación web completa para la gestión operativa de cocinas de hotel. Permite administrar eventos, menús, inventario, compras, personal y tareas de producción de forma integrada.

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilos** | Tailwind CSS + shadcn/ui |
| **Estado** | TanStack React Query |
| **Routing** | React Router v6 |
| **Backend** | Lovable Cloud (Supabase) |
| **Base de datos** | PostgreSQL |
| **Autenticación** | Supabase Auth |
| **Edge Functions** | Deno (Supabase Functions) |
| **IA** | Lovable AI Gateway (Gemini) |
| **Email** | Resend |

## 📁 Estructura del Proyecto

```
├── docs/                      # Documentación
├── public/                    # Archivos estáticos
├── src/
│   ├── components/           # Componentes React
│   │   ├── ai/              # Componentes de IA
│   │   ├── auth/            # Autenticación
│   │   ├── dashboard/       # Dashboard
│   │   ├── events/          # Eventos
│   │   ├── forecast/        # Previsiones
│   │   ├── import/          # Importadores (XLSX, OCR)
│   │   ├── inventory/       # Inventario
│   │   ├── layout/          # Layout principal
│   │   ├── menus/           # Menús y recetas
│   │   ├── purchases/       # Compras
│   │   ├── settings/        # Configuración
│   │   └── ui/              # Componentes UI base
│   ├── hooks/               # Custom hooks
│   ├── integrations/        # Integraciones (Supabase)
│   ├── lib/                 # Utilidades
│   ├── pages/               # Páginas/Rutas
│   └── test/                # Tests
├── supabase/
│   ├── config.toml          # Configuración Supabase
│   └── functions/           # Edge Functions
└── temp/                    # Archivos temporales
```

## 🚀 Módulos Principales

1. **Dashboard** - Vista general con KPIs y actividad reciente
2. **Eventos** - Gestión de banquetes, bodas, conferencias
3. **Menús** - Creación y gestión de menús/recetas
4. **Inventario** - Control de stock con lotes y movimientos
5. **Compras** - Órdenes de compra y recepción
6. **Proveedores** - Gestión de proveedores
7. **Productos** - Catálogo de productos
8. **Previsiones** - Forecast de ocupación
9. **Personal** - Gestión de staff y turnos
10. **Tareas** - Tareas de producción

## 📚 Documentación Completa

### Arquitectura y Diseño
- [Arquitectura](./ARCHITECTURE.md) - Estructura del sistema y patrones
- [Base de Datos](./DATABASE.md) - Esquema y relaciones
- [Módulos](./MODULES.md) - Descripción de cada módulo funcional

### Desarrollo
- [API Reference](./API.md) - Endpoints, hooks y tipos
- [Edge Functions](./EDGE_FUNCTIONS.md) - Funciones serverless
- [Migraciones](./MIGRATIONS.md) - Gestión de cambios de BD

### Operaciones
- [Lógica de Negocio](./BUSINESS_LOGIC.md) - Reglas y flujos operativos
- [Despliegue](./DEPLOYMENT.md) - Guía de publicación a producción
- [Seguridad](./SECURITY.md) - Autenticación, RLS y buenas prácticas
- [Troubleshooting](./TROUBLESHOOTING.md) - Resolución de problemas

### Historial
- [Changelog](./CHANGELOG.md) - Historial de versiones

## 🔐 Roles de Usuario

| Rol | Descripción |
|-----|-------------|
| `super_admin` | Acceso total al sistema |
| `admin` | Administrador de hotel |
| `jefe_cocina` | Jefe de cocina - gestión completa |
| `maitre` | Maître - eventos y menús |
| `produccion` | Personal de producción |
| `rrhh` | Recursos humanos |

## 🏨 Multi-tenancy

La aplicación soporta múltiples hoteles:
- Cada usuario pertenece a uno o más hoteles
- Los datos están aislados por `hotel_id`
- El usuario puede cambiar de hotel activo desde configuración

## 🔑 Variables de Entorno

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=xxx
```

## 📦 Dependencias Principales

- `@supabase/supabase-js` - Cliente Supabase
- `@tanstack/react-query` - Estado del servidor
- `react-hook-form` + `zod` - Formularios
- `date-fns` - Manipulación de fechas
- `recharts` - Gráficos
- `xlsx` - Importación Excel
- `lucide-react` - Iconos

## 🛠️ Comandos

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Tests
npm test

# Lint
npm run lint
```
