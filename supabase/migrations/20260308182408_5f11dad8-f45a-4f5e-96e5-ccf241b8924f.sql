
-- Allow users to delete their own notifications
CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own activity logs
CREATE POLICY "Users delete own activity logs"
ON public.activity_logs FOR DELETE
USING (auth.uid() = user_id);

-- Admin can also delete any activity logs
CREATE POLICY "Admin delete any activity logs"
ON public.activity_logs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add auto-delete preference to profiles (null = disabled, number = days)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_delete_days integer DEFAULT NULL;
