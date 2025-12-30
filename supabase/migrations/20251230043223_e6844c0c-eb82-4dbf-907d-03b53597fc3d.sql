-- =============================================
-- FLOWALT - ESTRUTURA DE BANCO DE DADOS
-- Fase 1: Fundação (Auth + Workspaces + RBAC + Espaços + Pastas + Cards)
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

-- Roles do sistema
CREATE TYPE public.app_role AS ENUM ('super_admin', 'owner', 'admin', 'coordinator', 'member', 'viewer');

-- Status do workspace
CREATE TYPE public.workspace_status AS ENUM ('active', 'trial', 'suspended', 'inactive');

-- Status do card
CREATE TYPE public.card_status AS ENUM ('backlog', 'briefing', 'todo', 'in_progress', 'review', 'approved', 'delivered', 'archived');

-- Urgência do card
CREATE TYPE public.card_urgency AS ENUM ('low', 'medium', 'high', 'critical');

-- Tipo de espaço (setor)
CREATE TYPE public.space_type AS ENUM ('designer', 'audiovisual', 'social_media', 'traffic', 'administrative', 'coordination', 'custom');

-- =============================================
-- TABELAS PRINCIPAIS
-- =============================================

-- Workspaces (Multi-tenant)
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status workspace_status NOT NULL DEFAULT 'active',
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles de usuário (RBAC) - Tabela separada por segurança
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- Membros do workspace (relação explícita)
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_title TEXT, -- Ex: Designer Sênior, Editor de Vídeo
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Espaços (Setores)
CREATE TABLE public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type space_type NOT NULL DEFAULT 'custom',
  description TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{"require_briefing": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pastas
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT DEFAULT 'folder',
  is_personal BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes/Projetos
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cards (Tarefas) - Núcleo do sistema
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status card_status NOT NULL DEFAULT 'backlog',
  urgency card_urgency NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  briefing_completed BOOLEAN DEFAULT false,
  briefing_data JSONB DEFAULT '{}',
  traffic_briefing_data JSONB DEFAULT NULL,
  estimated_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relação N:N entre Cards e Pastas
CREATE TABLE public.card_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_id, folder_id)
);

-- Membros do Card
CREATE TABLE public.card_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_title TEXT, -- Função específica neste card
  hourly_rate DECIMAL(10,2), -- Custo/hora para este card
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_id, user_id)
);

-- Checklist do Card
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  function_title TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time Entries (Registro de tempo)
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_title TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  is_running BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentários
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anexos
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dependências entre Cards e Checklists
CREATE TABLE public.dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- O item que depende
  dependent_card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  dependent_checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE,
  -- O item que libera
  blocking_card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  blocking_checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_dependent CHECK (dependent_card_id IS NOT NULL OR dependent_checklist_id IS NOT NULL),
  CONSTRAINT at_least_one_blocking CHECK (blocking_card_id IS NOT NULL OR blocking_checklist_id IS NOT NULL)
);

-- Audit Log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_workspace_id ON public.user_roles(workspace_id);
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_spaces_workspace_id ON public.spaces(workspace_id);
CREATE INDEX idx_folders_workspace_id ON public.folders(workspace_id);
CREATE INDEX idx_folders_space_id ON public.folders(space_id);
CREATE INDEX idx_cards_workspace_id ON public.cards(workspace_id);
CREATE INDEX idx_cards_space_id ON public.cards(space_id);
CREATE INDEX idx_cards_status ON public.cards(status);
CREATE INDEX idx_cards_owner_id ON public.cards(owner_id);
CREATE INDEX idx_card_folders_card_id ON public.card_folders(card_id);
CREATE INDEX idx_card_folders_folder_id ON public.card_folders(folder_id);
CREATE INDEX idx_checklists_card_id ON public.checklists(card_id);
CREATE INDEX idx_time_entries_card_id ON public.time_entries(card_id);
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_comments_card_id ON public.comments(card_id);
CREATE INDEX idx_audit_logs_workspace_id ON public.audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- =============================================
-- FUNÇÕES DE SEGURANÇA (SECURITY DEFINER)
-- =============================================

-- Função para verificar se usuário tem uma role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _workspace_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário é membro do workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND is_active = true
  )
$$;

-- Função para verificar se usuário tem permissão de admin ou superior
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role IN ('super_admin', 'owner', 'admin', 'coordinator')
  )
