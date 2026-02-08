-- Harden invitation acceptance and remove public token-wide access.

DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can accept invitation by token" ON public.invitations;

CREATE POLICY "Invited users can view their pending invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND accepted_at IS NULL
  AND expires_at > now()
);

CREATE POLICY "Invited users can accept their pending invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND accepted_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND accepted_at IS NOT NULL
);

CREATE POLICY "Invited users can join hotel_members"
ON public.hotel_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.invitations i
    WHERE i.hotel_id = hotel_id
      AND lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND i.accepted_at IS NULL
      AND i.expires_at > now()
  )
);

CREATE POLICY "Invited users can claim invited role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.invitations i
    WHERE lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND i.role = role
      AND i.accepted_at IS NULL
      AND i.expires_at > now()
  )
);
