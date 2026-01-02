-- ============================================================
-- HABILITAR REALTIME PARA TABELAS CRÍTICAS (com verificação)
-- ============================================================

-- Garantir REPLICA IDENTITY FULL para capturar todos os dados
ALTER TABLE public.workspace_members REPLICA IDENTITY FULL;
ALTER TABLE public.notice_reads REPLICA IDENTITY FULL;
ALTER TABLE public.notices REPLICA IDENTITY FULL;
ALTER TABLE public.cards REPLICA IDENTITY FULL;
ALTER TABLE public.checklists REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_invites REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime (ignorar se já existir)
DO $$
DECLARE
  tables_to_add TEXT[] := ARRAY[
    'workspace_members',
    'notice_reads', 
    'notices',
    'cards',
    'checklists',
    'notifications',
    'workspace_invites',
    'transactions',
    'invoices',
    'user_roles'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_to_add
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, skip
      NULL;
    END;
  END LOOP;
END $$;