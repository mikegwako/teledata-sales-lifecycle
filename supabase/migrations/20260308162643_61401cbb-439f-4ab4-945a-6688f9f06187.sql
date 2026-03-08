
-- Comment read receipts for "Seen" indicators
CREATE TABLE public.comment_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.comment_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see reads on accessible comments"
ON public.comment_reads FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can mark comments as read"
ON public.comment_reads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for comment_reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reads;
