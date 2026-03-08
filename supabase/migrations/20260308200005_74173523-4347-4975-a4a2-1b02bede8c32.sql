
CREATE OR REPLACE FUNCTION public.notify_deal_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  staff_name text;
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
    
    -- Notify client when a staff member is assigned/claims their project
    IF NEW.client_id IS NOT NULL AND NEW.client_id != NEW.assigned_to THEN
      SELECT full_name INTO staff_name FROM public.profiles WHERE id = NEW.assigned_to;
      INSERT INTO public.notifications (user_id, title, message, type, deal_id)
      VALUES (
        NEW.client_id,
        'Staff Assigned to Your Project',
        COALESCE(staff_name, 'A team member') || ' has been assigned to your project "' || NEW.title || '"',
        'assignment',
        NEW.id
      );
    END IF;
  END IF;

  -- Notify admin(s) of stage changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    SELECT ur.user_id, 'Deal Stage Changed', '"' || NEW.title || '" moved from ' || COALESCE(OLD.status, 'New') || ' to ' || NEW.status, 'status_change', NEW.id
    FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.user_id != COALESCE(NEW.client_id, '00000000-0000-0000-0000-000000000000');
  END IF;

  RETURN NEW;
END;
$function$;
