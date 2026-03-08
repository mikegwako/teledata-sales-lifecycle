
-- ==========================================
-- 1. Create documents table if not exists
-- ==========================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint DEFAULT 0,
  content_type text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. Fix ALL RLS policies - drop RESTRICTIVE, recreate as PERMISSIVE
-- ==========================================

-- COMMENTS
DROP POLICY IF EXISTS "Users can view comments on their deals" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "View comments on accessible deals" ON comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = comments.deal_id AND (deals.client_id = auth.uid() OR deals.assigned_to = auth.uid()))
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'staff')
);

CREATE POLICY "Insert comments" ON comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete comments admin or owner" ON comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- ACTIVITY LOGS
DROP POLICY IF EXISTS "Admins see all activity" ON activity_logs;
DROP POLICY IF EXISTS "Staff see own activity" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert activity" ON activity_logs;

CREATE POLICY "View activity logs" ON activity_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM deals WHERE deals.id = activity_logs.deal_id AND (deals.client_id = auth.uid() OR deals.assigned_to = auth.uid()))
);

CREATE POLICY "Insert activity logs" ON activity_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- PROFILES - allow all authenticated to read names
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON profiles;

CREATE POLICY "All authenticated read profiles" ON profiles FOR SELECT TO authenticated
USING (true);

-- DEALS
DROP POLICY IF EXISTS "Admins full access deals" ON deals;
DROP POLICY IF EXISTS "Clients see own deals" ON deals;
DROP POLICY IF EXISTS "Clients can create deals" ON deals;
DROP POLICY IF EXISTS "Clients can update own deals" ON deals;
DROP POLICY IF EXISTS "Staff see assigned deals" ON deals;
DROP POLICY IF EXISTS "Staff see unassigned deals" ON deals;
DROP POLICY IF EXISTS "Staff can create deals" ON deals;
DROP POLICY IF EXISTS "Staff update assigned deals" ON deals;
DROP POLICY IF EXISTS "Staff claim unassigned deals" ON deals;

CREATE POLICY "Admin full access" ON deals FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Client see own" ON deals FOR SELECT TO authenticated
USING (auth.uid() = client_id);

CREATE POLICY "Client create" ON deals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Client update own" ON deals FOR UPDATE TO authenticated
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Staff see assigned" ON deals FOR SELECT TO authenticated
USING (auth.uid() = assigned_to);

CREATE POLICY "Staff see unassigned" ON deals FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'staff') AND assigned_to IS NULL);

CREATE POLICY "Staff create" ON deals FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff update assigned" ON deals FOR UPDATE TO authenticated
USING (auth.uid() = assigned_to)
WITH CHECK (auth.uid() = assigned_to);

CREATE POLICY "Staff claim unassigned" ON deals FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'staff') AND assigned_to IS NULL);

-- DOCUMENTS
DROP POLICY IF EXISTS "View documents" ON documents;
DROP POLICY IF EXISTS "Insert documents" ON documents;
DROP POLICY IF EXISTS "Delete documents" ON documents;

CREATE POLICY "View documents for accessible deals" ON documents FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = documents.deal_id AND (deals.client_id = auth.uid() OR deals.assigned_to = auth.uid()))
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Upload documents to accessible deals" ON documents FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (SELECT 1 FROM deals WHERE deals.id = documents.deal_id AND (deals.client_id = auth.uid() OR deals.assigned_to = auth.uid() OR has_role(auth.uid(), 'admin')))
);

CREATE POLICY "Delete documents admin or owner" ON documents FOR DELETE TO authenticated
USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'));

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Authenticated upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documents" ON storage.objects;

CREATE POLICY "Authenticated upload documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated read documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated delete documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- USER ROLES - fix restrictive
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;

CREATE POLICY "Admin manage roles" ON user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "View own role" ON user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);
