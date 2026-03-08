DROP POLICY IF EXISTS "View own role" ON public.user_roles;
CREATE POLICY "Authenticated read all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);