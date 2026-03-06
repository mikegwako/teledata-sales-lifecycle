
-- ============================================
-- FIX: Drop all RESTRICTIVE policies and recreate as PERMISSIVE
-- ============================================

-- DEALS policies
DROP POLICY IF EXISTS "Admins full access deals" ON deals;
DROP POLICY IF EXISTS "Clients can create deals" ON deals;
DROP POLICY IF EXISTS "Clients see own deals" ON deals;
DROP POLICY IF EXISTS "Staff can create deals" ON deals;
DROP POLICY IF EXISTS "Staff see assigned deals" ON deals;
DROP POLICY IF EXISTS "Staff update assigned deals" ON deals;

CREATE POLICY "Admins full access deals" ON deals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients see own deals" ON deals FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can create deals" ON deals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own deals" ON deals FOR UPDATE TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Staff see assigned deals" ON deals FOR SELECT TO authenticated
  USING (auth.uid() = assigned_to);

CREATE POLICY "Staff see unassigned deals" ON deals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff') AND assigned_to IS NULL);

CREATE POLICY "Staff can create deals" ON deals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff update assigned deals" ON deals FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = assigned_to);

CREATE POLICY "Staff claim unassigned deals" ON deals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff') AND assigned_to IS NULL);

-- PROFILES policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view all profiles" ON profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- USER_ROLES policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;

CREATE POLICY "Admins can manage all roles" ON user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- ADD new columns to deals
-- ============================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_number serial;

-- ============================================
-- COMMENTS table
-- ============================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on their deals" ON comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = comments.deal_id AND (deals.client_id = auth.uid() OR deals.assigned_to = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Authenticated users can create comments" ON comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ACTIVITY LOGS table
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see all activity" ON activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff see own activity" ON activity_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert activity" ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- DOCUMENTS storage bucket
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admins can delete documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Enable realtime for activity_logs
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