$$;

-- Função para obter o workspace_id de um card
CREATE OR REPLACE FUNCTION public.get_card_workspace(_card_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.cards WHERE id = _card_id
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers de updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON public.checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar profile quando usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS - PROFILES
-- =============================================

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Members can view profiles in same workspace"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      WHERE wm1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm2
        WHERE wm2.user_id = profiles.id
        AND wm2.workspace_id = wm1.workspace_id
      )
    )
  );

-- =============================================
-- POLÍTICAS RLS - WORKSPACES
-- =============================================

CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Owners and admins can update workspace"
  ON public.workspaces FOR UPDATE
  USING (public.has_admin_access(auth.uid(), id));

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- POLÍTICAS RLS - USER_ROLES
-- =============================================

CREATE POLICY "Users can view roles in their workspaces"
  ON public.user_roles FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - WORKSPACE_MEMBERS
-- =============================================

CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Users can insert themselves as members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- POLÍTICAS RLS - SPACES
-- =============================================

CREATE POLICY "Members can view spaces"
  ON public.spaces FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage spaces"
  ON public.spaces FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - FOLDERS
-- =============================================

CREATE POLICY "Members can view folders"
  ON public.folders FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create folders"
  ON public.folders FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update their own folders or admins can update any"
  ON public.folders FOR UPDATE
  USING (
    owner_id = auth.uid() OR 
    public.has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "Admins can delete folders"
  ON public.folders FOR DELETE
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - CLIENTS
-- =============================================

CREATE POLICY "Members can view clients"
  ON public.clients FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage clients"
  ON public.clients FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - CARDS
-- =============================================

CREATE POLICY "Members can view cards"
  ON public.cards FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create cards"
  ON public.cards FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Card members and admins can update cards"
  ON public.cards FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.card_members WHERE card_id = cards.id AND user_id = auth.uid())
    OR owner_id = auth.uid()
    OR public.has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "Admins can delete cards"
  ON public.cards FOR DELETE
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - CARD_FOLDERS
-- =============================================

CREATE POLICY "Members can view card folders"
  ON public.card_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_folders.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Members can manage card folders"
  ON public.card_folders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_folders.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

-- =============================================
-- POLÍTICAS RLS - CARD_MEMBERS
-- =============================================

CREATE POLICY "Members can view card members"
  ON public.card_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_members.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Card owners and admins can manage card members"
  ON public.card_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_members.card_id
      AND (c.owner_id = auth.uid() OR public.has_admin_access(auth.uid(), c.workspace_id))
    )
  );

-- =============================================
-- POLÍTICAS RLS - CHECKLISTS
-- =============================================

CREATE POLICY "Members can view checklists"
  ON public.checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = checklists.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Card members can manage checklists"
  ON public.checklists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      LEFT JOIN public.card_members cm ON cm.card_id = c.id AND cm.user_id = auth.uid()
      WHERE c.id = checklists.card_id
      AND (cm.user_id IS NOT NULL OR c.owner_id = auth.uid() OR public.has_admin_access(auth.uid(), c.workspace_id))
    )
  );

-- =============================================
-- POLÍTICAS RLS - TIME_ENTRIES
-- =============================================

CREATE POLICY "Members can view time entries"
  ON public.time_entries FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can manage their own time entries"
  ON public.time_entries FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all time entries"
  ON public.time_entries FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - COMMENTS
-- =============================================

CREATE POLICY "Members can view comments"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = comments.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Members can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = comments.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments or admins"
  ON public.comments FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = comments.card_id
      AND public.has_admin_access(auth.uid(), c.workspace_id)
    )
  );

-- =============================================
-- POLÍTICAS RLS - ATTACHMENTS
-- =============================================

CREATE POLICY "Members can view attachments"
  ON public.attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = attachments.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Members can create attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = attachments.card_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
    )
  );

CREATE POLICY "Users can delete their own attachments or admins"
  ON public.attachments FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = attachments.card_id
      AND public.has_admin_access(auth.uid(), c.workspace_id)
    )
  );

-- =============================================
-- POLÍTICAS RLS - DEPENDENCIES
-- =============================================

CREATE POLICY "Members can view dependencies"
  ON public.dependencies FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage dependencies"
  ON public.dependencies FOR ALL
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =============================================
-- POLÍTICAS RLS - AUDIT_LOGS
-- =============================================

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));