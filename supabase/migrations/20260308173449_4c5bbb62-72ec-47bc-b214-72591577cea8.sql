
-- Fix: replace permissive insert policy with a restrictive one
DROP POLICY "System insert notifications" ON public.notifications;

-- Only allow inserts where user_id matches the authenticated user OR via security definer functions
CREATE POLICY "Insert own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
