-- Staff shift assignments for internal staff records (no auth account required)

CREATE TABLE IF NOT EXISTS public.staff_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  shift_type text CHECK (shift_type IN ('morning', 'afternoon', 'night', 'off')) NOT NULL,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, shift_date)
);

ALTER TABLE public.staff_shift_assignments ENABLE ROW LEVEL SECURITY;

-- Policies (multi-tenant by hotel_id)
DROP POLICY IF EXISTS "Hotel staff can view staff shift assignments" ON public.staff_shift_assignments;
CREATE POLICY "Hotel staff can view staff shift assignments"
ON public.staff_shift_assignments FOR SELECT
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_rrhh()
    OR public.is_produccion()
    OR public.is_super_admin()
  )
);

DROP POLICY IF EXISTS "Hotel HR can create staff shift assignments" ON public.staff_shift_assignments;
CREATE POLICY "Hotel HR can create staff shift assignments"
ON public.staff_shift_assignments FOR INSERT
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
);

DROP POLICY IF EXISTS "Hotel HR can update staff shift assignments" ON public.staff_shift_assignments;
CREATE POLICY "Hotel HR can update staff shift assignments"
ON public.staff_shift_assignments FOR UPDATE
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
)
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
);

DROP POLICY IF EXISTS "Hotel HR can delete staff shift assignments" ON public.staff_shift_assignments;
CREATE POLICY "Hotel HR can delete staff shift assignments"
ON public.staff_shift_assignments FOR DELETE
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_staff_shift_assignments_updated_at ON public.staff_shift_assignments;
CREATE TRIGGER set_staff_shift_assignments_updated_at
BEFORE UPDATE ON public.staff_shift_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

