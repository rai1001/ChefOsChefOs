# Changelog - ChefOS

Historial de cambios y versiones del sistema.

---

## Formato

Cada entrada sigue el formato:

```
## [Versión] - Fecha

### Added (Añadido)
- Nuevas funcionalidades

### Changed (Modificado)
- Cambios en funcionalidades existentes

### Fixed (Corregido)
- Corrección de errores

### Security (Seguridad)
- Mejoras de seguridad

### Deprecated (Obsoleto)
- Funcionalidades que serán eliminadas

### Removed (Eliminado)
- Funcionalidades eliminadas
```

---

## [1.0.0] - 2025-02-02

### Added
- **Sistema base completo**
  - Dashboard con KPIs en tiempo real
  - Gestión de eventos con calendario interactivo
  - Sistema de menús y escandallos
  - Control de inventario con lotes
  - Gestión de compras y proveedores
  - Catálogo de productos
  - Previsiones de ocupación
  - Gestión de personal y turnos
  - Tareas de producción con cronómetro

- **Multi-tenancy**
  - Soporte para múltiples hoteles
  - Aislamiento de datos por hotel_id
  - Cambio de hotel activo

- **Autenticación y roles**
  - Sistema de login/registro
  - 6 roles de usuario
  - RLS en todas las tablas

- **Importación de datos**
  - Importación XLSX de eventos
  - Importación XLSX de previsiones
  - Importación XLSX de productos
  - OCR de menús con IA
  - OCR de albaranes con IA

- **Edge Functions**
  - `ai-assistant`: Chat con IA
  - `parse-menu-image`: OCR de menús
  - `parse-delivery-note`: OCR de albaranes
  - `send-invitation-email`: Invitaciones

- **Sistema de invitaciones**
  - Invitar usuarios por email
  - Asignación de rol en invitación
  - Flujo de aceptación

- **Documentación**
  - README principal
  - Arquitectura del sistema
  - Esquema de base de datos
  - Documentación de módulos
  - Edge Functions
  - Migraciones
  - Lógica de negocio
  - Guía de despliegue
  - Seguridad
  - API Reference
  - Troubleshooting

### Technical Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- TanStack React Query
- React Router v6
- Lovable Cloud (Supabase)
- Lovable AI Gateway

---

## Próximas Versiones

### [1.1.0] - Planificado

#### Planned
- [ ] Notificaciones push
- [ ] Dashboard personalizable
- [ ] Reportes exportables
- [ ] Integración con PMS hotelero
- [ ] App móvil (PWA)

### [1.2.0] - Planificado

#### Planned
- [ ] Predicción de demanda con IA
- [ ] Optimización automática de compras
- [ ] Sistema de alérgenos avanzado
- [ ] Trazabilidad completa APPCC

---

## Convenciones de Versionado

- **MAJOR (X.0.0)**: Cambios incompatibles con versiones anteriores
- **MINOR (0.X.0)**: Nuevas funcionalidades compatibles
- **PATCH (0.0.X)**: Correcciones de errores

---

## Cómo Contribuir

1. Documentar cambios en este archivo
2. Seguir el formato establecido
3. Incluir fecha de la versión
4. Categorizar correctamente los cambios
