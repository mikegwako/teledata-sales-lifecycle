
-- Create soft-delete function for conversations
CREATE OR REPLACE FUNCTION public.soft_delete_conversation(_conversation_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversations
  SET deleted_by = array_append(deleted_by, _user_id)
  WHERE id = _conversation_id
    AND NOT (_user_id = ANY(deleted_by))
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = _conversation_id AND user_id = _user_id
    );
END;
$$;
