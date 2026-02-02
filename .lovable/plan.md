

# Plan: Mejoras en Turnos, Previsión y Emails de Invitación

## Resumen
Implementaré tres mejoras solicitadas:
1. **Emails de invitación reales** usando Resend
2. **Indicador de eventos en Turnos** para identificar días con eventos programados
3. **Corrección de texto en Previsión** para evitar que las etiquetas se salgan de las tarjetas

---

## 1. Emails de Invitación con Resend

### Configuración necesaria
- **API Key de Resend**: Necesitarás crear una cuenta en resend.com y obtener una API key
- **Dominio verificado**: Para enviar desde tu propio dominio (opcional, puedes usar el dominio de prueba de Resend)

### Cambios técnicos

**Edge Function: `send-invitation-email`**
- Crear función en `supabase/functions/send-invitation-email/index.ts`
- Recibe: email destinatario, nombre del hotel, token de invitación, rol
- Envía email con enlace de invitación usando Resend
- Diseño responsive (móvil-first) para que se vea bien en cualquier dispositivo

**Modificar `useSuperAdmin.ts` y `useHotel.ts`**
- Tras crear invitación en BD, llamar a la edge function para enviar email
- Incluir URL completa con token: `{dominio}/accept-invitation?token={token}`

**Actualizar `supabase/config.toml`**
- Añadir configuración de la nueva función

---

## 2. Indicador de Eventos en Turnos

### Comportamiento
- Cada día en la cuadrícula de turnos mostrará un pequeño punto/badge si hay eventos programados
- Al pasar el cursor, tooltip mostrará cuántos eventos hay y sus nombres
- Ayuda a saber qué personal está disponible en días de eventos

### Cambios técnicos

**Modificar `src/pages/Shifts.tsx`**
- Importar hook `useEvents` para obtener eventos del mes actual
- Crear mapa de fechas con eventos: `Map<string, Event[]>`
- En cada celda del encabezado de día, añadir indicador visual si existe evento
- Usar icono pequeño (punto naranja o badge con número)

```
Ejemplo visual:
   L     M     M     J     V
   3     4     5●    6     7
              (evento)
```

---

## 3. Corrección de Texto en Previsión

### Problema
En la captura se ve que "HUÉSPEDES" y "PREVISTOS" se salen de las tarjetas en pantallas pequeñas.

### Solución

**Modificar `src/components/forecast/ForecastCard.tsx`**
- Cambiar layout de `grid-cols-2` a diseño vertical en móvil
- Reducir tamaño de etiquetas de `text-[10px]` a `text-[9px]`
- Usar `truncate` para evitar desbordamiento
- Aplicar `whitespace-nowrap` y `overflow-hidden`
- Aumentar ancho mínimo del contenedor si es necesario

**Modificar `src/pages/Forecast.tsx`**
- Ajustar grid responsive para que las tarjetas tengan ancho mínimo adecuado
- Cambiar de `xl:grid-cols-7` a máximo 5-6 columnas para dar más espacio

---

## Orden de Implementación

1. **Primero**: Corrección de texto en Previsión (cambio visual rápido)
2. **Segundo**: Indicador de eventos en Turnos (requiere integración con datos)
3. **Tercero**: Edge function de emails (requiere API key de Resend)

---

## Dependencias Externas

Para los emails necesitarás:
1. Crear cuenta en https://resend.com (gratis hasta 100 emails/día)
2. Obtener API key en https://resend.com/api-keys
3. (Opcional) Verificar dominio en https://resend.com/domains para enviar desde tu email corporativo

