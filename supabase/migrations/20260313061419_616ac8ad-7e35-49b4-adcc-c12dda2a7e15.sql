
-- 1. Allow DELETE on messages for participants (delete for everyone)
CREATE POLICY "Delete messages in own conversations"
ON public.messages
FOR DELETE
TO authenticated
USING (
  (auth.uid() = sender_id) OR is_conversation_participant(conversation_id, auth.uid())
);

-- 2. Add read_by array to messages for read receipts
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by uuid[] NOT NULL DEFAULT '{}';

-- 3. Allow UPDATE on messages (for read_by updates)
CREATE POLICY "Update messages read_by"
ON public.messages
FOR UPDATE
TO authenticated
USING (is_conversation_participant(conversation_id, auth.uid()))
WITH CHECK (is_conversation_participant(conversation_id, auth.uid()));

-- 4. Update soft_delete_conversation to fully delete when all participants have deleted
CREATE OR REPLACE FUNCTION public.soft_delete_conversation(_conversation_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  participant_count int;
  deleted_count int;
BEGIN
  -- Add user to deleted_by
  UPDATE public.conversations
  SET deleted_by = array_append(deleted_by, _user_id)
  WHERE id = _conversation_id
    AND NOT (_user_id = ANY(deleted_by))
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = _conversation_id AND user_id = _user_id
    );

  -- Check if all participants have deleted
  SELECT COUNT(*) INTO participant_count
  FROM public.conversation_participants
  WHERE conversation_id = _conversation_id;

  SELECT array_length(deleted_by, 1) INTO deleted_count
  FROM public.conversations
  WHERE id = _conversation_id;

  -- If all participants deleted, remove everything
  IF deleted_count >= participant_count THEN
    DELETE FROM public.messages WHERE conversation_id = _conversation_id;
    DELETE FROM public.conversation_participants WHERE conversation_id = _conversation_id;
    DELETE FROM public.conversations WHERE id = _conversation_id;
  END IF;
END;
$$;
