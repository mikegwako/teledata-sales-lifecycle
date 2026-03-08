
-- Login audit log table
CREATE TABLE public.login_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  login_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view all audit logs
CREATE POLICY "Admin view all audit logs" ON public.login_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own login history
CREATE POLICY "Users view own audit logs" ON public.login_audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Insert policy for authenticated users (logging their own login)
CREATE POLICY "Users insert own audit log" ON public.login_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Tax presets table with multi-region support
CREATE TABLE public.tax_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_name text NOT NULL,
  country_code text NOT NULL,
  taxes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_presets ENABLE ROW LEVEL SECURITY;

-- Everyone can read tax presets
CREATE POLICY "All authenticated read tax presets" ON public.tax_presets
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage presets
CREATE POLICY "Admin manage tax presets" ON public.tax_presets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed some common presets
INSERT INTO public.tax_presets (region_name, country_code, taxes, is_default) VALUES
  ('Ghana', 'GH', '[{"name": "VAT", "rate": 15}, {"name": "NHIL", "rate": 2.5}, {"name": "GETFund", "rate": 2.5}, {"name": "COVID-19 Levy", "rate": 1}]'::jsonb, true),
  ('Nigeria', 'NG', '[{"name": "VAT", "rate": 7.5}]'::jsonb, false),
  ('Kenya', 'KE', '[{"name": "VAT", "rate": 16}]'::jsonb, false),
  ('South Africa', 'ZA', '[{"name": "VAT", "rate": 15}]'::jsonb, false),
  ('United Kingdom', 'GB', '[{"name": "VAT", "rate": 20}]'::jsonb, false),
  ('United States', 'US', '[{"name": "Sales Tax (avg)", "rate": 8}]'::jsonb, false);
