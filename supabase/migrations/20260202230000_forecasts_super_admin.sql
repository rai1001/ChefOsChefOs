-- Allow super admins full access to forecasts regardless of hotel
CREATE POLICY "Super admins manage forecasts"
ON public.forecasts
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

