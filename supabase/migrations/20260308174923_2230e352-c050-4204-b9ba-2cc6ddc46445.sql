
-- Add location columns to login_audit_logs
ALTER TABLE public.login_audit_logs ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.login_audit_logs ADD COLUMN IF NOT EXISTS country text;

-- Trigger: notify staff/admin when a document is uploaded
CREATE OR REPLACE FUNCTION public.notify_document_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deal_record RECORD;
  uploader_name text;
BEGIN
  SELECT * INTO deal_record FROM public.deals WHERE id = NEW.deal_id;
  SELECT full_name INTO uploader_name FROM public.profiles WHERE id = NEW.uploaded_by;

  -- Notify assigned staff if uploader is not the staff
  IF deal_record.assigned_to IS NOT NULL AND deal_record.assigned_to != NEW.uploaded_by THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    VALUES (deal_record.assigned_to, 'New Document Uploaded', COALESCE(uploader_name, 'Someone') || ' uploaded "' || NEW.file_name || '" to "' || deal_record.title || '"', 'info', NEW.deal_id);
  END IF;

  -- Notify admin(s)
  INSERT INTO public.notifications (user_id, title, message, type, deal_id)
  SELECT ur.user_id, 'New Document Uploaded', COALESCE(uploader_name, 'Someone') || ' uploaded "' || NEW.file_name || '" to "' || deal_record.title || '"', 'info', NEW.deal_id
  FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.user_id != NEW.uploaded_by;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_document_upload
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_document_upload();

-- Trigger: notify staff/admin/client when a comment is posted
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deal_record RECORD;
  commenter_name text;
  target_user uuid;
BEGIN
  SELECT * INTO deal_record FROM public.deals WHERE id = NEW.deal_id;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;

  -- Notify assigned staff if commenter is not the staff
  IF deal_record.assigned_to IS NOT NULL AND deal_record.assigned_to != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    VALUES (deal_record.assigned_to, 'New Comment', COALESCE(commenter_name, 'Someone') || ' commented on "' || deal_record.title || '"', 'info', NEW.deal_id);
  END IF;

  -- Notify client if commenter is not the client
  IF deal_record.client_id IS NOT NULL AND deal_record.client_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, deal_id)
    VALUES (deal_record.client_id, 'New Comment', COALESCE(commenter_name, 'Someone') || ' commented on "' || deal_record.title || '"', 'info', NEW.deal_id);
  END IF;

  -- Notify admin(s)
  INSERT INTO public.notifications (user_id, title, message, type, deal_id)
  SELECT ur.user_id, 'New Comment', COALESCE(commenter_name, 'Someone') || ' commented on "' || deal_record.title || '"', 'info', NEW.deal_id
  FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.user_id != NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();
