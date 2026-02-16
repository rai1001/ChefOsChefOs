-- F4: allow each authenticated user to read only their linked staff profile
-- so personal shift view can resolve staff_id without granting broad staff access.

DROP POLICY IF EXISTS "Staff visible por miembros hotel" ON public.staff;

CREATE POLICY "Staff visible por miembros hotel"
  ON public.staff FOR SELECT
  USING (
    hotel_id = get_user_hotel_id()
    AND (
      has_management_access()
      OR is_rrhh()
      OR user_id = auth.uid()
    )
  );
