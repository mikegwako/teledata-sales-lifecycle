
CREATE OR REPLACE FUNCTION public.get_user_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE has_role(auth.uid(), 'admin'::app_role)
$$;
