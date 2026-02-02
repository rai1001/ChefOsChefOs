-- Tabla para personal interno (ficha, sin cuenta obligatoria)
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'cocinero',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- opcional, si acepta invitación
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff visible por miembros hotel"
  ON public.staff FOR SELECT
  USING (hotel_id = get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

CREATE POLICY "HR/Admin puede crear staff"
  ON public.staff FOR INSERT
  WITH CHECK (hotel_id = get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

CREATE POLICY "HR/Admin puede actualizar staff"
  ON public.staff FOR UPDATE
  USING (hotel_id = get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

CREATE POLICY "HR/Admin puede eliminar staff"
  ON public.staff FOR DELETE
  USING (hotel_id = get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

-- Trigger updated_at
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Permitir a cualquier usuario autenticado crear un hotel (para su onboarding)
-- pero solo uno si no tiene ninguno
CREATE POLICY "Users can create first hotel"
  ON public.hotels FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    NOT EXISTS (
      SELECT 1 FROM public.hotel_members WHERE user_id = auth.uid()
    )
  );

-- Añadir política para invitaciones: actualizar accepted_at
CREATE POLICY "Anyone can accept invitation by token"
  ON public.invitations FOR UPDATE
  USING (token IS NOT NULL AND accepted_at IS NULL)
  WITH CHECK (token IS NOT NULL);