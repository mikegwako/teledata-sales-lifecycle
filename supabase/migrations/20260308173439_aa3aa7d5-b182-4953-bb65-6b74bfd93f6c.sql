
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Allow system inserts (via triggers with security definer)
CREATE POLICY "System insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Add unique constraint on comment_reads for upsert
ALTER TABLE public.comment_reads ADD CONSTRAINT comment_reads_unique UNIQUE (comment_id, user_id);

-- Create function to generate notifications on deal status change
CREATE OR REPLACE FUNCTION public.notify_deal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Notify client when their project moves stages
  IF NEW.client_id IS NOT NULL AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    VALUES (
      NEW.client_id,
      'Project Stage Updated',
      'Your project "' || NEW.title || '" has moved to ' || NEW.status,
      'status_change',
      NEW.id
    );
  END IF;

  -- Notify staff when assigned to a deal
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    VALUES (
      NEW.assigned_to,
      'New Deal Assigned',
      'You have been assigned to "' || NEW.title || '"',
      'assignment',
      NEW.id
    );
  END IF;

  -- Notify admin(s) of stage changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    SELECT ur.user_id, 'Deal Stage Changed', '"' || NEW.title || '" moved from ' || COALESCE(OLD.status, 'New') || ' to ' || NEW.status, 'status_change', NEW.id
    FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.user_id != COALESCE(NEW.client_id, '00000000-0000-0000-0000-000000000000');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deal_update_notify
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_deal_status_change();

-- Notify staff about new unassigned deals they can claim
CREATE OR REPLACE FUNCTION public.notify_new_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    SELECT ur.user_id, 'New Deal Available', 'A new project "' || NEW.title || '" is available to claim', 'new_deal', NEW.id
    FROM public.user_roles ur WHERE ur.role = 'staff';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deal_insert_notify
  AFTER INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_deal();
