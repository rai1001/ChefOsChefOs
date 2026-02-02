-- Create function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin');
$$;

-- Allow super_admins to create hotels
CREATE POLICY "Super admins can create hotels"
ON public.hotels
FOR INSERT
WITH CHECK (is_super_admin());

-- Allow super_admins to view all hotels
CREATE POLICY "Super admins can view all hotels"
ON public.hotels
FOR SELECT
USING (is_super_admin());

-- Allow super_admins to update any hotel
CREATE POLICY "Super admins can update any hotel"
ON public.hotels
FOR UPDATE
USING (is_super_admin());

-- Allow super_admins to delete hotels
CREATE POLICY "Super admins can delete hotels"
ON public.hotels
FOR DELETE
USING (is_super_admin());

-- Allow super_admins to manage all hotel members
CREATE POLICY "Super admins can manage all members"
ON public.hotel_members
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Allow super_admins to view all invitations
CREATE POLICY "Super admins can view all invitations"
ON public.invitations
FOR SELECT
USING (is_super_admin());

-- Allow super_admins to create invitations for any hotel
CREATE POLICY "Super admins can create any invitation"
ON public.invitations
FOR INSERT
WITH CHECK (is_super_admin());

-- Allow super_admins to delete any invitation
CREATE POLICY "Super admins can delete any invitation"
ON public.invitations
FOR DELETE
USING (is_super_admin());

-- Allow super_admins to manage all user roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());