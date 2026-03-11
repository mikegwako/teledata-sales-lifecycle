
-- 1. Add deleted_by column for soft-delete
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS deleted_by uuid[] NOT NULL DEFAULT '{}';

-- 2. Create security definer function to check participation (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

-- 3. Create soft-delete function
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

-- 4. Drop ALL existing policies on messaging tables
DROP POLICY IF EXISTS "Users see own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users update own conversations" ON public.conversations;

DROP POLICY IF EXISTS "See participants of own conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Add participants to own conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Update own participation" ON public.conversation_participants;

DROP POLICY IF EXISTS "See messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Send messages to own conversations" ON public.messages;

-- 5. Recreate all policies as PERMISSIVE using security definer function

-- conversations
CREATE POLICY "Users see own conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_participant(id, auth.uid())
    AND NOT (auth.uid() = ANY(deleted_by))
  );

CREATE POLICY "Users create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "Users delete own conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- conversation_participants
CREATE POLICY "See participants of own conversations" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Add participants to own conversations" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_participants.conversation_id AND c.created_by = auth.uid()))
    OR (auth.uid() = user_id)
  );

CREATE POLICY "Update own participation" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- messages
CREATE POLICY "See messages in own conversations" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Send messages to own conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- 6. Ensure trigger exists
DROP TRIGGER IF EXISTS on_new_message_update_convo ON public.messages;
CREATE TRIGGER on_new_message_update_convo
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();
