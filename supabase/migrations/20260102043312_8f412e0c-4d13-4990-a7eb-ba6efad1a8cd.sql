-- ═══════════════════════════════════════════════════════════
-- NOTICES MODULE - Complete Tables
-- ═══════════════════════════════════════════════════════════

-- 1) NOTICES TABLE
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'urgent', 'celebration', 'holiday', 'birthday', 'maintenance', 'policy')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'closed', 'archived')),
  requires_confirmation boolean DEFAULT false,
  target_roles text[] DEFAULT ARRAY['member', 'coordinator', 'admin', 'owner']::text[],
  target_spaces uuid[] DEFAULT NULL,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  auto_generated boolean DEFAULT false,
  source_type text CHECK (source_type IN ('manual', 'calendar_event', 'birthday', 'system')),
  source_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) NOTICE READS
CREATE TABLE public.notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  ip_address inet,
  user_agent text,
  UNIQUE(notice_id, user_id)
);

-- 3) BASE CALENDAR EVENTS
CREATE TABLE public.base_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  recurrence text DEFAULT 'yearly' CHECK (recurrence IN ('none', 'yearly', 'monthly')),
  category text DEFAULT 'holiday' CHECK (category IN ('holiday', 'celebration', 'important_date', 'custom')),
  is_national boolean DEFAULT false,
  generate_notice boolean DEFAULT true,
  notice_days_before int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) USER BIRTHDAYS (LGPD Compliant)
CREATE TABLE public.user_birthdays (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  birth_date date NOT NULL,
  visibility text NOT NULL DEFAULT 'team' CHECK (visibility IN ('public', 'team', 'private')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_notices_workspace_status ON public.notices(workspace_id, status);
CREATE INDEX idx_notices_dates ON public.notices(starts_at, ends_at);
CREATE INDEX idx_notice_reads_notice ON public.notice_reads(notice_id);
CREATE INDEX idx_notice_reads_user ON public.notice_reads(user_id);
CREATE INDEX idx_base_calendar_workspace ON public.base_calendar_events(workspace_id, event_date);
CREATE INDEX idx_user_birthdays_workspace ON public.user_birthdays(workspace_id);
CREATE INDEX idx_user_birthdays_date ON public.user_birthdays(birth_date);

-- TRIGGERS
CREATE TRIGGER update_notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_base_calendar_events_updated_at
  BEFORE UPDATE ON public.base_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_birthdays_updated_at
  BEFORE UPDATE ON public.user_birthdays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS ENABLE
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_birthdays ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: NOTICES
CREATE POLICY "notices_select_member" ON public.notices FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id) AND status IN ('active', 'closed'));

CREATE POLICY "notices_insert_admin" ON public.notices FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = notices.workspace_id AND ur.role IN ('admin', 'owner')
  ));

CREATE POLICY "notices_update_admin" ON public.notices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = notices.workspace_id AND ur.role IN ('admin', 'owner')
  ));

CREATE POLICY "notices_delete_admin" ON public.notices FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = notices.workspace_id AND ur.role IN ('admin', 'owner')
  ));

-- RLS POLICIES: NOTICE READS
CREATE POLICY "notice_reads_own" ON public.notice_reads FOR ALL USING (user_id = auth.uid());

-- RLS POLICIES: BASE CALENDAR EVENTS
CREATE POLICY "base_calendar_select_member" ON public.base_calendar_events FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "base_calendar_insert_admin" ON public.base_calendar_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = base_calendar_events.workspace_id AND ur.role IN ('admin', 'owner')
  ));

CREATE POLICY "base_calendar_update_admin" ON public.base_calendar_events FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = base_calendar_events.workspace_id AND ur.role IN ('admin', 'owner')
  ));

CREATE POLICY "base_calendar_delete_admin" ON public.base_calendar_events FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = base_calendar_events.workspace_id AND ur.role IN ('admin', 'owner')
  ));

-- RLS POLICIES: USER BIRTHDAYS
CREATE POLICY "birthdays_select" ON public.user_birthdays FOR SELECT
  USING (
    user_id = auth.uid()
    OR (is_workspace_member(auth.uid(), workspace_id) AND visibility = 'public')
    OR (is_workspace_member(auth.uid(), workspace_id) AND EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = user_birthdays.workspace_id AND ur.role IN ('admin', 'owner')
    ))
  );

CREATE POLICY "birthdays_insert_own" ON public.user_birthdays FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "birthdays_update_own" ON public.user_birthdays FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "birthdays_delete_own" ON public.user_birthdays FOR DELETE
  USING (user_id = auth.uid());